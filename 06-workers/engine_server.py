"""ArchIToken local generation provider HTTP service.

This service is the development HTTP adapter behind Harness Core generation.
It does not synthesize fake media: image/video requests require a configured
Hugging Face endpoint/model or an PanAI image/video provider.
"""

from __future__ import annotations

import base64
import functools
import http.client
import io
import json
import mimetypes
import os
import re
import shutil
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from architoken_workers.huggingface_generation_registry import (
    HuggingFaceRouteRegistry,
    hf_model_url,
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


@dataclass(frozen=True)
class ChatFallbackCandidate:
    provider: str
    model: str
    base_url: str
    api_key_env: str | None = None


class ProviderConfigurationError(RuntimeError):
    """Raised when no real provider route is configured."""


class ProviderExecutionError(RuntimeError):
    """Raised when a configured provider fails."""


@app.get("/v1/models")
def list_models() -> dict[str, Any]:
    hf_registry = HuggingFaceRouteRegistry()
    hf_token = bool(_huggingface_token())
    chat_endpoint_models = _list_huggingface_chat_endpoint_models()
    route_models = [_model_payload(route) for route in hf_registry.all_routes(has_token=hf_token)]
    repository_models = _list_huggingface_repository_models(hf_registry)
    cache_models = _list_huggingface_cache_models(hf_registry)
    local_models = _merge_huggingface_local_models(cache_models + repository_models)
    endpoint_payloads = _chat_endpoint_model_payloads(chat_endpoint_models)
    repository_payloads = _repository_model_payloads(local_models)
    data = _merge_huggingface_model_catalog(
        _dedupe_model_payloads(repository_payloads + endpoint_payloads),
        route_models,
    )
    return {
        "object": "list",
        "data": data,
        "models": _unique_model_ids(data),
        "endpointModels": [model["id"] for model in endpoint_payloads],
        "repositoryModels": local_models,
        "repositoryModelIds": [model["id"] for model in local_models],
        "taskRoutes": route_models,
        "modelTasks": _model_tasks_by_id(route_models),
    }


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "architoken-hf-endpoint",
        "status": "ok",
        "models": "/v1/models",
        "chatCompletions": "/v1/chat/completions",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "architoken-hf-endpoint",
        "modelsEndpoint": "/v1/models",
    }


def _list_huggingface_repository_models(hf_registry: HuggingFaceRouteRegistry) -> list[dict[str, Any]]:
    task_by_model = _primary_task_by_huggingface_route_model(hf_registry)
    discovered: dict[str, dict[str, Any]] = {}
    for root in _huggingface_model_repository_roots():
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
                        "source": "model_repository",
                        "cached": False,
                        "routedTaskType": task_by_model.get(model_id),
                    },
                )
    return list(discovered.values())


def _list_huggingface_cache_models(hf_registry: HuggingFaceRouteRegistry) -> list[dict[str, Any]]:
    if _falsey_env("ARCHITOKEN_HF_CACHE_MODELS_ENABLED"):
        return []

    task_by_model = _primary_task_by_huggingface_route_model(hf_registry)
    discovered: dict[str, dict[str, Any]] = {}
    for entry in _huggingface_cache_entries():
        if not isinstance(entry, dict):
            continue
        if entry.get("repo_type") != "model" and not str(entry.get("id") or "").startswith("model/"):
            continue
        model_id = entry.get("repo_id") or str(entry.get("id") or "").replace("model/", "", 1)
        snapshot_path = entry.get("snapshot_path")
        if not isinstance(model_id, str) or not model_id.strip():
            continue
        if not isinstance(snapshot_path, str) or not snapshot_path.strip():
            continue
        snapshot = Path(snapshot_path).expanduser()
        if not _looks_like_huggingface_model_repository(snapshot):
            continue

        candidate = {
            "id": model_id.strip(),
            "provider": "huggingface",
            "localRepository": str(snapshot),
            "source": "hf_cache",
            "cached": True,
            "revision": entry.get("revision"),
            "size": entry.get("size"),
            "refs": entry.get("refs") if isinstance(entry.get("refs"), list) else [],
            "routedTaskType": task_by_model.get(model_id),
        }
        previous = discovered.get(candidate["id"])
        if previous is None or _cache_model_rank(candidate) > _cache_model_rank(previous):
            discovered[candidate["id"]] = candidate

    return [discovered[model_id] for model_id in sorted(discovered)]


