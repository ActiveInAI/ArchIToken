"""ArchIToken local generation provider HTTP service.

This service is the development HTTP adapter behind Harness Core generation.
It does not synthesize fake media: image/video requests require a configured
Hugging Face endpoint/model or an OpenClaw image/video provider.
"""

from __future__ import annotations

import base64
import functools
import json
import mimetypes
import os
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse

from architoken_workers.huggingface_generation_registry import (
    HuggingFaceRouteRegistry,
    normalize_task_type,
)


GENERATED_DIR = Path(os.environ.get("ARCHITOKEN_GENERATION_OUTPUT_DIR", ".generated")).resolve()
DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("ARCHITOKEN_PROVIDER_TIMEOUT_SECONDS", "900"))

app = FastAPI(title="ArchIToken Generation Provider", version="0.2.0")


@dataclass(frozen=True)
class ProviderResult:
    engine: str
    model: str
    media_type: str
    content: bytes
    filename: str
    summary: str
    metadata: dict[str, Any]




@dataclass(frozen=True)
class ChatProviderResult:
    engine: str
    model: str
    content: str
    usage: dict[str, Any]
    metadata: dict[str, Any]


class ProviderConfigurationError(RuntimeError):
    """Raised when no real provider route is configured."""


class ProviderExecutionError(RuntimeError):
    """Raised when a configured provider fails."""


@app.get("/v1/models")
def list_models() -> dict[str, Any]:
    hf_registry = HuggingFaceRouteRegistry()
    hf_token = bool(_huggingface_token())
    route_models = [_model_payload(route) for route in hf_registry.all_routes(has_token=hf_token)]
    repository_models = _list_huggingface_repository_models(hf_registry)
    repository_payloads = _repository_model_payloads(repository_models)
    route_model_ids = {model["id"] for model in route_models}
    data = [
        model for model in repository_payloads if model["id"] not in route_model_ids
    ] + route_models
    return {
        "object": "list",
        "data": data,
        "models": [model["id"] for model in data],
        "repositoryModels": repository_models,
        "repositoryModelIds": [model["id"] for model in repository_models],
    }


def _list_huggingface_repository_models(hf_registry: HuggingFaceRouteRegistry) -> list[dict[str, Any]]:
    task_by_model = {
        route.model: route.task_type
        for route in hf_registry.all_routes(has_token=bool(_huggingface_token()))
        if route.model
    }
    roots: list[Path] = []
    if _env("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR"):
        roots.append(Path(_env("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR") or ""))
    if _env("ARCHITOKEN_MODEL_REPOSITORY_DIR"):
        roots.append(Path(_env("ARCHITOKEN_MODEL_REPOSITORY_DIR") or "") / "huggingface")
    roots.append(Path(__file__).resolve().parents[1] / "data" / "model-repository" / "huggingface")

    discovered: dict[str, dict[str, Any]] = {}
    for root in roots:
        if not root.exists():
            continue
        for owner_dir in root.iterdir():
            if not owner_dir.is_dir():
                continue
            for model_dir in owner_dir.iterdir():
                if not model_dir.is_dir() or not _looks_like_huggingface_model_repository(model_dir):
                    continue
                model_id = f"{owner_dir.name}/{model_dir.name}"
                discovered.setdefault(
                    model_id,
                    {
                        "id": model_id,
                        "provider": "huggingface",
                        "localRepository": str(model_dir),
                        "routedTaskType": task_by_model.get(model_id),
                    },
                )
    return [discovered[model_id] for model_id in sorted(discovered)]


def _repository_model_payloads(repository_models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_repository_model_payload(model) for model in repository_models]


def _repository_model_payload(model: dict[str, Any]) -> dict[str, Any]:
    model_id = str(model.get("id") or "")
    inferred = _infer_repository_model_task(model_id, model.get("routedTaskType"))
    return {
        "id": model_id,
        "object": "model",
        "provider": "huggingface",
        "taskType": inferred["taskType"],
        "capability": inferred["capability"],
        "capabilities": [inferred["taskType"], inferred["capability"]],
        "configured": bool(model.get("localRepository")),
        "missing": [],
        "modelEnv": inferred["modelEnv"],
        "urlEnv": inferred["urlEnv"],
        "endpoint": None,
        "localRepository": model.get("localRepository"),
        "providerPreference": "local_huggingface_first",
        "routedTaskType": model.get("routedTaskType"),
        "repositoryOnly": model.get("routedTaskType") is None,
    }


def _infer_repository_model_task(model_id: str, routed_task_type: Any) -> dict[str, str]:
    normalized_route = normalize_task_type(str(routed_task_type or "")) if routed_task_type else None
    if normalized_route and normalized_route != "chat":
        return _task_descriptor(normalized_route)

    lowered = model_id.lower()
    if "industrialcoder" in lowered:
        return _task_descriptor("code")
    if "paddleocr" in lowered:
        return _task_descriptor("ocr")
    if "ernie-image" in lowered:
        return _task_descriptor("text_to_image")
    if "flux" in lowered:
        return _task_descriptor("image_to_image")
    if "ltx" in lowered:
        return _task_descriptor("image_to_video")
    if "hy-world" in lowered:
        return _task_descriptor("image_to_3d")
    if "asset-harvester" in lowered:
        return _task_descriptor("object_to_3d_asset")
    if "lyra" in lowered:
        return _task_descriptor("world_3d_research")
    if "c-radiov2" in lowered:
        return {
            "taskType": "vision_embedding",
            "capability": "vision.embedding",
            "modelEnv": "ARCHITOKEN_HF_VISION_EMBEDDING_MODEL",
            "urlEnv": "ARCHITOKEN_HF_VISION_EMBEDDING_URL",
        }
    return _task_descriptor("chat")


