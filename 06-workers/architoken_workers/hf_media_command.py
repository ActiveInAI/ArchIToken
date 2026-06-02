"""Local Hugging Face media command adapter for ArchIToken.

This command is executed by ``engine_server.py`` when a local Hugging Face
runtime is available. It never writes placeholder media: failures are returned
as a non-zero process exit so the caller can mark the generation as blocked.
"""

from __future__ import annotations

import argparse
import inspect
import json
import os
import re
import sys
import traceback
from pathlib import Path
from typing import Any


_PIPELINE_CACHE: dict[tuple[str, ...], Any] = {}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run local Hugging Face media generation.")
    parser.add_argument("--input", required=True, help="Request JSON written by engine_server.py")
    parser.add_argument("--output", required=True, help="Output media file to write")
    parser.add_argument("--task", required=True, help="Normalized task type")
    parser.add_argument("--model", required=True, help="Hugging Face model id")
    args = parser.parse_args(argv)

    try:
        request = json.loads(Path(args.input).read_text(encoding="utf-8"))
        task = args.task.strip().lower().replace("-", "_")
        if task == "text_to_image":
            _run_text_to_image(request, args.model, Path(args.output))
            return 0
        if task == "image_to_video":
            raise RuntimeError(
                "image_to_video requires a configured LTX-2 runtime command or HTTP adapter; "
                "diffusers support for this local LTX-2.3 NVFP4 model repository is not enabled here."
            )
        raise RuntimeError(f"unsupported media task: {args.task}")
    except Exception as exc:  # noqa: BLE001 - surface exact provider failure to caller.
        print(
            f"ArchIToken local HF media command failed: {type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        traceback.print_exc(file=sys.stderr)
        return 2


def _run_text_to_image(request: dict[str, Any], model: str, output_path: Path) -> None:
    _force_offline_hf()

    prompt = _prompt(request)
    model_path = _resolve_model_path(request, model)
    parameters = request.get("parameters") if isinstance(request.get("parameters"), dict) else {}
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    import torch

    device = _torch_device(torch)
    pipe = _text_to_image_pipeline(model, model_path, torch, device)

    width = _dimension(parameters, "width", default=1024)
    height = _dimension(parameters, "height", default=1024)
    steps = _int_value(
        os.environ.get("ARCHITOKEN_HF_IMAGE_STEPS")
        or parameters.get("num_inference_steps")
        or parameters.get("steps"),
        default=50,
        minimum=1,
        maximum=100,
    )
    guidance_scale = _float_value(parameters.get("guidance_scale"), default=4.0)
    seed = parameters.get("seed")

    kwargs: dict[str, Any] = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
        "guidance_scale": guidance_scale,
    }
    negative_prompt = _string_value(parameters.get("negative_prompt") or parameters.get("negativePrompt"))
    if negative_prompt and _pipeline_accepts_argument(pipe, "negative_prompt"):
        kwargs["negative_prompt"] = negative_prompt
    if "ERNIE-Image" in model:
        kwargs["use_pe"] = bool(parameters.get("use_pe", True))
    if seed is not None:
        generator_device = "cpu" if _offload_mode(model, device) != "none" else device
        kwargs["generator"] = torch.Generator(device=generator_device).manual_seed(int(seed))

    result = pipe(**kwargs)
    images = getattr(result, "images", None)
    if not images:
        raise RuntimeError("diffusers pipeline completed without images")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(output_path)
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError("diffusers pipeline wrote an empty image")



def _text_to_image_pipeline(model: str, model_path: Path, torch: Any, device: str) -> Any:
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    offload_mode = _offload_mode(model, device)
    cache_key = (model, str(model_path), device, str(dtype), offload_mode)
    cached = _PIPELINE_CACHE.get(cache_key)
    if cached is not None:
        return cached

    from diffusers import DiffusionPipeline

    pipeline_cls = DiffusionPipeline
    if "ERNIE-Image" in model:
        from diffusers import ErnieImagePipeline

        pipeline_cls = ErnieImagePipeline

    pipe = pipeline_cls.from_pretrained(
        str(model_path),
        torch_dtype=dtype,
        local_files_only=True,
    )
    _enable_memory_savers(pipe)
    if device != "cpu":
        pipe = _place_pipeline(pipe, device, offload_mode)
    _PIPELINE_CACHE[cache_key] = pipe
    return pipe


