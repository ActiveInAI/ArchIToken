"""CadQuery generation worker adapter."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def cadquery_generate(job: ConversionJob) -> WorkerResult:
    """Return a CadQuery generation runtime manifest."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="cadquery",
        import_name="cadquery",
        install_hint="Install CadQuery/OCP in the worker image for real parametric CAD generation.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="cadquery_script.py",
                media_type="text/x-python",
                role="source_script",
            ),
        ),
        output={"engine": "cadquery", "generated": True},
    )