def _task_descriptor(task_type: str) -> dict[str, str]:
    descriptors: dict[str, dict[str, str]] = {
        "chat": {
            "taskType": "chat",
            "capability": "model.chat",
            "modelEnv": "ARCHITOKEN_HF_CHAT_MODEL",
            "urlEnv": "ARCHITOKEN_HF_CHAT_URL",
        },
        "code": {
            "taskType": "code",
            "capability": "model.code",
            "modelEnv": "ARCHITOKEN_HF_CODE_MODEL",
            "urlEnv": "ARCHITOKEN_HF_CODE_URL",
        },
        "ocr": {
            "taskType": "ocr",
            "capability": "document.ocr",
            "modelEnv": "ARCHITOKEN_HF_OCR_MODEL",
            "urlEnv": "ARCHITOKEN_HF_OCR_URL",
        },
        "text_to_image": {
            "taskType": "text_to_image",
            "capability": "image.generate",
            "modelEnv": "ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL",
            "urlEnv": "ARCHITOKEN_HF_TEXT_TO_IMAGE_URL",
        },
        "image_to_image": {
            "taskType": "image_to_image",
            "capability": "image.transform",
            "modelEnv": "ARCHITOKEN_HF_IMAGE_TO_IMAGE_MODEL",
            "urlEnv": "ARCHITOKEN_HF_IMAGE_TO_IMAGE_URL",
        },
        "image_to_video": {
            "taskType": "image_to_video",
            "capability": "video.image_to_video",
            "modelEnv": "ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL",
            "urlEnv": "ARCHITOKEN_HF_IMAGE_TO_VIDEO_URL",
        },
        "image_to_3d": {
            "taskType": "image_to_3d",
            "capability": "world.image_to_3d",
            "modelEnv": "ARCHITOKEN_HF_IMAGE_TO_3D_MODEL",
            "urlEnv": "ARCHITOKEN_HF_IMAGE_TO_3D_URL",
        },
        "object_to_3d_asset": {
            "taskType": "object_to_3d_asset",
            "capability": "asset.object_to_3d",
            "modelEnv": "ARCHITOKEN_HF_OBJECT_TO_3D_ASSET_MODEL",
            "urlEnv": "ARCHITOKEN_HF_OBJECT_TO_3D_ASSET_URL",
        },
        "world_3d_research": {
            "taskType": "world_3d_research",
            "capability": "world.research_3d",
            "modelEnv": "ARCHITOKEN_HF_WORLD_3D_RESEARCH_MODEL",
            "urlEnv": "ARCHITOKEN_HF_WORLD_3D_RESEARCH_URL",
        },
    }
    return descriptors.get(task_type, descriptors["chat"])


def _looks_like_huggingface_model_repository(path: Path) -> bool:
    return (
        (path / "config.json").exists()
        or (path / "model_index.json").exists()
        or (path / "tokenizer.json").exists()
        or (path / "README.md").exists()
    )

@app.post("/v1/generate/text-to-bim")
def generate_text_to_bim() -> None:
    raise HTTPException(
        status_code=503,
        detail={
            "code": "adapter_not_configured",
            "message": (
                "TextToBim is not implemented by this media provider. "
                "Configure ARCHITOKEN_TEXT_TO_BIM_PROVIDER_URL or use the dedicated BIM engine."
            ),
        },
    )


@app.post("/v1/generate/text-to-image")
def generate_text_to_image(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    prompt = _required_prompt(payload)
    try:
        result = _generate_text_to_image(prompt, payload)
    except ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "adapter_not_configured", "message": str(exc)},
        ) from exc
    except ProviderExecutionError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "provider_execution_failed", "message": str(exc)},
        ) from exc

    return _media_response(payload, request, result, kind="image")


@app.post("/v1/generate/image-to-video")
def generate_image_to_video(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    prompt = _required_prompt(payload)
    try:
        result = _generate_image_to_video(prompt, payload)
    except ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "adapter_not_configured", "message": str(exc)},
        ) from exc
    except ProviderExecutionError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "provider_execution_failed", "message": str(exc)},
        ) from exc

    return _media_response(payload, request, result, kind="video")


@app.post("/v1/chat/completions")
def chat_completions(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        result = _generate_chat_completion(payload)
    except ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "adapter_not_configured", "message": str(exc)},
        ) from exc
    except ProviderExecutionError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "provider_execution_failed", "message": str(exc)},
        ) from exc

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": result.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result.content},
                "finish_reason": "stop",
            }
        ],
        "usage": result.usage,
        "metadata": result.metadata,
    }


@app.get("/download/{filename}")
def download_generated_file(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    path = GENERATED_DIR / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="generated file not found")
    return FileResponse(path)


def _generate_text_to_image(prompt: str, payload: dict[str, Any]) -> ProviderResult:
    provider = _selected_provider("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER")
    if provider == "openclaw":
        return _run_openclaw_media(prompt, payload, media_kind="image")
    if provider == "huggingface":
        return _run_huggingface_media(prompt, payload, media_kind="image")
    raise ProviderConfigurationError(
        "TextToImage requires ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER=huggingface|openclaw."
    )


def _generate_image_to_video(prompt: str, payload: dict[str, Any]) -> ProviderResult:
    provider = _selected_provider("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER")
    if provider == "openclaw":
        return _run_openclaw_media(prompt, payload, media_kind="video")
    if provider == "huggingface":
        return _run_huggingface_media(prompt, payload, media_kind="video")
    raise ProviderConfigurationError(
        "ImageToVideo requires ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER=huggingface|openclaw."
    )


