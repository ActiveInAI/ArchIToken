"""Hugging Face generation route registry for ArchIToken workers.

Business code should ask for a capability route instead of hardcoding a
provider/model pair. Environment variables may override every default route.
"""

from __future__ import annotations

import json
import os
import urllib.parse
from dataclasses import dataclass
from typing import Any


DEFAULT_HF_MODEL_ROUTES: dict[str, str] = {
    "chat": "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
    "code": "Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8",
    "ocr": "PaddlePaddle/PaddleOCR-VL-1.5",
    "text_to_image": "baidu/ERNIE-Image",
    "image_to_image": "black-forest-labs/FLUX.2-dev-NVFP4",
    "text_to_video": "Lightricks/LTX-2.3-nvfp4",
    "image_to_video": "Lightricks/LTX-2.3-nvfp4",
    "image_to_3d": "tencent/HY-World-2.0",
    "object_to_3d_asset": "nvidia/asset-harvester",
    "world_3d_research": "nvidia/Lyra-2.0",
}

TASK_CAPABILITIES: dict[str, str] = {
    "chat": "model.chat",
    "code": "model.code",
    "ocr": "document.ocr",
    "text_to_image": "image.generate",
    "image_to_image": "image.transform",
    "text_to_video": "video.text_to_video",
    "image_to_video": "video.image_to_video",
    "image_to_3d": "world.image_to_3d",
    "object_to_3d_asset": "asset.object_to_3d",
    "world_3d_research": "world.research_3d",
}

TASK_ENV_KEYS: dict[str, tuple[str, str]] = {
    "chat": ("ARCHITOKEN_HF_CHAT_MODEL", "HUGGINGFACE_CHAT_MODEL"),
    "code": ("ARCHITOKEN_HF_CODE_MODEL", "HUGGINGFACE_CODE_MODEL"),
    "ocr": ("ARCHITOKEN_HF_OCR_MODEL", "HUGGINGFACE_OCR_MODEL"),
    "text_to_image": ("ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL", "HUGGINGFACE_TEXT_TO_IMAGE_MODEL"),
    "image_to_image": ("ARCHITOKEN_HF_IMAGE_TO_IMAGE_MODEL", "HUGGINGFACE_IMAGE_TO_IMAGE_MODEL"),
    "text_to_video": ("ARCHITOKEN_HF_TEXT_TO_VIDEO_MODEL", "HUGGINGFACE_TEXT_TO_VIDEO_MODEL"),
    "image_to_video": ("ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL", "HUGGINGFACE_IMAGE_TO_VIDEO_MODEL"),
    "image_to_3d": ("ARCHITOKEN_HF_IMAGE_TO_3D_MODEL", "HUGGINGFACE_IMAGE_TO_3D_MODEL"),
    "object_to_3d_asset": (
        "ARCHITOKEN_HF_OBJECT_TO_3D_ASSET_MODEL",
        "HUGGINGFACE_OBJECT_TO_3D_ASSET_MODEL",
    ),
    "world_3d_research": (
        "ARCHITOKEN_HF_WORLD_3D_RESEARCH_MODEL",
        "HUGGINGFACE_WORLD_3D_RESEARCH_MODEL",
    ),
}

TASK_URL_ENV_KEYS: dict[str, tuple[str, str]] = {
    "chat": ("ARCHITOKEN_HF_CHAT_URL", "HUGGINGFACE_CHAT_URL"),
    "code": ("ARCHITOKEN_HF_CODE_URL", "HUGGINGFACE_CODE_URL"),
    "ocr": ("ARCHITOKEN_HF_OCR_URL", "HUGGINGFACE_OCR_URL"),
    "text_to_image": ("ARCHITOKEN_HF_TEXT_TO_IMAGE_URL", "HUGGINGFACE_TEXT_TO_IMAGE_URL"),
    "image_to_image": ("ARCHITOKEN_HF_IMAGE_TO_IMAGE_URL", "HUGGINGFACE_IMAGE_TO_IMAGE_URL"),
    "text_to_video": ("ARCHITOKEN_HF_TEXT_TO_VIDEO_URL", "HUGGINGFACE_TEXT_TO_VIDEO_URL"),
    "image_to_video": ("ARCHITOKEN_HF_IMAGE_TO_VIDEO_URL", "HUGGINGFACE_IMAGE_TO_VIDEO_URL"),
    "image_to_3d": ("ARCHITOKEN_HF_IMAGE_TO_3D_URL", "HUGGINGFACE_IMAGE_TO_3D_URL"),
    "object_to_3d_asset": (
        "ARCHITOKEN_HF_OBJECT_TO_3D_ASSET_URL",
        "HUGGINGFACE_OBJECT_TO_3D_ASSET_URL",
    ),
    "world_3d_research": (
        "ARCHITOKEN_HF_WORLD_3D_RESEARCH_URL",
        "HUGGINGFACE_WORLD_3D_RESEARCH_URL",
    ),
}

