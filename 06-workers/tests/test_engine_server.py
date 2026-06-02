import base64
import http.client
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
        "ARCHITOKEN_HF_CACHE_MODELS_ENABLED",
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
        "ARCHITOKEN_ENABLE_CHAT_FALLBACK",
        "ARCHITOKEN_CHAT_MODEL_FALLBACKS",
        "ARCHITOKEN_CHAT_FALLBACK_DIAGNOSTICS",
        "ARCHITOKEN_OLLAMA_BASE_URL",
        "OLLAMA_BASE_URL",
        "ARCHITOKEN_OLLAMA_CHAT_MODEL",
        "OLLAMA_CHAT_MODEL",
        "ARCHITOKEN_OLLAMA_NUM_CTX",
        "OLLAMA_NUM_CTX",
        "ARCHITOKEN_OLLAMA_KEEP_ALIVE",
        "OLLAMA_KEEP_ALIVE",
        "ARCHITOKEN_LM_STUDIO_BASE_URL",
        "LM_STUDIO_BASE_URL",
        "ARCHITOKEN_LM_STUDIO_CHAT_MODEL",
        "LM_STUDIO_CHAT_MODEL",
        "ARCHITOKEN_OPENROUTER_CHAT_MODEL",
        "OPENROUTER_CHAT_MODEL",
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
        {"mode": "text_to_image", "prompt": "a yellow dog", "parameters": {"width": 512, "steps": 2}},
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


def test_selected_huggingface_chat_short_name_is_canonicalized(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    engine_server._openai_chat_models_for_endpoint.cache_clear()
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_HF_LOCAL_CHAT_URL", "http://127.0.0.1:9998/v1/chat/completions")

    class FakeModelsResponse:
        status = 200
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({"data": [{"id": "Qwen/Qwen2.5-0.5B-Instruct-GGUF"}]}).encode("utf-8")

    class FakeChatResponse:
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "model": "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
                "choices": [{"message": {"content": "来自 Qwen HF endpoint"}}],
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: int) -> FakeModelsResponse | FakeChatResponse:
        if request.full_url == "http://127.0.0.1:9998/v1/models":
            return FakeModelsResponse()
        assert request.full_url == "http://127.0.0.1:9998/v1/chat/completions"
        body = json.loads(request.data.decode("utf-8"))
        assert body["model"] == "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
        return FakeChatResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.chat_completions(
        {
            "model": "Qwen2.5-0.5B-Instruct-GGUF",
            "messages": [{"role": "user", "content": "你好"}],
        }
    )

    assert payload["model"] == "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
    assert payload["choices"][0]["message"]["content"] == "来自 Qwen HF endpoint"
    engine_server._openai_chat_models_for_endpoint.cache_clear()


def test_unserved_huggingface_chat_model_falls_back_to_ollama(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    engine_server._openai_chat_models_for_endpoint.cache_clear()
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_ENABLE_CHAT_FALLBACK", "1")
    monkeypatch.setenv("ARCHITOKEN_OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")

    class FakeModelsResponse:
        status = 200
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({"data": [{"id": "qwen3.6:35b-a3b"}]}).encode("utf-8")

    class FakeChatResponse:
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "model": "qwen3.6:35b-a3b",
                "message": {"role": "assistant", "content": "已由 Ollama fallback 回复。"},
                "prompt_eval_count": 3,
                "eval_count": 5,
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: int | float) -> FakeModelsResponse | FakeChatResponse:
        if request.full_url == "http://127.0.0.1:11434/v1/models":
            return FakeModelsResponse()
        assert request.full_url == "http://127.0.0.1:11434/api/chat"
        body = json.loads(request.data.decode("utf-8"))
        assert body["model"] == "qwen3.6:35b-a3b"
        assert body["think"] is False
        assert body["options"]["num_predict"] == 768
        assert body["options"]["num_ctx"] == 8192
        assert body["keep_alive"] == "30s"
        return FakeChatResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.chat_completions(
        {
            "model": "RedHatAI/Qwen3.6-35B-A3B-NVFP4",
            "messages": [{"role": "user", "content": "你可以干嘛"}],
        }
    )

    assert payload["model"] == "qwen3.6:35b-a3b"
    assert payload["choices"][0]["message"]["content"] == "已由 Ollama fallback 回复。"
    assert payload["metadata"]["provider"] == "ollama"
    assert payload["metadata"]["providerMode"] == "chat_fallback"
    assert payload["metadata"]["requestedModel"] == "RedHatAI/Qwen3.6-35B-A3B-NVFP4"
    engine_server._openai_chat_models_for_endpoint.cache_clear()


