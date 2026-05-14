"""CAD worker skeletons and adapter boundaries."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def dxf_extract_entities(job: ConversionJob) -> WorkerResult:
    """Return a DXF entity extraction manifest placeholder."""

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
    """Return a STEP metadata manifest placeholder."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"format": "step", "schema": "AP242", "bodies": 0},
    )


def occt_adapter_boundary(job: ConversionJob) -> WorkerResult:
    """Return an OCCT boundary manifest without linking native OCCT."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "occt", "mode": "boundary_only"},
    )


def dwg_legal_adapter_boundary(job: ConversionJob) -> WorkerResult:
    """Return a DWG legal-boundary manifest without decoding DWG."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "dwg", "mode": "legal_boundary_only", "productionEnabled": False},
    )