def _generate_chat_completion(payload: dict[str, Any]) -> ChatProviderResult:
    token = _huggingface_token()
    route = HuggingFaceRouteRegistry().route_for_task("chat", has_token=bool(token))
    messages = _chat_messages(payload)
    endpoint_url = _huggingface_chat_endpoint(route.endpoint_url)
    if not endpoint_url:
        raise ProviderConfigurationError(
            "Chat requires a real local Hugging Face/vLLM endpoint. Configure "
            "ARCHITOKEN_HF_LOCAL_CHAT_URL or ARCHITOKEN_VLLM_BASE_URL. "
            "Nemotron NVFP4 should be served by vLLM/TensorRT; direct Transformers loading is not used as a fake fallback."
        )
    return _run_huggingface_chat_http(messages, payload, route=route, endpoint_url=endpoint_url)


def _run_huggingface_chat_http(
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    *,
    route: Any,
    endpoint_url: str,
) -> ChatProviderResult:
    model = str(payload.get("model") or route.model or "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4")
    body: dict[str, Any] = {
        "model": model,
        "stream": False,
        "temperature": _number_payload(payload, "temperature", 0.2),
        "max_tokens": int(_number_payload(payload, "max_tokens", _number_payload(payload, "maxTokens", 768))),
        "messages": messages,
    }
    if _is_nemotron_model(model):
        body.setdefault("top_k", 1)
        body.setdefault("chat_template_kwargs", {"enable_thinking": False})
    extra_body = payload.get("extra_body") or payload.get("extraBody")
    if isinstance(extra_body, dict):
        body.update(extra_body)

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    token = _huggingface_token()
    if token and not _is_local_http_url(endpoint_url):
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(
        endpoint_url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=int(payload.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS)) as response:
            response_body = response.read()
            media_type = _clean_content_type(response.headers.get("Content-Type") or "application/json")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise ProviderExecutionError(f"Hugging Face chat adapter returned HTTP {exc.code}: {_trim(error_body)}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExecutionError(f"Hugging Face chat adapter request failed: {exc.reason}") from exc

    try:
        decoded = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ProviderExecutionError(f"Hugging Face chat adapter returned {media_type}, expected application/json") from exc
    if isinstance(decoded, dict) and decoded.get("error"):
        raise ProviderExecutionError(_trim(str(decoded["error"])))

    content = _extract_chat_content(decoded)
    if not content:
        raise ProviderExecutionError("Hugging Face chat adapter returned no assistant content")
    if _looks_like_provider_sentinel(content):
        raise ProviderExecutionError(f"Hugging Face chat adapter returned a non-business sentinel: {_trim(content)}")

    return ChatProviderResult(
        engine="huggingface-local-chat-http",
        model=str(decoded.get("model") or model) if isinstance(decoded, dict) else model,
        content=content,
        usage=decoded.get("usage", {}) if isinstance(decoded, dict) and isinstance(decoded.get("usage"), dict) else {},
        metadata={
            "provider": "huggingface",
            "providerMode": "local_chat_http",
            "taskType": route.task_type,
            "capability": route.capability,
            "endpoint": _redacted_hf_url(endpoint_url),
            "localRepository": _huggingface_model_repository_path(route.model),
            "router": "OpenClawRouter -> ModelRouter -> InferenceRouter -> Hugging Face local/vLLM provider",
        },
    )


def _chat_messages(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_messages = payload.get("messages")
    if not isinstance(raw_messages, list):
        raise ProviderConfigurationError("chat payload.messages must be a non-empty OpenAI-compatible message list")
    messages: list[dict[str, Any]] = []
    for message in raw_messages:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        if role not in {"system", "user", "assistant", "tool"}:
            continue
        content = _chat_content(message.get("content"))
        if content is None:
            continue
        messages.append({"role": role, "content": content})
    if not messages or not any(message["role"] == "user" for message in messages):
        raise ProviderConfigurationError("chat payload.messages must include at least one user message")
    return messages


def _chat_content(content: Any) -> str | list[Any] | None:
    if isinstance(content, str):
        stripped = content.strip()
        return stripped if stripped else None
    if isinstance(content, list) and content:
        return content
    if content is None:
        return None
    return json.dumps(content, ensure_ascii=False)


def _extract_chat_content(payload: Any) -> str:
    if isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    return _content_to_text(message.get("content"))
                return _content_to_text(first.get("text"))
        return _content_to_text(payload.get("output_text") or payload.get("content"))
    return ""


def _content_to_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(part.strip() for part in parts if part.strip()).strip()
    return ""


def _huggingface_chat_endpoint(route_endpoint_url: str | None) -> str | None:
    for name in (
        "ARCHITOKEN_HF_LOCAL_CHAT_URL",
        "HUGGINGFACE_LOCAL_CHAT_URL",
        "ARCHITOKEN_HF_CHAT_URL",
        "HUGGINGFACE_CHAT_URL",
        "ARCHITOKEN_VLLM_BASE_URL",
        "VLLM_BASE_URL",
    ):
        value = _env(name)
        if value:
            return _chat_completion_url(value)
    if route_endpoint_url and _is_local_http_url(route_endpoint_url):
        return _chat_completion_url(route_endpoint_url)
    return _chat_completion_url("http://127.0.0.1:8000")


def _chat_completion_url(value: str) -> str:
    from urllib.parse import urlsplit, urlunsplit

    parsed = urlsplit(value)
    path = parsed.path.rstrip("/")
    if path.endswith("/v1/chat/completions") or path.endswith("/chat/completions"):
        return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
    base_path = path.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, f"{base_path}/v1/chat/completions", "", ""))