def test_ollama_fallback_honors_requested_ollama_model_and_context_env(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    engine_server._openai_chat_models_for_endpoint.cache_clear()
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_ENABLE_CHAT_FALLBACK", "1")
    monkeypatch.setenv("ARCHITOKEN_OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")
    monkeypatch.setenv("ARCHITOKEN_OLLAMA_NUM_CTX", "16384")
    monkeypatch.setenv("ARCHITOKEN_OLLAMA_KEEP_ALIVE", "5s")

    class FakeModelsResponse:
        status = 200
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({"data": [{"id": "gemma4:e2b-it-q4_K_M"}]}).encode("utf-8")

    class FakeChatResponse:
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "model": "gemma4:e2b-it-q4_K_M",
                "message": {"role": "assistant", "content": "已使用用户选择的 Ollama 模型。"},
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: int | float) -> FakeModelsResponse | FakeChatResponse:
        if request.full_url == "http://127.0.0.1:11434/v1/models":
            return FakeModelsResponse()
        assert request.full_url == "http://127.0.0.1:11434/api/chat"
        body = json.loads(request.data.decode("utf-8"))
        assert body["model"] == "gemma4:e2b-it-q4_K_M"
        assert body["options"]["num_ctx"] == 16384
        assert body["keep_alive"] == "5s"
        return FakeChatResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.chat_completions(
        {
            "model": "gemma4:e2b-it-q4_K_M",
            "messages": [{"role": "user", "content": "你是谁"}],
        }
    )

    assert payload["model"] == "gemma4:e2b-it-q4_K_M"
    assert payload["choices"][0]["message"]["content"] == "已使用用户选择的 Ollama 模型。"
    engine_server._openai_chat_models_for_endpoint.cache_clear()


def test_ollama_fallback_disconnect_tries_next_candidate(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    engine_server._openai_chat_models_for_endpoint.cache_clear()
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_ENABLE_CHAT_FALLBACK", "1")
    monkeypatch.setenv("ARCHITOKEN_OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")

    attempted: list[str] = []

    class FakeModelsResponse:
        status = 200
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "data": [
                    {"id": "gemma4:26b-a4b-it-q8_0"},
                    {"id": "qwen3.6:35b-a3b"},
                ]
            }).encode("utf-8")

    class FakeChatResponse:
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "model": "qwen3.6:35b-a3b",
                "message": {"role": "assistant", "content": "已切换到下一个可用 fallback。"},
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: int | float) -> FakeModelsResponse | FakeChatResponse:
        if request.full_url == "http://127.0.0.1:11434/v1/models":
            return FakeModelsResponse()
        assert request.full_url == "http://127.0.0.1:11434/api/chat"
        body = json.loads(request.data.decode("utf-8"))
        attempted.append(body["model"])
        if body["model"] == "gemma4:26b-a4b-it-q8_0":
            raise http.client.RemoteDisconnected("remote closed")
        assert body["model"] == "qwen3.6:35b-a3b"
        return FakeChatResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.chat_completions(
        {
            "model": "nvidia/Gemma-4-26B-A4B-NVFP4",
            "messages": [{"role": "user", "content": "你是谁"}],
        }
    )

    assert attempted == ["gemma4:26b-a4b-it-q8_0", "qwen3.6:35b-a3b"]
    assert payload["model"] == "qwen3.6:35b-a3b"
    assert payload["choices"][0]["message"]["content"] == "已切换到下一个可用 fallback。"
    engine_server._openai_chat_models_for_endpoint.cache_clear()