def _place_pipeline(pipe: Any, device: str, offload_mode: str) -> Any:
    if offload_mode == "sequential" and hasattr(pipe, "enable_sequential_cpu_offload"):
        try:
            pipe.enable_sequential_cpu_offload()
            return pipe
        except Exception as exc:
            print(f"ArchIToken local HF media command: sequential CPU offload unavailable: {exc}", file=sys.stderr)
    if offload_mode == "model" and hasattr(pipe, "enable_model_cpu_offload"):
        try:
            pipe.enable_model_cpu_offload()
            return pipe
        except Exception as exc:
            print(f"ArchIToken local HF media command: model CPU offload unavailable: {exc}", file=sys.stderr)
    return pipe.to(device)


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


def _offload_mode(model: str, device: str) -> str:
    if device != "cuda":
        return "none"
    raw = os.environ.get("ARCHITOKEN_HF_IMAGE_OFFLOAD", "auto").strip().lower()
    if raw in {"0", "false", "off", "none", "disable", "disabled"}:
        return "none"
    if raw in {"model", "cpu"}:
        return "model"
    if raw in {"sequential", "seq", "1", "true", "yes", "on"}:
        return "sequential"
    return "sequential" if "ERNIE-Image" in model else "model"


def _force_offline_hf() -> None:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("HF_DATASETS_OFFLINE", "1")


def _prompt(request: dict[str, Any]) -> str:
    prompt = request.get("prompt") or request.get("inputs")
    if isinstance(prompt, dict):
        prompt = prompt.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise RuntimeError("prompt is required")
    return _strip_openclaw_chat_prefix(prompt)


def _strip_openclaw_chat_prefix(prompt: str) -> str:
    stripped = prompt.strip()
    cleaned = re.sub(
        r"^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+GMT[^\]]*\]\s*",
        "",
        stripped,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned or stripped


def _pipeline_accepts_argument(pipe: Any, name: str) -> bool:
    try:
        signature = inspect.signature(pipe.__call__)
    except (TypeError, ValueError):
        return True
    return name in signature.parameters or any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in signature.parameters.values()
    )


def _string_value(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _resolve_model_path(request: dict[str, Any], model: str) -> Path:
    model_repository = request.get("modelRepository")
    if isinstance(model_repository, str) and model_repository.strip():
        candidate = Path(model_repository).expanduser()
        if _is_model_repository(candidate):
            return candidate
    default_repository = _repository_dir_for_model(model)
    if _is_model_repository(default_repository):
        return default_repository
    raise RuntimeError(
        f"local Hugging Face model repository not found for {model}; "
        "import the model under data/model-repository/huggingface/<owner>/<model>"
    )


def _repository_dir_for_model(model: str) -> Path:
    model_id = model.split("/", 1)[1] if model.startswith("huggingface/") else model
    parts = [part for part in model_id.split("/") if part]
    root = os.environ.get("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR")
    if root:
        return Path(root).expanduser().joinpath(*parts)
    repository_root = os.environ.get("ARCHITOKEN_MODEL_REPOSITORY_DIR")
    if repository_root:
        return Path(repository_root).expanduser().joinpath("huggingface", *parts)
    return Path(__file__).resolve().parents[2].joinpath("data", "model-repository", "huggingface", *parts)


def _is_model_repository(path: Path) -> bool:
    return path.exists() and (
        (path / "model_index.json").exists()
        or (path / "config.json").exists()
        or (path / "tokenizer.json").exists()
        or (path / "README.md").exists()
    )

def _torch_device(torch: Any) -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _dimension(parameters: dict[str, Any], key: str, *, default: int) -> int:
    value = _int_value(parameters.get(key), default=default, minimum=256, maximum=2048)
    return max(256, (value // 32) * 32)


def _int_value(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _float_value(value: Any, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


if __name__ == "__main__":
    raise SystemExit(main())
