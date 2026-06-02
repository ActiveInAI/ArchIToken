"""ArchIToken Hugging Face runtime nodes for ComfyUI.

These nodes keep ArchIToken media generation inside the ComfyUI workflow runtime
while loading model weights from the local Hugging Face cache/repository.
"""

from __future__ import annotations

import inspect
import os
import re
from pathlib import Path
from typing import Any

import numpy as np
import torch


_PIPELINE_CACHE: dict[tuple[str, str, str, str], Any] = {}


class ArchITokenHuggingFaceTextToImage:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "required": {
                "model_repository": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                        "tooltip": "Local Hugging Face snapshot/repository path.",
                    },
                ),
                "prompt": ("STRING", {"default": "", "multiline": True}),
                "negative_prompt": ("STRING", {"default": "", "multiline": True}),
                "width": ("INT", {"default": 512, "min": 256, "max": 2048, "step": 32}),
                "height": ("INT", {"default": 512, "min": 256, "max": 2048, "step": 32}),
                "steps": ("INT", {"default": 8, "min": 1, "max": 100}),
                "guidance_scale": ("FLOAT", {"default": 4.0, "min": 0.0, "max": 30.0, "step": 0.1}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 2**63 - 1}),
                "use_pe": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "generate"
    CATEGORY = "ArchIToken/HuggingFace"

    def generate(
        self,
        model_repository: str,
        prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        steps: int,
        guidance_scale: float,
        seed: int,
        use_pe: bool,
    ) -> tuple[torch.Tensor]:
        repository = _model_repository(model_repository)
        cleaned_prompt = _clean_prompt(prompt)
        if not cleaned_prompt:
            raise RuntimeError("prompt is required")

        _force_offline_hf()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        pipe = _pipeline(repository, device)

        width = _dimension(width)
        height = _dimension(height)
        kwargs: dict[str, Any] = {
            "prompt": cleaned_prompt,
            "width": width,
            "height": height,
            "num_inference_steps": max(1, min(100, int(steps))),
            "guidance_scale": float(guidance_scale),
        }
        if negative_prompt.strip() and _accepts_argument(pipe, "negative_prompt"):
            kwargs["negative_prompt"] = negative_prompt.strip()
        if _accepts_argument(pipe, "use_pe") and "ERNIE-Image" in str(repository):
            kwargs["use_pe"] = bool(use_pe)
        if _accepts_argument(pipe, "generator"):
            generator_device = "cpu" if _offload_mode(repository, device) != "none" else device
            kwargs["generator"] = torch.Generator(device=generator_device).manual_seed(int(seed))

        result = pipe(**kwargs)
        images = getattr(result, "images", None)
        if not images:
            raise RuntimeError("Hugging Face pipeline completed without images")

        image = images[0].convert("RGB")
        array = np.asarray(image).astype(np.float32) / 255.0
        return (torch.from_numpy(array)[None, ...],)


def _pipeline(repository: Path, device: str) -> Any:
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    offload = _offload_mode(repository, device)
    key = (str(repository), device, str(dtype), offload)
    cached = _PIPELINE_CACHE.get(key)
    if cached is not None:
        return cached

    from diffusers import DiffusionPipeline

    pipeline_cls = DiffusionPipeline
    if "ERNIE-Image" in str(repository):
        from diffusers import ErnieImagePipeline

        pipeline_cls = ErnieImagePipeline

    pipe = pipeline_cls.from_pretrained(
        str(repository),
        torch_dtype=dtype,
        local_files_only=True,
    )
    _enable_memory_savers(pipe)
    if device != "cpu":
        pipe = _place_pipeline(pipe, device, offload)
    _PIPELINE_CACHE[key] = pipe
    return pipe


def _model_repository(raw: str) -> Path:
    value = raw.strip()
    if not value:
        raise RuntimeError("model_repository is required")
    path = Path(value).expanduser()
    if not _is_model_repository(path):
        raise RuntimeError(f"model_repository does not look like a Hugging Face repository: {path}")
    return path


def _is_model_repository(path: Path) -> bool:
    return path.exists() and (
        (path / "model_index.json").exists()
        or (path / "config.json").exists()
        or (path / "tokenizer.json").exists()
        or (path / "README.md").exists()
    )


def _force_offline_hf() -> None:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("HF_DATASETS_OFFLINE", "1")


def _clean_prompt(prompt: str) -> str:
    stripped = str(prompt or "").strip()
    cleaned = re.sub(
        r"^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+GMT[^\]]*\]\s*",
        "",
        stripped,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned or stripped


def _dimension(value: int) -> int:
    parsed = max(256, min(2048, int(value)))
    return max(256, (parsed // 32) * 32)


def _accepts_argument(pipe: Any, name: str) -> bool:
    try:
        signature = inspect.signature(pipe.__call__)
    except (TypeError, ValueError):
        return True
    return name in signature.parameters or any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in signature.parameters.values()
    )


def _enable_memory_savers(pipe: Any) -> None:
    for name in ("enable_attention_slicing", "enable_vae_slicing", "enable_vae_tiling"):
        method = getattr(pipe, name, None)
        if callable(method):
            try:
                method()
            except TypeError:
                try:
                    method("max")
                except Exception:
                    pass
            except Exception:
                pass


def _place_pipeline(pipe: Any, device: str, offload: str) -> Any:
    if offload == "sequential" and hasattr(pipe, "enable_sequential_cpu_offload"):
        try:
            pipe.enable_sequential_cpu_offload()
            return pipe
        except Exception:
            pass
    if offload == "model" and hasattr(pipe, "enable_model_cpu_offload"):
        try:
            pipe.enable_model_cpu_offload()
            return pipe
        except Exception:
            pass
    return pipe.to(device)


def _offload_mode(repository: Path, device: str) -> str:
    if device != "cuda":
        return "none"
    raw = os.environ.get("ARCHITOKEN_COMFYUI_HF_OFFLOAD", "auto").strip().lower()
    if raw in {"0", "false", "off", "none", "disable", "disabled"}:
        return "none"
    if raw in {"model", "cpu"}:
        return "model"
    if raw in {"sequential", "seq", "1", "true", "yes", "on"}:
        return "sequential"
    return "model"


NODE_CLASS_MAPPINGS = {
    "ArchITokenHuggingFaceTextToImage": ArchITokenHuggingFaceTextToImage,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ArchITokenHuggingFaceTextToImage": "ArchIToken Hugging Face Text To Image",
}
