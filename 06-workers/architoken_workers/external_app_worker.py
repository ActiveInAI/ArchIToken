"""Adapters for large external OSS applications kept outside the core runtime."""

from __future__ import annotations

import json
import os
import urllib.request

from .adapter_requirements import blocked, missing_env
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import (
    artifact_for_path,
    input_string,
    output_dir,
    require_source_file,
    source_path,
    write_json_artifact,
)


def open_design_generate(job: ConversionJob) -> WorkerResult:
    """Route prototype/media export generation to an isolated Open Design service."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="open_design",
        name="OPEN_DESIGN_URL",
        install_hint="Run open-design as an isolated service and set OPEN_DESIGN_URL.",
    ):
        return unavailable
    response = _post_json(
        os.environ["OPEN_DESIGN_URL"].rstrip("/"),
        "/v1/generate",
        {
            "jobId": job.job_id,
            "tenantId": job.tenant_id,
            "projectId": job.project_id,
            "actor": job.actor,
            "operation": job.operation.value,
            "input": job.input,
        },
        timeout_seconds=int(job.input.get("timeoutSeconds", 900)),
    )
    artifact = _response_artifact(job, response, "open_design")
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "open_design", "response": response},
    )


def licensed_bim_convert(job: ConversionJob) -> WorkerResult:
    """Route vendor BIM/CAD sources to a configured licensed conversion service."""

    validate_job(job)
    base_url = _licensed_bim_adapter_url(job)
    if not base_url:
        return blocked(
            job,
            adapter="licensed_bim_adapter",
            reason=(
                "missing licensed BIM/CAD adapter URL; configure RVT_ADAPTER_URL, "
                "SKETCHUP_ADAPTER_URL, RHINO_ADAPTER_URL, or LICENSED_BIM_ADAPTER_URL"
            ),
            install_hint=(
                "Configure a licensed Autodesk/Revit, SketchUp, Rhino, Trimble/Speckle, "
                "or enterprise conversion service that returns persisted IFC/GLB/STEP artifacts."
            ),
        )

    local_source = source_path(job)
    has_source_binding = bool(
        local_source
        or input_string(job, "sourceObjectKey", "source_object_key")
        or input_string(job, "sourceDownloadUrl", "source_download_url")
    )
    if not has_source_binding:
        return blocked(
            job,
            adapter="licensed_bim_adapter",
            reason="missing source binding: sourcePath, sourceObjectKey, or sourceDownloadUrl",
            install_hint="Pass a real source file binding from object storage or a local worker mount.",
        )

    payload = {
        "jobId": job.job_id,
        "tenantId": job.tenant_id,
        "projectId": job.project_id,
        "actor": job.actor,
        "operation": job.operation.value,
        "sourcePath": str(local_source) if local_source else None,
        "sourceObjectKey": job.input.get("sourceObjectKey")
        or job.input.get("source_object_key"),
        "sourceBucket": job.input.get("sourceBucket")
        or job.input.get("source_bucket"),
        "sourceDownloadUrl": job.input.get("sourceDownloadUrl")
        or job.input.get("source_download_url"),
        "sourceFileName": job.input.get("sourceFileName")
        or job.input.get("source_file_name"),
        "sourceFormat": _source_format(job),
        "outputFormats": job.input.get("outputFormats", ["ifc", "glb"]),
    }
    headers = (
        {"Authorization": f"Bearer {os.getenv('LICENSED_BIM_ADAPTER_TOKEN', '')}"}
        if os.getenv("LICENSED_BIM_ADAPTER_TOKEN")
        else {}
    )
    response = _post_json(
        base_url.rstrip("/"),
        str(job.input.get("adapterPath", "/v1/convert")),
        payload,
        timeout_seconds=int(job.input.get("timeoutSeconds", 900)),
        headers=headers,
    )
    manifest = write_json_artifact(
        job,
        "licensed_bim_adapter_manifest.json",
        {"request": payload, "response": response},
        role="licensed_bim_adapter_manifest",
        metadata={
            "adapter": "licensed_bim_adapter",
            "sourceFormat": _source_format(job),
        },
    )
    artifacts = _artifacts_from_service_response(
        job,
        response,
        "licensed_bim_adapter",
    )
    if not artifacts:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            artifacts=(manifest,),
            output={"adapter": "licensed_bim_adapter", "response": response},
            error={
                "code": "licensed_bim_adapter_missing_artifacts",
                "message": "Licensed BIM/CAD adapter response did not include artifact bytes or persisted object references.",
            },
        )

    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple([*artifacts, manifest]),
        output={
            "adapter": "licensed_bim_adapter",
            "sourceFormat": _source_format(job),
            "artifactCount": len(artifacts) + 1,
            "response": response,
        },
    )


def siyuan_import(job: ConversionJob) -> WorkerResult:
    """Import a Markdown/text source into an isolated SiYuan service."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="siyuan",
        name="SIYUAN_API_URL",
        install_hint="Run SiYuan as an isolated AGPL service and set SIYUAN_API_URL.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="siyuan",
        install_hint="Pass a Markdown/text sourcePath or sourceObjectKey to import into SiYuan.",
    )
    if blocked:
        return blocked
    payload = {
        "jobId": job.job_id,
        "notebook": job.input.get("notebook"),
        "path": job.input.get("path", f"/architoken/{source.name}"),
        "content": source.read_text(encoding="utf-8"),
    }
    headers = {"Authorization": f"Token {os.getenv('SIYUAN_TOKEN', '')}"} if os.getenv("SIYUAN_TOKEN") else {}
    response = _post_json(
        os.environ["SIYUAN_API_URL"].rstrip("/"),
        str(job.input.get("siyuanOperationPath", "/api/file/putFile")),
        payload,
        timeout_seconds=int(job.input.get("timeoutSeconds", 120)),
        headers=headers,
    )
    artifact = write_json_artifact(
        job,
        "siyuan_import_manifest.json",
        {"sourcePath": str(source), "response": response},
        role="siyuan_import_manifest",
        metadata={"adapter": "siyuan"},
    )
    return WorkerResult(job_id=job.job_id, status="completed", artifacts=(artifact,), output={"adapter": "siyuan", "response": response})


