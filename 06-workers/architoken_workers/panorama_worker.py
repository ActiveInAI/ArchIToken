"""360 panorama graph worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, require_source_file, write_json_artifact


def panorama_graph(job: ConversionJob) -> WorkerResult:
    """Ingest a real panorama image/video source and emit a viewer graph manifest."""

    validate_job(job)
    source, blocked = require_source_file(
        job,
        adapter="panorama",
        install_hint="Mount a panorama image/video source and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    source_artifact = artifact_for_path(
        source,
        job=job,
        media_type=str(job.input.get("sourceContentType", "application/octet-stream")),
        role="panorama_source",
        metadata={"adapter": "panorama", "sourcePath": str(source)},
    )
    graph = {
        "nodes": [
            {
                "id": str(job.input.get("nodeId", "panorama-1")),
                "name": str(job.input.get("name", source.stem)),
                "artifact": source_artifact.name,
                "sourcePath": str(source),
            }
        ],
        "edges": [],
        "cameraSync": True,
    }
    manifest = write_json_artifact(
        job,
        "panorama_graph.json",
        graph,
        role="panorama_graph",
        metadata={"webxr": "worker_adapter", "adapter": "panorama"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(source_artifact, manifest),
        output={"adapter": "panorama", **graph},
    )


def osgb_adapter(job: ConversionJob) -> WorkerResult:
    """Block OSGB until a licensed adapter is configured."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="blocked",
        error={"code": "adapter_not_configured", "message": "OSGB requires a licensed external adapter service"},
        output={"adapter": "osgb", "available": False},
    )
