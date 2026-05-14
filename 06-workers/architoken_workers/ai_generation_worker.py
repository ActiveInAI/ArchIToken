"""AI generation worker adapters for multimodal deliverables."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def route_generation(job: ConversionJob) -> WorkerResult:
    """Route a generation job to the configured production model provider."""

    validate_job(job)
    provider = str(job.input.get("provider", "architoken-provider-router"))
    output_name = str(job.input.get("output_name", f"{job.operation.value}.json"))
    media_type = str(job.input.get("media_type", "application/json"))
    return WorkerResult(
        job_id=job.job_id,
        status="queued",
        artifacts=(
            WorkerArtifact(
                name=output_name,
                media_type=media_type,
                role=job.operation.value,
                metadata={"provider": provider},
            ),
        ),
        output={
            "provider": provider,
            "operation": job.operation.value,
            "route": "ai_provider_adapter",
        },
    )