def test_models_registry_exposes_only_served_huggingface_chat_models(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    engine_server._openai_chat_models_for_endpoint.cache_clear()
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_HF_CACHE_MODELS_ENABLED", "0")
    monkeypatch.setenv("ARCHITOKEN_HF_LOCAL_CHAT_URL", "http://127.0.0.1:9998/v1/chat/completions")

    class FakeResponse:
        status = 200
        headers = {"Content-Type": "application/json"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return json.dumps({
                "data": [
                    {
                        "id": "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
                        "owned_by": "llamacpp",
                        "object": "model",
                    }
                ]
            }).encode("utf-8")

    def fake_urlopen(request: urllib.request.Request, timeout: float) -> FakeResponse:
        assert request.full_url == "http://127.0.0.1:9998/v1/models"
        return FakeResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.list_models()
    by_id = {model["id"]: model for model in payload["data"]}

    assert "Qwen/Qwen2.5-0.5B-Instruct-GGUF" in payload["endpointModels"]
    assert by_id["Qwen/Qwen2.5-0.5B-Instruct-GGUF"]["source"] == "hf_chat_endpoint"
    assert by_id["Qwen/Qwen2.5-0.5B-Instruct-GGUF"]["runtimeConfigured"] is True
    assert by_id["nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"]["runtimeConfigured"] is False
    assert by_id["nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"]["configured"] is False
    engine_server._openai_chat_models_for_endpoint.cache_clear()


def test_models_registry_defaults_to_huggingface_routes(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["taskRoutes"]}

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
    assert len(payload["models"]) == len(set(payload["models"]))
    assert payload["models"].count("Lightricks/LTX-2.3-nvfp4") == 1


def test_models_registry_tolerates_missing_hf_cli(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    engine_server._openai_chat_models_for_endpoint.cache_clear()
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setattr(engine_server, "_hf_cli_command", lambda: None)

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["data"]}

    assert payload["object"] == "list"
    assert routes["chat"]["provider"] == "huggingface"


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


def test_models_registry_preserves_hf_cache_order_and_route_metadata(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setattr(engine_server, "_huggingface_model_repository_roots", lambda: [])
    ordered_ids = [
        "Lightricks/LTX-2.3-nvfp4",
        "Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8",
        "PaddlePaddle/PaddleOCR-VL-1.5",
        "RedHatAI/Qwen3.6-35B-A3B-NVFP4",
        "baidu/ERNIE-Image",
    ]
    entries = []
    for index, model_id in enumerate(ordered_ids):
        snapshot = tmp_path / f"snapshot-{index}"
        snapshot.mkdir()
        (snapshot / "README.md").write_text(f"# {model_id}\n", encoding="utf-8")
        entries.append(
            {
                "repo_type": "model",
                "repo_id": model_id,
                "snapshot_path": str(snapshot),
                "revision": "main",
                "refs": ["main"],
                "size": "1G",
            }
        )
    monkeypatch.setattr(engine_server, "_huggingface_cache_entries", lambda: entries)

    payload = engine_server.list_models()
    by_id = {model["id"]: model for model in payload["data"]}

    assert payload["repositoryModelIds"][: len(ordered_ids)] == ordered_ids
    assert payload["models"][: len(ordered_ids)] == ordered_ids
    assert payload["models"].count("Lightricks/LTX-2.3-nvfp4") == 1
    assert by_id["Lightricks/LTX-2.3-nvfp4"]["availableTaskTypes"] == [
        "text_to_video",
        "image_to_video",
    ]
    assert by_id["baidu/ERNIE-Image"]["taskType"] == "text_to_image"
    assert by_id["baidu/ERNIE-Image"]["availableCapabilities"] == ["image.generate"]


def test_huggingface_remote_media_requires_explicit_enable(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")
    monkeypatch.setenv("ARCHITOKEN_HF_REMOTE_ENABLED", "1")

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["taskRoutes"]}

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
        assert body["parameters"]["width"] == 512
        assert body["parameters"]["steps"] == 2
        assert body["providerMode"] == "local"
        return FakeResponse()

    monkeypatch.setattr(engine_server.urllib.request, "urlopen", fake_urlopen)

    payload = engine_server.generate_text_to_image(
        {"mode": "text_to_image", "prompt": "a yellow dog", "parameters": {"width": 512, "steps": 2}},
        DummyRequest(),
    )

    assert payload["engine"] == "huggingface-local-http"
    artifact = payload["artifacts"][0]
    assert artifact["kind"] == "image"
    assert artifact["mimeType"] == "image/png"
    assert artifact["base64"] == base64.b64encode(b"real-image").decode("ascii")
    assert artifact["metadata"]["providerMode"] == "local_http"


def test_chat_selected_huggingface_text_to_image_model_returns_artifact_link(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        assert prompt.startswith("生成一根钢管")
        assert "Do not render text" in prompt
        assert payload["mode"] == "text_to_image"
        assert payload["model"] == "baidu/ERNIE-Image"
        assert payload["parameters"]["width"] == 512
        assert payload["parameters"]["steps"] == 8
        assert "timestamp" in payload["parameters"]["negative_prompt"]
        return engine_server.ProviderResult(
            engine="test-hf-image",
            model="baidu/ERNIE-Image",
            media_type="image/png",
            content=b"image-bytes",
            filename="pipe.png",
            summary="fixture image",
            metadata={"provider": "huggingface", "providerMode": "local_command"},
        )

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    for selected_model in ("huggingface/baidu/ERNIE-Image", "ERNIE-Image"):
        payload = engine_server.chat_completions(
            {
                "model": selected_model,
                "messages": [{"role": "user", "content": "生成一根钢管"}],
            }
        )

        content = payload["choices"][0]["message"]["content"]
        assert payload["model"] == "baidu/ERNIE-Image"
        assert "http://127.0.0.1:7071/download/pipe.png" in content
        assert "![生成图像](http://127.0.0.1:7071/download/pipe.png)" in content
        assert (tmp_path / "pipe.png").read_bytes() == b"image-bytes"
        assert payload["metadata"]["providerMode"] == "media_chat_bridge"
        assert payload["metadata"]["taskType"] == "text_to_image"


def test_chat_huggingface_text_to_image_strips_timestamp_and_adds_pipe_annotation(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("dimensioned pipe requests should use the local CAD schematic renderer")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [{"role": "user", "content": "[Tue 2026-05-26 12:02 GMT+8] 生成长1米，直径10mm的钢管"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert "arclaw-pipe-schematic-" in content
    assert "已用 ArClaw 本地工程渲染生成图像" in content
    assert "ArClaw 已生成结构化工程示意图" in content
    artifact = payload["metadata"]["artifact"]
    assert (tmp_path / artifact["filename"]).exists()
    assert payload["metadata"]["status"] == "completed"
    assert payload["metadata"]["artifactPersisted"] is True
    assert payload["metadata"]["mediaProvider"]["providerMode"] == "local_cad_schematic"
    labels = payload["metadata"]["mediaProvider"]["engineeringAnnotation"]["labels"]
    assert labels["length"] == "1000 mm"
    assert labels["outsideDiameter"] == "10 mm"


def test_chat_huggingface_h_beam_uses_local_cad_schematic(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("dimensioned H beam requests should use the local CAD schematic renderer")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [{"role": "user", "content": "[Tue 2026-05-26 13:57 GMT+8] 生成2米长的H型钢"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert "arclaw-h-beam-schematic-" in content
    assert "生成2米长的H型钢" in content
    assert "已用 ArClaw 本地工程渲染生成图像" in content
    artifact = payload["metadata"]["artifact"]
    assert artifact["mimeType"] == "image/png"
    assert (tmp_path / artifact["filename"]).exists()
    assert payload["metadata"]["status"] == "completed"
    assert payload["metadata"]["artifacts"][0]["persisted"] is True
    media_provider = payload["metadata"]["mediaProvider"]
    assert media_provider["providerMode"] == "local_cad_schematic"
    annotation = media_provider["engineeringAnnotation"]
    assert annotation["type"] == "dimensioned_h_beam"
    assert annotation["sourcePrompt"] == "生成2米长的H型钢"
    labels = annotation["labels"]
    assert labels["object"] == "H型钢"
    assert labels["length"] == "2000 mm"
    assert labels["section"] == "未指定"


def test_chat_selected_unconfigured_huggingface_media_model_returns_diagnostic(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise engine_server.ProviderConfigurationError("missing local image worker")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [{"role": "user", "content": "生成一根钢管"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert payload["model"] == "baidu/ERNIE-Image"
    assert "当前还不能执行该请求" in content
    assert "missing local image worker" in content
    assert payload["metadata"]["providerMode"] == "media_error"
    assert payload["metadata"]["taskType"] == "text_to_image"


def test_openclaw_heartbeat_does_not_trigger_huggingface_media(monkeypatch) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("heartbeat must not call image generation")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [
                {"role": "user", "content": "[OpenClaw heartbeat poll]"},
                {
                    "role": "user",
                    "content": (
                        "Read HEARTBEAT.md if it exists (workspace context). "
                        "If nothing needs attention, reply HEARTBEAT_OK."
                    ),
                },
            ],
        }
    )

    assert payload["choices"][0]["message"]["content"] == "HEARTBEAT_OK"
    assert payload["metadata"]["providerMode"] == "control_bypass"


def test_prior_heartbeat_history_does_not_hide_later_media_request(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("dimensioned pipe requests should use the local CAD schematic renderer")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [
                {"role": "user", "content": "[OpenClaw heartbeat poll]"},
                {"role": "assistant", "content": "HEARTBEAT_OK"},
                {"role": "user", "content": "[Tue 2026-05-26 12:38 GMT+8] 生成长2米，直径12mm的钢管"},
            ],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert content != "HEARTBEAT_OK"
    assert "下载链接" in content
    assert payload["metadata"]["mediaProvider"]["providerMode"] == "local_cad_schematic"
    labels = payload["metadata"]["mediaProvider"]["engineeringAnnotation"]["labels"]
    assert labels["length"] == "2000 mm"
    assert labels["outsideDiameter"] == "12 mm"


def test_media_attachment_notice_does_not_replace_latest_text_to_image_request(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("dimensioned pipe requests should use the local CAD schematic renderer")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [
                {"role": "user", "content": "[Tue 2026-05-26 12:50 GMT+8] 生成长5米，直径12mm的钢管"},
                {
                    "role": "user",
                    "content": (
                        "[media attached: media://inbound/图片---248e9126-5732-4175-a738-08f4fa40f895.png (image/png)]\n"
                        "To send an image back, prefer the message tool (media/path/filePath).\n"
                        "[Image]\n"
                        "Description:\n"
                        "浏览器中打开 ArchToken 平台。"
                    ),
                },
            ],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert "下载链接" in content
    assert payload["metadata"]["mediaProvider"]["providerMode"] == "local_cad_schematic"
    labels = payload["metadata"]["mediaProvider"]["engineeringAnnotation"]["labels"]
    assert labels["length"] == "5000 mm"
    assert labels["outsideDiameter"] == "12 mm"


def test_multiple_pending_text_to_image_requests_return_multiple_artifacts(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("dimensioned pipe requests should use the local CAD schematic renderer")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [
                {"role": "assistant", "content": "previous response"},
                {"role": "user", "content": "[Tue 2026-05-26 13:14 GMT+8] 生成长1米，直径12mm的钢管"},
                {"role": "user", "content": "[Tue 2026-05-26 13:14 GMT+8] 生成长3米，直径6mm的钢管"},
            ],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert "图像 1/2" in content
    assert "图像 2/2" in content
    assert "生成长1米，直径12mm的钢管" in content
    assert "生成长3米，直径6mm的钢管" in content
    assert payload["metadata"]["batchCount"] == 2
    assert len(payload["metadata"]["artifacts"]) == 2
    labels = [provider["engineeringAnnotation"]["labels"] for provider in payload["metadata"]["mediaProviders"]]
    assert labels[0]["length"] == "1000 mm"
    assert labels[0]["outsideDiameter"] == "12 mm"
    assert labels[1]["length"] == "3000 mm"
    assert labels[1]["outsideDiameter"] == "6 mm"


def test_chat_selected_huggingface_text_to_video_model_returns_artifact_link(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    def fake_generate(task_type: str, prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        assert task_type == "text_to_video"
        assert prompt == "生成一段施工动画"
        assert payload["mode"] == "text_to_video"
        assert payload["model"] == "Lightricks/LTX-2.3-nvfp4"
        return engine_server.ProviderResult(
            engine="test-hf-video",
            model="Lightricks/LTX-2.3-nvfp4",
            media_type="video/mp4",
            content=b"video-bytes",
            filename="clip.mp4",
            summary="fixture video",
            metadata={"provider": "huggingface", "providerMode": "local_command"},
        )

    monkeypatch.setattr(engine_server, "_generate_huggingface_artifact_task", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "LTX-2.3-nvfp4",
            "messages": [{"role": "user", "content": "生成一段施工动画"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert payload["model"] == "Lightricks/LTX-2.3-nvfp4"
    assert "http://127.0.0.1:7071/download/clip.mp4" in content
    assert (tmp_path / "clip.mp4").read_bytes() == b"video-bytes"
    assert payload["metadata"]["providerMode"] == "media_chat_bridge"
    assert payload["metadata"]["taskType"] == "text_to_video"


def test_chat_steel_construction_video_uses_local_engineering_animation(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_ARCLAW_ENGINEERING_VIDEO_FPS", "6")
    monkeypatch.setenv("ARCHITOKEN_ARCLAW_ENGINEERING_VIDEO_SECONDS", "3")

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("steel construction video requests should use the local engineering animation renderer")

    monkeypatch.setattr(engine_server, "_generate_image_to_video", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "LTX-2.3-nvfp4",
            "messages": [{"role": "user", "content": "能否生成钢结构建筑施工的视频"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert payload["model"] == "Lightricks/LTX-2.3-nvfp4"
    assert "已用 ArClaw 本地工程动画生成视频" in content
    assert "非施工交底" in content
    artifact = payload["metadata"]["artifact"]
    assert artifact["mimeType"] == "video/mp4"
    assert artifact["persisted"] is True
    assert (tmp_path / artifact["filename"]).exists()
    assert (tmp_path / artifact["filename"]).stat().st_size > 0
    assert payload["metadata"]["status"] == "completed"
    media_provider = payload["metadata"]["mediaProvider"]
    assert media_provider["providerMode"] == "local_engineering_animation"
    assert media_provider["engineeringAnimation"]["type"] == "steel_structure_construction_sequence"


def test_chat_video_prompt_overrides_selected_image_model(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_ARCLAW_ENGINEERING_VIDEO_FPS", "6")
    monkeypatch.setenv("ARCHITOKEN_ARCLAW_ENGINEERING_VIDEO_SECONDS", "3")

    def fake_image_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("explicit video prompts must not be routed to the image generator")

    monkeypatch.setattr(engine_server, "_generate_text_to_image", fake_image_generate)

    payload = engine_server.chat_completions(
        {
            "model": "baidu/ERNIE-Image",
            "messages": [{"role": "user", "content": "生成钢结构建筑施工的视频"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert payload["model"] == "Lightricks/LTX-2.3-nvfp4"
    assert "视频链接" in content
    assert payload["metadata"]["artifact"]["mimeType"] == "video/mp4"
    assert payload["metadata"]["mediaProvider"]["providerMode"] == "local_engineering_animation"


def test_chat_ltx_villa_prompt_uses_local_engineering_animation(monkeypatch, tmp_path) -> None:
    clear_hf_media_env(monkeypatch)
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)
    monkeypatch.setenv("ARCHITOKEN_ARCLAW_ENGINEERING_VIDEO_FPS", "6")
    monkeypatch.setenv("ARCHITOKEN_ARCLAW_ENGINEERING_VIDEO_SECONDS", "3")

    def fake_generate(prompt: str, payload: dict[str, object]) -> engine_server.ProviderResult:
        raise AssertionError("LTX steel villa requests should use the local engineering animation renderer")

    monkeypatch.setattr(engine_server, "_generate_image_to_video", fake_generate)

    payload = engine_server.chat_completions(
        {
            "model": "LTX-2.3-nvfp4",
            "messages": [{"role": "user", "content": "200平宅基地生成重钢结构别墅"}],
        }
    )

    content = payload["choices"][0]["message"]["content"]
    assert payload["model"] == "Lightricks/LTX-2.3-nvfp4"
    assert "视频链接" in content
    assert "200平宅基地生成重钢结构别墅" in content
    assert payload["metadata"]["artifact"]["mimeType"] == "video/mp4"
    assert payload["metadata"]["mediaProvider"]["providerMode"] == "local_engineering_animation"


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
