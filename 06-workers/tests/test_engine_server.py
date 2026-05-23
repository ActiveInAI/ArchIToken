import base64
import json
import urllib.request

from fastapi import HTTPException

import engine_server


class DummyRequest:
    def url_for(self, name: str, **params: str) -> str:
        assert name == "download_generated_file"
        return f"http://testserver/download/{params['filename']}"


def clear_hf_media_env(monkeypatch) -> None:
    for name in (
        "ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER",
        "ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER",
        "ARCHITOKEN_HF_MODEL_ROUTES",
        "ARCHITOKEN_HF_REMOTE_ENABLED",
        "HUGGINGFACE_REMOTE_ENABLED",
        "ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL",
        "HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_URL",
        "ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL",
        "HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_URL",
        "ARCHITOKEN_HF_LOCAL_MEDIA_URL",
        "HUGGINGFACE_LOCAL_MEDIA_URL",
        "ARCHITOKEN_HF_LOCAL_CHAT_URL",
        "HUGGINGFACE_LOCAL_CHAT_URL",
        "ARCHITOKEN_HF_CHAT_URL",
        "HUGGINGFACE_CHAT_URL",
        "ARCHITOKEN_VLLM_BASE_URL",
        "VLLM_BASE_URL",
        "ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_COMMAND",
        "HUGGINGFACE_LOCAL_TEXT_TO_IMAGE_COMMAND",
        "ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_COMMAND",
        "HUGGINGFACE_LOCAL_IMAGE_TO_VIDEO_COMMAND",
        "ARCHITOKEN_HF_LOCAL_MEDIA_COMMAND",
        "HUGGINGFACE_LOCAL_MEDIA_COMMAND",
        "ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL",
        "ARCHITOKEN_HF_TEXT_TO_IMAGE_URL",
        "HUGGINGFACE_TEXT_TO_IMAGE_MODEL",
        "HUGGINGFACE_TEXT_TO_IMAGE_URL",
        "ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL",
        "ARCHITOKEN_HF_IMAGE_TO_VIDEO_URL",
        "HUGGINGFACE_IMAGE_TO_VIDEO_MODEL",
        "HUGGINGFACE_IMAGE_TO_VIDEO_URL",
        "OPENCLAW_IMAGE_MODEL",
        "OPENCLAW_VIDEO_MODEL",
        "ARCHITOKEN_DISABLE_HF_AUTO_LOCAL_MEDIA_COMMAND",
        "ARCHITOKEN_HF_LOCAL_MEDIA_PYTHON",
        "HUGGINGFACE_LOCAL_MEDIA_PYTHON",
        "ARCHITOKEN_HF_MODEL_REPOSITORY_DIR",
        "ARCHITOKEN_MODEL_REPOSITORY_DIR",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ARCHITOKEN_DISABLE_HF_AUTO_LOCAL_MEDIA_COMMAND", "1")


def test_text_to_image_returns_media_protocol(monkeypatch, tmp_path) -> None:
    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        assert prompt == "a yellow dog"
        assert payload["mode"] == "text_to_image"
        return engine_server.ProviderResult(
            engine="test-hf",
            model="test-image-model",
            media_type="image/png",
            content=b"png-bytes",
            filename="generated.png",
            summary="real provider fixture",
            metadata={"provider": "huggingface"},
        )

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)

    payload = engine_server.generate_text_to_image(
        {"mode": "text_to_image", "prompt": "a yellow dog"},
        DummyRequest(),
    )

    assert payload["engine"] == "test-hf"
    assert payload["modelCalls"] == 1
    artifact = payload["artifacts"][0]
    assert artifact["kind"] == "image"
    assert artifact["mimeType"] == "image/png"
    assert artifact["base64"] == base64.b64encode(b"png-bytes").decode("ascii")


