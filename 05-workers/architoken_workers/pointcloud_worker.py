"""Point cloud worker skeletons for E57/LAS/LAZ/PLY metadata and tiling."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def pointcloud_metadata(job: ConversionJob, source_format: str = "laz") -> WorkerResult:
    """Return deterministic point cloud metadata."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="pointcloud_metadata.json",
                media_type="application/json",
                role="metadata",
                metadata={"format": source_format},
            ),
        ),
        output={"format": source_format, "points": 0, "bounds": None},
    )


def tileset_manifest(job: ConversionJob) -> WorkerResult:
    """Return a 3D Tiles tileset manifest placeholder."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="tileset.json",
                media_type="application/json",
                role="3d_tiles_manifest",
            ),
        ),
        output={"standard": "3D Tiles", "tileset": "tileset.json"},
    )
