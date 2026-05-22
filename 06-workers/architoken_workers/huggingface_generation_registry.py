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


DEFAULT_HF_CHAT_MODEL = "huggingface/deepseek-ai/DeepSeek-R1-0528"
DEFAULT_HF_TEXT_TO_IMAGE_MODEL = "black-forest-labs/FLUX.1-dev"
DEFAULT_HF_IMAGE_TO_VIDEO_MODEL = "Lightricks/LTX-Video"


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
        return (
            self._route_value("chat")
            or self._env_value("ARCHITOKEN_HF_CHAT_MODEL")
            or self._env_value("HUGGINGFACE_CHAT_MODEL")
            or DEFAULT_HF_CHAT_MODEL
        )

    def text_to_image(self, *, has_token: bool) -> HuggingFaceTaskRoute:
        return self._route(
            capability="image.generate",
            task_type="text_to_image",
            model_env=("ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL", "HUGGINGFACE_TEXT_TO_IMAGE_MODEL"),
            url_env=("ARCHITOKEN_HF_TEXT_TO_IMAGE_URL", "HUGGINGFACE_TEXT_TO_IMAGE_URL"),
            default_model=DEFAULT_HF_TEXT_TO_IMAGE_MODEL,
            has_token=has_token,
        )

    def image_to_video(self, *, has_token: bool) -> HuggingFaceTaskRoute:
        return self._route(
            capability="video.image_to_video",
            task_type="image_to_video",
            model_env=("ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL", "HUGGINGFACE_IMAGE_TO_VIDEO_MODEL"),
            url_env=("ARCHITOKEN_HF_IMAGE_TO_VIDEO_URL", "HUGGINGFACE_IMAGE_TO_VIDEO_URL"),
            default_model=DEFAULT_HF_IMAGE_TO_VIDEO_MODEL,
            has_token=has_token,
        )

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
        endpoint_url = self._first_env(url_env) or hf_model_url(model)
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
