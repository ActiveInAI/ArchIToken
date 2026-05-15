"""Point cloud worker adapters backed by PDAL and Cesium ion."""

from __future__ import annotations

import json
import subprocess

from .adapter_requirements import missing_binary
from .cesium_worker import cesium_ion_create_asset
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def pointcloud_metadata(job: ConversionJob, source_format: str | None = None) -> WorkerResult:
    """Extract real point cloud metadata with PDAL."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="pdal",
        binary="pdal",
        install_hint="Install PDAL in the worker image for LAS/LAZ/E57/PLY metadata extraction.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="pdal",
        install_hint="Mount a point cloud source file and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    completed = subprocess.run(
        ["pdal", "info", "--metadata", "--stats", str(source)],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 600)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "pdal_info_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"adapter": "pdal", "sourcePath": str(source)},
        )
    metadata = json.loads(completed.stdout)
    artifact = write_json_artifact(
        job,
        "pointcloud_metadata.json",
        metadata,
        role="metadata",
        metadata={"adapter": "pdal", "format": source_format or source.suffix.lower().lstrip(".")},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "adapter": "pdal",
            "format": source_format or source.suffix.lower().lstrip("."),
            "sourcePath": str(source),
            "metadata": metadata.get("metadata", {}),
            "stats": metadata.get("stats", {}),
        },
    )


def tileset_manifest(job: ConversionJob) -> WorkerResult:
    """Create a Cesium ion point-cloud tiling asset from a real source file."""

    validate_job(job)
    job.input.setdefault("assetType", "3DTILES")
    job.input.setdefault("options", {"sourceType": "POINT_CLOUD"})
    return cesium_ion_create_asset(job)
