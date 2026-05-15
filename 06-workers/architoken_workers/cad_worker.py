"""CAD worker adapters."""

from __future__ import annotations

from .adapter_requirements import missing_env, missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def dxf_extract_entities(job: ConversionJob) -> WorkerResult:
    """Return a DXF entity extraction runtime manifest."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="ezdxf",
        import_name="ezdxf",
        install_hint="Install ezdxf in the worker image for real DXF parsing.",
    ):
        return unavailable
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
    if unavailable := missing_python_dependency(
        job,
        adapter="ocp",
        import_name="OCP",
        install_hint="Install CadQuery OCP/OCCT bindings in the worker image for real STEP/STP parsing.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"format": "step", "schema": "AP242", "bodies": 0},
    )


def occt_adapter(job: ConversionJob) -> WorkerResult:
    """Return an OCCT native-adapter execution manifest."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="occt",
        import_name="OCP",
        install_hint="Install OCP or run an OCCT sidecar service before enabling CAD kernel conversion.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "occt", "mode": "external_native_adapter"},
    )


def licensed_dwg_adapter(job: ConversionJob) -> WorkerResult:
    """Return a DWG licensed-adapter execution manifest."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="dwg",
        name="DWG_ADAPTER_URL",
        install_hint="Configure a licensed DWG service such as Autodesk APS, ODA-based adapter, or an approved LibreDWG-compatible adapter.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "dwg", "mode": "licensed_external_adapter"},
    )