TASK_ALIASES: dict[str, str] = {
    "default": "chat",
    "text": "chat",
    "text_generation": "chat",
    "coding": "code",
    "programming": "code",
    "image.generate": "text_to_image",
    "image_generation": "text_to_image",
    "text-to-image": "text_to_image",
    "image.transform": "image_to_image",
    "image-to-image": "image_to_image",
    "video.generate": "text_to_video",
    "text-to-video": "text_to_video",
    "text_to_video": "text_to_video",
    "video.text_to_video": "text_to_video",
    "video.image_to_video": "image_to_video",
    "image-to-video": "image_to_video",
    "document.ocr": "ocr",
    "image_to_3d_world": "image_to_3d",
    "image-to-3d": "image_to_3d",
    "object_to_3d": "object_to_3d_asset",
    "3d_world": "world_3d_research",
}


@dataclass(frozen=True)
class HuggingFaceTaskRoute:
    capability: str
    task_type: str
    model: str | None
    endpoint_url: str | None
    model_env: str
    url_env: str
    configured: bool
    missing: tuple[str, ...]


class HuggingFaceRouteRegistry:
    """Resolve Hugging Face models by ArchIToken task type."""

    def __init__(self, env: dict[str, str] | None = None) -> None:
        self._env = env if env is not None else os.environ
        self._route_overrides = self._load_route_overrides()

    def text_chat_model(self) -> str:
        return self.model_for_task("chat")

    def model_for_task(self, task_type: str) -> str:
        normalized = normalize_task_type(task_type)
        env_names = TASK_ENV_KEYS[normalized]
        return (
            self._route_value(normalized)
            or self._first_env(env_names)
            or DEFAULT_HF_MODEL_ROUTES[normalized]
        )

    def all_routes(self, *, has_token: bool) -> list[HuggingFaceTaskRoute]:
        return [
            self.route_for_task(task_type, has_token=has_token)
            for task_type in DEFAULT_HF_MODEL_ROUTES
        ]

    def route_for_task(self, task_type: str, *, has_token: bool) -> HuggingFaceTaskRoute:
        normalized = normalize_task_type(task_type)
        return self._route(
            capability=TASK_CAPABILITIES[normalized],
            task_type=normalized,
            model_env=TASK_ENV_KEYS[normalized],
            url_env=TASK_URL_ENV_KEYS[normalized],
            default_model=DEFAULT_HF_MODEL_ROUTES[normalized],
            has_token=has_token,
        )

    def text_to_image(self, *, has_token: bool) -> HuggingFaceTaskRoute:
        return self.route_for_task("text_to_image", has_token=has_token)

    def image_to_video(self, *, has_token: bool) -> HuggingFaceTaskRoute:
        return self.route_for_task("image_to_video", has_token=has_token)

    def _route(
        self,
        *,
        capability: str,
        task_type: str,
        model_env: tuple[str, str],
        url_env: tuple[str, str],
        default_model: str,
        has_token: bool,
    ) -> HuggingFaceTaskRoute:
        model = self._route_value(task_type) or self._first_env(model_env) or default_model
        endpoint_url = self._route_url_value(task_type) or self._first_env(url_env) or hf_model_url(model)
        missing: list[str] = []
        if not has_token:
            missing.append("HF_TOKEN or HUGGINGFACE_API_TOKEN")
        if not endpoint_url:
            missing.append(f"{url_env[0]} or {model_env[0]}")
        return HuggingFaceTaskRoute(
            capability=capability,
            task_type=task_type,
            model=model,
            endpoint_url=endpoint_url,
            model_env=model_env[0],
            url_env=url_env[0],
            configured=not missing,
            missing=tuple(missing),
        )

    def _route_value(self, task_type: str) -> str | None:
        value = self._route_overrides.get(task_type)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            model = value.get("model")
            if isinstance(model, str) and model.strip():
                return model.strip()
        return None

    def _route_url_value(self, task_type: str) -> str | None:
        value = self._route_overrides.get(task_type)
        if isinstance(value, dict):
            url = value.get("url") or value.get("endpoint") or value.get("endpoint_url")
            if isinstance(url, str) and url.strip():
                return url.strip()
        return None

    def _load_route_overrides(self) -> dict[str, Any]:
        raw = self._env_value("ARCHITOKEN_HF_MODEL_ROUTES")
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}

    def _first_env(self, names: tuple[str, ...]) -> str | None:
        for name in names:
            value = self._env_value(name)
            if value:
                return value
        return None

    def _env_value(self, name: str) -> str | None:
        value = self._env.get(name)
        if value is None or not value.strip():
            return None
        return value.strip()


def hf_model_url(model: str | None) -> str | None:
    if not model:
        return None
    model_id = model.split("/", 1)[1] if model.startswith("huggingface/") else model
    quoted = urllib.parse.quote(model_id.strip(), safe="/")
    return f"https://api-inference.huggingface.co/models/{quoted}"


def normalize_task_type(task_type: str) -> str:
    normalized = task_type.strip().lower().replace("-", "_")
    normalized = TASK_ALIASES.get(normalized, normalized)
    if normalized not in DEFAULT_HF_MODEL_ROUTES:
        return "chat"
    return normalized
