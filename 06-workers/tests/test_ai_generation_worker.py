from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.ai_generation_worker import route_generation


def test_ai_generation_routes_to_provider_adapter() -> None:
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
    assert result.status == "queued"
    assert result.output["route"] == "ai_provider_adapter"
    assert result.artifacts[0].media_type == "image/png"
