"""Cesium ion / 3D Tiles service adapter."""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path
from typing import Any

from .adapter_requirements import missing_env
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def cesium_ion_create_asset(job: ConversionJob) -> WorkerResult:
    """Create a Cesium ion asset upload job for 3D Tiles production tiling."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="cesium_ion",
        name="CESIUM_ION_TOKEN",
        install_hint="Configure CESIUM_ION_TOKEN for Cesium ion asset tiling.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="cesium_ion",
        install_hint="Mount a source model/tileset file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked

    base_url = os.getenv("CESIUM_ION_API_URL", "https://api.cesium.com").rstrip("/")
    payload = {
        "name": str(job.input.get("name", source.stem)),
        "description": str(job.input.get("description", f"ArchIToken job {job.job_id}")),
        "type": str(job.input.get("assetType", "3DTILES")),
        "options": job.input.get("options", {"sourceType": "3D_MODEL"}),
    }
    request = urllib.request.Request(
        f"{base_url}/v1/assets",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {os.environ['CESIUM_ION_TOKEN']}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 60))) as response:
        asset_response = json.loads(response.read().decode("utf-8"))
    upload_result = complete_cesium_asset_upload(asset_response, source, timeout_seconds=int(job.input.get("timeoutSeconds", 600)))
    artifact = write_json_artifact(
        job,
        "cesium_ion_asset_manifest.json",
        {"request": payload, "response": asset_response, "sourcePath": str(source), "upload": upload_result},
        role="cesium_ion_asset_manifest",
        metadata={"adapter": "cesium_ion"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "adapter": "cesium_ion",
            "assetId": asset_response.get("assetMetadata", {}).get("id") or asset_response.get("id"),
            "sourcePath": str(source),
            "upload": upload_result,
        },
    )


def complete_cesium_asset_upload(asset_response: dict[str, Any], source: Path, *, timeout_seconds: int) -> dict[str, Any]:
    """Upload a source file to Cesium ion's temporary upload target when one is returned."""

    upload_location = asset_response.get("uploadLocation")
    if not isinstance(upload_location, dict):
        return {"uploadPerformed": False, "reason": "upload_location_absent"}
    required = ("bucket", "prefix", "accessKey", "secretAccessKey")
    missing = [name for name in required if not str(upload_location.get(name, "")).strip()]
    if missing:
        raise RuntimeError(f"Cesium ion uploadLocation missing required fields: {', '.join(missing)}")

    import boto3

    endpoint = str(upload_location.get("endpoint") or upload_location.get("url") or "").strip() or None
    prefix = str(upload_location["prefix"]).strip().strip("/")
    object_key = f"{prefix}/{source.name}" if prefix else source.name
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=str(upload_location["accessKey"]),
        aws_secret_access_key=str(upload_location["secretAccessKey"]),
        aws_session_token=upload_location.get("sessionToken"),
    )
    client.upload_file(str(source), str(upload_location["bucket"]), object_key)

    on_complete_result = _call_cesium_on_complete(asset_response.get("onComplete"), timeout_seconds)
    return {
        "uploadPerformed": True,
        "bucket": upload_location["bucket"],
        "objectKey": object_key,
        "onComplete": on_complete_result,
    }


def _call_cesium_on_complete(on_complete: object, timeout_seconds: int) -> dict[str, Any]:
    if not isinstance(on_complete, dict) or not str(on_complete.get("url", "")).strip():
        return {"called": False, "reason": "on_complete_absent"}
    method = str(on_complete.get("method", "POST")).upper()
    headers = dict(on_complete.get("headers") or {})
    body = on_complete.get("body", on_complete.get("fields"))
    data = None if body is None else json.dumps(body).encode("utf-8")
    if data is not None and "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(str(on_complete["url"]), data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        response.read()
    return {"called": True, "method": method}
