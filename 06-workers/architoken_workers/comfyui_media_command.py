"""ArchIToken ComfyUI command adapter.

The worker service executes this command behind ModelRouter/InferenceRouter.
It queues real ComfyUI workflows and writes the produced media file to the
path requested by ``engine_server.py``.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import mimetypes
import os
import re
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any


TASK_WORKFLOW_ENVS: dict[str, tuple[str, ...]] = {
    "text_to_image": ("ARCHITOKEN_COMFYUI_WORKFLOW_TEXT_TO_IMAGE",),
    "image_to_image": ("ARCHITOKEN_COMFYUI_WORKFLOW_IMAGE_TO_IMAGE",),
    "image_to_video": ("ARCHITOKEN_COMFYUI_WORKFLOW_IMAGE_TO_VIDEO",),
    "text_to_video": ("ARCHITOKEN_COMFYUI_WORKFLOW_TEXT_TO_VIDEO",),
    "image_to_3d": ("ARCHITOKEN_COMFYUI_WORKFLOW_IMAGE_TO_3D",),
    "object_to_3d_asset": ("ARCHITOKEN_COMFYUI_WORKFLOW_OBJECT_TO_3D_ASSET",),
    "world_3d_research": ("ARCHITOKEN_COMFYUI_WORKFLOW_WORLD_3D_RESEARCH",),
    "ocr": ("ARCHITOKEN_COMFYUI_WORKFLOW_OCR",),
}

DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("ARCHITOKEN_COMFYUI_TIMEOUT_SECONDS", "900"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run an ArchIToken ComfyUI workflow.")
    parser.add_argument("--input", required=True, help="Request JSON written by engine_server.py")
    parser.add_argument("--output", required=True, help="Output media file to write")
    parser.add_argument("--task", required=True, help="Normalized task type")
    parser.add_argument("--model", required=True, help="Provider model id")
    args = parser.parse_args(argv)

    try:
        request = json.loads(Path(args.input).read_text(encoding="utf-8"))
        task = _normalize_task(args.task)
        client = _ComfyClient()
        extra: dict[str, Any] = {}
        image_bytes = _input_image_bytes(request)
        if image_bytes is not None:
            extra["input_image"] = client.upload_image(image_bytes)
        workflow = _workflow_for_task(task, request, args.model, extra=extra)
        unresolved = re.findall(r"\{\{\s*(input_image)\s*\}\}", json.dumps(workflow))
        if unresolved:
            raise RuntimeError(
                f"{task} requires an input image; provide constraints.imageBase64, "
                "constraints.imageUrl, inputs.image or inputArtifacts[].objectUri"
            )
        _assert_required_nodes(client, workflow)
        prompt_id = client.queue(workflow)
        outputs = client.wait(prompt_id, timeout=int(request.get("timeoutSeconds") or DEFAULT_TIMEOUT_SECONDS))
        candidates = _output_files(outputs)
        # 主产物优先取非 JSON 文件；纯数据型工作流（如 OCR）则直接以 JSON 为主产物
        media = next(
            (item for item in candidates if Path(item["filename"]).suffix.lower() != ".json"),
            None,
        ) or (candidates[0] if candidates else None)
        if media is None:
            raise RuntimeError("ComfyUI workflow completed without a saved output file")
        content = client.download(media)
        if not content:
            raise RuntimeError("ComfyUI returned an empty output file")
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(content)
        # 工作流额外保存的 JSON（如 OCR 的版面区域结构）作为 sidecar 交给 engine_server
        sidecar = next(
            (
                item
                for item in candidates
                if item is not media and Path(item["filename"]).suffix.lower() == ".json"
            ),
            None,
        )
        if sidecar is not None:
            try:
                sidecar_content = client.download(sidecar)
                if sidecar_content:
                    Path(str(output_path) + ".extra.json").write_bytes(sidecar_content)
            except Exception as exc:  # noqa: BLE001 - sidecar 失败不影响主产物
                print(f"sidecar download skipped: {exc}", file=sys.stderr)
        return 0
    except Exception as exc:  # noqa: BLE001 - exact provider failure is diagnostic.
        print(f"ArchIToken ComfyUI command failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        if os.environ.get("ARCHITOKEN_COMFYUI_DEBUG_TRACEBACK", "").lower() in {"1", "true", "yes", "on"}:
            traceback.print_exc(file=sys.stderr)
        return 2


def _workflow_for_task(
    task: str, request: dict[str, Any], model: str, *, extra: dict[str, Any] | None = None
) -> dict[str, Any]:
    configured = _configured_workflow(task)
    if configured is not None:
        return _patch_workflow(configured, request=request, task=task, model=model, extra=extra)
    if task == "text_to_image":
        return _default_text_to_image_workflow(request, model)
    envs = ", ".join(TASK_WORKFLOW_ENVS.get(task, ()))
    raise RuntimeError(f"{task} requires a ComfyUI workflow JSON configured by one of: {envs}")


def _configured_workflow(task: str) -> dict[str, Any] | None:
    for name in TASK_WORKFLOW_ENVS.get(task, ()):
        raw = os.environ.get(name)
        if not raw or not raw.strip():
            continue
        path = Path(raw).expanduser()
        if not path.exists():
            raise RuntimeError(f"{name} points to a missing workflow file: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("prompt"), dict):
            payload = payload["prompt"]
        if not isinstance(payload, dict):
            raise RuntimeError(f"{name} must contain a ComfyUI API workflow object")
        return payload
    return None


def _default_text_to_image_workflow(request: dict[str, Any], model: str) -> dict[str, Any]:
    repository = _model_repository(request, model)
    parameters = request.get("parameters") if isinstance(request.get("parameters"), dict) else {}
    prompt = _prompt(request)
    negative = _string(parameters.get("negative_prompt") or parameters.get("negativePrompt")) or (
        "text, watermark, logo, blurry, low quality"
    )
    width = _dimension(parameters.get("width"), default=512)
    height = _dimension(parameters.get("height"), default=512)
    steps = _int(parameters.get("steps") or parameters.get("num_inference_steps"), default=8, minimum=1, maximum=100)
    guidance = _float(parameters.get("guidance_scale"), default=4.0)
    seed = _int(parameters.get("seed"), default=int(time.time()) % (2**31), minimum=0, maximum=2**63 - 1)
    prefix = f"architoken_{_slug(Path(repository).name or 'hf')}_{uuid.uuid4().hex[:8]}"
    node_class = os.environ.get(
        "ARCHITOKEN_COMFYUI_HF_TEXT_TO_IMAGE_NODE",
        "ArchITokenHuggingFaceTextToImage",
    )
    return {
        "1": {
            "class_type": node_class,
            "inputs": {
                "model_repository": repository,
                "prompt": prompt,
                "negative_prompt": negative,
                "width": width,
                "height": height,
                "steps": steps,
                "guidance_scale": guidance,
                "seed": seed,
                "use_pe": bool(parameters.get("use_pe", False)),
            },
        },
        "2": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["1", 0],
                "filename_prefix": prefix,
            },
        },
    }


def _patch_workflow(
    workflow: dict[str, Any],
    *,
    request: dict[str, Any],
    task: str,
    model: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    parameters = request.get("parameters") if isinstance(request.get("parameters"), dict) else {}
    try:
        prompt = _prompt(request)
    except RuntimeError:
        if task not in {"ocr", "image_to_3d", "object_to_3d_asset", "world_3d_research"}:
            raise
        prompt = ""
    values = {
        "prompt": prompt,
        "negative_prompt": _string(parameters.get("negative_prompt") or parameters.get("negativePrompt")) or "",
        "model": model,
        "model_repository": _model_repository_or_empty(request, model),
        "task": task,
        "width": _dimension(parameters.get("width"), default=512),
        "height": _dimension(parameters.get("height"), default=512),
        "steps": _int(parameters.get("steps") or parameters.get("num_inference_steps"), default=20, minimum=1, maximum=1000),
        "seed": _int(parameters.get("seed"), default=int(time.time()) % (2**31), minimum=0, maximum=2**63 - 1),
        "guidance_scale": _float(parameters.get("guidance_scale"), default=4.0),
        "length": _int(parameters.get("length") or parameters.get("num_frames"), default=97, minimum=9, maximum=1024),
        "fps": _int(parameters.get("fps") or parameters.get("frame_rate"), default=24, minimum=1, maximum=60),
        "denoise": _float(parameters.get("denoise") or parameters.get("strength"), default=0.6),
        "filename_prefix": f"architoken_{_slug(task)}_{uuid.uuid4().hex[:8]}",
    }
    if extra:
        values.update(extra)
    return _replace_placeholders(workflow, values)


def _input_image_bytes(request: dict[str, Any]) -> bytes | None:
    constraints = request.get("constraints") if isinstance(request.get("constraints"), dict) else {}
    inputs = request.get("inputs") if isinstance(request.get("inputs"), dict) else {}
    candidates: list[Any] = [
        constraints.get("imageBase64"),
        inputs.get("image"),
        constraints.get("imageUrl"),
    ]
    artifacts = request.get("inputArtifacts")
    if isinstance(artifacts, list):
        candidates.extend(
            artifact.get("objectUri") for artifact in artifacts if isinstance(artifact, dict)
        )
    for candidate in candidates:
        if not isinstance(candidate, str) or not candidate.strip():
            continue
        content = _decode_image_candidate(candidate.strip())
        if content:
            return content
    return None


def _decode_image_candidate(value: str) -> bytes | None:
    if value.startswith("data:"):
        _, _, payload = value.partition(",")
        value = payload
    if value.startswith(("http://", "https://")):
        request = urllib.request.Request(value, headers={"User-Agent": "architoken-comfyui"})
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    try:
        path = Path(value).expanduser()
        if path.is_file():
            return path.read_bytes()
    except OSError:
        pass
    try:
        content = base64.b64decode(re.sub(r"\s+", "", value), validate=True)
    except (binascii.Error, ValueError):
        return None
    return content if len(content) > 16 else None


def _image_suffix(content: bytes) -> str:
    if content.startswith(b"\x89PNG"):
        return ".png"
    if content.startswith(b"\xff\xd8"):
        return ".jpg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ".webp"
    return ".png"


def _replace_placeholders(value: Any, replacements: dict[str, Any]) -> Any:
    if isinstance(value, dict):
        return {key: _replace_placeholders(item, replacements) for key, item in value.items()}
    if isinstance(value, list):
        return [_replace_placeholders(item, replacements) for item in value]
    if not isinstance(value, str):
        return value
    exact = re.fullmatch(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", value)
    if exact and exact.group(1) in replacements:
        return replacements[exact.group(1)]
    patched = value
    for key, replacement in replacements.items():
        patched = patched.replace(f"{{{{{key}}}}}", str(replacement))
        patched = patched.replace(f"{{{{ {key} }}}}", str(replacement))
    return patched


def _assert_required_nodes(client: "_ComfyClient", workflow: dict[str, Any]) -> None:
    object_info = client.object_info()
    missing = sorted(
        {
            str(node.get("class_type"))
            for node in workflow.values()
            if isinstance(node, dict)
            and isinstance(node.get("class_type"), str)
            and node["class_type"] not in object_info
        }
    )
    if missing:
        raise RuntimeError(f"ComfyUI is missing required node(s): {', '.join(missing)}")


class _ComfyClient:
    def __init__(self) -> None:
        self.base_url = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
        self.tokens = _candidate_tokens()
        self.client_id = str(uuid.uuid4())

    def object_info(self) -> dict[str, Any]:
        payload = self._json("GET", "/object_info")
        return payload if isinstance(payload, dict) else {}

    def queue(self, workflow: dict[str, Any]) -> str:
        payload = self._json(
            "POST",
            "/prompt",
            body={"client_id": self.client_id, "prompt": workflow},
        )
        prompt_id = payload.get("prompt_id") if isinstance(payload, dict) else None
        if not isinstance(prompt_id, str) or not prompt_id:
            raise RuntimeError(f"ComfyUI did not return a prompt_id: {payload}")
        return prompt_id

    def wait(self, prompt_id: str, *, timeout: int) -> dict[str, Any]:
        deadline = time.time() + timeout
        last_status: Any = None
        while time.time() < deadline:
            payload = self._json("GET", f"/history/{urllib.parse.quote(prompt_id)}")
            item = payload.get(prompt_id) if isinstance(payload, dict) else None
            if isinstance(item, dict):
                status = item.get("status") if isinstance(item.get("status"), dict) else {}
                last_status = status
                if status.get("completed"):
                    outputs = item.get("outputs")
                    return outputs if isinstance(outputs, dict) else {}
                if status.get("status_str") == "error":
                    raise RuntimeError(f"ComfyUI workflow failed: {json.dumps(status, ensure_ascii=False)[:2000]}")
            time.sleep(1.0)
        raise RuntimeError(f"ComfyUI workflow timed out after {timeout}s; last status: {last_status}")

    def upload_image(self, content: bytes) -> str:
        filename = f"architoken_input_{uuid.uuid4().hex[:12]}{_image_suffix(content)}"
        boundary = uuid.uuid4().hex
        parts = [
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
                "Content-Type: application/octet-stream\r\n\r\n"
            ).encode("utf-8"),
            content,
            (
                f"\r\n--{boundary}\r\n"
                'Content-Disposition: form-data; name="overwrite"\r\n\r\n'
                "true"
                f"\r\n--{boundary}--\r\n"
            ).encode("utf-8"),
        ]
        body = b"".join(parts)
        response = self._request(
            "POST",
            "/upload/image",
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )
        try:
            payload = json.loads(response.decode("utf-8", errors="replace"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"ComfyUI image upload returned non-JSON: {response[:300]!r}") from exc
        name = payload.get("name") if isinstance(payload, dict) else None
        if not isinstance(name, str) or not name:
            raise RuntimeError(f"ComfyUI image upload failed: {payload}")
        subfolder = payload.get("subfolder") if isinstance(payload, dict) else ""
        return f"{subfolder}/{name}" if subfolder else name

    def download(self, media: dict[str, str]) -> bytes:
        params = urllib.parse.urlencode(
            {
                "filename": media.get("filename", ""),
                "subfolder": media.get("subfolder", ""),
                "type": media.get("type", "output"),
            }
        )
        return self._bytes("GET", f"/view?{params}")

    def _json(self, method: str, path: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        response = self._request(method, path, data=data, headers=headers)
        text = response.decode("utf-8", errors="replace")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            if _looks_like_html_login(text):
                raise RuntimeError(
                    "ComfyUI API returned the login page instead of JSON. "
                    "Set COMFYUI_TOKEN for the running worker or point COMFYUI_URL to an unauthenticated ComfyUI API endpoint."
                ) from exc
            raise RuntimeError(f"ComfyUI returned non-JSON response: {text[:500]}") from exc
        if isinstance(payload, dict) and payload.get("error"):
            raise RuntimeError(f"ComfyUI returned error: {payload['error']}")
        return payload if isinstance(payload, dict) else {}

    def _bytes(self, method: str, path: str) -> bytes:
        return self._request(method, path, data=None, headers={"Accept": "*/*"})

    def _request(self, method: str, path: str, *, data: bytes | None, headers: dict[str, str]) -> bytes:
        tokens = self.tokens or [""]
        last_login_body: bytes | None = None
        last_http_error: tuple[int, str] | None = None
        for index, token_value in enumerate(tokens):
            separator = "&" if "?" in path else "?"
            token = f"{separator}token={urllib.parse.quote(token_value)}" if token_value else ""
            request = urllib.request.Request(
                f"{self.base_url}{path}{token}",
                data=data,
                headers=headers,
                method=method,
            )
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    body = response.read()
            except urllib.error.HTTPError as exc:
                error_body = exc.read().decode("utf-8", errors="replace")
                if exc.code in {401, 403} and index < len(tokens) - 1:
                    last_http_error = (exc.code, error_body)
                    continue
                raise RuntimeError(f"ComfyUI returned HTTP {exc.code}: {error_body[:1000]}") from exc
            except urllib.error.URLError as exc:
                raise RuntimeError(f"ComfyUI request failed: {exc.reason}") from exc

            text = body.decode("utf-8", errors="replace")
            if _looks_like_html_login(text) and index < len(tokens) - 1:
                last_login_body = body
                continue
            return body
        if last_login_body is not None:
            return last_login_body
        if last_http_error is not None:
            code, error_body = last_http_error
            raise RuntimeError(f"ComfyUI returned HTTP {code}: {error_body[:1000]}")
        raise RuntimeError("ComfyUI request failed before receiving a response")


def _first_output_file(outputs: dict[str, Any]) -> dict[str, str] | None:
    candidates = _output_files(outputs)
    return candidates[0] if candidates else None


def _output_files(outputs: dict[str, Any]) -> list[dict[str, str]]:
    preferred_extensions = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".gif", ".glb", ".obj", ".fbx"}
    candidates: list[dict[str, str]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            filename = value.get("filename")
            if isinstance(filename, str) and filename:
                suffix = Path(filename).suffix.lower()
                if suffix in preferred_extensions or mimetypes.guess_type(filename)[0]:
                    candidates.append(
                        {
                            "filename": filename,
                            "subfolder": str(value.get("subfolder") or ""),
                            "type": str(value.get("type") or "output"),
                        }
                    )
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(outputs)
    return candidates


def _model_repository_or_empty(request: dict[str, Any], model: str) -> str:
    """Like _model_repository but tolerant: workflows that don't reference
    {{model_repository}} (e.g. ComfyUI-checkpoint based 3D/video tasks) must
    not fail when the routed model id is not a local Hugging Face repo."""
    try:
        return _model_repository(request, model)
    except RuntimeError:
        return ""


def _model_repository(request: dict[str, Any], model: str) -> str:
    raw = request.get("modelRepository")
    if isinstance(raw, str) and _looks_like_repository(Path(raw).expanduser()):
        return str(Path(raw).expanduser())

    model_id = model.split("/", 1)[1] if model.startswith("huggingface/") else model
    parts = [part for part in model_id.split("/") if part]
    for root in _repository_roots():
        candidate = root.joinpath(*parts)
        if _looks_like_repository(candidate):
            return str(candidate)
    cache = _cache_snapshot(model_id)
    if cache:
        return cache
    raise RuntimeError(f"local Hugging Face repository not found for {model}")


def _repository_roots() -> list[Path]:
    roots: list[Path] = []
    for name in ("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR", "HUGGINGFACE_MODEL_REPOSITORY_DIR"):
        value = os.environ.get(name)
        if value:
            roots.append(Path(value).expanduser())
    repository_root = os.environ.get("ARCHITOKEN_MODEL_REPOSITORY_DIR")
    if repository_root:
        roots.append(Path(repository_root).expanduser() / "huggingface")
    roots.append(Path(__file__).resolve().parents[2] / "data" / "model-repository" / "huggingface")
    return roots


def _cache_snapshot(model_id: str) -> str | None:
    if "/" not in model_id:
        return None
    owner, name = model_id.split("/", 1)
    root = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{owner}--{name}" / "snapshots"
    if not root.exists():
        return None
    candidates = [path for path in root.iterdir() if _looks_like_repository(path)]
    if not candidates:
        return None
    candidates.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return str(candidates[0])


def _looks_like_repository(path: Path) -> bool:
    return path.exists() and (
        (path / "model_index.json").exists()
        or (path / "config.json").exists()
        or (path / "tokenizer.json").exists()
        or (path / "README.md").exists()
    )


def _prompt(request: dict[str, Any]) -> str:
    prompt = request.get("prompt") or request.get("inputs")
    if isinstance(prompt, dict):
        prompt = prompt.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise RuntimeError("prompt is required")
    return _strip_panai_chat_prefix(prompt)


def _strip_panai_chat_prefix(prompt: str) -> str:
    stripped = prompt.strip()
    cleaned = re.sub(
        r"^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+GMT[^\]]*\]\s*",
        "",
        stripped,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned or stripped


def _candidate_tokens() -> list[str]:
    tokens: list[str] = []
    for token in (os.environ.get("COMFYUI_TOKEN"), *_tokens_from_logs()):
        if not isinstance(token, str) or not token.strip():
            continue
        stripped = token.strip()
        if stripped not in tokens:
            tokens.append(stripped)
    return tokens


def _token_from_log() -> str:
    tokens = _tokens_from_logs()
    return tokens[0] if tokens else ""


def _tokens_from_logs() -> list[str]:
    comfyui_home = Path(os.environ.get("COMFYUI_HOME", str(Path.home() / "ComfyUI")))
    candidates = [
        comfyui_home / "user" / "comfyui_8188.log",
        Path(os.environ.get("COMFYUI_LOG", "/tmp/architoken-comfyui.log")),
        comfyui_home / "user" / "comfyui.log",
        comfyui_home / "comfyui.log",
        comfyui_home / "user" / "comfyui_8188.prev.log",
        comfyui_home / "user" / "comfyui_8188.prev2.log",
    ]
    seen: set[Path] = set()
    tokens: list[str] = []
    for path in candidates:
        if path in seen:
            continue
        seen.add(path)
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        matches = re.findall(r"\$2b\$12\$[A-Za-z0-9./]+", text)
        for token in reversed(matches):
            if token not in tokens:
                tokens.append(token)
    return tokens


def _looks_like_html_login(text: str) -> bool:
    lowered = text[:2000].lower()
    return "<html" in lowered and ("login" in lowered or "comfyui" in lowered)


def _normalize_task(task: str) -> str:
    return task.strip().lower().replace("-", "_")


def _string(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _int(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _float(value: Any, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _dimension(value: Any, *, default: int) -> int:
    parsed = _int(value, default=default, minimum=256, maximum=2048)
    return max(256, (parsed // 32) * 32)


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_.-]+", "_", value.strip())
    return slug.strip("._-") or "comfyui"


if __name__ == "__main__":
    raise SystemExit(main())