def test_text_to_image_requires_real_provider(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.delenv("HF_TOKEN", raising=False)
    monkeypatch.delenv("HUGGINGFACE_API_TOKEN", raising=False)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    try:
        engine_server.generate_text_to_image({"mode": "text_to_image", "prompt": "a yellow dog"}, DummyRequest())
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail["code"] == "adapter_not_configured"
        assert "ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL" in exc.detail["message"]
    else:
        raise AssertionError("unconfigured image provider should raise HTTPException")



def test_local_huggingface_chat_adapter_returns_openai_response(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_HF_LOCAL_CHAT_URL", "http://127.0.0.1:9998/v1/chat/completions")

    class FakeResponse:
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "model": "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
                "choices": [{"message": {"content": "我是 ArchIToken，本次回复来自真实 HF/vLLM adapter。"}}],
                "usage": {"prompt_tokens": 8, "completion_tokens": 12},
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: int) -> FakeResponse:
        assert request.full_url == "http://127.0.0.1:9998/v1/chat/completions"
        body = json.loads(request.data.decode("utf-8"))
        assert body["model"] == "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"
        assert body["messages"][-1]["content"] == "你好"
        return FakeResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.chat_completions({"messages": [{"role": "user", "content": "你好"}]})

    assert payload["model"] == "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"
    assert payload["choices"][0]["message"]["content"].startswith("我是 ArchIToken")
    assert payload["metadata"]["provider"] == "huggingface"
    assert payload["metadata"]["providerMode"] == "local_chat_http"

def test_models_registry_defaults_to_huggingface_routes(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["data"]}

    assert routes["chat"]["provider"] == "huggingface"
    assert routes["chat"]["id"] == "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"
    assert routes["code"]["id"] == "Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8"
    assert routes["ocr"]["id"] == "PaddlePaddle/PaddleOCR-VL-1.5"
    assert routes["image_to_image"]["id"] == "black-forest-labs/FLUX.2-dev-NVFP4"
    assert routes["image_to_3d"]["id"] == "tencent/HY-World-2.0"
    assert routes["object_to_3d_asset"]["id"] == "nvidia/asset-harvester"
    assert routes["world_3d_research"]["id"] == "nvidia/Lyra-2.0"
    assert routes["text_to_image"]["provider"] == "huggingface"
    assert routes["image_to_video"]["provider"] == "huggingface"
    assert routes["text_to_image"]["id"] == "baidu/ERNIE-Image"
    assert routes["image_to_video"]["id"] == "Lightricks/LTX-2.3-nvfp4"
    assert routes["text_to_image"]["configured"] is False
    assert routes["image_to_video"]["configured"] is False
    assert "ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL" in routes["text_to_image"]["missing"]
    assert "ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL" in routes["image_to_video"]["missing"]
    assert routes["text_to_image"]["providerPreference"] == "local_huggingface_first"


def test_models_registry_exposes_repository_only_huggingface_models(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    repository = tmp_path / "huggingface"
    model_dir = repository / "custom-owner" / "Custom-Architecture-Model"
    model_dir.mkdir(parents=True)
    (model_dir / "README.md").write_text("# Custom Architecture Model\n", encoding="utf-8")
    monkeypatch.setenv("ARCHITOKEN_HF_MODEL_REPOSITORY_DIR", str(repository))

    payload = engine_server.list_models()
    by_id = {model["id"]: model for model in payload["data"]}

    assert "custom-owner/Custom-Architecture-Model" in payload["models"]
    assert "custom-owner/Custom-Architecture-Model" in payload["repositoryModelIds"]
    assert by_id["custom-owner/Custom-Architecture-Model"]["provider"] == "huggingface"
    assert by_id["custom-owner/Custom-Architecture-Model"]["repositoryOnly"] is True


def test_huggingface_remote_media_requires_explicit_enable(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")
    monkeypatch.setenv("ARCHITOKEN_HF_REMOTE_ENABLED", "1")

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["data"]}

    assert routes["text_to_image"]["configured"] is True
    assert routes["text_to_image"]["remoteEnabled"] is True
    assert routes["image_to_video"]["configured"] is True


def test_auto_huggingface_local_command_uses_repository_text_to_image_runtime(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.delenv("ARCHITOKEN_DISABLE_HF_AUTO_LOCAL_MEDIA_COMMAND", raising=False)
    python = tmp_path / "bin" / "python"
    python.parent.mkdir()
    python.write_text("#!/usr/bin/env python\n", encoding="utf-8")
    python.chmod(0o755)
    (python.parent / "diffusers-cli").write_text("", encoding="utf-8")
    (python.parent / "accelerate").write_text("", encoding="utf-8")
    monkeypatch.setenv("ARCHITOKEN_HF_LOCAL_MEDIA_PYTHON", str(python))
    monkeypatch.setattr(engine_server, "_huggingface_model_repository_path", lambda model: "/tmp/hf-model-repository")
    monkeypatch.setattr(engine_server, "_python_supports_hf_media_model", lambda python, task_type, route_model: True)

    command = engine_server._huggingface_local_command("text_to_image", "baidu/ERNIE-Image")

    assert command is not None
    assert str(python) in command
    assert "hf_media_command.py" in command
    assert engine_server._huggingface_local_command("image_to_video", "Lightricks/LTX-2.3-nvfp4") is None


def test_local_huggingface_http_adapter_returns_real_artifact(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL", "http://127.0.0.1:9999/v1/generate")
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)

    class FakeResponse:
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "base64": base64.b64encode(b"real-image").decode("ascii"),
                "mimeType": "image/png",
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: int) -> FakeResponse:
        assert request.full_url == "http://127.0.0.1:9999/v1/generate"
        body = json.loads(request.data.decode("utf-8"))
        assert body["taskType"] == "text_to_image"
        assert body["model"] == "baidu/ERNIE-Image"
        assert body["prompt"] == "a yellow dog"
        assert body["providerMode"] == "local"
        return FakeResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.generate_text_to_image(
        {"mode": "text_to_image", "prompt": "a yellow dog"},
        DummyRequest(),
    )

    assert payload["engine"] == "huggingface-local-http"
    artifact = payload["artifacts"][0]
    assert artifact["kind"] == "image"
    assert artifact["mimeType"] == "image/png"
    assert artifact["base64"] == base64.b64encode(b"real-image").decode("ascii")
    assert artifact["metadata"]["providerMode"] == "local_http"


def test_huggingface_route_overrides_select_by_task(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")
    monkeypatch.setenv(
        "ARCHITOKEN_HF_MODEL_ROUTES",
        '{"chat":"huggingface/custom-chat","code":{"model":"custom/code"},"text_to_image":"custom/image","image_to_video":"custom/video"}',
    )

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["data"]}

    assert routes["chat"]["id"] == "huggingface/custom-chat"
    assert routes["code"]["id"] == "custom/code"
    assert routes["text_to_image"]["id"] == "custom/image"
    assert routes["image_to_video"]["id"] == "custom/video"


def test_image_to_video_returns_media_protocol(monkeypatch, tmp_path) -> None:
    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        assert prompt == "slow dolly shot"
        assert payload["mode"] == "image_to_video"
        return engine_server.ProviderResult(
            engine="test-video",
            model="test-video-model",
            media_type="video/mp4",
            content=b"mp4-bytes",
            filename="generated.mp4",
            summary="real provider fixture",
            metadata={"provider": "huggingface"},
        )

    monkeypatch.setattr(engine_server, "_generate_image_to_video", fake_generate)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)

    payload = engine_server.generate_image_to_video(
        {"mode": "image_to_video", "prompt": "slow dolly shot"},
        DummyRequest(),
    )

    artifact = payload["artifacts"][0]
    assert artifact["kind"] == "video"
    assert artifact["mimeType"] == "video/mp4"
    assert artifact["base64"] == base64.b64encode(b"mp4-bytes").decode("ascii")