def _merge_huggingface_local_models(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for model in models:
        model_id = str(model.get("id") or "")
        if not model_id:
            continue
        previous = merged.get(model_id)
        if previous is None:
            merged[model_id] = model
            continue
        if previous.get("source") != "model_repository" and model.get("source") == "model_repository":
            merged[model_id] = {**previous, **model, "cached": previous.get("cached") or model.get("cached")}
    return list(merged.values())


def _merge_huggingface_model_catalog(
    local_or_endpoint_models: list[dict[str, Any]],
    route_models: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    route_tasks = _model_tasks_by_id(route_models)
    first_route_by_id: dict[str, dict[str, Any]] = {}
    for route in route_models:
        model_id = str(route.get("id") or "")
        if model_id and model_id not in first_route_by_id:
            first_route_by_id[model_id] = route

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for model in local_or_endpoint_models:
        model_id = str(model.get("id") or "")
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        merged.append(
            _with_huggingface_route_metadata(
                model,
                first_route_by_id.get(model_id),
                route_tasks.get(model_id, []),
            )
        )

    for route in route_models:
        model_id = str(route.get("id") or "")
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        merged.append(
            _with_huggingface_route_metadata(
                route,
                first_route_by_id.get(model_id),
                route_tasks.get(model_id, []),
            )
        )
    return merged


def _model_tasks_by_id(route_models: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    tasks: dict[str, list[dict[str, Any]]] = {}
    for route in route_models:
        model_id = str(route.get("id") or "")
        task_type = str(route.get("taskType") or "")
        capability = str(route.get("capability") or "")
        if not model_id or not task_type:
            continue
        tasks.setdefault(model_id, []).append(
            {
                "taskType": task_type,
                "capability": capability,
                "configured": bool(route.get("configured")),
                "runtimeConfigured": bool(route.get("runtimeConfigured", route.get("configured"))),
                "endpointPath": route.get("endpointPath"),
                "requiresRuntime": route.get("requiresRuntime"),
            }
        )
    return tasks


def _with_huggingface_route_metadata(
    model: dict[str, Any],
    route: dict[str, Any] | None,
    route_tasks: list[dict[str, Any]],
) -> dict[str, Any]:
    merged = {**(route or {}), **model}
    if route_tasks:
        task_types = [str(task["taskType"]) for task in route_tasks if task.get("taskType")]
        capabilities = [str(task["capability"]) for task in route_tasks if task.get("capability")]
        merged["routeTasks"] = route_tasks
        merged["availableTaskTypes"] = task_types
        merged["availableCapabilities"] = capabilities
        merged["primaryTaskType"] = merged.get("taskType") or task_types[0]
        merged["repositoryOnly"] = False
    return merged


def _cache_model_rank(model: dict[str, Any]) -> tuple[int, int, str]:
    refs = model.get("refs") if isinstance(model.get("refs"), list) else []
    has_main_ref = 1 if "main" in refs else 0
    size = _human_size_to_bytes(str(model.get("size") or "0"))
    return (size, has_main_ref, str(model.get("revision") or ""))


def _human_size_to_bytes(value: str) -> int:
    raw = value.strip().upper()
    if not raw or raw == "-":
        return 0
    multiplier = 1
    if raw.endswith("K"):
        multiplier = 1024
        raw = raw[:-1]
    elif raw.endswith("M"):
        multiplier = 1024**2
        raw = raw[:-1]
    elif raw.endswith("G"):
        multiplier = 1024**3
        raw = raw[:-1]
    elif raw.endswith("T"):
        multiplier = 1024**4
        raw = raw[:-1]
    try:
        return int(float(raw) * multiplier)
    except ValueError:
        return 0


def _hf_cli_command() -> list[str] | None:
    configured = _env("ARCHITOKEN_HF_CLI_PATH") or _env("HF_CLI_PATH")
    candidates = [
        configured,
        shutil.which("hf"),
        str(Path.home() / ".local" / "bin" / "hf"),
        str(Path.home() / ".huggingface" / "bin" / "hf"),
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if path.exists():
            return [str(path)]
    return None


def _huggingface_cache_entries() -> list[dict[str, Any]]:
    command = _hf_cli_command()
    if not command:
        return []
    try:
        result = subprocess.run(
            [*command, "cache", "list", "--revisions", "--json", "--filter", "type=model", "--no-truncate"],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if result.returncode != 0:
        return []

    try:
        entries = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return []
    return entries if isinstance(entries, list) else []


def _repository_model_payloads(repository_models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_repository_model_payload(model) for model in repository_models]


def _repository_model_payload(model: dict[str, Any]) -> dict[str, Any]:
    model_id = str(model.get("id") or "")
    inferred = _infer_repository_model_task(model_id, model.get("routedTaskType"))
    runtime = _local_runtime_descriptor(model_id, inferred, model.get("localRepository"))
    return {
        "id": model_id,
        "object": "model",
        "provider": "huggingface",
        "taskType": inferred["taskType"],
        "capability": inferred["capability"],
        "capabilities": [inferred["taskType"], inferred["capability"]],
        "configured": bool(runtime["configured"]),
        "missing": [],
        "repositoryAvailable": bool(model.get("localRepository")),
        "modelEnv": inferred["modelEnv"],
        "urlEnv": inferred["urlEnv"],
        "endpoint": runtime["endpoint"],
        "endpointPath": runtime["endpointPath"],
        "localRepository": model.get("localRepository"),
        "source": model.get("source", "model_repository"),
        "cached": bool(model.get("cached")),
        "revision": model.get("revision"),
        "size": model.get("size"),
        "runtime": runtime["runtime"],
        "runtimePreference": runtime["runtimePreference"],
        "runtimeConfigured": runtime["configured"],
        "requiresRuntime": runtime["requiresRuntime"],
        "providerPreference": "local_huggingface_first",
        "routedTaskType": model.get("routedTaskType"),
        "repositoryOnly": model.get("routedTaskType") is None,
    }


def _chat_endpoint_model_payloads(endpoint_models: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    endpoint = _huggingface_chat_endpoint(None)
    for model_id in sorted(endpoint_models):
        inferred = _infer_repository_model_task(model_id, None)
        task_type = "code" if inferred["taskType"] == "code" else "chat"
        descriptor = _task_descriptor(task_type)
        payloads.append(
            {
                "id": model_id,
                "name": model_id,
                "object": "model",
                "provider": "huggingface",
                "taskType": descriptor["taskType"],
                "capability": descriptor["capability"],
                "capabilities": [descriptor["taskType"], descriptor["capability"]],
                "configured": True,
                "missing": [],
                "repositoryAvailable": False,
                "modelEnv": descriptor["modelEnv"],
                "urlEnv": descriptor["urlEnv"],
                "endpoint": _redacted_hf_url(endpoint) if endpoint else None,
                "endpointPath": "/v1/chat/completions",
                "localRepository": _huggingface_model_repository_path(model_id),
                "source": "hf_chat_endpoint",
                "cached": False,
                "runtime": "llama.cpp_or_vllm_openai_compatible",
                "runtimePreference": ["llama.cpp", "vllm", "tgi", "custom_worker"],
                "runtimeConfigured": True,
                "requiresRuntime": None,
                "providerPreference": "local_huggingface_first",
                "endpointModel": endpoint_models[model_id],
                "repositoryOnly": False,
            }
        )
    return payloads


def _dedupe_model_payloads(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for model in models:
        model_id = str(model.get("id") or "")
        if not model_id:
            continue
        existing = deduped.get(model_id)
        if existing is None:
            deduped[model_id] = model
            continue
        if model.get("localRepository") and not existing.get("localRepository"):
            existing["localRepository"] = model["localRepository"]
            existing["repositoryAvailable"] = True
        if model.get("cached") and not existing.get("cached"):
            existing["cached"] = True
        if model.get("source") == "hf_chat_endpoint":
            deduped[model_id] = {**model, **{k: v for k, v in existing.items() if k in {"localRepository", "cached"}}}
    return list(deduped.values())


def _primary_task_by_huggingface_route_model(
    hf_registry: HuggingFaceRouteRegistry,
) -> dict[str, str]:
    task_by_model: dict[str, str] = {}
    for route in hf_registry.all_routes(has_token=bool(_huggingface_token())):
        if route.model:
            task_by_model.setdefault(route.model, route.task_type)
    return task_by_model


def _unique_model_ids(models: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    ids: list[str] = []
    for model in models:
        model_id = str(model.get("id") or "")
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        ids.append(model_id)
    return ids


def _local_runtime_descriptor(
    model_id: str,
    inferred: dict[str, str],
    local_repository: Any,
) -> dict[str, Any]:
    task_type = inferred["taskType"]
    if task_type in {"chat", "code"}:
        endpoint = _huggingface_chat_endpoint(None)
        served = _huggingface_chat_endpoint_serves_model(model_id)
        fallback = _first_available_chat_fallback(model_id)
        requires_runtime = None
        if fallback:
            requires_runtime = None
        elif not endpoint:
            requires_runtime = "Start vLLM/TGI/llama.cpp with an OpenAI-compatible /v1/chat/completions endpoint."
        elif model_id and not served:
            requires_runtime = "The configured chat endpoint is reachable but does not advertise this model in /v1/models."
        return {
            "runtime": "llama.cpp_or_vllm_openai_compatible" if not fallback else f"{fallback.provider}_chat_fallback",
            "runtimePreference": ["Hugging Face local endpoint", "vllm", "tgi", "Ollama", "LM Studio", "OpenRouter"],
            "endpoint": _redacted_hf_url(endpoint or _chat_fallback_runtime_endpoint(fallback)) if endpoint or fallback else None,
            "endpointPath": "/v1/chat/completions",
            "configured": bool((endpoint and (not model_id or served)) or fallback),
            "requiresRuntime": requires_runtime,
        }
    if task_type == "ocr":
        command = _huggingface_local_command(task_type, model_id)
        endpoint = _huggingface_local_endpoint(task_type, None)
        return {
            "runtime": "paddleocr_or_comfyui_worker",
            "runtimePreference": ["paddleocr", "ComfyUI", "custom_worker"],
            "endpoint": _redacted_hf_url(endpoint) if endpoint else None,
            "endpointPath": "/v1/ocr",
            "configured": bool(endpoint or command),
            "requiresRuntime": None if endpoint or command else "Configure a PaddleOCR/ComfyUI OCR worker endpoint or command.",
        }
    if task_type == "text_to_image":
        command = _huggingface_local_command(task_type, model_id)
        endpoint = _huggingface_local_endpoint(task_type, None)
        return {
            "runtime": "diffusers_or_comfyui_worker",
            "runtimePreference": ["ComfyUI", "diffusers", "custom_worker"],
            "endpoint": _redacted_hf_url(endpoint) if endpoint else None,
            "endpointPath": "/v1/generate/text-to-image",
            "configured": bool(endpoint or command),
            "requiresRuntime": None if endpoint or command else "Configure ComfyUI/diffusers local text-to-image runtime.",
        }
    if task_type == "image_to_video":
        command = _huggingface_local_command(task_type, model_id)
        endpoint = _huggingface_local_endpoint(task_type, None)
        return {
            "runtime": "comfyui_or_video_worker",
            "runtimePreference": ["ComfyUI", "custom_worker"],
            "endpoint": _redacted_hf_url(endpoint) if endpoint else None,
            "endpointPath": "/v1/generate/image-to-video",
            "configured": bool(endpoint or command),
            "requiresRuntime": None if endpoint or command else "Configure an LTX/image-to-video runtime behind a local HTTP or command adapter.",
        }
    if task_type == "text_to_video":
        command = _huggingface_local_command(task_type, model_id)
        endpoint = _huggingface_local_endpoint(task_type, None)
        return {
            "runtime": "comfyui_or_video_worker",
            "runtimePreference": ["ComfyUI", "custom_worker"],
            "endpoint": _redacted_hf_url(endpoint) if endpoint else None,
            "endpointPath": "/v1/generate/text-to-video",
            "configured": bool(endpoint or command),
            "requiresRuntime": None if endpoint or command else "Configure an LTX/text-to-video runtime behind a local HTTP or command adapter.",
        }
    command = _huggingface_local_command(task_type, model_id)
    endpoint = _huggingface_local_endpoint(task_type, None)
    endpoint_paths = {
        "image_to_image": "/v1/generate/image-to-image",
        "image_to_3d": "/v1/generate/image-to-3d",
        "object_to_3d_asset": "/v1/generate/object-to-3d-asset",
        "world_3d_research": "/v1/generate/world-3d-research",
        "vision_embedding": "/v1/embeddings/vision",
    }
    return {
        "runtime": "comfyui_or_custom_worker",
        "runtimePreference": ["ComfyUI", "custom_worker"],
        "endpoint": _redacted_hf_url(endpoint) if endpoint else None,
        "endpointPath": endpoint_paths.get(task_type, "/v1/generate"),
        "configured": bool(endpoint or command),
        "requiresRuntime": None if endpoint or command else f"Configure a {inferred['capability']} ComfyUI/custom worker endpoint or command before execution.",
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
        return _task_descriptor("text_to_video")
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
        "text_to_video": {
            "taskType": "text_to_video",
            "capability": "video.text_to_video",
            "modelEnv": "ARCHITOKEN_HF_TEXT_TO_VIDEO_MODEL",
            "urlEnv": "ARCHITOKEN_HF_TEXT_TO_VIDEO_URL",
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


@app.post("/v1/generate/{task_path}")
def generate_huggingface_task(task_path: str, payload: dict[str, Any], request: Request) -> dict[str, Any]:
    normalized = normalize_task_type(task_path)
    if normalized == "text_to_image":
        return generate_text_to_image(payload, request)
    if normalized == "image_to_video":
        return generate_image_to_video(payload, request)
    if normalized == "text_to_video" or _is_generation_artifact_task(normalized):
        prompt = _required_prompt(payload)
        try:
            result = _generate_huggingface_artifact_task(normalized, prompt, payload)
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
        return _media_response(payload, request, result, kind=_artifact_kind_for_task(normalized))

    route = HuggingFaceRouteRegistry().route_for_task(normalized, has_token=bool(_huggingface_token()))
    descriptor = _task_descriptor(normalized)
    runtime = _local_runtime_descriptor(route.model or "", descriptor, _huggingface_model_repository_path(route.model))
    raise HTTPException(
        status_code=503,
        detail={
            "code": "adapter_not_configured",
            "message": f"{normalized} requires a configured {runtime['runtime']} runtime.",
            "taskType": normalized,
            "capability": descriptor["capability"],
            "model": route.model,
            "endpointPath": runtime["endpointPath"],
            "requiresRuntime": runtime["requiresRuntime"],
            "localRepository": _huggingface_model_repository_path(route.model),
        },
    )


@app.post("/v1/chat/completions", response_model=None)
def chat_completions(payload: dict[str, Any]) -> Any:
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

    if payload.get("stream") is True:
        return _chat_completion_stream_response(result)
    return _chat_completion_response(result)


def _chat_completion_response(result: ChatProviderResult) -> dict[str, Any]:
    return {
        "id": _chat_completion_id(),
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


def _chat_completion_stream_response(result: ChatProviderResult) -> StreamingResponse:
    chat_id = _chat_completion_id()
    created = int(time.time())

    def events() -> Any:
        yield _sse_chat_completion_chunk(
            chat_id=chat_id,
            created=created,
            model=result.model,
            delta={"role": "assistant"},
            finish_reason=None,
            metadata=None,
        )
        if result.content:
            yield _sse_chat_completion_chunk(
                chat_id=chat_id,
                created=created,
                model=result.model,
                delta={"content": result.content},
                finish_reason=None,
                metadata=result.metadata,
            )
        yield _sse_chat_completion_chunk(
            chat_id=chat_id,
            created=created,
            model=result.model,
            delta={},
            finish_reason="stop",
            metadata=result.metadata,
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse_chat_completion_chunk(
    *,
    chat_id: str,
    created: int,
    model: str,
    delta: dict[str, str],
    finish_reason: str | None,
    metadata: dict[str, Any] | None,
) -> str:
    chunk: dict[str, Any] = {
        "id": chat_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": delta,
                "finish_reason": finish_reason,
            }
        ],
    }
    if metadata is not None:
        chunk["metadata"] = metadata
    return f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"


def _chat_completion_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex}"


@app.api_route("/download/{filename}", methods=["GET", "HEAD"])
def download_generated_file(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    path = GENERATED_DIR / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="generated file not found")
    return FileResponse(path)


def _markdown_media_preview(url: str, *, label: str, media_type: str) -> str:
    if media_type.startswith("image/"):
        return f"![{label}]({url})"
    return ""


def _generate_text_to_image(prompt: str, payload: dict[str, Any]) -> ProviderResult:
    provider = _selected_provider("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER")
    if provider == "panai":
        return _run_panai_media(prompt, payload, media_kind="image")
    if provider == "huggingface":
        return _run_huggingface_media(prompt, payload, media_kind="image")
    raise ProviderConfigurationError(
        "TextToImage requires ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER=huggingface|panai."
    )


def _generate_image_to_video(prompt: str, payload: dict[str, Any]) -> ProviderResult:
    provider = _selected_provider("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER")
    if provider == "panai":
        return _run_panai_media(prompt, payload, media_kind="video")
    if provider == "huggingface":
        return _run_huggingface_media(prompt, payload, media_kind="video")
    raise ProviderConfigurationError(
        "ImageToVideo requires ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER=huggingface|panai."
    )


def _generate_huggingface_artifact_task(task_type: str, prompt: str, payload: dict[str, Any]) -> ProviderResult:
    route = _huggingface_route_for_media_payload(task_type, payload, has_token=bool(_huggingface_token()))
    result = _run_huggingface_local_media_if_configured(
        prompt,
        payload,
        media_kind=_artifact_kind_for_task(task_type),
        route=route,
    )
    if result is not None:
        return result
    runtime = _local_runtime_descriptor(
        route.model or "",
        _task_descriptor(task_type),
        _huggingface_model_repository_path(route.model),
    )
    raise ProviderConfigurationError(
        f"{task_type} requires a configured local runtime. {runtime['requiresRuntime']}"
    )


def _generate_chat_completion(payload: dict[str, Any]) -> ChatProviderResult:
    token = _huggingface_token()
    route = HuggingFaceRouteRegistry().route_for_task("chat", has_token=bool(token))
    messages = _chat_messages(payload)
    requested_model = _normalize_huggingface_model_id(payload.get("model")) or route.model
    if _is_panai_heartbeat_request(messages):
        return ChatProviderResult(
            engine="huggingface-control-bypass",
            model=str(requested_model or route.model or "huggingface"),
            content="HEARTBEAT_OK",
            usage={},
            metadata={
                "provider": "huggingface",
                "providerMode": "control_bypass",
                "taskType": "control",
                "capability": "panai.heartbeat",
                "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> control bypass",
            },
        )
    requested_task = _infer_repository_model_task(str(requested_model or ""), None)
    prompt_task = _infer_chat_media_task_from_prompt(messages)
    if prompt_task and requested_task["taskType"] in {"chat", "text_to_image"}:
        requested_task = _task_descriptor(prompt_task)
        if prompt_task in {"image_to_video", "text_to_video"}:
            media_route = HuggingFaceRouteRegistry().route_for_task(prompt_task, has_token=bool(token))
            requested_model = media_route.model or requested_model
    if requested_model and requested_task["taskType"] not in {"chat", "code"}:
        return _run_huggingface_non_chat_model_from_chat(
            messages,
            payload,
            model=str(requested_model),
            inferred=requested_task,
        )

    canonical_payload = {**payload, "model": str(requested_model or route.model or "")}
    endpoint_url = _huggingface_chat_endpoint(route.endpoint_url)
    if not endpoint_url:
        fallback = _run_chat_fallback_if_available(
            messages,
            canonical_payload,
            requested_model=str(requested_model or route.model or ""),
            route=route,
            reason="huggingface_chat_endpoint_not_configured",
        )
        if fallback is not None:
            return fallback
        raise ProviderConfigurationError(
            "Chat requires a real local Hugging Face/vLLM endpoint. Configure "
            "ARCHITOKEN_HF_LOCAL_CHAT_URL or ARCHITOKEN_VLLM_BASE_URL. "
            "Nemotron NVFP4 should be served by vLLM/TensorRT; direct Transformers loading is not used as a fake fallback."
        )
    return _run_huggingface_chat_http(messages, canonical_payload, route=route, endpoint_url=endpoint_url)


def _infer_chat_media_task_from_prompt(messages: list[dict[str, Any]]) -> str | None:
    prompt = _strip_panai_chat_prefix(_last_user_text(messages))
    lowered = prompt.lower()
    if any(token in prompt for token in ("视频", "动画", "动图", "演示动画")) or "video" in lowered or "animation" in lowered:
        return "text_to_video"
    return None


def _run_huggingface_non_chat_model_from_chat(
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    *,
    model: str,
    inferred: dict[str, str],
) -> ChatProviderResult:
    task_type = normalize_task_type(inferred["taskType"])
    source_prompt = _last_user_prompt(messages, skip_media_attachment_notice=task_type == "text_to_image")
    if task_type == "text_to_image":
        source_prompts = _pending_user_prompts(messages, skip_media_attachment_notice=True)
        if not source_prompts:
            source_prompts = [source_prompt]

        generated: list[dict[str, Any]] = []
        for source_prompt in source_prompts:
            media_prompt = _chat_media_prompt(source_prompt, task_type=task_type)
            media_payload = _chat_media_payload(payload, prompt=media_prompt, source_prompt=source_prompt, task_type=task_type, model=model)
            result = _try_render_local_engineering_image(model, source_prompt)
            if result is None:
                try:
                    result = _generate_text_to_image(media_prompt, media_payload)
                except (ProviderConfigurationError, ProviderExecutionError) as exc:
                    return _huggingface_media_chat_diagnostic(
                        model,
                        inferred=inferred,
                        message=str(exc),
                        provider_mode="media_error",
                    )
                result = _apply_engineering_image_annotations(result, source_prompt)
            filename, download_url = _persist_generated_artifact(result)
            generated.append(
                {
                    "sourcePrompt": source_prompt,
                    "cleanPrompt": _strip_panai_chat_prefix(source_prompt),
                    "result": result,
                    "filename": filename,
                    "downloadUrl": download_url,
                    "annotation": result.metadata.get("engineeringAnnotation") if isinstance(result.metadata, dict) else None,
                }
            )

        content_blocks: list[str] = []
        for index, item in enumerate(generated, start=1):
            result = item["result"]
            prefix = f"图像 {index}/{len(generated)}" if len(generated) > 1 else "图像"
            media_metadata = result.metadata if isinstance(result.metadata, dict) else {}
            if media_metadata.get("provider") == "panai":
                preview = _markdown_media_preview(
                    item["downloadUrl"],
                    label=f"生成{prefix}",
                    media_type=result.media_type,
                )
                block = (
                    f"已用 PanAI 本地工程渲染生成{prefix}（当前选择模型 `{result.model}` 作为入口）。\n"
                    f"请求：`{item['cleanPrompt']}`\n"
                    f"{preview}\n"
                    f"下载链接：{item['downloadUrl']}"
                )
            else:
                preview = _markdown_media_preview(
                    item["downloadUrl"],
                    label=f"生成{prefix}",
                    media_type=result.media_type,
                )
                block = (
                    f"已用 Hugging Face 模型 `{result.model}` 生成{prefix}。\n"
                    f"请求：`{item['cleanPrompt']}`\n"
                    f"{preview}\n"
                    f"下载链接：{item['downloadUrl']}"
                )
            if isinstance(item["annotation"], dict) and item["annotation"].get("labels"):
                if media_metadata.get("provider") == "panai":
                    block += "\nPanAI 已生成结构化工程示意图；图像主体为概念示意，尺寸以标注面板为准。"
                else:
                    block += "\nPanAI 已叠加结构化工程标注；图像主体仍是概念渲染，尺寸以标注面板为准。"
            content_blocks.append(block)

        first = generated[0]
        content = "\n\n".join(content_blocks)
        return ChatProviderResult(
            engine="huggingface-media-chat-bridge",
            model=first["result"].model,
            content=content,
            usage={},
            metadata={
                "provider": "huggingface",
                "providerMode": "media_chat_bridge",
                "taskType": task_type,
                "capability": inferred["capability"],
                "requestedModel": model,
                "artifact": {
                    "filename": first["filename"],
                    "downloadUrl": first["downloadUrl"],
                    "mimeType": first["result"].media_type,
                    "sizeBytes": len(first["result"].content),
                },
                "artifacts": [
                    {
                        "filename": item["filename"],
                        "downloadUrl": item["downloadUrl"],
                        "mimeType": item["result"].media_type,
                        "sizeBytes": len(item["result"].content),
                        "sourcePrompt": item["cleanPrompt"],
                        "persisted": True,
                    }
                    for item in generated
                ],
                "mediaProvider": first["result"].metadata,
                "mediaProviders": [item["result"].metadata for item in generated],
                "batchCount": len(generated),
                "status": "completed",
                "completed": True,
                "artifactPersisted": True,
                "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Hugging Face media provider",
            },
        )

    if task_type in {"image_to_video", "text_to_video"}:
        media_prompt = _chat_media_prompt(source_prompt, task_type=task_type)
        media_payload = _chat_media_payload(payload, prompt=media_prompt, source_prompt=source_prompt, task_type=task_type, model=model)
        # The deterministic engineering animation is only a stand-in: once a real
        # video runtime (local HTTP adapter or command) is configured, every
        # prompt goes to the actual model.
        video_runtime_configured = bool(
            _huggingface_local_endpoint(task_type, None) or _huggingface_local_command(task_type, model)
        )
        result = None if video_runtime_configured else _try_render_local_engineering_video(model, source_prompt)
        if result is None:
            try:
                if task_type == "image_to_video":
                    result = _generate_image_to_video(media_prompt, media_payload)
                else:
                    result = _generate_huggingface_artifact_task(task_type, media_prompt, media_payload)
            except (ProviderConfigurationError, ProviderExecutionError) as exc:
                return _huggingface_media_chat_diagnostic(
                    model,
                    inferred=inferred,
                    message=str(exc),
                    provider_mode="media_error",
                )
        filename, download_url = _persist_generated_artifact(result)
        media_metadata = result.metadata if isinstance(result.metadata, dict) else {}
        if media_metadata.get("provider") == "panai":
            content = (
                f"已用 PanAI 本地工程动画生成视频（当前选择模型 `{result.model}` 作为入口）。\n\n"
                f"请求：`{_strip_panai_chat_prefix(source_prompt)}`\n"
                f"视频链接：{download_url}\n\n"
                f"下载链接：{download_url}\n\n"
                "说明：这是工程概念动画，非施工交底、非专项施工方案、非加工详图。"
            )
        else:
            content = (
                f"已用 Hugging Face 模型 `{result.model}` 生成视频。\n\n"
                f"视频链接：{download_url}\n\n"
                f"下载链接：{download_url}"
            )
        return ChatProviderResult(
            engine="huggingface-media-chat-bridge",
            model=result.model,
            content=content,
            usage={},
            metadata={
                "provider": "huggingface",
                "providerMode": "media_chat_bridge",
                "taskType": task_type,
                "capability": inferred["capability"],
                "requestedModel": model,
                "artifact": {
                    "filename": filename,
                    "downloadUrl": download_url,
                    "mimeType": result.media_type,
                    "sizeBytes": len(result.content),
                    "persisted": True,
                },
                "mediaProvider": result.metadata,
                "status": "completed",
                "completed": True,
                "artifactPersisted": True,
                "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Hugging Face media provider",
            },
        )

    return _huggingface_media_chat_diagnostic(
        model,
        inferred=inferred,
        message=(
            f"`{task_type}` 不是 OpenAI chat completion 能力。该模型已进入 PanAI 下拉框，"
            "但还需要对应的本地 worker endpoint 后才能从聊天窗口直接执行。"
        ),
        provider_mode="unsupported_non_chat_task",
    )


def _chat_media_payload(
    payload: dict[str, Any],
    *,
    prompt: str,
    source_prompt: str,
    task_type: str,
    model: str,
) -> dict[str, Any]:
    media_payload = dict(payload)
    media_payload["prompt"] = prompt
    media_payload["sourcePrompt"] = source_prompt
    media_payload["mode"] = task_type
    media_payload["model"] = model

    parameters = dict(_media_parameters(payload))
    if task_type == "text_to_image":
        parameters.setdefault("width", _int_env("ARCHITOKEN_HF_CHAT_IMAGE_WIDTH", 512))
        parameters.setdefault("height", _int_env("ARCHITOKEN_HF_CHAT_IMAGE_HEIGHT", 512))
        parameters.setdefault("steps", _int_env("ARCHITOKEN_HF_CHAT_IMAGE_STEPS", 8))
        parameters["negative_prompt"] = _merge_negative_prompt(parameters.get("negative_prompt") or parameters.get("negativePrompt"))
    media_payload["parameters"] = parameters
    media_payload.setdefault("timeoutSeconds", _int_env("ARCHITOKEN_HF_CHAT_MEDIA_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
    return media_payload


def _chat_media_prompt(prompt: str, *, task_type: str) -> str:
    cleaned = _strip_panai_chat_prefix(prompt)
    if normalize_task_type(task_type) != "text_to_image":
        return cleaned

    spec = _parse_dimensioned_component_spec(cleaned)
    if spec:
        if spec.get("objectKind") == "h_beam":
            return (
                "Clean studio product render of a single structural steel H-beam. "
                "Show only the physical H-shaped steel member on a neutral light background, with realistic metallic material, "
                "straight full-length composition, visible H profile geometry. "
                "Do not render any text, labels, dimensions, dates, timestamps, watermarks, UI, captions, or numbers in the image. "
                f"Object request: {cleaned}"
            )
        return (
            "Clean studio product render of a single slender brushed stainless steel pipe tube. "
            "Show only the physical pipe object on a neutral light background, with realistic metallic material, "
            "straight cylindrical shape, visible open circular rim, full-length composition. "
            "Do not render any text, labels, dimensions, dates, timestamps, watermarks, UI, captions, or numbers in the image. "
            f"Object request: {cleaned}"
        )

    return (
        f"{cleaned}\n\n"
        "Generate a clean image only. Do not render text, labels, dimensions, dates, timestamps, watermarks, UI, captions, or numbers inside the image."
    )


def _strip_panai_chat_prefix(prompt: str) -> str:
    stripped = prompt.strip()
    # PanAI prepends human-readable timestamps to chat messages; media models
    # otherwise draw those dates as fake labels or watermarks.
    cleaned = re.sub(
        r"^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+GMT[^\]]*\]\s*",
        "",
        stripped,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned or stripped


def _merge_negative_prompt(existing: Any) -> str:
    defaults = [
        "text",
        "letters",
        "numbers",
        "labels",
        "captions",
        "dimension marks",
        "wrong annotations",
        "timestamp",
        "date",
        "watermark",
        "UI",
        "screenshots",
        "malformed characters",
    ]
    if isinstance(existing, str) and existing.strip():
        return f"{existing.strip()}, {', '.join(defaults)}"
    return ", ".join(defaults)


def _apply_engineering_image_annotations(result: ProviderResult, source_prompt: str) -> ProviderResult:
    spec = _parse_dimensioned_component_spec(source_prompt)
    if not spec or not result.media_type.startswith("image/"):
        return result
    try:
        content = _render_engineering_annotation_panel(result.content, spec)
    except Exception as exc:  # noqa: BLE001 - keep provider artifact if annotation postprocess fails.
        metadata = {**result.metadata, "engineeringAnnotationError": _trim(str(exc))}
        return replace(result, metadata=metadata)

    metadata = {
        **result.metadata,
        "engineeringAnnotation": {
            "type": _engineering_annotation_type(spec),
            "labels": spec,
            "sourcePrompt": _strip_panai_chat_prefix(source_prompt),
            "note": "Generated image was post-processed with deterministic PanAI Chinese engineering labels.",
        },
    }
    filename = f"{Path(result.filename).stem}-annotated.png"
    return replace(
        result,
        media_type="image/png",
        content=content,
        filename=filename,
        summary=f"{result.summary} PanAI added deterministic Chinese engineering annotations.",
        metadata=metadata,
    )


def _try_render_local_engineering_image(model: str, source_prompt: str) -> ProviderResult | None:
    spec = _parse_dimensioned_component_spec(source_prompt)
    if not spec:
        return None
    if spec.get("objectKind") == "h_beam":
        content = _render_dimensioned_h_beam_schematic(spec)
        filename = f"panai-h-beam-schematic-{uuid.uuid4().hex}.png"
    else:
        content = _render_dimensioned_pipe_schematic(spec)
        filename = f"panai-pipe-schematic-{uuid.uuid4().hex}.png"
    return ProviderResult(
        engine="panai-local-cad-schematic",
        model=model,
        media_type="image/png",
        content=content,
        filename=filename,
        summary="PanAI rendered a deterministic CAD-style engineering schematic from parsed dimensions.",
        metadata={
            "provider": "panai",
            "providerMode": "local_cad_schematic",
            "taskType": "text_to_image",
            "capability": "image.generate",
            "engineeringAnnotation": {
                "type": _engineering_annotation_type(spec),
                "labels": spec,
                "sourcePrompt": _strip_panai_chat_prefix(source_prompt),
                "note": "Rendered locally by PanAI after parsing explicit engineering dimensions.",
            },
        },
    )


def _try_render_local_engineering_video(model: str, source_prompt: str) -> ProviderResult | None:
    cleaned = _strip_panai_chat_prefix(source_prompt)
    if not _looks_like_steel_construction_video_prompt(cleaned):
        return None
    content = _render_steel_construction_sequence_video(cleaned)
    return ProviderResult(
        engine="panai-local-engineering-animation",
        model=model,
        media_type="video/mp4",
        content=content,
        filename=f"panai-steel-construction-sequence-{uuid.uuid4().hex}.mp4",
        summary="PanAI rendered a deterministic steel construction sequence animation.",
        metadata={
            "provider": "panai",
            "providerMode": "local_engineering_animation",
            "taskType": "text_to_video",
            "requestedTaskType": "image_to_video",
            "capability": "video.generate",
            "engineeringAnimation": {
                "type": "steel_structure_construction_sequence",
                "sourcePrompt": cleaned,
                "labelsLanguage": "zh-CN",
                "note": "Concept animation only; not a construction method statement, fabrication drawing, or code-checked deliverable.",
            },
        },
    )


def _looks_like_steel_construction_video_prompt(prompt: str) -> bool:
    lowered = prompt.lower()
    has_video_intent = any(token in prompt for token in ("视频", "动画", "演示", "过程")) or "video" in lowered
    has_steel_intent = any(token in prompt for token in ("钢结构", "钢构", "重钢", "轻钢")) or "h型钢" in lowered or "h-beam" in lowered
    has_building_intent = any(token in prompt for token in ("建筑", "别墅", "宅基地", "房屋", "住宅", "厂房"))
    has_construction_intent = any(token in prompt for token in ("施工", "安装", "吊装", "建造", "搭建"))
    return (has_video_intent and (has_steel_intent or has_building_intent)) or (
        has_steel_intent and (has_construction_intent or has_building_intent)
    )


def _render_steel_construction_sequence_video(prompt: str) -> bytes:
    from PIL import Image, ImageDraw

    try:
        import cv2
        import numpy as np
    except Exception as exc:  # noqa: BLE001 - this is a runtime capability boundary.
        raise ProviderExecutionError("local engineering video rendering requires cv2 and numpy") from exc

    width = 1280
    height = 720
    fps = _int_env("ARCHITOKEN_PANAI_ENGINEERING_VIDEO_FPS", 12)
    duration_seconds = _int_env("ARCHITOKEN_PANAI_ENGINEERING_VIDEO_SECONDS", 5)
    fps = max(6, min(30, fps))
    frame_count = max(fps * 3, min(fps * 12, fps * duration_seconds))

    with tempfile.TemporaryDirectory(prefix="panai-steel-video-") as tmpdir:
        output_path = Path(tmpdir) / "steel-construction-sequence.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_path), fourcc, float(fps), (width, height))
        if not writer.isOpened():
            raise ProviderExecutionError("local engineering video encoder could not open an MP4 writer")

        for index in range(frame_count):
            progress = index / max(1, frame_count - 1)
            frame = Image.new("RGB", (width, height), (250, 252, 255))
            draw = ImageDraw.Draw(frame)
            _draw_steel_construction_frame(draw, progress, prompt, width, height)
            writer.write(cv2.cvtColor(np.array(frame), cv2.COLOR_RGB2BGR))
        writer.release()

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise ProviderExecutionError("local engineering video renderer completed without an MP4 artifact")
        return output_path.read_bytes()


def _draw_steel_construction_frame(
    draw: Any,
    progress: float,
    prompt: str,
    width: int,
    height: int,
) -> None:
    title_font = _load_annotation_font(32, bold=True)
    body_font = _load_annotation_font(22)
    small_font = _load_annotation_font(18)
    label_font = _load_annotation_font(20, bold=True)

    margin = 54
    draw.rectangle((margin, margin, width - margin, height - margin), outline=(205, 213, 224), width=2)
    draw.text((84, 82), "PanAI 钢结构施工概念动画", fill=(17, 24, 39), font=title_font)
    draw.text((84, 124), f"请求：{prompt[:44]}", fill=(71, 85, 105), font=body_font)

    site_left = 150
    site_right = 820
    ground_y = 575
    frame_top = 230
    bay_x = [250, 420, 590, 760]
    floor_y = [455, 365, 275]

    draw.line((site_left, ground_y, site_right + 80, ground_y), fill=(110, 122, 138), width=4)
    for x in range(site_left, site_right + 100, 42):
        draw.line((x, ground_y + 12, x + 18, ground_y), fill=(203, 213, 225), width=2)

    stages = [
        ("1 基础定位", "放线、基础与柱脚定位"),
        ("2 立柱吊装", "钢柱起吊、临时固定"),
        ("3 主梁安装", "主梁就位并形成框架"),
        ("4 次梁支撑", "次梁、斜撑与连接完善"),
        ("5 概念完成", "形成钢结构施工阶段示意"),
    ]
    stage_index = min(len(stages) - 1, int(progress * len(stages)))
    draw.rounded_rectangle((890, 205, 1185, 410), radius=12, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    draw.text((918, 232), "当前阶段", fill=(71, 85, 105), font=small_font)
    draw.text((918, 266), stages[stage_index][0], fill=(220, 38, 38), font=label_font)
    draw.text((918, 304), stages[stage_index][1], fill=(30, 41, 59), font=body_font)
    draw.text((918, 352), "状态：概念动画，非施工交底", fill=(71, 85, 105), font=small_font)

    foundation_progress = min(1.0, progress / 0.18)
    if foundation_progress > 0:
        for x in bay_x:
            w = int(62 * foundation_progress)
            draw.rectangle((x - w // 2, ground_y - 18, x + w // 2, ground_y + 8), fill=(148, 163, 184), outline=(71, 85, 105), width=2)
            draw.rectangle((x - 13, ground_y - 36, x + 13, ground_y - 18), fill=(226, 232, 240), outline=(71, 85, 105), width=2)

    column_progress = min(1.0, max(0.0, (progress - 0.16) / 0.25))
    for order, x in enumerate(bay_x):
        staggered = min(1.0, max(0.0, column_progress * 1.25 - order * 0.08))
        top = ground_y - int((ground_y - frame_top) * staggered)
        if staggered > 0:
            _draw_steel_member(draw, (x - 12, top, x + 12, ground_y - 34), vertical=True)

    beam_progress = min(1.0, max(0.0, (progress - 0.38) / 0.26))
    for row, y in enumerate(floor_y):
        row_progress = min(1.0, max(0.0, beam_progress * 1.25 - row * 0.14))
        if row_progress <= 0:
            continue
        for left, right in zip(bay_x[:-1], bay_x[1:]):
            end = left + int((right - left) * row_progress)
            _draw_steel_member(draw, (left - 12, y - 9, end + 12, y + 9), vertical=False)

    brace_progress = min(1.0, max(0.0, (progress - 0.62) / 0.22))
    if brace_progress > 0:
        brace_color = (37, 99, 235)
        for left, right in ((bay_x[0], bay_x[1]), (bay_x[2], bay_x[3])):
            mid_y = int(floor_y[1] + (floor_y[0] - floor_y[1]) * (1 - brace_progress))
            draw.line((left + 16, floor_y[0] - 12, right - 16, mid_y), fill=brace_color, width=5)
            draw.line((right - 16, floor_y[0] - 12, left + 16, mid_y), fill=brace_color, width=5)

    crane_progress = min(1.0, max(0.0, (progress - 0.18) / 0.45))
    hook_x = int(160 + (760 - 160) * crane_progress)
    hook_y = int(180 + 45 * abs(0.5 - crane_progress))
    draw.line((120, 170, 835, 170), fill=(100, 116, 139), width=5)
    draw.line((120, 170, 120, ground_y), fill=(100, 116, 139), width=5)
    draw.line((hook_x, 170, hook_x, hook_y), fill=(239, 68, 68), width=3)
    draw.rectangle((hook_x - 24, hook_y, hook_x + 24, hook_y + 18), fill=(239, 68, 68))
    draw.text((hook_x - 34, hook_y + 24), "吊装", fill=(185, 28, 28), font=small_font)

    if progress > 0.84:
        draw.rounded_rectangle((892, 444, 1185, 555), radius=12, fill=(240, 253, 244), outline=(34, 197, 94), width=2)
        draw.text((918, 474), "输出边界", fill=(22, 101, 52), font=label_font)
        draw.text((918, 510), "工程概念动画；需专业校核后使用", fill=(22, 101, 52), font=small_font)


def _draw_steel_member(draw: Any, box: tuple[int, int, int, int], *, vertical: bool) -> None:
    x1, y1, x2, y2 = box
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1
    if x2 - x1 < 2 or y2 - y1 < 2:
        return
    box = (x1, y1, x2, y2)
    fill = (174, 187, 201)
    edge = (51, 65, 85)
    highlight = (226, 232, 240)
    draw.rectangle(box, fill=fill, outline=edge, width=2)
    if vertical:
        cx = (x1 + x2) // 2
        draw.line((cx, y1 + 2, cx, y2 - 2), fill=highlight, width=2)
    else:
        cy = (y1 + y2) // 2
        draw.line((x1 + 2, cy, x2 - 2, cy), fill=highlight, width=2)


def _parse_dimensioned_component_spec(prompt: str) -> dict[str, str] | None:
    cleaned = _strip_panai_chat_prefix(prompt)
    if _looks_like_h_beam_prompt(cleaned):
        length_mm = _extract_dimension_mm(
            cleaned,
            (
                r"(?:长度|长|length)\s*[:：为是=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|毫米|cm|厘米|m|米)",
                r"([0-9]+(?:\.[0-9]+)?)\s*(mm|毫米|cm|厘米|m|米)\s*(?:长|长度)",
            ),
        )
        if length_mm is None:
            return None
        return {
            "objectKind": "h_beam",
            "object": "H型钢",
            "length": _format_mm(length_mm),
            "section": "未指定",
        }
    return _parse_dimensioned_pipe_spec(cleaned)


def _looks_like_h_beam_prompt(prompt: str) -> bool:
    lowered = prompt.lower()
    return bool(
        re.search(r"h\s*型\s*钢", prompt, flags=re.IGNORECASE)
        or re.search(r"h\s*钢", prompt, flags=re.IGNORECASE)
        or "工字钢" in prompt
        or "h-beam" in lowered
        or "h beam" in lowered
        or "i-beam" in lowered
        or "i beam" in lowered
    )


def _parse_dimensioned_pipe_spec(prompt: str) -> dict[str, str] | None:
    cleaned = _strip_panai_chat_prefix(prompt)
    lowered = cleaned.lower()
    if "pipe" not in lowered and "管" not in cleaned:
        return None

    length_mm = _extract_dimension_mm(
        cleaned,
        (
            r"(?:长度|长|length)\s*[:：为是=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|毫米|cm|厘米|m|米)",
            r"([0-9]+(?:\.[0-9]+)?)\s*(m|米)\s*(?:长|长度)",
        ),
    )
    diameter_mm = _extract_dimension_mm(
        cleaned,
        (
            r"(?:直径|外径|管径|diameter|od)\s*[:：为是=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|毫米|cm|厘米|m|米)",
        ),
    )
    if length_mm is None and diameter_mm is None:
        return None

    spec: dict[str, str] = {"objectKind": "pipe", "object": "钢管" if "钢" in cleaned else "管件"}
    if length_mm is not None:
        spec["length"] = _format_mm(length_mm)
    if diameter_mm is not None:
        spec["outsideDiameter"] = _format_mm(diameter_mm)
    return spec


def _engineering_annotation_type(spec: dict[str, str]) -> str:
    if spec.get("objectKind") == "h_beam":
        return "dimensioned_h_beam"
    return "dimensioned_pipe"


def _extract_dimension_mm(text: str, patterns: tuple[str, ...]) -> float | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        value = float(match.group(1))
        unit = match.group(2).lower()
        if unit in {"m", "米"}:
            return value * 1000
        if unit in {"cm", "厘米"}:
            return value * 10
        return value
    return None


def _format_mm(value: float) -> str:
    return f"{int(value)} mm" if value.is_integer() else f"{value:g} mm"


def _render_dimensioned_pipe_schematic(spec: dict[str, str]) -> bytes:
    from PIL import Image, ImageDraw

    width = 1100
    height = 700
    margin = 64
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    font = _load_annotation_font(18)
    title_font = _load_annotation_font(28, bold=True)

    draw.rectangle((margin, margin, width - margin, height - margin), outline=(209, 213, 219), width=2)
    draw.text((margin + 24, margin + 16), "PanAI 工程示意图", fill=(17, 24, 39), font=title_font)
    draw.text((margin + 24, margin + 54), "尺寸化钢管概念示意", fill=(75, 85, 99), font=font)

    pipe_left = margin + 150
    pipe_right = width - margin - 240
    pipe_center_y = height // 2
    pipe_radius = 38
    pipe_top = pipe_center_y - pipe_radius
    pipe_bottom = pipe_center_y + pipe_radius

    for i in range(pipe_left, pipe_right):
        ratio = (i - pipe_left) / max(1, pipe_right - pipe_left)
        shade = int(188 + 42 * abs(0.5 - ratio))
        draw.line((i, pipe_top, i, pipe_bottom), fill=(shade, shade + 6, shade + 12))
    draw.rectangle((pipe_left, pipe_top, pipe_right, pipe_bottom), outline=(71, 85, 105), width=3)
    draw.ellipse((pipe_left - 20, pipe_top, pipe_left + 20, pipe_bottom), fill=(229, 236, 244), outline=(71, 85, 105), width=3)
    draw.ellipse((pipe_right - 20, pipe_top, pipe_right + 20, pipe_bottom), fill=(235, 240, 246), outline=(71, 85, 105), width=3)
    draw.ellipse((pipe_right - 10, pipe_center_y - 18, pipe_right + 10, pipe_center_y + 18), fill=(255, 255, 255), outline=(107, 114, 128), width=2)

    if spec.get("length"):
        dim_y = pipe_bottom + 78
        draw.line((pipe_left, dim_y, pipe_right, dim_y), fill=(37, 99, 235), width=3)
        draw.line((pipe_left, dim_y - 14, pipe_left, dim_y + 14), fill=(37, 99, 235), width=3)
        draw.line((pipe_right, dim_y - 14, pipe_right, dim_y + 14), fill=(37, 99, 235), width=3)
        draw.polygon([(pipe_left, dim_y), (pipe_left + 14, dim_y - 8), (pipe_left + 14, dim_y + 8)], fill=(37, 99, 235))
        draw.polygon([(pipe_right, dim_y), (pipe_right - 14, dim_y - 8), (pipe_right - 14, dim_y + 8)], fill=(37, 99, 235))
        _draw_centered_text(draw, ((pipe_left + pipe_right) // 2, dim_y + 28), f"长度 = {spec['length']}", font, (37, 99, 235))

    if spec.get("outsideDiameter"):
        dia_x = pipe_right + 82
        draw.line((dia_x, pipe_top, dia_x, pipe_bottom), fill=(220, 38, 38), width=3)
        draw.line((dia_x - 14, pipe_top, dia_x + 14, pipe_top), fill=(220, 38, 38), width=3)
        draw.line((dia_x - 14, pipe_bottom, dia_x + 14, pipe_bottom), fill=(220, 38, 38), width=3)
        draw.polygon([(dia_x, pipe_top), (dia_x - 8, pipe_top + 14), (dia_x + 8, pipe_top + 14)], fill=(220, 38, 38))
        draw.polygon([(dia_x, pipe_bottom), (dia_x - 8, pipe_bottom - 14), (dia_x + 8, pipe_bottom - 14)], fill=(220, 38, 38))
        draw.text((dia_x + 18, pipe_center_y - 12), f"外径 = {spec['outsideDiameter']}", fill=(220, 38, 38), font=font)

    table_x = margin + 24
    table_y = height - margin - 142
    draw.rectangle((table_x, table_y, width - margin - 24, height - margin - 24), outline=(229, 231, 235), width=2)
    rows = [
        ("对象", spec.get("object", "管件")),
        ("长度", spec.get("length", "未指定")),
        ("外径", spec.get("outsideDiameter", "未指定")),
        ("状态", "概念示意，非加工详图"),
    ]
    y = table_y + 18
    for key, value in rows:
        draw.text((table_x + 18, y), key, fill=(75, 85, 99), font=font)
        draw.text((table_x + 170, y), value, fill=(17, 24, 39), font=font)
        y += 24

    output = io.BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue()


def _render_dimensioned_h_beam_schematic(spec: dict[str, str]) -> bytes:
    from PIL import Image, ImageDraw

    width = 1100
    height = 700
    margin = 64
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    font = _load_annotation_font(18)
    title_font = _load_annotation_font(28, bold=True)

    draw.rectangle((margin, margin, width - margin, height - margin), outline=(209, 213, 219), width=2)
    draw.text((margin + 24, margin + 16), "PanAI 工程示意图", fill=(17, 24, 39), font=title_font)
    draw.text((margin + 24, margin + 54), "尺寸化 H 型钢概念示意", fill=(75, 85, 99), font=font)

    beam_left = margin + 110
    beam_right = width - margin - 300
    beam_center_y = height // 2 - 28
    flange_thick = 24
    beam_height = 138
    web_thick = 42
    top_y = beam_center_y - beam_height // 2
    bottom_y = beam_center_y + beam_height // 2

    for x in range(beam_left, beam_right):
        ratio = (x - beam_left) / max(1, beam_right - beam_left)
        shade = int(166 + 36 * abs(0.5 - ratio))
        steel = (shade, shade + 8, shade + 14)
        draw.line((x, top_y, x, top_y + flange_thick), fill=steel)
        draw.line((x, bottom_y - flange_thick, x, bottom_y), fill=steel)
        draw.line((x, beam_center_y - web_thick // 2, x, beam_center_y + web_thick // 2), fill=(shade - 10, shade - 2, shade + 5))
    draw.rectangle((beam_left, top_y, beam_right, top_y + flange_thick), outline=(71, 85, 105), width=3)
    draw.rectangle((beam_left, bottom_y - flange_thick, beam_right, bottom_y), outline=(71, 85, 105), width=3)
    draw.rectangle((beam_left, beam_center_y - web_thick // 2, beam_right, beam_center_y + web_thick // 2), outline=(71, 85, 105), width=3)

    section_x = beam_right + 104
    section_w = 118
    section_h = 154
    section_top = beam_center_y - section_h // 2
    section_bottom = beam_center_y + section_h // 2
    section_left = section_x - section_w // 2
    section_right = section_x + section_w // 2
    draw.rectangle((section_left, section_top, section_right, section_top + 22), fill=(190, 200, 210), outline=(71, 85, 105), width=2)
    draw.rectangle((section_left, section_bottom - 22, section_right, section_bottom), fill=(190, 200, 210), outline=(71, 85, 105), width=2)
    draw.rectangle((section_x - 14, section_top + 22, section_x + 14, section_bottom - 22), fill=(176, 188, 200), outline=(71, 85, 105), width=2)
    _draw_centered_text(draw, (section_x, section_bottom + 28), "截面示意", font, (75, 85, 99))

    if spec.get("length"):
        dim_y = bottom_y + 78
        draw.line((beam_left, dim_y, beam_right, dim_y), fill=(37, 99, 235), width=3)
        draw.line((beam_left, dim_y - 14, beam_left, dim_y + 14), fill=(37, 99, 235), width=3)
        draw.line((beam_right, dim_y - 14, beam_right, dim_y + 14), fill=(37, 99, 235), width=3)
        draw.polygon([(beam_left, dim_y), (beam_left + 14, dim_y - 8), (beam_left + 14, dim_y + 8)], fill=(37, 99, 235))
        draw.polygon([(beam_right, dim_y), (beam_right - 14, dim_y - 8), (beam_right - 14, dim_y + 8)], fill=(37, 99, 235))
        _draw_centered_text(draw, ((beam_left + beam_right) // 2, dim_y + 28), f"长度 = {spec['length']}", font, (37, 99, 235))

    table_x = margin + 24
    table_y = height - margin - 142
    draw.rectangle((table_x, table_y, width - margin - 24, height - margin - 24), outline=(229, 231, 235), width=2)
    rows = [
        ("对象", spec.get("object", "H型钢")),
        ("长度", spec.get("length", "未指定")),
        ("截面", spec.get("section", "未指定")),
        ("状态", "概念示意，非加工详图"),
    ]
    y = table_y + 18
    for key, value in rows:
        draw.text((table_x + 18, y), key, fill=(75, 85, 99), font=font)
        draw.text((table_x + 170, y), value, fill=(17, 24, 39), font=font)
        y += 24

    output = io.BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue()


def _load_annotation_font(size: int, *, bold: bool = False) -> Any:
    from PIL import ImageFont

    candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    ]
    for candidate in candidates:
        if not Path(candidate).exists():
            continue
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_centered_text(draw: Any, center: tuple[int, int], text: str, font: Any, fill: tuple[int, int, int]) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    draw.text((center[0] - text_width // 2, center[1] - text_height // 2), text, fill=fill, font=font)


def _render_engineering_annotation_panel(image_bytes: bytes, spec: dict[str, str]) -> bytes:
    from PIL import Image, ImageDraw

    source = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    max_side = 520
    if max(source.size) > max_side:
        scale = max_side / max(source.size)
        source = source.resize((max(1, int(source.width * scale)), max(1, int(source.height * scale))), Image.Resampling.LANCZOS)

    margin = 28
    panel_width = 360
    canvas_width = source.width + panel_width + margin * 3
    canvas_height = max(source.height + margin * 2, 600)
    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    image_y = (canvas_height - source.height) // 2
    canvas.paste(source, (margin, image_y))

    draw = ImageDraw.Draw(canvas)
    font = _load_annotation_font(17)
    title_font = _load_annotation_font(23, bold=True)
    panel_x = source.width + margin * 2

    draw.rectangle((panel_x - 12, margin, canvas_width - margin, canvas_height - margin), outline=(214, 221, 230), width=2)
    draw.text((panel_x, margin + 18), "PanAI 工程标注", fill=(17, 24, 39), font=title_font)
    draw.text((panel_x, margin + 52), "解析尺寸：", fill=(75, 85, 99), font=font)

    labels = [
        ("对象", spec.get("object", "构件")),
        ("长度", spec.get("length")),
        ("外径", spec.get("outsideDiameter")),
        ("截面", spec.get("section") if spec.get("objectKind") == "h_beam" else None),
    ]
    y = margin + 84
    for key, value in labels:
        if not value:
            continue
        draw.text((panel_x, y), f"{key}：{value}", fill=(17, 24, 39), font=font)
        y += 24

    diagram_top = margin + 170
    diagram_bottom = canvas_height - margin - 86
    component_center_x = panel_x + 160
    if spec.get("objectKind") == "h_beam":
        flange_w = 74
        flange_h = 18
        web_w = 18
        draw.rectangle(
            (component_center_x - flange_w // 2, diagram_top, component_center_x + flange_w // 2, diagram_top + flange_h),
            fill=(198, 208, 218),
            outline=(75, 85, 99),
            width=2,
        )
        draw.rectangle(
            (component_center_x - flange_w // 2, diagram_bottom - flange_h, component_center_x + flange_w // 2, diagram_bottom),
            fill=(198, 208, 218),
            outline=(75, 85, 99),
            width=2,
        )
        draw.rectangle(
            (component_center_x - web_w // 2, diagram_top + flange_h, component_center_x + web_w // 2, diagram_bottom - flange_h),
            fill=(176, 188, 200),
            outline=(75, 85, 99),
            width=2,
        )
    else:
        pipe_width = 28
        draw.rounded_rectangle(
            (component_center_x - pipe_width // 2, diagram_top, component_center_x + pipe_width // 2, diagram_bottom),
            radius=pipe_width // 2,
            fill=(198, 208, 218),
            outline=(75, 85, 99),
            width=2,
        )
        draw.ellipse(
            (component_center_x - pipe_width // 2, diagram_top - 6, component_center_x + pipe_width // 2, diagram_top + 8),
            fill=(235, 241, 245),
            outline=(75, 85, 99),
            width=2,
        )

    if spec.get("length"):
        arrow_x = component_center_x - 62
        draw.line((arrow_x, diagram_top, arrow_x, diagram_bottom), fill=(37, 99, 235), width=2)
        draw.line((arrow_x - 8, diagram_top, arrow_x + 8, diagram_top), fill=(37, 99, 235), width=2)
        draw.line((arrow_x - 8, diagram_bottom, arrow_x + 8, diagram_bottom), fill=(37, 99, 235), width=2)
        draw.text((arrow_x - 58, diagram_top - 28), f"长度 = {spec['length']}", fill=(37, 99, 235), font=font)

    if spec.get("outsideDiameter"):
        dia_y = diagram_top + 70
        pipe_width = 28
        draw.line((component_center_x - pipe_width // 2, dia_y, component_center_x + pipe_width // 2, dia_y), fill=(220, 38, 38), width=2)
        draw.text((component_center_x + 28, dia_y - 10), f"外径 = {spec['outsideDiameter']}", fill=(220, 38, 38), font=font)

    draw.text(
        (panel_x, canvas_height - margin - 52),
        "概念渲染 + 确定性标注。",
        fill=(75, 85, 99),
        font=font,
    )
    draw.text(
        (panel_x, canvas_height - margin - 30),
        "非加工详图。",
        fill=(75, 85, 99),
        font=font,
    )

    output = io.BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue()


def _huggingface_media_chat_diagnostic(
    model: str,
    *,
    inferred: dict[str, str],
    message: str,
    provider_mode: str,
) -> ChatProviderResult:
    local_repository = _huggingface_model_repository_path(model)
    runtime = _local_runtime_descriptor(model, inferred, local_repository)
    content = (
        f"你选择了 Hugging Face 模型 `{model}`，模型已经进入 PanAI 下拉框。\n\n"
        f"能力类型：`{inferred['taskType']}` / `{inferred['capability']}`。\n"
        f"当前还不能执行该请求：{message}"
    )
    if runtime.get("requiresRuntime"):
        content += f"\n\n需要的本地运行时：{runtime['requiresRuntime']}"
    if runtime.get("endpointPath"):
        content += f"\n建议 endpoint：`{runtime['endpointPath']}`"
    if local_repository:
        content += f"\n本地缓存路径：`{local_repository}`"
    return ChatProviderResult(
        engine="huggingface-router-diagnostic",
        model=model,
        content=content,
        usage={},
        metadata={
            "provider": "huggingface",
            "providerMode": provider_mode,
            "taskType": inferred["taskType"],
            "capability": inferred["capability"],
            "requestedModel": model,
            "runtime": runtime,
            "localRepository": local_repository,
            "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Hugging Face capability router",
        },
    )


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
    served_models = _list_huggingface_chat_endpoint_models()
    if served_models and model not in served_models:
        fallback = _run_chat_fallback_if_available(
            messages,
            payload,
            requested_model=model,
            route=route,
            reason="huggingface_endpoint_does_not_serve_requested_model",
        )
        if fallback is not None:
            return fallback
        return _unserved_huggingface_chat_model_result(model, route=route, endpoint_url=endpoint_url, served_models=served_models)
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
            "localRepository": _huggingface_model_repository_path(model),
            "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Hugging Face local/vLLM provider",
        },
    )


def _unserved_huggingface_chat_model_result(
    model: str,
    *,
    route: Any,
    endpoint_url: str,
    served_models: dict[str, dict[str, Any]],
) -> ChatProviderResult:
    available = ", ".join(sorted(served_models)) or "none"
    local_repository = _huggingface_model_repository_path(model)
    content = (
        f"你选择了 Hugging Face 模型 `{model}`，它已经进入 PanAI 下拉框，但当前还没有被 "
        "vLLM / TGI / llama.cpp / 自定义 worker 作为 chat endpoint 加载。\n\n"
        f"当前可直接聊天的 HF endpoint 模型是：{available}。\n"
        "我不会把其他模型伪装成这个模型来回答。要真正使用它，请先启动对应的本地推理服务，"
        "并让该服务的 `/v1/models` 广告完全相同的 model id。"
    )
    if local_repository:
        content += f"\n\n本地缓存路径：`{local_repository}`"
    return ChatProviderResult(
        engine="huggingface-router-diagnostic",
        model=model,
        content=content,
        usage={},
        metadata={
            "provider": "huggingface",
            "providerMode": "router_diagnostic",
            "taskType": route.task_type,
            "capability": route.capability,
            "endpoint": _redacted_hf_url(endpoint_url),
            "localRepository": local_repository,
            "requestedModel": model,
            "servedModels": sorted(served_models),
            "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Hugging Face local/vLLM provider",
        },
    )


DEFAULT_CHAT_FALLBACK_MODEL_ALIASES: dict[str, tuple[str, str]] = {
    "redhatai/qwen3.6-35b-a3b-nvfp4": ("ollama", "qwen3.6:35b-a3b"),
    "unsloth/qwen3.6-27b-nvfp4": ("ollama", "qwen3.6:35b-a3b"),
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning-nvfp4": ("ollama", "nemotron-3-nano:30b"),
    "multilingual-multimodal-nlp/industrialcoder-thinking-32b-fp8": ("ollama", "qwen3.6:35b-a3b"),
    "nvidia/gemma-4-31b-it-nvfp4": ("ollama", "gemma4:31b-it-q8_0"),
    "nvidia/gemma-4-26b-a4b-nvfp4": ("ollama", "gemma4:26b-a4b-it-q8_0"),
    "mlx-community/granite-4.1-30b-nvfp4": ("ollama", "granite4.1:30b-q8_0"),
    "mlx-community/gemma-4-31b-it-nvfp4": ("ollama", "gemma4:31b-it-q8_0"),
    "mlx-community/gemma-4-31b-nvfp4": ("ollama", "gemma4:31b-it-q8_0"),
}


def _run_chat_fallback_if_available(
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    *,
    requested_model: str,
    route: Any,
    reason: str,
) -> ChatProviderResult | None:
    if not _chat_fallback_enabled():
        return None

    failures: list[str] = []
    for candidate in _chat_fallback_candidates(requested_model):
        try:
            return _run_openai_compatible_chat_candidate(
                messages,
                payload,
                candidate=candidate,
                requested_model=requested_model,
                route=route,
                reason=reason,
            )
        except ProviderConfigurationError as exc:
            failures.append(f"{candidate.provider}/{candidate.model}: {_trim(str(exc))}")
            continue
        except ProviderExecutionError as exc:
            failures.append(f"{candidate.provider}/{candidate.model}: {_trim(str(exc))}")
            continue

    if failures and _truthy_env("ARCHITOKEN_CHAT_FALLBACK_DIAGNOSTICS"):
        return ChatProviderResult(
            engine="chat-fallback-diagnostic",
            model=requested_model,
            content=(
                f"你选择的 Hugging Face 模型 `{requested_model}` 当前没有可执行 HF/vLLM chat runtime。"
                "我尝试了已启用的 fallback runtime，但都没有成功：\n"
                + "\n".join(f"- {item}" for item in failures)
            ),
            usage={},
            metadata={
                "provider": "huggingface",
                "providerMode": "chat_fallback_diagnostic",
                "taskType": route.task_type,
                "capability": route.capability,
                "requestedModel": requested_model,
                "fallbackReason": reason,
                "fallbackFailures": failures,
            },
        )
    return None


def _chat_fallback_enabled() -> bool:
    return (
        _truthy_env("ARCHITOKEN_ENABLE_CHAT_FALLBACK")
        or _truthy_env("ARCHITOKEN_ALLOW_OLLAMA_FALLBACK")
    )


def _chat_fallback_candidates(requested_model: str) -> list[ChatFallbackCandidate]:
    candidates: list[ChatFallbackCandidate] = []
    candidates.extend(_configured_chat_fallback_candidates(requested_model))

    requested_as_ollama = _chat_fallback_candidate("ollama", requested_model)
    if requested_as_ollama:
        candidates.append(requested_as_ollama)

    requested_key = requested_model.lower()
    provider_model = DEFAULT_CHAT_FALLBACK_MODEL_ALIASES.get(requested_key)
    if provider_model:
        provider, model = provider_model
        candidate = _chat_fallback_candidate(provider, model)
        if candidate:
            candidates.append(candidate)

    for model in (
        _env("ARCHITOKEN_OLLAMA_CHAT_MODEL"),
        _env("OLLAMA_CHAT_MODEL"),
        "qwen3.6:35b-a3b",
        "nemotron-3-nano:30b",
        "Insome:12B",
    ):
        candidate = _chat_fallback_candidate("ollama", model)
        if candidate:
            candidates.append(candidate)

    lm_studio_model = _env("ARCHITOKEN_LM_STUDIO_CHAT_MODEL") or _env("LM_STUDIO_CHAT_MODEL")
    candidate = _chat_fallback_candidate("lm_studio", lm_studio_model)
    if candidate:
        candidates.append(candidate)

    openrouter_model = _env("ARCHITOKEN_OPENROUTER_CHAT_MODEL") or _env("OPENROUTER_CHAT_MODEL")
    if openrouter_model and (_env("OPENROUTER_API_KEY") or _env("OPENROUTER_TOKEN")):
        candidate = _chat_fallback_candidate("openrouter", openrouter_model)
        if candidate:
            candidates.append(candidate)

    deduped: list[ChatFallbackCandidate] = []
    seen: set[tuple[str, str, str]] = set()
    for candidate in candidates:
        key = (candidate.provider, candidate.model, candidate.base_url)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def _first_available_chat_fallback(requested_model: str) -> ChatFallbackCandidate | None:
    if not _chat_fallback_enabled():
        return None
    for candidate in _chat_fallback_candidates(requested_model):
        endpoint_url = _chat_completion_url(candidate.base_url)
        served_models = _openai_chat_models_for_endpoint(endpoint_url)
        if served_models and candidate.model in served_models:
            return candidate
    return None


def _configured_chat_fallback_candidates(requested_model: str) -> list[ChatFallbackCandidate]:
    raw = _env("ARCHITOKEN_CHAT_MODEL_FALLBACKS")
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, dict):
        return []

    values = []
    for key in (requested_model, requested_model.lower(), "*"):
        if key in parsed:
            values.append(parsed[key])

    candidates: list[ChatFallbackCandidate] = []
    for value in values:
        candidate = _chat_fallback_candidate_from_config(value)
        if candidate:
            candidates.append(candidate)
    return candidates


def _chat_fallback_candidate_from_config(value: Any) -> ChatFallbackCandidate | None:
    if isinstance(value, str) and value.strip():
        return _chat_fallback_candidate("ollama", value.strip())
    if not isinstance(value, dict):
        return None
    provider = str(value.get("provider") or "ollama").strip()
    model = str(value.get("model") or "").strip()
    if not model:
        return None
    base_url = value.get("baseUrl") or value.get("base_url")
    api_key_env = value.get("apiKeyEnv") or value.get("api_key_env")
    return _chat_fallback_candidate(
        provider,
        model,
        base_url=str(base_url).strip() if isinstance(base_url, str) and base_url.strip() else None,
        api_key_env=str(api_key_env).strip() if isinstance(api_key_env, str) and api_key_env.strip() else None,
    )


def _chat_fallback_candidate(
    provider: str,
    model: str | None,
    *,
    base_url: str | None = None,
    api_key_env: str | None = None,
) -> ChatFallbackCandidate | None:
    if not model or not model.strip():
        return None
    normalized_provider = provider.strip().lower().replace("-", "_")
    if normalized_provider == "lmstudio":
        normalized_provider = "lm_studio"
    if normalized_provider == "ollama":
        base = base_url or _env("ARCHITOKEN_OLLAMA_BASE_URL") or _env("OLLAMA_BASE_URL") or "http://127.0.0.1:11434/v1"
        return ChatFallbackCandidate("ollama", model.strip(), base, api_key_env)
    if normalized_provider == "lm_studio":
        base = base_url or _env("ARCHITOKEN_LM_STUDIO_BASE_URL") or _env("LM_STUDIO_BASE_URL") or "http://127.0.0.1:1234/v1"
        return ChatFallbackCandidate("lm_studio", model.strip(), base, api_key_env)
    if normalized_provider == "openrouter":
        base = base_url or _env("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1"
        return ChatFallbackCandidate("openrouter", model.strip(), base, api_key_env or "OPENROUTER_API_KEY")
    if normalized_provider in {"openai_compatible", "custom"}:
        base = base_url or _env("OPENAI_COMPATIBLE_BASE_URL")
        if not base:
            return None
        return ChatFallbackCandidate("openai_compatible", model.strip(), base, api_key_env or "OPENAI_COMPATIBLE_API_KEY")
    return None


def _run_openai_compatible_chat_candidate(
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    *,
    candidate: ChatFallbackCandidate,
    requested_model: str,
    route: Any,
    reason: str,
) -> ChatProviderResult:
    if candidate.provider == "ollama":
        return _run_ollama_native_chat_candidate(
            messages,
            payload,
            candidate=candidate,
            requested_model=requested_model,
            route=route,
            reason=reason,
        )

    endpoint_url = _chat_completion_url(candidate.base_url)
    served_models = _openai_chat_models_for_endpoint(endpoint_url)
    if served_models and candidate.model not in served_models:
        raise ProviderConfigurationError(f"model is not advertised by {_openai_models_url(endpoint_url)}")
    if not served_models and _is_local_http_url(endpoint_url):
        raise ProviderConfigurationError(f"models endpoint is not reachable at {_openai_models_url(endpoint_url)}")

    body: dict[str, Any] = {
        "model": candidate.model,
        "stream": False,
        "temperature": _number_payload(payload, "temperature", 0.2),
        "max_tokens": int(_number_payload(payload, "max_tokens", _number_payload(payload, "maxTokens", 768))),
        "messages": messages,
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    token = _env(candidate.api_key_env) if candidate.api_key_env else None
    if not token and candidate.provider == "openrouter":
        token = _env("OPENROUTER_TOKEN")
    if token:
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
        raise ProviderExecutionError(f"fallback runtime returned HTTP {exc.code}: {_trim(error_body)}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExecutionError(f"fallback runtime request failed: {exc.reason}") from exc
    except (http.client.RemoteDisconnected, ConnectionResetError, TimeoutError) as exc:
        raise ProviderExecutionError(f"fallback runtime disconnected: {_trim(str(exc))}") from exc

    try:
        decoded = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ProviderExecutionError(f"fallback runtime returned {media_type}, expected application/json") from exc
    if isinstance(decoded, dict) and decoded.get("error"):
        raise ProviderExecutionError(_trim(str(decoded["error"])))

    content = _extract_chat_content(decoded)
    if not content:
        raise ProviderExecutionError("fallback runtime returned no assistant content")
    if _looks_like_provider_sentinel(content):
        raise ProviderExecutionError(f"fallback runtime returned a non-business sentinel: {_trim(content)}")

    served_model = str(decoded.get("model") or candidate.model) if isinstance(decoded, dict) else candidate.model
    return ChatProviderResult(
        engine=f"{candidate.provider}-chat-fallback",
        model=served_model,
        content=content,
        usage=decoded.get("usage", {}) if isinstance(decoded, dict) and isinstance(decoded.get("usage"), dict) else {},
        metadata={
            "provider": candidate.provider,
            "providerMode": "chat_fallback",
            "requestedProvider": "huggingface",
            "requestedModel": requested_model,
            "servedModel": served_model,
            "fallbackReason": reason,
            "taskType": route.task_type,
            "capability": route.capability,
            "endpoint": _redacted_hf_url(endpoint_url),
            "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Chat runtime fallback",
        },
    )


def _run_ollama_native_chat_candidate(
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    *,
    candidate: ChatFallbackCandidate,
    requested_model: str,
    route: Any,
    reason: str,
) -> ChatProviderResult:
    openai_endpoint_url = _chat_completion_url(candidate.base_url)
    served_models = _openai_chat_models_for_endpoint(openai_endpoint_url)
    if served_models and candidate.model not in served_models:
        raise ProviderConfigurationError(f"model is not advertised by {_openai_models_url(openai_endpoint_url)}")
    if not served_models and _is_local_http_url(openai_endpoint_url):
        raise ProviderConfigurationError(f"models endpoint is not reachable at {_openai_models_url(openai_endpoint_url)}")

    endpoint_url = _ollama_native_chat_url(candidate.base_url)
    body: dict[str, Any] = {
        "model": candidate.model,
        "stream": False,
        "think": False,
        "keep_alive": _env("ARCHITOKEN_OLLAMA_KEEP_ALIVE") or _env("OLLAMA_KEEP_ALIVE") or "30s",
        "messages": messages,
        "options": {
            "temperature": _number_payload(payload, "temperature", 0.2),
            "num_predict": int(_number_payload(payload, "max_tokens", _number_payload(payload, "maxTokens", 768))),
            "num_ctx": int(
                _number_payload(
                    payload,
                    "num_ctx",
                    _number_payload(
                        payload,
                        "numCtx",
                        _int_env("ARCHITOKEN_OLLAMA_NUM_CTX", _int_env("OLLAMA_NUM_CTX", 8192)),
                    ),
                )
            ),
        },
    }
    request = urllib.request.Request(
        endpoint_url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=int(payload.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS)) as response:
            response_body = response.read()
            media_type = _clean_content_type(response.headers.get("Content-Type") or "application/json")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise ProviderExecutionError(f"Ollama fallback returned HTTP {exc.code}: {_trim(error_body)}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExecutionError(f"Ollama fallback request failed: {exc.reason}") from exc
    except (http.client.RemoteDisconnected, ConnectionResetError, TimeoutError) as exc:
        raise ProviderExecutionError(f"Ollama fallback disconnected: {_trim(str(exc))}") from exc

    try:
        decoded = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ProviderExecutionError(f"Ollama fallback returned {media_type}, expected application/json") from exc
    if isinstance(decoded, dict) and decoded.get("error"):
        raise ProviderExecutionError(_trim(str(decoded["error"])))

    message = decoded.get("message") if isinstance(decoded, dict) else None
    content = _content_to_text(message.get("content")) if isinstance(message, dict) else ""
    if not content:
        content = _extract_chat_content(decoded)
    if not content:
        raise ProviderExecutionError("Ollama fallback returned no assistant content")
    if _looks_like_provider_sentinel(content):
        raise ProviderExecutionError(f"Ollama fallback returned a non-business sentinel: {_trim(content)}")

    usage = {}
    if isinstance(decoded, dict):
        prompt_tokens = decoded.get("prompt_eval_count")
        completion_tokens = decoded.get("eval_count")
        if isinstance(prompt_tokens, int) or isinstance(completion_tokens, int):
            usage = {
                "prompt_tokens": prompt_tokens or 0,
                "completion_tokens": completion_tokens or 0,
                "total_tokens": (prompt_tokens or 0) + (completion_tokens or 0),
            }

    served_model = str(decoded.get("model") or candidate.model) if isinstance(decoded, dict) else candidate.model
    return ChatProviderResult(
        engine="ollama-chat-fallback",
        model=served_model,
        content=content,
        usage=usage,
        metadata={
            "provider": "ollama",
            "providerMode": "chat_fallback",
            "requestedProvider": "huggingface",
            "requestedModel": requested_model,
            "servedModel": served_model,
            "fallbackReason": reason,
            "taskType": route.task_type,
            "capability": route.capability,
            "endpoint": _redacted_hf_url(endpoint_url),
            "router": "PanAIRouter -> ModelRouter -> InferenceRouter -> Ollama native chat fallback",
        },
    )


def _last_user_prompt(messages: list[dict[str, Any]], *, skip_media_attachment_notice: bool = False) -> str:
    for message in reversed(messages):
        if message.get("role") != "user":
            continue
        content = _content_to_text(message.get("content"))
        if skip_media_attachment_notice and _is_panai_media_attachment_notice(content):
            continue
        if content:
            return content
    raise ProviderConfigurationError("chat payload.messages must include a non-empty user prompt")


def _pending_user_prompts(messages: list[dict[str, Any]], *, skip_media_attachment_notice: bool = False) -> list[str]:
    prompts: list[str] = []
    saw_pending_user = False
    for message in reversed(messages):
        role = message.get("role")
        if role == "assistant" and saw_pending_user:
            break
        if role != "user":
            continue
        content = _content_to_text(message.get("content"))
        if skip_media_attachment_notice and _is_panai_media_attachment_notice(content):
            continue
        if content:
            saw_pending_user = True
            prompts.append(content)
    prompts.reverse()
    return prompts


def _is_panai_media_attachment_notice(text: str) -> bool:
    stripped = text.lstrip()
    if not stripped.startswith("[media attached:"):
        return False
    return (
        "media://inbound/" in stripped
        and "To send an image back" in stripped
        and "[Image]" in stripped
        and "Description:" in stripped
    )


def _is_panai_heartbeat_request(messages: list[dict[str, Any]]) -> bool:
    user_text = _last_user_text(messages)
    if not user_text:
        return False
    if "[PanAI heartbeat poll]" in user_text:
        return True
    return (
        "Read HEARTBEAT.md if it exists" in user_text
        and "If nothing needs attention, reply HEARTBEAT_OK" in user_text
    )


def _last_user_text(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if message.get("role") != "user":
            continue
        content = _content_to_text(message.get("content"))
        if content:
            return content
    return ""


def _normalize_huggingface_model_id(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    model = value.strip()
    if not model:
        return None
    if model.startswith("huggingface/") and model.count("/") >= 2:
        model = model.split("/", 1)[1]
    return _canonical_huggingface_model_id(model)


def _canonical_huggingface_model_id(model: str) -> str:
    normalized = model.strip()
    if not normalized or "/" in normalized:
        return normalized
    return _huggingface_model_id_for_short_name(normalized) or normalized


def _huggingface_model_id_for_short_name(short_name: str) -> str | None:
    target = short_name.lower()
    route_matches = []
    for route in HuggingFaceRouteRegistry().all_routes(has_token=bool(_huggingface_token())):
        if route.model and _huggingface_model_short_name(route.model) == target:
            route_matches.append(route.model.split("/", 1)[1] if route.model.startswith("huggingface/") else route.model)
    if route_matches:
        return sorted(route_matches)[0]

    repository_match = _huggingface_repository_model_id_for_short_name(target)
    if repository_match:
        return repository_match
    endpoint_match = _huggingface_endpoint_model_id_for_short_name(target)
    if endpoint_match:
        return endpoint_match
    return _huggingface_cache_model_id_for_short_name(target)


def _huggingface_model_short_name(model_id: str) -> str:
    return model_id.split("/")[-1].lower()


def _persist_generated_artifact(result: ProviderResult) -> tuple[str, str]:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    filename = Path(result.filename).name
    path = GENERATED_DIR / filename
    path.write_bytes(result.content)
    return filename, _generated_download_url(filename)


def _generated_download_url(filename: str) -> str:
    base_url = (
        _env("ARCHITOKEN_GENERATION_PUBLIC_BASE_URL")
        or _env("ARCHITOKEN_HF_ENDPOINT_PUBLIC_BASE_URL")
        or _env("ARCHITOKEN_PUBLIC_BASE_URL")
        or "http://127.0.0.1:7071"
    )
    return f"{base_url.rstrip('/')}/download/{filename}"


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
    default_base = "http://127.0.0.1:8000"
    if _truthy_env("ARCHITOKEN_HF_ASSUME_DEFAULT_VLLM") or _openai_models_endpoint_available(default_base):
        return _chat_completion_url(default_base)
    return None


def _list_huggingface_chat_endpoint_models() -> dict[str, dict[str, Any]]:
    endpoint = _huggingface_chat_endpoint(None)
    if not endpoint:
        return {}
    return _openai_chat_models_for_endpoint(endpoint)


def _huggingface_chat_endpoint_serves_model(model_id: str) -> bool:
    if not model_id:
        return False
    return model_id in _list_huggingface_chat_endpoint_models()


@functools.lru_cache(maxsize=16)
def _openai_chat_models_for_endpoint(chat_endpoint_url: str) -> dict[str, dict[str, Any]]:
    models_url = _openai_models_url(chat_endpoint_url)
    request = urllib.request.Request(models_url, headers={"Accept": "application/json"}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            if not (200 <= response.status < 500):
                return {}
            payload = json.loads(response.read().decode("utf-8") or "{}")
    except Exception:
        return {}

    raw_models: list[Any] = []
    if isinstance(payload, dict):
        if isinstance(payload.get("data"), list):
            raw_models = payload["data"]
        elif isinstance(payload.get("models"), list):
            raw_models = payload["models"]
    discovered: dict[str, dict[str, Any]] = {}
    for raw in raw_models:
        if isinstance(raw, str):
            model_id = raw
            model_payload: dict[str, Any] = {"id": model_id}
        elif isinstance(raw, dict):
            model_id = str(raw.get("id") or raw.get("name") or raw.get("model") or "").strip()
            model_payload = raw
        else:
            continue
        if not model_id:
            continue
        discovered[model_id] = model_payload
    return discovered


def _chat_completion_url(value: str) -> str:
    from urllib.parse import urlsplit, urlunsplit

    parsed = urlsplit(value)
    path = parsed.path.rstrip("/")
    if path.endswith("/v1/chat/completions") or path.endswith("/chat/completions"):
        return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
    base_path = path.rstrip("/")
    if base_path.endswith("/v1"):
        return urlunsplit((parsed.scheme, parsed.netloc, f"{base_path}/chat/completions", "", ""))
    return urlunsplit((parsed.scheme, parsed.netloc, f"{base_path}/v1/chat/completions", "", ""))


def _ollama_native_chat_url(value: str) -> str:
    from urllib.parse import urlsplit, urlunsplit

    parsed = urlsplit(value)
    path = parsed.path.rstrip("/")
    if path.endswith("/api/chat"):
        return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
    if path.endswith("/v1/chat/completions"):
        path = path[: -len("/v1/chat/completions")]
    elif path.endswith("/chat/completions"):
        path = path[: -len("/chat/completions")]
    elif path.endswith("/v1"):
        path = path[: -len("/v1")]
    return urlunsplit((parsed.scheme, parsed.netloc, f"{path}/api/chat", "", ""))


def _chat_fallback_runtime_endpoint(candidate: ChatFallbackCandidate) -> str:
    if candidate.provider == "ollama":
        return _ollama_native_chat_url(candidate.base_url)
    return _chat_completion_url(candidate.base_url)


def _openai_models_url(value: str) -> str:
    from urllib.parse import urlsplit, urlunsplit

    parsed = urlsplit(value)
    path = parsed.path.rstrip("/")
    if path.endswith("/chat/completions"):
        path = path[: -len("/chat/completions")]
    if not path.endswith("/v1"):
        path = f"{path}/v1"
    return urlunsplit((parsed.scheme, parsed.netloc, f"{path}/models", "", ""))


def _openai_models_endpoint_available(value: str) -> bool:
    try:
        endpoint = _openai_models_url(value)
    except ValueError:
        return False
    request = urllib.request.Request(endpoint, headers={"Accept": "application/json"}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=0.5) as response:
            return 200 <= response.status < 500
    except Exception:
        return False


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
    return stripped in {"HEARTBEAT_OK", "PANAI_MODEL_OK"} or stripped.startswith("PANAI_") and stripped.endswith("_OK")


def _run_panai_media(prompt: str, payload: dict[str, Any], *, media_kind: str) -> ProviderResult:
    model_env = "PANAI_IMAGE_MODEL" if media_kind == "image" else "PANAI_VIDEO_MODEL"
    model = _env(model_env)
    if not model:
        raise ProviderConfigurationError(f"{model_env} is required for PanAI {media_kind} generation.")

    suffix = ".png" if media_kind == "image" else ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        output_path = Path(tmp.name)

    command = [
        _env("PANAI_CLI_PATH") or "panai",
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
        raise ProviderExecutionError(_trim(result.stderr or result.stdout or "PanAI infer failed"))
    if not output_path.exists() or output_path.stat().st_size == 0:
        output_path.unlink(missing_ok=True)
        raise ProviderExecutionError("PanAI infer completed without a media artifact")

    content = output_path.read_bytes()
    output_path.unlink(missing_ok=True)
    return ProviderResult(
        engine="panai-infer",
        model=model,
        media_type="image/png" if media_kind == "image" else "video/mp4",
        content=content,
        filename=f"panai-{media_kind}-{uuid.uuid4().hex}{suffix}",
        summary=f"PanAI {media_kind} provider returned a real artifact.",
        metadata={"provider": "panai", "stdout": _trim(result.stdout)},
    )


def _run_huggingface_media(prompt: str, payload: dict[str, Any], *, media_kind: str) -> ProviderResult:
    token = _huggingface_token()
    task_type = "text_to_image" if media_kind == "image" else "image_to_video"
    route = _huggingface_route_for_media_payload(task_type, payload, has_token=bool(token))

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


def _huggingface_route_for_media_payload(task_type: str, payload: dict[str, Any], *, has_token: bool) -> Any:
    route = HuggingFaceRouteRegistry().route_for_task(task_type, has_token=has_token)
    selected_model = _normalize_huggingface_model_id(payload.get("model"))
    if not selected_model:
        return route

    inferred = _infer_repository_model_task(selected_model, None)
    if normalize_task_type(inferred["taskType"]) != normalize_task_type(task_type):
        return route

    endpoint_url = route.endpoint_url
    if endpoint_url and not _is_local_http_url(endpoint_url):
        endpoint_url = hf_model_url(selected_model)
    return replace(route, model=selected_model, endpoint_url=endpoint_url)


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

    command = _huggingface_local_command(task_type, route.model)
    if command:
        return _run_huggingface_local_command(prompt, payload, media_kind=media_kind, route=route, command=command)

    in_process = _run_huggingface_in_process_media_if_available(
        prompt,
        payload,
        media_kind=media_kind,
        route=route,
    )
    if in_process is not None:
        return in_process

    return None


def _run_huggingface_in_process_media_if_available(
    prompt: str,
    payload: dict[str, Any],
    *,
    media_kind: str,
    route: Any,
) -> ProviderResult | None:
    if not _truthy_env("ARCHITOKEN_HF_ALLOW_IN_PROCESS_MEDIA"):
        return None

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
    suffix = _suffix_for_artifact_kind(media_kind)
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

    body = _huggingface_request_body(prompt, {**payload, "taskType": route.task_type}, media_kind=media_kind)
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
    descriptor = _task_descriptor(route.task_type)
    runtime = _local_runtime_descriptor(model or "", descriptor, _huggingface_model_repository_path(model))
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
        "endpointPath": runtime["endpointPath"],
        "runtime": runtime["runtime"],
        "runtimePreference": runtime["runtimePreference"],
        "runtimeConfigured": runtime["configured"],
        "requiresRuntime": runtime["requiresRuntime"],
    }
    if provider == "huggingface":
        payload["localRepository"] = _huggingface_model_repository_path(model)
        payload["providerPreference"] = "local_huggingface_first"
        if normalize_task_type(route.task_type) in {"chat", "code"}:
            payload["localEndpointEnv"] = "ARCHITOKEN_HF_LOCAL_CHAT_URL"
            chat_endpoint = _huggingface_chat_endpoint(route.endpoint_url)
            fallback = _first_available_chat_fallback(model or "")
            payload["endpoint"] = (
                _redacted_hf_url(chat_endpoint)
                if chat_endpoint
                else _redacted_hf_url(_chat_fallback_runtime_endpoint(fallback))
                if fallback
                else None
            )
            payload["adapter"] = (
                "huggingface-local-vllm-openai-compatible"
                if not fallback
                else f"{fallback.provider}-chat-fallback"
            )
        if _is_local_runtime_task(route.task_type):
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
    if provider != "panai":
        return route_model
    if normalized == "text_to_image":
        return _env("PANAI_IMAGE_MODEL")
    if normalized == "image_to_video":
        return _env("PANAI_VIDEO_MODEL")
    return route_model


def _route_configured(task_type: str, provider: str, route: Any) -> bool:
    normalized = normalize_task_type(task_type)
    if provider != "panai":
        if provider == "huggingface" and normalized in {"chat", "code"}:
            return bool(
                (
                    _huggingface_chat_endpoint(route.endpoint_url)
                    and _huggingface_chat_endpoint_serves_model(route.model or "")
                )
                or _first_available_chat_fallback(route.model or "")
            )
        if provider == "huggingface" and _is_local_runtime_task(normalized):
            return _huggingface_media_configured(normalized, route.configured, route.endpoint_url, route.model)
        return bool(_huggingface_remote_enabled() and route.configured)
    if normalized == "text_to_image":
        return bool(_env("PANAI_IMAGE_MODEL"))
    if normalized == "image_to_video":
        return bool(_env("PANAI_VIDEO_MODEL"))
    return False


def _route_missing(task_type: str, provider: str, route: Any) -> list[str]:
    normalized = normalize_task_type(task_type)
    if provider == "panai":
        if normalized == "text_to_image":
            return ["PANAI_IMAGE_MODEL"]
        if normalized == "image_to_video":
            return ["PANAI_VIDEO_MODEL"]
        return []
    if provider == "huggingface" and normalized in {"chat", "code"}:
        if _first_available_chat_fallback(route.model or ""):
            return []
        endpoint = _huggingface_chat_endpoint(route.endpoint_url)
        if not endpoint:
            return ["ARCHITOKEN_HF_LOCAL_CHAT_URL or ARCHITOKEN_VLLM_BASE_URL"]
        if not _huggingface_chat_endpoint_serves_model(route.model or ""):
            return [f"{route.model} not advertised by { _openai_models_url(endpoint) }"]
        return []
    if provider == "huggingface" and _is_local_runtime_task(normalized):
        return _huggingface_media_missing(normalized, route)
    return list(route.missing)


def _media_parameters(payload: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    top_level = payload.get("parameters")
    if isinstance(top_level, dict):
        merged.update(top_level)
    constraints = payload.get("constraints")
    if isinstance(constraints, dict) and isinstance(constraints.get("parameters"), dict):
        merged.update(constraints["parameters"])
    return merged


def _huggingface_request_body(prompt: str, payload: dict[str, Any], *, media_kind: str) -> dict[str, Any]:
    parameters = _media_parameters(payload)
    task_type = normalize_task_type(str(payload.get("mode") or payload.get("taskType") or ""))
    if media_kind in {"image", "document", "model3d", "artifact"} or task_type == "text_to_video":
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
    local_payload = {**payload, "taskType": route.task_type}
    base_body = _huggingface_request_body(prompt, local_payload, media_kind=media_kind)
    constraints = payload.get("constraints") if isinstance(payload.get("constraints"), dict) else {}
    parameters = _media_parameters(payload)
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
    return normalize_task_type(task_type) in {"text_to_image", "text_to_video", "image_to_video"}


def _is_generation_artifact_task(task_type: str) -> bool:
    return normalize_task_type(task_type) in {
        "image_to_image",
        "image_to_3d",
        "object_to_3d_asset",
        "world_3d_research",
        "ocr",
    }


def _is_local_runtime_task(task_type: str) -> bool:
    return _is_media_task(task_type) or _is_generation_artifact_task(task_type)


def _artifact_kind_for_task(task_type: str) -> str:
    normalized = normalize_task_type(task_type)
    if normalized in {"text_to_image", "image_to_image"}:
        return "image"
    if normalized in {"text_to_video", "image_to_video"}:
        return "video"
    if normalized in {"image_to_3d", "object_to_3d_asset", "world_3d_research"}:
        return "model3d"
    if normalized == "ocr":
        return "document"
    return "artifact"


def _suffix_for_artifact_kind(kind: str) -> str:
    if kind == "image":
        return ".png"
    if kind == "video":
        return ".mp4"
    if kind == "model3d":
        return ".glb"
    if kind == "document":
        return ".txt"
    return ".bin"


def _task_local_url_env(task_type: str) -> tuple[str, str]:
    normalized = normalize_task_type(task_type)
    if normalized == "text_to_video":
        return ("ARCHITOKEN_HF_LOCAL_TEXT_TO_VIDEO_URL", "HUGGINGFACE_LOCAL_TEXT_TO_VIDEO_URL")
    if normalized == "image_to_video":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL", "HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_URL")
    if normalized == "image_to_image":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_IMAGE_URL", "HUGGINGFACE_LOCAL_IMAGE_TO_IMAGE_URL")
    if normalized == "image_to_3d":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_3D_URL", "HUGGINGFACE_LOCAL_IMAGE_TO_3D_URL")
    if normalized == "object_to_3d_asset":
        return ("ARCHITOKEN_HF_LOCAL_OBJECT_TO_3D_ASSET_URL", "HUGGINGFACE_LOCAL_OBJECT_TO_3D_ASSET_URL")
    if normalized == "world_3d_research":
        return ("ARCHITOKEN_HF_LOCAL_WORLD_3D_RESEARCH_URL", "HUGGINGFACE_LOCAL_WORLD_3D_RESEARCH_URL")
    if normalized == "ocr":
        return ("ARCHITOKEN_HF_LOCAL_OCR_URL", "HUGGINGFACE_LOCAL_OCR_URL")
    return ("ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL", "HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_URL")


def _task_local_command_env(task_type: str) -> tuple[str, str]:
    normalized = normalize_task_type(task_type)
    if normalized == "text_to_video":
        return ("ARCHITOKEN_HF_LOCAL_TEXT_TO_VIDEO_COMMAND", "HUGGINGFACE_LOCAL_TEXT_TO_VIDEO_COMMAND")
    if normalized == "image_to_video":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_COMMAND", "HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_COMMAND")
    if normalized == "image_to_image":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_IMAGE_COMMAND", "HUGGINGFACE_LOCAL_IMAGE_TO_IMAGE_COMMAND")
    if normalized == "image_to_3d":
        return ("ARCHITOKEN_HF_LOCAL_IMAGE_TO_3D_COMMAND", "HUGGINGFACE_LOCAL_IMAGE_TO_3D_COMMAND")
    if normalized == "object_to_3d_asset":
        return ("ARCHITOKEN_HF_LOCAL_OBJECT_TO_3D_ASSET_COMMAND", "HUGGINGFACE_LOCAL_OBJECT_TO_3D_ASSET_COMMAND")
    if normalized == "world_3d_research":
        return ("ARCHITOKEN_HF_LOCAL_WORLD_3D_RESEARCH_COMMAND", "HUGGINGFACE_LOCAL_WORLD_3D_RESEARCH_COMMAND")
    if normalized == "ocr":
        return ("ARCHITOKEN_HF_LOCAL_OCR_COMMAND", "HUGGINGFACE_LOCAL_OCR_COMMAND")
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


def _falsey_env(name: str) -> bool:
    value = _env(name)
    return value.lower() in {"0", "false", "no", "off"} if value else False


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



def _huggingface_model_repository_roots() -> list[Path]:
    roots: list[Path] = []
    if _env("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR"):
        roots.append(Path(_env("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR") or ""))
    if _env("ARCHITOKEN_MODEL_REPOSITORY_DIR"):
        roots.append(Path(_env("ARCHITOKEN_MODEL_REPOSITORY_DIR") or "") / "huggingface")
    roots.append(Path(__file__).resolve().parents[1] / "data" / "model-repository" / "huggingface")
    return roots


def _huggingface_repository_model_id_for_short_name(short_name: str) -> str | None:
    matches: list[str] = []
    for root in _huggingface_model_repository_roots():
        if not root.exists():
            continue
        for owner_dir in root.iterdir():
            if not owner_dir.is_dir():
                continue
            for model_dir in owner_dir.iterdir():
                if _huggingface_model_short_name(model_dir.name) != short_name:
                    continue
                if model_dir.is_dir() and _looks_like_huggingface_model_repository(model_dir):
                    matches.append(f"{owner_dir.name}/{model_dir.name}")
    return sorted(matches)[0] if matches else None


def _huggingface_cache_model_id_for_short_name(short_name: str) -> str | None:
    matches: list[str] = []
    for entry in _huggingface_cache_entries():
        if not isinstance(entry, dict):
            continue
        model_id = entry.get("repo_id") or str(entry.get("id") or "").replace("model/", "", 1)
        if not isinstance(model_id, str) or not model_id.strip():
            continue
        if _huggingface_model_short_name(model_id.strip()) == short_name:
            matches.append(model_id.strip())
    return sorted(matches)[0] if matches else None


def _huggingface_endpoint_model_id_for_short_name(short_name: str) -> str | None:
    matches = [
        model_id
        for model_id in _list_huggingface_chat_endpoint_models()
        if _huggingface_model_short_name(model_id) == short_name
    ]
    return sorted(matches)[0] if matches else None


def _huggingface_model_repository_path(model: str | None) -> str | None:
    if not model:
        return None
    model_id = _normalize_huggingface_model_id(model)
    if not model_id:
        return None
    parts = [part for part in model_id.split("/") if part]
    for root in _huggingface_model_repository_roots():
        candidate = root.joinpath(*parts)
        if candidate.exists():
            return str(candidate)
    cache_snapshot = _huggingface_cache_snapshot_path(model_id)
    if cache_snapshot:
        return cache_snapshot
    return None


def _local_huggingface_model_path(model: str | None) -> str | None:
    return _huggingface_model_repository_path(model)


def _huggingface_cache_snapshot_path(model_id: str) -> str | None:
    best: tuple[tuple[int, int, str], str] | None = None
    for entry in _huggingface_cache_entries():
        if not isinstance(entry, dict):
            continue
        if entry.get("repo_id") != model_id:
            continue
        snapshot_path = entry.get("snapshot_path")
        if not isinstance(snapshot_path, str) or not snapshot_path:
            continue
        snapshot = Path(snapshot_path).expanduser()
        if not _looks_like_huggingface_model_repository(snapshot):
            continue
        candidate = {
            "revision": entry.get("revision"),
            "size": entry.get("size"),
            "refs": entry.get("refs") if isinstance(entry.get("refs"), list) else [],
        }
        rank = _cache_model_rank(candidate)
        if best is None or rank > best[0]:
            best = (rank, str(snapshot))
    return best[1] if best else None

def _media_type_for_path(path: str, media_kind: str) -> str:
    media_type = mimetypes.guess_type(path)[0]
    if media_type:
        return _clean_content_type(media_type)
    if media_kind == "image":
        return "image/png"
    if media_kind == "video":
        return "video/mp4"
    if media_kind == "model3d":
        return "model/gltf-binary"
    if media_kind == "document":
        return "text/plain"
    return "application/octet-stream"


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
    if (_env("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER") or "").lower() == "panai":
        return bool(_env("PANAI_IMAGE_MODEL"))
    route = HuggingFaceRouteRegistry().text_to_image(has_token=bool(_huggingface_token()))
    return _huggingface_media_configured("text_to_image", route.configured, route.endpoint_url, route.model)


def _image_to_video_configured() -> bool:
    if (_env("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER") or "").lower() == "panai":
        return bool(_env("PANAI_VIDEO_MODEL"))
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
    return _suffix_for_artifact_kind(media_kind)


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


def _int_env(name: str, fallback: int) -> int:
    value = _env(name)
    if value is None:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


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
