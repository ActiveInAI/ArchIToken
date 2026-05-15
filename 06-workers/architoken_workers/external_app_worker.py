"""Adapters for large external OSS applications kept outside the core runtime."""

from __future__ import annotations

import json
import os
import urllib.request

from .adapter_requirements import missing_env
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact


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
