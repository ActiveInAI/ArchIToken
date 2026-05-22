import base64

from fastapi import HTTPException

import engine_server


class DummyRequest:
    def url_for(self, name: str, **params: str) -> str:
        assert name == "download_generated_file"
        return f"http://testserver/download/{params['filename']}"


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
    monkeypatch.delenv("HF_TOKEN", raising=False)
    monkeypatch.delenv("HUGGINGFACE_API_TOKEN", raising=False)
    monkeypatch.delenv("ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL", raising=False)
    monkeypatch.delenv("ARCHITOKEN_HF_TEXT_TO_IMAGE_URL", raising=False)
    monkeypatch.delenv("HUGGINGFACE_TEXT_TO_IMAGE_MODEL", raising=False)
    monkeypatch.delenv("HUGGINGFACE_TEXT_TO_IMAGE_URL", raising=False)
    monkeypatch.delenv("OPENCLAW_IMAGE_MODEL", raising=False)
    monkeypatch.delenv("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER", raising=False)
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: None)

    try:
        engine_server.generate_text_to_image({"mode": "text_to_image", "prompt": "a yellow dog"}, DummyRequest())
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail["code"] == "adapter_not_configured"
    else:
        raise AssertionError("unconfigured image provider should raise HTTPException")


def test_models_registry_defaults_to_huggingface_routes(monkeypatch) -> None:
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")
    monkeypatch.delenv("ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER", raising=False)
    monkeypatch.delenv("ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER", raising=False)
    monkeypatch.delenv("ARCHITOKEN_HF_MODEL_ROUTES", raising=False)

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["data"]}

    assert routes["chat"]["provider"] == "huggingface"
    assert routes["text_to_image"]["provider"] == "huggingface"
    assert routes["image_to_video"]["provider"] == "huggingface"
    assert routes["text_to_image"]["configured"] is True
    assert routes["image_to_video"]["configured"] is True


def test_huggingface_route_overrides_select_by_task(monkeypatch) -> None:
    monkeypatch.setattr(engine_server, "_huggingface_token", lambda: "hf-test-token")
    monkeypatch.setenv(
        "ARCHITOKEN_HF_MODEL_ROUTES",
        '{"chat":"huggingface/custom-chat","text_to_image":"custom/image","image_to_video":"custom/video"}',
    )

    payload = engine_server.list_models()
    routes = {model["taskType"]: model for model in payload["data"]}

    assert routes["chat"]["id"] == "huggingface/custom-chat"
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
