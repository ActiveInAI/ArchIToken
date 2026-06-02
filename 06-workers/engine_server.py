"""ArchIToken local generation provider HTTP service.

This service is the development HTTP adapter behind Harness Core generation.
It does not synthesize fake media: image/video requests require a configured
Hugging Face endpoint/model or an OpenClaw image/video provider.
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import subprocess
import tempfile
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


class ProviderConfigurationError(RuntimeError):
    """Raised when no real provider route is configured."""


class ProviderExecutionError(RuntimeError):
    """Raised when a configured provider fails."""


@app.get("/v1/models")
def list_models() -> dict[str, Any]:
    hf_registry = HuggingFaceRouteRegistry()
    hf_token = bool(_huggingface_token())
    image_route = hf_registry.text_to_image(has_token=hf_token)
    video_route = hf_registry.image_to_video(has_token=hf_token)
    image_provider = _selected_provider("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER")
    video_provider = _selected_provider("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER")
    image_model = _env("OPENCLAW_IMAGE_MODEL") if image_provider == "openclaw" else image_route.model
    video_model = _env("OPENCLAW_VIDEO_MODEL") if video_provider == "openclaw" else video_route.model
    models = [
        {
            "id": image_model or "unconfigured-text-to-image",
            "object": "model",
            "provider": image_provider or "huggingface",
            "taskType": "text_to_image",
            "capability": "image.generate",
            "capabilities": ["text_to_image"],
            "configured": _text_to_image_configured(),
            "missing": list(image_route.missing) if image_provider != "openclaw" else [],
        },
        {
            "id": video_model or "unconfigured-image-to-video",
            "object": "model",
            "provider": video_provider or "huggingface",
            "taskType": "image_to_video",
            "capability": "video.image_to_video",
            "capabilities": ["image_to_video"],
            "configured": _image_to_video_configured(),
            "missing": list(video_route.missing) if video_provider != "openclaw" else [],
        },
        {
            "id": hf_registry.text_chat_model(),
            "object": "model",
            "provider": "huggingface",
            "taskType": "chat",
            "capability": "model.run",
            "capabilities": ["chat"],
            "configured": hf_token,
            "missing": [] if hf_token else ["HF_TOKEN or HUGGINGFACE_API_TOKEN"],
        },
    ]
    return {
        "object": "list",
        "data": models,
        "models": [model["id"] for model in models if model["configured"]],
    }


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
    route = (
        hf_registry.text_to_image(has_token=bool(token))
        if media_kind == "image"
        else hf_registry.image_to_video(has_token=bool(token))
    )
    model = route.model
    endpoint_url = route.endpoint_url
    if not token:
        raise ProviderConfigurationError("HF_TOKEN or HUGGINGFACE_API_TOKEN is required for Hugging Face generation.")
    if not endpoint_url:
        raise ProviderConfigurationError(
            f"{route.url_env} or {route.model_env} is required for Hugging Face generation."
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
        raise ProviderExecutionError(f"Hugging Face returned HTTP {exc.code}: {_trim(error_body)}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExecutionError(f"Hugging Face request failed: {exc.reason}") from exc

    content, media_type = _extract_huggingface_media(response_body, media_type, media_kind=media_kind)
    suffix = _suffix_for_media(media_type, media_kind)
    return ProviderResult(
        engine="huggingface-http",
        model=model or endpoint_url,
        media_type=media_type,
        content=content,
        filename=f"huggingface-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary=f"Hugging Face {media_kind} endpoint returned a real artifact.",
        metadata={"provider": "huggingface", "endpoint": _redacted_hf_url(endpoint_url)},
    )


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
    return HuggingFaceRouteRegistry().text_to_image(has_token=bool(_huggingface_token())).configured


def _image_to_video_configured() -> bool:
    if (_env("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER") or "").lower() == "openclaw":
        return bool(_env("OPENCLAW_VIDEO_MODEL"))
    return HuggingFaceRouteRegistry().image_to_video(has_token=bool(_huggingface_token())).configured


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
