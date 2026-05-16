"""IFCDB-Agent sidecar adapter.

The upstream v1.0.9 public release exposes product documentation and a Windows
installer, not an importable Linux library. ArchIToken therefore integrates it
as an isolated sidecar/service contract and treats every result as external
evidence returned by the configured IFCDB-Agent runtime.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked
from .contract import ConversionJob, ConversionOperation, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, file_sha256, input_string, output_dir, require_source_file, write_json_artifact

IFCDB_AGENT_REQUIRED_VERSION = "v1.0.9"

_OPERATION_DEFAULT_PATHS: dict[ConversionOperation, tuple[str, str]] = {
    ConversionOperation.IFCDB_INDEX: ("IFCDB_AGENT_INDEX_PATH", "/api/v1/ifcdb/index"),
    ConversionOperation.IFCDB_QUERY: ("IFCDB_AGENT_QUERY_PATH", "/api/v1/ifcdb/query"),
    ConversionOperation.IFCDB_EXPORT: ("IFCDB_AGENT_EXPORT_PATH", "/api/v1/ifcdb/export"),
    ConversionOperation.IFCDB_CLASH: ("IFCDB_AGENT_CLASH_PATH", "/api/v1/ifcdb/clash"),
    ConversionOperation.IFCDB_QUANTITY: ("IFCDB_AGENT_QUANTITY_PATH", "/api/v1/ifcdb/quantity"),
}

_JSON_ARTIFACTS: dict[ConversionOperation, tuple[str, str]] = {
    ConversionOperation.IFCDB_INDEX: ("ifcdb_index_report.json", "ifcdb_index_report"),
    ConversionOperation.IFCDB_QUERY: ("ifcdb_query_result.json", "ifcdb_query_result"),
    ConversionOperation.IFCDB_EXPORT: ("ifcdb_export_result.json", "ifcdb_export_result"),
    ConversionOperation.IFCDB_CLASH: ("ifcdb_clash_report.json", "ifcdb_clash_report"),
    ConversionOperation.IFCDB_QUANTITY: ("ifcdb_quantity_report.json", "ifcdb_quantity_report"),
}


def run_ifcdb_agent(job: ConversionJob) -> WorkerResult:
    """Dispatch IFCDB-Agent database, object graph, query, clash, and quantity operations."""

    validate_job(job)
    if job.operation not in _OPERATION_DEFAULT_PATHS:
        raise ValueError(f"unsupported IFCDB-Agent operation: {job.operation}")
    if unavailable := _missing_ifcdb_agent_runtime(job):
        return unavailable
    if unavailable := _version_block(job):
        return unavailable

    if job.operation == ConversionOperation.IFCDB_INDEX:
        return _index_model(job)
    return _json_operation(job)


def _index_model(job: ConversionJob) -> WorkerResult:
    source, blocked_result = require_source_file(
        job,
        adapter="ifcdb_agent",
        install_hint="Mount a source IFC file and configure IFCDB_AGENT_URL for the isolated IFCDB-Agent v1.0.9 service.",
    )
    if blocked_result:
        return blocked_result
    assert source is not None

    health = _health_check(job)
    if isinstance(health, WorkerResult):
        return health
    fields = _base_payload(job)
    fields.update(_job_payload(job))
    fields.update(
        {
            "sourcePath": str(source),
            "sourceFileName": source.name,
            "sourceContentType": str(job.input.get("sourceContentType", "model/ifc")),
            "sourceSha256": file_sha256(source),
        }
    )
    body, content_type = _multipart_body("----architoken-ifcdb-agent-boundary", fields, source)
    response = _request(job, _operation_path(job.operation), body=body, content_type=content_type)
    if isinstance(response, WorkerResult):
        return response
    payload, raw_artifact = _persist_response(job, response, operation=job.operation)
    artifacts: tuple[WorkerArtifact, ...] = (raw_artifact,) if raw_artifact else ()
    if payload is not None:
        name, role = _JSON_ARTIFACTS[job.operation]
        artifact = write_json_artifact(
            job,
            name,
            _result_payload(job, payload, health=health),
            role=role,
            metadata={"adapter": "ifcdb_agent", "upstreamVersion": IFCDB_AGENT_REQUIRED_VERSION},
        )
        artifacts = (artifact,)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=artifacts,
        output={
            "adapter": "ifcdb_agent",
            "operation": job.operation.value,
            "upstream": "DeeJoin/IFCDB-Agent",
            "upstreamVersion": IFCDB_AGENT_REQUIRED_VERSION,
            "serviceUrl": _base_url(),
            "sourcePath": str(source),
            "responseKind": "json" if payload is not None else "binary",
            "health": health,
        },
    )


def _json_operation(job: ConversionJob) -> WorkerResult:
    validation = _validate_json_operation_input(job)
    if validation is not None:
        return validation
    health = _health_check(job)
    if isinstance(health, WorkerResult):
        return health
    body = json.dumps(_request_payload(job), ensure_ascii=False).encode("utf-8")
    response = _request(job, _operation_path(job.operation), body=body, content_type="application/json")
    if isinstance(response, WorkerResult):
        return response
    payload, raw_artifact = _persist_response(job, response, operation=job.operation)
    if payload is not None:
        name, role = _JSON_ARTIFACTS[job.operation]
        artifact = write_json_artifact(
            job,
            name,
            _result_payload(job, payload, health=health),
            role=role,
            metadata={"adapter": "ifcdb_agent", "upstreamVersion": IFCDB_AGENT_REQUIRED_VERSION},
        )
        artifacts = (artifact,)
        response_kind = "json"
    else:
        artifacts = (raw_artifact,) if raw_artifact else ()
        response_kind = "binary"
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=artifacts,
        output={
            "adapter": "ifcdb_agent",
            "operation": job.operation.value,
            "upstream": "DeeJoin/IFCDB-Agent",
            "upstreamVersion": IFCDB_AGENT_REQUIRED_VERSION,
            "serviceUrl": _base_url(),
            "responseKind": response_kind,
            "health": health,
        },
    )


def _validate_json_operation_input(job: ConversionJob) -> WorkerResult | None:
    if job.operation == ConversionOperation.IFCDB_QUERY:
        query = input_string(job, "query", "sql", "naturalLanguage", "natural_language")
        if not query:
            return blocked(
                job,
                adapter="ifcdb_agent",
                reason="missing IFCDB query input: query, sql, or naturalLanguage",
                install_hint="Pass the real SQL or natural-language IFCDB query in the conversion job input.",
            )
    return None


def _missing_ifcdb_agent_runtime(job: ConversionJob) -> WorkerResult | None:
    if _base_url():
        return None
    return blocked(
        job,
        adapter="ifcdb_agent",
        reason="missing environment variable: IFCDB_AGENT_URL",
        install_hint="Deploy IFCDB-Agent v1.0.9 as an isolated sidecar/service and set IFCDB_AGENT_URL.",
    )


def _version_block(job: ConversionJob) -> WorkerResult | None:
    configured = os.getenv("IFCDB_AGENT_VERSION", "").strip()
    if _version_matches(configured):
        return None
    production = os.getenv("ARCHITOKEN_PROFILE", "").strip().lower() == "production"
    if not production and not configured:
        return None
    return blocked(
        job,
        adapter="ifcdb_agent",
        reason=f"IFCDB_AGENT_VERSION must be {IFCDB_AGENT_REQUIRED_VERSION}; configured={configured or '<unset>'}",
        install_hint="Pin the isolated IFCDB-Agent runtime to release v1.0.9 before enabling production jobs.",
    )


def _version_matches(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in {IFCDB_AGENT_REQUIRED_VERSION, IFCDB_AGENT_REQUIRED_VERSION.lstrip("v")}


def _health_check(job: ConversionJob) -> dict[str, Any] | WorkerResult:
    if str(job.input.get("skipIfcdbHealthCheck", "")).lower() in {"1", "true", "yes", "on"}:
        return {"executed": False, "reason": "skipIfcdbHealthCheck was requested"}
    health_path = os.getenv("IFCDB_AGENT_HEALTH_PATH", "/health").strip()
    if not health_path:
        return {"executed": False, "reason": "IFCDB_AGENT_HEALTH_PATH is empty"}
    response = _request(job, health_path, method="GET", body=None, content_type=None)
    if isinstance(response, WorkerResult):
        return response
    payload, _artifact = _persist_response(job, response, operation=None)
    return {
        "executed": True,
        "path": health_path,
        "statusCode": response["statusCode"],
        "payload": payload,
    }


def _request_payload(job: ConversionJob) -> dict[str, Any]:
    payload = _base_payload(job)
    payload.update(_job_payload(job))
    _apply_manual_semantics(job, payload)
    return payload


def _base_payload(job: ConversionJob) -> dict[str, Any]:
    return {
        "tenantId": job.tenant_id,
        "projectId": job.project_id,
        "jobId": job.job_id,
        "actor": job.actor,
        "sourceAssetId": job.source_asset_id,
        "sourceFileId": job.source_file_id,
        "operation": job.operation.value,
        "requiredUpstream": "DeeJoin/IFCDB-Agent",
        "requiredVersion": IFCDB_AGENT_REQUIRED_VERSION,
    }


def _job_payload(job: ConversionJob) -> dict[str, Any]:
    excluded = {
        "adapter",
        "sourcePath",
        "source_path",
        "sourceFilePath",
        "source_file_path",
        "sourceObjectKey",
        "source_object_key",
        "sourceDownloadUrl",
        "sourceBucket",
        "artifactObjectPrefix",
        "artifact_object_prefix",
    }
    return {str(key): value for key, value in job.input.items() if key not in excluded}


def _apply_manual_semantics(job: ConversionJob, payload: dict[str, Any]) -> None:
    """Apply behavior stated in the public IFCDB v1.0.9 user manual."""

    if job.operation == ConversionOperation.IFCDB_QUERY:
        sql = input_string(job, "sql", "sql_ifc")
        if sql:
            payload.setdefault("query", _sql_ifc_command(sql))
            payload.setdefault("sqlCommand", _sql_ifc_command(sql))
            payload.setdefault("queryMode", "sql_ifc")
    if job.operation == ConversionOperation.IFCDB_EXPORT:
        payload.setdefault("exportFormat", "csv")
        payload.setdefault("queryMode", "export_csv")


def _sql_ifc_command(sql: str) -> str:
    stripped = sql.strip()
    if stripped.lower().startswith("%%sql_ifc"):
        return stripped
    return f"%%sql_ifc\n{stripped}"


def _result_payload(job: ConversionJob, response_payload: Any, *, health: dict[str, Any]) -> dict[str, Any]:
    return {
        "adapter": "ifcdb_agent",
        "operation": job.operation.value,
        "upstream": "DeeJoin/IFCDB-Agent",
        "upstreamVersion": IFCDB_AGENT_REQUIRED_VERSION,
        "sourceUrl": "https://github.com/DeeJoin/IFCDB-Agent/releases/tag/v1.0.9",
        "health": health,
        "response": response_payload,
    }


def _operation_path(operation: ConversionOperation) -> str:
    env_name, default = _OPERATION_DEFAULT_PATHS[operation]
    return os.getenv(env_name, default).strip() or default


def _request(
    job: ConversionJob,
    path: str,
    *,
    method: str = "POST",
    body: bytes | None,
    content_type: str | None,
) -> dict[str, Any] | WorkerResult:
    url = _absolute_url(path)
    headers = {"Accept": "application/json, application/octet-stream"}
    if content_type:
        headers["Content-Type"] = content_type
    token = os.getenv("IFCDB_AGENT_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 120))) as response:
            return {
                "url": url,
                "statusCode": response.status,
                "contentType": response.headers.get("Content-Type", "application/octet-stream"),
                "body": response.read(),
            }
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[-4000:]
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "ifcdb_agent", "operation": job.operation.value, "url": url, "statusCode": exc.code},
            error={"code": "ifcdb_agent_http_error", "message": detail or str(exc)},
        )
    except Exception as exc:  # noqa: BLE001 - external runtime failures are structured worker failures.
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "ifcdb_agent", "operation": job.operation.value, "url": url},
            error={"code": "ifcdb_agent_unreachable", "message": str(exc)},
        )


def _persist_response(
    job: ConversionJob,
    response: dict[str, Any],
    *,
    operation: ConversionOperation | None,
) -> tuple[Any | None, WorkerArtifact | None]:
    body = bytes(response["body"])
    content_type = str(response["contentType"])
    if not body:
        return None, None
    if "json" in content_type.lower():
        return json.loads(body.decode("utf-8")), None
    if operation is None:
        return body.decode("utf-8", errors="replace"), None
    suffix = _export_suffix(job, content_type)
    path = output_dir(job) / f"{operation.value}_response{suffix}"
    path.write_bytes(body)
    return None, artifact_for_path(
        path,
        job=job,
        media_type=content_type.split(";")[0] or "application/octet-stream",
        role=f"{operation.value}_response",
        metadata={"adapter": "ifcdb_agent", "upstreamVersion": IFCDB_AGENT_REQUIRED_VERSION, "responseUrl": response["url"]},
    )


def _export_suffix(job: ConversionJob, content_type: str) -> str:
    requested = input_string(job, "exportFormat", "export_format", "format")
    if requested:
        return "." + requested.lower().lstrip(".")
    if "ifc" in content_type.lower():
        return ".ifc"
    if "json" in content_type.lower():
        return ".json"
    if "gltf" in content_type.lower() or "glb" in content_type.lower():
        return ".glb"
    return ".bin"


def _multipart_body(boundary: str, fields: dict[str, Any], source: Path) -> tuple[bytes, str]:
    parts: list[bytes] = []
    for key, value in fields.items():
        parts.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{key}"\r\n'
                "Content-Type: application/json; charset=utf-8\r\n\r\n"
                f"{json.dumps(value, ensure_ascii=False)}\r\n"
            ).encode("utf-8")
        )
    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{source.name}"\r\n'
            "Content-Type: model/ifc\r\n\r\n"
        ).encode("utf-8")
        + source.read_bytes()
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _absolute_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return urllib.parse.urljoin(_base_url().rstrip("/") + "/", path.lstrip("/"))


def _base_url() -> str:
    return os.getenv("IFCDB_AGENT_URL", "").strip().rstrip("/")
