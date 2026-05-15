"""openBIM worker adapters for IFC ingestion contracts."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, ConversionOperation, WorkerArtifact, WorkerResult, validate_job

IFC_INGEST_OUTPUTS = (
    "ifc_entities.jsonl",
    "ifc_relationships.jsonl",
    "ifc_properties.jsonl",
    "ifc_spatial_tree.json",
    "geometry_manifest.json",
    "model_manifest.json",
)


def ingest_ifc(job: ConversionJob) -> WorkerResult:
    """Produce IFC ingestion manifests for the openBIM processing route."""

    validate_job(job)
    if job.operation != ConversionOperation.IFC_INGEST:
        raise ValueError(f"unsupported openBIM operation: {job.operation}")
    if unavailable := missing_python_dependency(
        job,
        adapter="ifcopenshell",
        import_name="ifcopenshell",
        install_hint="Install IfcOpenShell in the worker image and mount source IFC bytes from object storage.",
    ):
        return unavailable

    artifacts = tuple(
        WorkerArtifact(
            name=name,
            media_type="application/jsonl" if name.endswith(".jsonl") else "application/json",
            role="manifest",
            metadata={"standard": "IFC4x3", "parserFamily": "ifc_open_shell_or_ifc_lite"},
        )
        for name in IFC_INGEST_OUTPUTS
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=artifacts,
        output={
            "standard": "IFC4x3",
            "outputs": list(IFC_INGEST_OUTPUTS),
            "parser": "ifc_open_shell_or_ifc_lite",
        },
    )
