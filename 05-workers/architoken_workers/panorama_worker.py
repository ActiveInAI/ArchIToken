"""360 panorama graph worker skeleton."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def panorama_graph(job: ConversionJob) -> WorkerResult:
    """Return a panorama graph manifest placeholder."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="panorama_graph.json",
                media_type="application/json",
                role="panorama_graph",
                metadata={"webxr": "adapter_boundary"},
            ),
        ),
        output={"nodes": [], "edges": [], "cameraSync": True},
    )


def osgb_adapter_boundary(job: ConversionJob) -> WorkerResult:
    """Return an OSGB adapter-boundary manifest without decoding OSGB."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "osgb", "mode": "boundary_only", "productionEnabled": False},
    )
