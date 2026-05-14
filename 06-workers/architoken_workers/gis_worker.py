"""GIS worker skeletons for Phase 7."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def geojson_ingest(job: ConversionJob) -> WorkerResult:
    """Return a GeoJSON ingest manifest placeholder."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="geojson_manifest.json",
                media_type="application/json",
                role="gis_manifest",
                metadata={"crs": "EPSG:4326"},
            ),
        ),
        output={"operation": "geojson_ingest", "postgisReady": True},
    )


def postgis_index(job: ConversionJob) -> WorkerResult:
    """Return a PostGIS index manifest placeholder."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"operation": "postgis_index", "tables": ["asset_geometries"]},
    )