def _number_payload(payload: dict[str, Any], name: str, fallback: float) -> float:
    value = payload.get(name)
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _is_nemotron_model(model: str) -> bool:
    return "nemotron" in model.lower()


def _looks_like_provider_sentinel(content: str) -> bool:
    stripped = content.strip()
    return stripped in {"HEARTBEAT_OK", "OPENCLAW_MODEL_OK", "OK"}


def _run_openclaw_media(prompt: str, payload: dict[str, Any], *, media_kind: str) -> ProviderResult:
    model_env = "OPENCLAW_IMAGE_MODEL" if media_kind == "image" else "OPENCLAW_VIDEO_MODEL"
    model = _env(model_env)
    if not model:
        raise ProviderConfigurationError(f"{model_env} is required for OpenClaw {media_kind} generation.")

    suffix = ".png" if media_kind == "image" else ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        output_path = Path(tmp.name)

    command = [
        _env("OPENCLAW_CLI_PATH") or "openclaw",
        "infer",
        media_kind,
        "generate",
        "--prompt",
        prompt,
        "--model",
        model,
        "--output",
        str(output_path),
        "--json",
    ]
    result = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=int(payload.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS),
    )
    if result.returncode != 0:
        output_path.unlink(missing_ok=True)
        raise ProviderExecutionError(_trim(result.stderr or result.stdout or "OpenClaw infer failed"))
    if not output_path.exists() or output_path.stat().st_size == 0:
        output_path.unlink(missing_ok=True)
        raise ProviderExecutionError("OpenClaw infer completed without a media artifact")

    content = output_path.read_bytes()
    output_path.unlink(missing_ok=True)
    return ProviderResult(
        engine="openclaw-infer",
        model=model,
        media_type="image/png" if media_kind == "image" else "video/mp4",
        content=content,
        filename=f"openclaw-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary=f"OpenClaw {media_kind} provider returned a real artifact.",
        metadata={"provider": "openclaw", "stdout": _trim(result.stdout)},
    )


def _run_huggingface_media(prompt: str, payload: dict[str, Any], *, media_kind: str) -> ProviderResult:
    token = _huggingface_token()
    hf_registry = HuggingFaceRouteRegistry()
    task_type = "text_to_image" if media_kind == "image" else "image_to_video"
    route = hf_registry.route_for_task(task_type, has_token=bool(token))

    local_result = _run_huggingface_local_media_if_configured(prompt, payload, media_kind=media_kind, route=route)
    if local_result is not None:
        return local_result

    if not _huggingface_remote_enabled():
        local_model = _local_huggingface_model_path(route.model)
        repository_hint = f" 已发现本地模型仓库 {local_model}，但缺少可执行的本地 HF media runtime。" if local_model else ""
        raise ProviderConfigurationError(
            "Hugging Face media 默认只走本地 adapter。请配置 "
            f"{_task_local_url_env(task_type)[0]} 或 {_task_local_command_env(task_type)[0]}，"
            "或显式设置 ARCHITOKEN_HF_REMOTE_ENABLED=1 才允许调用远端 Hugging Face Inference API。"
            + repository_hint
        )

    return _run_huggingface_remote_media(prompt, payload, media_kind=media_kind, route=route)


def _run_huggingface_local_media_if_configured(
    prompt: str,
    payload: dict[str, Any],
    *,
    media_kind: str,
    route: Any,
) -> ProviderResult | None:
    task_type = route.task_type
    endpoint_url = _huggingface_local_endpoint(task_type, route.endpoint_url)
    if endpoint_url:
        return _run_huggingface_local_http(prompt, payload, media_kind=media_kind, route=route, endpoint_url=endpoint_url)

    in_process = _run_huggingface_in_process_media_if_available(
        prompt,
        payload,
        media_kind=media_kind,
        route=route,
    )
    if in_process is not None:
        return in_process

    command = _huggingface_local_command(task_type, route.model)
    if command:
        return _run_huggingface_local_command(prompt, payload, media_kind=media_kind, route=route, command=command)

    return None



def _run_huggingface_in_process_media_if_available(
    prompt: str,
    payload: dict[str, Any],
    *,
    media_kind: str,
    route: Any,
) -> ProviderResult | None:
    if media_kind != "image" or normalize_task_type(route.task_type) != "text_to_image":
        return None

    try:
        import importlib.util

        if importlib.util.find_spec("torch") is None or importlib.util.find_spec("diffusers") is None:
            return None
        from architoken_workers.hf_media_command import _run_text_to_image
    except Exception:
        return None

    suffix = ".png"
    with tempfile.TemporaryDirectory(prefix="architoken-hf-inproc-") as tmpdir:
        output_path = Path(tmpdir) / f"output{suffix}"
        request_body = _huggingface_local_request_body(prompt, payload, media_kind=media_kind, route=route)
        try:
            _run_text_to_image(request_body, route.model or "", output_path)
        except Exception as exc:
            raise ProviderExecutionError(f"in-process Hugging Face image generation failed: {_trim(str(exc))}") from exc
        if not output_path.exists() or output_path.stat().st_size == 0:
            raise ProviderExecutionError("in-process Hugging Face image generation completed without a media artifact")
        content = output_path.read_bytes()

    media_type = _media_type_for_path(output_path.name, media_kind)
    suffix = _suffix_for_media(media_type, media_kind)
    return ProviderResult(
        engine="huggingface-in-process",
        model=route.model or "huggingface-local",
        media_type=media_type,
        content=content,
        filename=f"huggingface-in-process-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary="Local Hugging Face in-process image pipeline returned a real artifact.",
        metadata={
            "provider": "huggingface",
            "providerMode": "in_process",
            "taskType": route.task_type,
            "capability": route.capability,
            "localRepository": _huggingface_model_repository_path(route.model),
        },
    )

