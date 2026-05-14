"""CAD worker adapters."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def dxf_extract_entities(job: ConversionJob) -> WorkerResult:
    """Return a DXF entity extraction runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="dxf_entities.jsonl",
                media_type="application/jsonl",
                role="cad_entities",
            ),
        ),
        output={"format": "dxf", "entities": 0},
    )


def step_metadata(job: ConversionJob) -> WorkerResult:
    """Return a STEP metadata runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"format": "step", "schema": "AP242", "bodies": 0},
    )


def occt_adapter(job: ConversionJob) -> WorkerResult:
    """Return an OCCT native-adapter execution manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "occt", "mode": "external_native_adapter"},
    )


def licensed_dwg_adapter(job: ConversionJob) -> WorkerResult:
    """Return a DWG licensed-adapter execution manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "dwg", "mode": "licensed_external_adapter"},
    )