def _post_json(base_url: str, path: str, payload: dict[str, object], *, timeout_seconds: int, headers: dict[str, str] | None = None) -> dict[str, object]:
    request_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    request_headers.update(headers or {})
    request = urllib.request.Request(
        f"{base_url}/{path.lstrip('/')}",
        data=json.dumps(payload).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        data = json.loads(response.read().decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("external app response must be a JSON object")
    return data


def _response_artifact(job: ConversionJob, response: dict[str, object], adapter: str):
    if "contentBase64" in response:
        import base64

        output_name = str(response.get("name") or job.input.get("outputName") or f"{adapter}_output.bin")
        media_type = str(response.get("mediaType") or "application/octet-stream")
        target = output_dir(job) / output_name
        target.write_bytes(base64.b64decode(str(response["contentBase64"])))
        return artifact_for_path(target, job=job, media_type=media_type, role=f"{adapter}_output", metadata={"adapter": adapter})
    return write_json_artifact(job, f"{adapter}_response.json", response, role=f"{adapter}_response", metadata={"adapter": adapter})


def _licensed_bim_adapter_url(job: ConversionJob) -> str | None:
    source_format = _source_format(job)
    candidates = {
        "rvt": (
            "RVT_ADAPTER_URL",
            "AUTODESK_APS_ADAPTER_URL",
            "LICENSED_BIM_ADAPTER_URL",
        ),
        "rfa": (
            "RVT_ADAPTER_URL",
            "AUTODESK_APS_ADAPTER_URL",
            "LICENSED_BIM_ADAPTER_URL",
        ),
        "skp": ("SKETCHUP_ADAPTER_URL", "LICENSED_BIM_ADAPTER_URL"),
        "3dm": ("RHINO_ADAPTER_URL", "LICENSED_BIM_ADAPTER_URL"),
        "stel": ("LICENSED_BIM_ADAPTER_URL",),
    }.get(source_format, ("LICENSED_BIM_ADAPTER_URL",))
    for name in candidates:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return None


def _source_format(job: ConversionJob) -> str:
    explicit = input_string(job, "sourceFormat", "source_format")
    if explicit:
        return explicit.lower().lstrip(".")
    source_name = input_string(job, "sourceFileName", "source_file_name")
    if source_name and "." in source_name:
        return source_name.rsplit(".", 1)[1].lower()
    path = source_path(job)
    if path and path.suffix:
        return path.suffix.lower().lstrip(".")
    return "unknown"


def _artifacts_from_service_response(
    job: ConversionJob,
    response: dict[str, object],
    adapter: str,
) -> list[WorkerArtifact]:
    raw_artifacts = response.get("artifacts")
    artifacts: list[WorkerArtifact] = []
    if isinstance(raw_artifacts, list):
        for index, item in enumerate(raw_artifacts):
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or f"{adapter}_{index}.bin")
            media_type = str(
                item.get("mediaType")
                or item.get("media_type")
                or "application/octet-stream"
            )
            role = str(item.get("role") or f"{adapter}_output")
            if isinstance(item.get("contentBase64"), str):
                import base64

                target = output_dir(job) / name
                target.write_bytes(base64.b64decode(str(item["contentBase64"])))
                artifacts.append(
                    artifact_for_path(
                        target,
                        job=job,
                        media_type=media_type,
                        role=role,
                        metadata={"adapter": adapter},
                    )
                )
                continue
            object_key = item.get("objectKey") or item.get("object_key")
            object_uri = item.get("objectUri") or item.get("object_uri")
            if isinstance(object_key, str) or isinstance(object_uri, str):
                artifacts.append(
                    WorkerArtifact(
                        name=name,
                        media_type=media_type,
                        role=role,
                        metadata={
                            "adapter": adapter,
                            "objectPersisted": True,
                            **(
                                {"objectKey": object_key}
                                if isinstance(object_key, str)
                                else {}
                            ),
                            **(
                                {"objectUri": object_uri}
                                if isinstance(object_uri, str)
                                else {}
                            ),
                        },
                    )
                )
    elif "contentBase64" in response:
        artifacts.append(_response_artifact(job, response, adapter))
    elif isinstance(response.get("objectKey"), str) or isinstance(
        response.get("objectUri"),
        str,
    ):
        name = str(response.get("name") or f"{adapter}_object")
        media_type = str(response.get("mediaType") or "application/octet-stream")
        object_key = response.get("objectKey")
        object_uri = response.get("objectUri")
        artifacts.append(
            WorkerArtifact(
                name=name,
                media_type=media_type,
                role=str(response.get("role") or f"{adapter}_output"),
                metadata={
                    "adapter": adapter,
                    "objectPersisted": True,
                    **(
                        {"objectKey": object_key}
                        if isinstance(object_key, str)
                        else {}
                    ),
                    **(
                        {"objectUri": object_uri}
                        if isinstance(object_uri, str)
                        else {}
                    ),
                },
            )
        )
    return artifacts