def _run_huggingface_local_http(
    prompt: str,
    payload: dict[str, Any],
    *,
    media_kind: str,
    route: Any,
    endpoint_url: str,
) -> ProviderResult:
    body = _huggingface_local_request_body(prompt, payload, media_kind=media_kind, route=route)
    request = urllib.request.Request(
        endpoint_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Accept": "image/png, image/jpeg, video/mp4, application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=int(payload.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS)) as response:
            response_body = response.read()
            media_type = _clean_content_type(response.headers.get("Content-Type") or "application/octet-stream")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise ProviderExecutionError(f"local Hugging Face adapter returned HTTP {exc.code}: {_trim(error_body)}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExecutionError(f"local Hugging Face adapter request failed: {exc.reason}") from exc

    content, media_type = _extract_huggingface_media(response_body, media_type, media_kind=media_kind)
    suffix = _suffix_for_media(media_type, media_kind)
    return ProviderResult(
        engine="huggingface-local-http",
        model=route.model or endpoint_url,
        media_type=media_type,
        content=content,
        filename=f"huggingface-local-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary=f"Local Hugging Face {media_kind} adapter returned a real artifact.",
        metadata={
            "provider": "huggingface",
            "providerMode": "local_http",
            "taskType": route.task_type,
            "capability": route.capability,
            "endpoint": _redacted_hf_url(endpoint_url),
            "localRepository": _huggingface_model_repository_path(route.model),
        },
    )


def _run_huggingface_local_command(
    prompt: str,
    payload: dict[str, Any],
    *,
    media_kind: str,
    route: Any,
    command: str,
) -> ProviderResult:
    suffix = ".png" if media_kind == "image" else ".mp4"
    with tempfile.TemporaryDirectory(prefix="architoken-hf-local-") as tmpdir:
        tmp_path = Path(tmpdir)
        request_path = tmp_path / "request.json"
        output_path = tmp_path / f"output{suffix}"
        request_path.write_text(
            json.dumps(
                _huggingface_local_request_body(prompt, payload, media_kind=media_kind, route=route),
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        args = shlex.split(command) + [
            "--input",
            str(request_path),
            "--output",
            str(output_path),
            "--task",
            route.task_type,
            "--model",
            route.model or "",
        ]
        try:
            result = subprocess.run(
                args,
                check=False,
                capture_output=True,
                text=True,
                timeout=int(payload.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS),
            )
        except subprocess.TimeoutExpired as exc:
            raise ProviderExecutionError(
                f"local Hugging Face command timed out after {exc.timeout} seconds; reduce generation steps/size or keep the model warm behind a local endpoint"
            ) from exc
        if result.returncode != 0:
            raise ProviderExecutionError(
                f"local Hugging Face command exited {result.returncode}: {_trim(result.stderr or result.stdout)}"
            )
        if not output_path.exists() or output_path.stat().st_size == 0:
            raise ProviderExecutionError("local Hugging Face command completed without a media artifact")
        content = output_path.read_bytes()

    media_type = _media_type_for_path(output_path.name, media_kind)
    suffix = _suffix_for_media(media_type, media_kind)
    return ProviderResult(
        engine="huggingface-local-command",
        model=route.model or command,
        media_type=media_type,
        content=content,
        filename=f"huggingface-local-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary=f"Local Hugging Face {media_kind} command returned a real artifact.",
        metadata={
            "provider": "huggingface",
            "providerMode": "local_command",
            "taskType": route.task_type,
            "capability": route.capability,
            "command": shlex.split(command)[0],
            "localRepository": _huggingface_model_repository_path(route.model),
        },
    )


def _run_huggingface_remote_media(prompt: str, payload: dict[str, Any], *, media_kind: str, route: Any) -> ProviderResult:
    token = _huggingface_token()
    model = route.model
    endpoint_url = route.endpoint_url
    if not token:
        raise ProviderConfigurationError("HF_TOKEN or HUGGINGFACE_API_TOKEN is required for remote Hugging Face generation.")
    if not endpoint_url:
        raise ProviderConfigurationError(
            f"{route.url_env} or {route.model_env} is required for remote Hugging Face generation."
        )

    body = _huggingface_request_body(prompt, payload, media_kind=media_kind)
    request = urllib.request.Request(
        endpoint_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "image/png, image/jpeg, video/mp4, application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=int(payload.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS)) as response:
            response_body = response.read()
            media_type = _clean_content_type(response.headers.get("Content-Type") or "application/octet-stream")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise ProviderExecutionError(f"remote Hugging Face returned HTTP {exc.code}: {_trim(error_body)}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExecutionError(f"remote Hugging Face request failed: {exc.reason}") from exc

    content, media_type = _extract_huggingface_media(response_body, media_type, media_kind=media_kind)
    suffix = _suffix_for_media(media_type, media_kind)
    return ProviderResult(
        engine="huggingface-remote-http",
        model=model or endpoint_url,
        media_type=media_type,
        content=content,
        filename=f"huggingface-remote-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary=f"Remote Hugging Face {media_kind} endpoint returned a real artifact.",
        metadata={"provider": "huggingface", "providerMode": "remote_http", "endpoint": _redacted_hf_url(endpoint_url)},
    )


def _model_payload(route: Any) -> dict[str, Any]:
    provider = _provider_for_task(route.task_type)
    model = _model_for_provider(route.task_type, provider, route.model)
    configured = _route_configured(route.task_type, provider, route)
    missing = _route_missing(route.task_type, provider, route) if not configured else []
    payload = {
        "id": model or f"unconfigured-{route.task_type}",
        "object": "model",
        "provider": provider,
        "taskType": route.task_type,
        "capability": route.capability,
        "capabilities": [route.task_type, route.capability],
        "configured": configured,
        "missing": missing,
        "modelEnv": route.model_env,
        "urlEnv": route.url_env,
        "endpoint": _redacted_hf_url(route.endpoint_url) if route.endpoint_url else None,
    }
    if provider == "huggingface":
        payload["localRepository"] = _huggingface_model_repository_path(model)
        payload["providerPreference"] = "local_huggingface_first"
        if normalize_task_type(route.task_type) == "chat":
            payload["localEndpointEnv"] = "ARCHITOKEN_HF_LOCAL_CHAT_URL"
            payload["endpoint"] = _redacted_hf_url(_huggingface_chat_endpoint(route.endpoint_url) or "http://127.0.0.1:8000/v1/chat/completions")
            payload["adapter"] = "huggingface-local-vllm-openai-compatible"
        if _is_media_task(route.task_type):
            payload["localEndpointEnv"] = _task_local_url_env(route.task_type)[0]
            payload["localCommandEnv"] = _task_local_command_env(route.task_type)[0]
            payload["remoteEnabled"] = _huggingface_remote_enabled()
    return payload


def _provider_for_task(task_type: str) -> str:
    normalized = normalize_task_type(task_type)
    if normalized == "text_to_image":
        return _selected_provider("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER")
    if normalized == "image_to_video":
        return _selected_provider("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER")
    return "huggingface"


def _model_for_provider(task_type: str, provider: str, route_model: str | None) -> str | None:
    normalized = normalize_task_type(task_type)
    if provider != "openclaw":
        return route_model
    if normalized == "text_to_image":
        return _env("OPENCLAW_IMAGE_MODEL")
    if normalized == "image_to_video":
        return _env("OPENCLAW_VIDEO_MODEL")
    return route_model


def _route_configured(task_type: str, provider: str, route: Any) -> bool:
    normalized = normalize_task_type(task_type)
    if provider != "openclaw":
        if provider == "huggingface" and normalized == "chat":
            return bool(_huggingface_chat_endpoint(route.endpoint_url))
        if provider == "huggingface" and _is_media_task(normalized):
            return _huggingface_media_configured(normalized, route.configured, route.endpoint_url, route.model)
        return bool(route.configured)
    if normalized == "text_to_image":
        return bool(_env("OPENCLAW_IMAGE_MODEL"))
    if normalized == "image_to_video":
        return bool(_env("OPENCLAW_VIDEO_MODEL"))
    return False


def _route_missing(task_type: str, provider: str, route: Any) -> list[str]:
    normalized = normalize_task_type(task_type)
    if provider == "openclaw":
        if normalized == "text_to_image":
            return ["OPENCLAW_IMAGE_MODEL"]
        if normalized == "image_to_video":
            return ["OPENCLAW_VIDEO_MODEL"]
        return []
    if provider == "huggingface" and normalized == "chat":
        return [] if _huggingface_chat_endpoint(route.endpoint_url) else ["ARCHITOKEN_HF_LOCAL_CHAT_URL or ARCHITOKEN_VLLM_BASE_URL"]
    if provider == "huggingface" and _is_media_task(normalized):
        return _huggingface_media_missing(normalized, route)
    return list(route.missing)


def _huggingface_request_body(prompt: str, payload: dict[str, Any], *, media_kind: str) -> dict[str, Any]:
    constraints = payload.get("constraints")
    parameters = constraints.get("parameters", {}) if isinstance(constraints, dict) else {}
    if media_kind == "image":
        return {
            "inputs": prompt,
            "parameters": parameters,
            "options": {"wait_for_model": True},
        }

    image_input = _image_to_video_input(payload)
    if not image_input:
        raise ProviderConfigurationError(
            "ImageToVideo requires constraints.imageBase64, constraints.imageUrl, or a downloadable input artifact."
        )
    return {
        "inputs": {"prompt": prompt, "image": image_input},
        "parameters": parameters,
        "options": {"wait_for_model": True},
    }


def _image_to_video_input(payload: dict[str, Any]) -> str | None:
    constraints = payload.get("constraints")
    if isinstance(constraints, dict):
        image_base64 = constraints.get("imageBase64")
        if isinstance(image_base64, str) and image_base64.strip():
            return image_base64.strip()
        image_url = constraints.get("imageUrl")
        if isinstance(image_url, str) and image_url.strip():
            return image_url.strip()

    for artifact in payload.get("inputArtifacts") or []:
        if not isinstance(artifact, dict):
            continue
        object_uri = artifact.get("objectUri")
        if isinstance(object_uri, str) and object_uri.startswith(("http://", "https://")):
            return object_uri
    return None


def _huggingface_local_request_body(
    prompt: str,
    payload: dict[str, Any],
    *,
    media_kind: str,
    route: Any,
) -> dict[str, Any]:
    base_body = _huggingface_request_body(prompt, payload, media_kind=media_kind)
    constraints = payload.get("constraints") if isinstance(payload.get("constraints"), dict) else {}
    parameters = constraints.get("parameters", {}) if isinstance(constraints, dict) else {}
    return {
        "jobId": payload.get("jobId"),
        "mode": payload.get("mode"),
        "taskType": route.task_type,
        "capability": route.capability,
        "provider": "huggingface",
        "providerMode": "local",
        "model": route.model,
        "modelRepository": _huggingface_model_repository_path(route.model),
        "prompt": prompt,
        "inputs": base_body.get("inputs"),
        "parameters": parameters,
        "options": base_body.get("options", {}),
        "constraints": constraints,
        "inputArtifacts": payload.get("inputArtifacts") or [],
        "outputFormats": payload.get("outputFormats") or [],
    }


def _huggingface_media_configured(
    task_type: str,
    remote_route_configured: bool,
    route_endpoint_url: str | None = None,
    route_model: str | None = None,
) -> bool:
    return bool(
        _huggingface_local_endpoint(task_type, route_endpoint_url)
        or _huggingface_local_command(task_type, route_model)
        or (_huggingface_remote_enabled() and remote_route_configured)
    )


def _huggingface_media_missing(task_type: str, route: Any) -> list[str]:
    if _huggingface_local_endpoint(task_type, route.endpoint_url) or _huggingface_local_command(task_type, route.model):
        return []
    if _huggingface_remote_enabled():
        return list(route.missing)
    return [
        _task_local_url_env(task_type)[0],
        _task_local_command_env(task_type)[0],
        "ARCHITOKEN_HF_REMOTE_ENABLED=1 (only if remote Hugging Face API is allowed)",
    ]


def _is_media_task(task_type: str) -> bool:
    return normalize_task_type(task_type) in {"text_to_image", "image_to_video"}


def _task_local_url_env(task_type: str) -> tuple[str, str]:
    normalized = normalize_task_type(task_type)
    if normalized == "image_to_video":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL", "HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_URL")
    return ("ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL", "HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_URL")


def _task_local_command_env(task_type: str) -> tuple[str, str]:
    normalized = normalize_task_type(task_type)
    if normalized == "image_to_video":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_COMMAND", "HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_COMMAND")
    return ("ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_COMMAND", "HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_COMMAND")


def _huggingface_local_endpoint(task_type: str, route_endpoint_url: str | None) -> str | None:
    for name in (*_task_local_url_env(task_type), "ARCHITOKEN_HF_LOCAL_MEDIA_URL", "HUGGINGFACE_LOCAL_MEDIA_URL"):
        value = _env(name)
        if value:
            return value
    if route_endpoint_url and _is_local_http_url(route_endpoint_url):
        return route_endpoint_url
    return None


def _huggingface_local_command(task_type: str, route_model: str | None = None) -> str | None:
    for name in (*_task_local_command_env(task_type), "ARCHITOKEN_HF_LOCAL_MEDIA_COMMAND", "HUGGINGFACE_LOCAL_MEDIA_COMMAND"):
        value = _env(name)
        if value:
            return value
    return _auto_huggingface_local_command(task_type, route_model)


def _auto_huggingface_local_command(task_type: str, route_model: str | None) -> str | None:
    if _truthy_env("ARCHITOKEN_DISABLE_HF_AUTO_LOCAL_MEDIA_COMMAND"):
        return None
    normalized = normalize_task_type(task_type)
    if normalized != "text_to_image":
        return None
    if not _local_huggingface_model_path(route_model):
        return None

    script = Path(__file__).resolve().parent / "architoken_workers" / "hf_media_command.py"
    if not script.exists():
        return None

    python = _huggingface_local_media_python()
    if not python or not _python_supports_hf_media_model(python, normalized, route_model):
        return None
    return f"{shlex.quote(str(python))} {shlex.quote(str(script))}"


def _huggingface_local_media_python() -> Path | None:
    for name in ("ARCHITOKEN_HF_LOCAL_MEDIA_PYTHON", "HUGGINGFACE_LOCAL_MEDIA_PYTHON"):
        value = _env(name)
        if value:
            candidate = Path(value).expanduser()
            if candidate.exists():
                return candidate

    candidates = [
        Path.home() / "ComfyUI" / "venv" / "bin" / "python",
        Path(sys.executable),
    ]
    for candidate in candidates:
        if _python_has_hf_media_runtime(candidate):
            return candidate
    return None


@functools.lru_cache(maxsize=8)
def _python_has_hf_media_runtime(python: Path) -> bool:
    if not python.exists():
        return False
    check = "import torch; import transformers; from diffusers import DiffusionPipeline"
    result = subprocess.run([str(python), "-c", check], check=False, capture_output=True, text=True, timeout=20)
    return result.returncode == 0


@functools.lru_cache(maxsize=16)
def _python_supports_hf_media_model(python: Path, task_type: str, route_model: str | None) -> bool:
    if task_type != "text_to_image":
        return False
    model = route_model or ""
    if "ERNIE-Image" in model:
        check = (
            "from diffusers import ErnieImagePipeline; "
            "from transformers import Mistral3Model, Ministral3ForCausalLM"
        )
    else:
        check = "from diffusers import DiffusionPipeline"
    result = subprocess.run([str(python), "-c", check], check=False, capture_output=True, text=True, timeout=20)
    return result.returncode == 0


def _huggingface_remote_enabled() -> bool:
    return _truthy_env("ARCHITOKEN_HF_REMOTE_ENABLED") or _truthy_env("HUGGINGFACE_REMOTE_ENABLED")


def _truthy_env(name: str) -> bool:
    value = _env(name)
    return value.lower() in {"1", "true", "yes", "on"} if value else False


def _is_local_http_url(url: str) -> bool:
    from urllib.parse import urlsplit

    try:
        host = urlsplit(url).hostname or ""
    except ValueError:
        return False
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        return True
    if host.startswith("192.168.") or host.startswith("10."):
        return True
    if host.startswith("172."):
        parts = host.split(".")
        if len(parts) > 1 and parts[1].isdigit() and 16 <= int(parts[1]) <= 31:
            return True
    return False



def _huggingface_model_repository_path(model: str | None) -> str | None:
    if not model:
        return None
    model_id = model.split("/", 1)[1] if model.startswith("huggingface/") else model
    roots = []
    if _env("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR"):
        roots.append(Path(_env("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR") or ""))
    if _env("ARCHITOKEN_MODEL_REPOSITORY_DIR"):
        roots.append(Path(_env("ARCHITOKEN_MODEL_REPOSITORY_DIR") or "") / "huggingface")
    roots.append(Path(__file__).resolve().parents[1] / "data" / "model-repository" / "huggingface")
    parts = [part for part in model_id.split("/") if part]
    for root in roots:
        candidate = root.joinpath(*parts)
        if candidate.exists():
            return str(candidate)
    return None


def _local_huggingface_model_path(model: str | None) -> str | None:
    return _huggingface_model_repository_path(model)

def _media_type_for_path(path: str, media_kind: str) -> str:
    media_type = mimetypes.guess_type(path)[0]
    if media_type:
        return _clean_content_type(media_type)
    return "image/png" if media_kind == "image" else "video/mp4"


def _media_response(
    payload: dict[str, Any],
    request: Request,
    result: ProviderResult,
    *,
    kind: str,
) -> dict[str, Any]:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    filename = Path(result.filename).name
    path = GENERATED_DIR / filename
    path.write_bytes(result.content)
    download_url = str(request.url_for("download_generated_file", filename=filename))
    return {
        "engine": result.engine,
        "model": result.model,
        "summary": result.summary,
        "modelCalls": 1,
        "artifacts": [
            {
                "kind": kind,
                "mimeType": result.media_type,
                "filename": filename,
                "downloadUrl": download_url,
                "base64": base64.b64encode(result.content).decode("ascii"),
                "sizeBytes": len(result.content),
                "metadata": {
                    **result.metadata,
                    "jobId": payload.get("jobId"),
                    "mode": payload.get("mode"),
                },
            }
        ],
    }


def _selected_provider(env_name: str) -> str:
    configured = (_env(env_name) or "").lower()
    if configured:
        return configured

    return "huggingface"


def _text_to_image_configured() -> bool:
    if (_env("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER") or "").lower() == "openclaw":
        return bool(_env("OPENCLAW_IMAGE_MODEL"))
    route = HuggingFaceRouteRegistry().text_to_image(has_token=bool(_huggingface_token()))
    return _huggingface_media_configured("text_to_image", route.configured, route.endpoint_url, route.model)


def _image_to_video_configured() -> bool:
    if (_env("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER") or "").lower() == "openclaw":
        return bool(_env("OPENCLAW_VIDEO_MODEL"))
    route = HuggingFaceRouteRegistry().image_to_video(has_token=bool(_huggingface_token()))
    return _huggingface_media_configured("image_to_video", route.configured, route.endpoint_url, route.model)


def _extract_huggingface_media(response_body: bytes, media_type: str, *, media_kind: str) -> tuple[bytes, str]:
    expected_prefix = "image/" if media_kind == "image" else "video/"
    if media_type.startswith(expected_prefix):
        return response_body, media_type

    try:
        payload = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ProviderExecutionError(f"provider returned {media_type}, expected {expected_prefix} media") from exc

    if isinstance(payload, dict) and payload.get("error"):
        raise ProviderExecutionError(_trim(str(payload["error"])))

    if isinstance(payload, dict):
        for key in ("base64", "contentBase64", "generated_image", "video"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return base64.b64decode(_strip_data_url(value)), _media_type_from_payload(payload, media_kind)
        url = payload.get("url") or payload.get("downloadUrl")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            return _download_url(url), _media_type_from_payload(payload, media_kind)

    raise ProviderExecutionError("provider JSON did not include media bytes or a downloadable media URL")


def _download_url(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
        return response.read()


def _media_type_from_payload(payload: dict[str, Any], media_kind: str) -> str:
    media_type = payload.get("mimeType") or payload.get("mediaType") or payload.get("contentType")
    if isinstance(media_type, str) and media_type.strip():
        return _clean_content_type(media_type)
    return "image/png" if media_kind == "image" else "video/mp4"


def _required_prompt(payload: dict[str, Any]) -> str:
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(status_code=400, detail={"code": "invalid_prompt", "message": "prompt is required"})
    return prompt.strip()


def _redacted_hf_url(url: str) -> str:
    from urllib.parse import urlsplit, urlunsplit

    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _suffix_for_media(media_type: str, media_kind: str) -> str:
    guessed = mimetypes.guess_extension(media_type)
    if guessed:
        return guessed
    return ".png" if media_kind == "image" else ".mp4"


def _strip_data_url(value: str) -> str:
    if "," in value and value.lstrip().startswith("data:"):
        return value.split(",", 1)[1]
    return value


def _clean_content_type(value: str) -> str:
    return value.split(";", 1)[0].strip().lower()


def _env(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None or not value.strip():
        return None
    return value.strip()


def _huggingface_token() -> str | None:
    token = _env("HF_TOKEN") or _env("HUGGINGFACE_API_TOKEN")
    if token:
        return token

    for path in (
        Path.home() / ".cache" / "huggingface" / "token",
        Path.home() / ".huggingface" / "token",
    ):
        try:
            value = path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if value:
            return value
    return None


def _trim(value: str, limit: int = 700) -> str:
    return " ".join(value.split())[:limit]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "engine_server:app",
        host=os.environ.get("ARCHITOKEN_GENERATION_HOST", "127.0.0.1"),
        port=int(os.environ.get("ARCHITOKEN_GENERATION_PORT", "7071")),
        reload=False,
    )
