"""360 panorama graph worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def panorama_graph(job: ConversionJob) -> WorkerResult:
    """Return a panorama graph runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="panorama_graph.json",
                media_type="application/json",
                role="panorama_graph",
                metadata={"webxr": "worker_adapter"},
            ),
        ),
        output={"nodes": [], "edges": [], "cameraSync": True},
    )


def osgb_adapter(job: ConversionJob) -> WorkerResult:
    """Return an OSGB licensed-adapter execution manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "osgb", "mode": "licensed_external_adapter"},
    )
