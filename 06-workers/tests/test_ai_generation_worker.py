from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.ai_generation_worker import route_generation


def test_ai_generation_routes_to_provider_adapter(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    job = ConversionJob(
        job_id="job-ai-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="ai-worker-test",
        operation=ConversionOperation.IMAGE_GENERATE,
        source_asset_id="asset-ai-1",
        source_file_id="file-ai-1",
        input={
            "provider": "openrouter",
            "output_name": "concept-render.png",
            "media_type": "image/png",
        },
    )
    result = route_generation(job)
    assert result.status == "blocked"
    assert result.error["code"] == "provider_direct_adapter_not_configured"


def test_ai_generation_blocks_unconfigured_provider(monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    job = ConversionJob(
        job_id="job-ai-2",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="ai-worker-test",
        operation=ConversionOperation.VIDEO_GENERATE,
        source_asset_id="asset-ai-2",
        source_file_id="file-ai-2",
        input={
            "provider": "openrouter",
            "output_name": "site-walkthrough.mp4",
            "media_type": "video/mp4",
        },
    )

    result = route_generation(job)

    assert result.status == "blocked"
    assert result.error["code"] == "adapter_not_configured"
    assert result.output["adapter"] == "openrouter"
    assert "OPENROUTER_API_KEY" in result.output["reason"]
