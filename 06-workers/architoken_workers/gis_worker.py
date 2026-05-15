"""GIS worker adapters backed by GeoJSON parsing and GDAL/OGR."""

from __future__ import annotations

import json
import os
import subprocess
from typing import Any

from .adapter_requirements import missing_binary, missing_env
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def geojson_ingest(job: ConversionJob) -> WorkerResult:
    """Parse a real GeoJSON source and emit a GIS manifest."""

    validate_job(job)
    source, blocked = require_source_file(
        job,
        adapter="geojson",
        install_hint="Mount a GeoJSON source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    payload = json.loads(source.read_text(encoding="utf-8"))
    features = _features(payload)
    bbox = _bbox(payload, features)
    manifest = {
        "adapter": "geojson",
        "sourcePath": str(source),
        "type": payload.get("type"),
        "featureCount": len(features),
        "bbox": bbox,
        "crs": payload.get("crs") or {"type": "name", "properties": {"name": "EPSG:4326"}},
    }
    artifact = write_json_artifact(
        job,
        "geojson_manifest.json",
        manifest,
        role="gis_manifest",
        metadata={"adapter": "geojson", "sourcePath": str(source)},
    )
    return WorkerResult(job_id=job.job_id, status="completed", artifacts=(artifact,), output=manifest)


def postgis_index(job: ConversionJob) -> WorkerResult:
    """Import a vector source into PostGIS through ogr2ogr."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="postgis",
        name="POSTGIS_DSN",
        install_hint="Configure POSTGIS_DSN for real GIS indexing.",
    ):
        return unavailable
    if unavailable := missing_binary(
        job,
        adapter="postgis",
        binary="ogr2ogr",
        install_hint="Install GDAL/OGR tools in the worker image for PostGIS ingestion.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="postgis",
        install_hint="Mount a vector source file and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    table = _safe_table_name(str(job.input.get("tableName", f"asset_{job.source_file_id}")))
    completed = subprocess.run(
        [
            "ogr2ogr",
            "-f",
            "PostgreSQL",
            f"PG:{os.environ['POSTGIS_DSN']}",
            str(source),
            "-nln",
            table,
            "-overwrite" if job.input.get("overwrite", True) else "-append",
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 600)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "postgis_import_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"adapter": "postgis", "sourcePath": str(source), "tableName": table},
        )
    artifact = write_json_artifact(
        job,
        "postgis_import_manifest.json",
        {"adapter": "postgis", "sourcePath": str(source), "tableName": table},
        role="postgis_import_manifest",
        metadata={"adapter": "postgis"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "postgis", "tableName": table, "sourcePath": str(source)},
    )


def _features(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if payload.get("type") == "FeatureCollection" and isinstance(payload.get("features"), list):
        return [feature for feature in payload["features"] if isinstance(feature, dict)]
    if payload.get("type") == "Feature":
        return [payload]
    return []


def _bbox(payload: dict[str, Any], features: list[dict[str, Any]]) -> list[float] | None:
    if isinstance(payload.get("bbox"), list):
        return [float(value) for value in payload["bbox"]]
    points: list[tuple[float, float]] = []
    for feature in features:
        _collect_positions(feature.get("geometry"), points)
    if not points:
        return None
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return [min(xs), min(ys), max(xs), max(ys)]


def _collect_positions(geometry: object, points: list[tuple[float, float]]) -> None:
    if not isinstance(geometry, dict):
        return
    coordinates = geometry.get("coordinates")
    _walk_coordinates(coordinates, points)


def _walk_coordinates(value: object, points: list[tuple[float, float]]) -> None:
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(item, int | float) for item in value[:2]):
        points.append((float(value[0]), float(value[1])))
        return
    if isinstance(value, list):
        for item in value:
            _walk_coordinates(item, points)


def _safe_table_name(value: str) -> str:
    table = "".join(ch.lower() if ch.isalnum() else "_" for ch in value)
    table = "_".join(part for part in table.split("_") if part)
    return table or "asset_geometries"
