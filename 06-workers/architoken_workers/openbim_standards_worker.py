"""buildingSMART openBIM standard worker adapters."""

from __future__ import annotations

import json
import os
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked, missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, file_sha256, input_string, output_dir, require_source_file, write_json_artifact, write_jsonl_artifact


def bcf_ingest(job: ConversionJob) -> WorkerResult:
    """Parse a BCF package into topic/comment/viewpoint artifacts."""

    validate_job(job)
    source, blocked_result = require_source_file(
        job,
        adapter="bcf",
        install_hint="Mount a .bcf/.bcfzip package and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result
    if not zipfile.is_zipfile(source):
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "bcf", "sourcePath": str(source)},
            error={"code": "bcf_not_zip", "message": f"BCF package is not a readable zip archive: {source}"},
        )

    topics: list[dict[str, Any]] = []
    comments: list[dict[str, Any]] = []
    viewpoints: list[dict[str, Any]] = []
    with zipfile.ZipFile(source) as archive:
        entries = sorted(archive.namelist())
        version = _read_zip_text(archive, "bcf.version")
        project = _read_zip_text(archive, "project.bcfp")
        for name in entries:
            if name.endswith("markup.bcf"):
                topic, topic_comments, topic_viewpoints = _parse_bcf_markup(name, archive.read(name))
                topics.append(topic)
                comments.extend(topic_comments)
                viewpoints.extend(topic_viewpoints)
    topic_artifact = write_jsonl_artifact(
        job,
        "bcf_topics.jsonl",
        topics,
        role="bcf_topics",
        metadata={"standard": "BCF", "sourcePath": str(source)},
    )
    comment_artifact = write_jsonl_artifact(
        job,
        "bcf_comments.jsonl",
        comments,
        role="bcf_comments",
        metadata={"standard": "BCF", "sourcePath": str(source)},
    )
    viewpoint_artifact = write_jsonl_artifact(
        job,
        "bcf_viewpoints.jsonl",
        viewpoints,
        role="bcf_viewpoints",
        metadata={"standard": "BCF", "sourcePath": str(source)},
    )
    manifest_payload = {
        "standard": "BCF",
        "sourcePath": str(source),
        "sha256": file_sha256(source),
        "entryCount": len(entries),
        "topicCount": len(topics),
        "commentCount": len(comments),
        "viewpointCount": len(viewpoints),
        "versionXmlPresent": version is not None,
        "projectXmlPresent": project is not None,
    }
    manifest = write_json_artifact(
        job,
        "bcf_manifest.json",
        manifest_payload,
        role="bcf_manifest",
        metadata={"standard": "BCF", "sourcePath": str(source)},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(manifest, topic_artifact, comment_artifact, viewpoint_artifact),
        output=manifest_payload,
    )


def idm_ingest(job: ConversionJob) -> WorkerResult:
    """Register a structured IDM exchange requirement set or source manifest."""

    validate_job(job)
    raw_spec = job.input.get("idmSpec") or job.input.get("idm_spec")
    source = None
    source_artifact: WorkerArtifact | None = None
    if raw_spec is None:
        source, blocked_result = require_source_file(
            job,
            adapter="idm",
            install_hint="Pass structured idmSpec or mount an IDM source document with sourcePath/sourceObjectKey.",
        )
        if blocked_result:
            return blocked_result
        source_artifact = artifact_for_path(
            source,
            job=job,
            media_type=_media_type(source.suffix.lower()),
            role="idm_source",
            metadata={"standard": "IDM", "sourcePath": str(source)},
        )
        spec = {
            "standard": "IDM",
            "sourcePath": str(source),
            "sha256": file_sha256(source),
            "machineReadable": False,
            "requiresStructuredExchangeRequirements": True,
            "reason": "No structured idmSpec was provided; registered source document only.",
        }
    else:
        if not isinstance(raw_spec, dict):
            raise ValueError("idmSpec must be an object")
        spec = _validated_idm_spec(raw_spec)

    manifest = write_json_artifact(
        job,
        "idm_manifest.json",
        spec,
        role="idm_manifest",
        metadata={"standard": "IDM", "sourcePath": str(source) if source else None},
    )
    artifacts = tuple(artifact for artifact in (source_artifact, manifest) if artifact)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=artifacts,
        output={"standard": "IDM", "machineReadable": bool(raw_spec is not None), "manifestPath": manifest.metadata["path"]},
    )


def buildingsmart_validate(job: ConversionJob) -> WorkerResult:
    """Validate an IFC file through local openBIM checks and optional buildingSMART Validate service/CLI."""

    validate_job(job)
    source, blocked_result = require_source_file(
        job,
        adapter="buildingsmart_validate",
        install_hint="Mount a source IFC file and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result
    local_report = _local_ifc_validation(job, source)
    if isinstance(local_report, WorkerResult):
        return local_report
    service_report = _run_validate_service(job, source)
    cli_report = _run_validate_cli(job, source)
    report = {
        "standard": "buildingSMART Validate",
        "sourcePath": str(source),
        "sha256": file_sha256(source),
        "local": local_report,
        "service": service_report,
        "cli": cli_report,
        "passed": bool(local_report.get("passed")) and not _external_validation_failed(service_report, cli_report),
    }
    artifact = write_json_artifact(
        job,
        "buildingsmart_validate_report.json",
        report,
        role="validation_report",
        metadata={"standard": "buildingSMART Validate", "sourcePath": str(source)},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "standard": "buildingSMART Validate",
            "passed": report["passed"],
            "schema": local_report.get("schema"),
            "serviceExecuted": bool(service_report.get("executed")),
            "cliExecuted": bool(cli_report.get("executed")),
            "reportPath": artifact.metadata["path"],
        },
    )


def _local_ifc_validation(job: ConversionJob, source: Path) -> dict[str, Any] | WorkerResult:
    if unavailable := missing_python_dependency(
        job,
        adapter="buildingsmart_validate",
        import_name="ifcopenshell",
        install_hint="Install IfcOpenShell for local IFC syntax/schema validation.",
    ):
        return unavailable
    import ifcopenshell

    try:
        model = ifcopenshell.open(str(source))
    except Exception as exc:  # noqa: BLE001 - report parse failures as validation failures.
        return {
            "executed": True,
            "engine": "ifcopenshell",
            "passed": False,
            "error": {"code": "ifc_parse_failed", "message": str(exc)},
        }
    return {
        "executed": True,
        "engine": "ifcopenshell",
        "passed": True,
        "schema": str(getattr(model, "schema", "IFC")).upper(),
        "entityCount": sum(1 for _ in model),
        "productCount": len(list(model.by_type("IfcProduct"))),
    }


def _run_validate_service(job: ConversionJob, source: Path) -> dict[str, Any]:
    base_url = os.getenv("BUILDINGSMART_VALIDATE_URL", "").strip().rstrip("/")
    operation_path = os.getenv("BUILDINGSMART_VALIDATE_OPERATION_PATH", "").strip()
    if not base_url or not operation_path:
        return {
            "executed": False,
            "reason": "BUILDINGSMART_VALIDATE_URL or BUILDINGSMART_VALIDATE_OPERATION_PATH is not configured",
        }
    endpoint = f"{base_url}/{operation_path.lstrip('/')}"
    boundary = "----architoken-openbim-validate-boundary"
    body = _multipart_file_body(boundary, "file", source)
    headers = {
        "Accept": "application/json",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    token = os.getenv("BUILDINGSMART_VALIDATE_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 120))) as response:
            raw = response.read().decode("utf-8")
    except Exception as exc:  # noqa: BLE001 - external validator failure is evidence, not a worker crash.
        return {"executed": True, "passed": False, "endpoint": endpoint, "error": str(exc)}
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError:
        payload = {"raw": raw}
    return {"executed": True, "endpoint": endpoint, "passed": _payload_passed(payload), "response": payload}


def _run_validate_cli(job: ConversionJob, source: Path) -> dict[str, Any]:
    binary = input_string(job, "buildingsmartValidateBinary", "validateBinary") or os.getenv("BUILDINGSMART_VALIDATE_BINARY", "")
    if not binary:
        return {"executed": False, "reason": "BUILDINGSMART_VALIDATE_BINARY was not configured"}
    completed = subprocess.run(
        [binary, str(source)],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 300)),
    )
    return {
        "executed": True,
        "binary": binary,
        "passed": completed.returncode == 0,
        "returnCode": completed.returncode,
        "stdout": completed.stdout[-8000:],
        "stderr": completed.stderr[-8000:],
    }


def _external_validation_failed(*reports: dict[str, Any]) -> bool:
    return any(report.get("executed") and report.get("passed") is False for report in reports)


def _payload_passed(payload: Any) -> bool | None:
    if isinstance(payload, dict):
        for key in ("passed", "valid", "success", "isValid"):
            if isinstance(payload.get(key), bool):
                return payload[key]
        status = str(payload.get("status", "")).lower()
        if status in {"passed", "valid", "success", "completed"}:
            return True
        if status in {"failed", "invalid", "error"}:
            return False
    return None


def _multipart_file_body(boundary: str, field_name: str, path: Path) -> bytes:
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; filename="{path.name}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    footer = f"\r\n--{boundary}--\r\n".encode("utf-8")
    return header + path.read_bytes() + footer


def _validated_idm_spec(spec: dict[str, Any]) -> dict[str, Any]:
    process_name = _required_string(spec, "processName")
    exchanges = spec.get("exchanges")
    if not isinstance(exchanges, list) or not exchanges:
        raise ValueError("idmSpec.exchanges must be a non-empty list")
    normalized_exchanges = []
    for index, exchange in enumerate(exchanges):
        if not isinstance(exchange, dict):
            raise ValueError(f"idmSpec.exchanges[{index}] must be an object")
        normalized_exchanges.append(
            {
                "id": str(exchange.get("id") or f"exchange-{index + 1}"),
                "name": _required_string(exchange, "name"),
                "sender": _required_string(exchange, "sender"),
                "receiver": _required_string(exchange, "receiver"),
                "milestone": _required_string(exchange, "milestone"),
                "purpose": str(exchange.get("purpose", "")).strip(),
                "deliverables": _required_list(exchange, "deliverables"),
                "informationRequirements": _required_list(exchange, "informationRequirements"),
                "ifcEntities": _optional_list(exchange, "ifcEntities"),
                "idsRefs": _optional_list(exchange, "idsRefs"),
                "bsddRefs": _optional_list(exchange, "bsddRefs"),
                "bcfTopics": _optional_list(exchange, "bcfTopics"),
            }
        )
    return {
        "standard": "IDM",
        "source": "structured_idm_spec",
        "machineReadable": True,
        "processName": process_name,
        "version": str(spec.get("version", "1.0")),
        "exchanges": normalized_exchanges,
        "exchangeCount": len(normalized_exchanges),
    }


def _required_string(payload: dict[str, Any], name: str) -> str:
    value = payload.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"idmSpec.{name} must be a non-empty string")
    return value.strip()


def _required_list(payload: dict[str, Any], name: str) -> list[Any]:
    value = payload.get(name)
    if not isinstance(value, list) or not value:
        raise ValueError(f"idmSpec.{name} must be a non-empty list")
    return value


def _optional_list(payload: dict[str, Any], name: str) -> list[Any]:
    value = payload.get(name, [])
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(f"idmSpec.{name} must be a list")
    return value


def _read_zip_text(archive: zipfile.ZipFile, name: str) -> str | None:
    if name not in archive.namelist():
        return None
    return archive.read(name).decode("utf-8", errors="replace")


def _parse_bcf_markup(entry_name: str, content: bytes) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    root = ET.fromstring(content)
    topic_element = _first_child(root, "Topic")
    topic_guid = topic_element.attrib.get("Guid") if topic_element is not None else None
    topic = {
        "entry": entry_name,
        "guid": topic_guid,
        "topicType": _text(topic_element, "TopicType"),
        "topicStatus": _text(topic_element, "TopicStatus"),
        "title": _text(topic_element, "Title"),
        "priority": _text(topic_element, "Priority"),
        "index": _text(topic_element, "Index"),
        "creationDate": _text(topic_element, "CreationDate"),
        "creationAuthor": _text(topic_element, "CreationAuthor"),
        "modifiedDate": _text(topic_element, "ModifiedDate"),
        "modifiedAuthor": _text(topic_element, "ModifiedAuthor"),
        "assignedTo": _text(topic_element, "AssignedTo"),
        "dueDate": _text(topic_element, "DueDate"),
        "description": _text(topic_element, "Description"),
        "labels": [_node_text(node) for node in _children(topic_element, "Labels")],
    }
    comments = []
    for comment in _children(root, "Comment"):
        comments.append(
            {
                "topicGuid": topic_guid,
                "guid": comment.attrib.get("Guid"),
                "date": _text(comment, "Date"),
                "author": _text(comment, "Author"),
                "comment": _text(comment, "Comment"),
                "viewpointGuid": _first_child(comment, "Viewpoint").attrib.get("Guid") if _first_child(comment, "Viewpoint") is not None else None,
            }
        )
    viewpoints = []
    for viewpoint in _children(root, "Viewpoints"):
        viewpoints.append(
            {
                "topicGuid": topic_guid,
                "guid": viewpoint.attrib.get("Guid"),
                "viewpoint": _text(viewpoint, "Viewpoint"),
                "snapshot": _text(viewpoint, "Snapshot"),
            }
        )
    return topic, comments, viewpoints


def _first_child(element: ET.Element | None, name: str) -> ET.Element | None:
    if element is None:
        return None
    for child in list(element):
        if _local_name(child.tag) == name:
            return child
    return None


def _children(element: ET.Element | None, name: str) -> list[ET.Element]:
    if element is None:
        return []
    return [child for child in list(element) if _local_name(child.tag) == name]


def _text(element: ET.Element | None, name: str) -> str | None:
    child = _first_child(element, name)
    return _node_text(child)


def _node_text(element: ET.Element | None) -> str | None:
    if element is None or element.text is None:
        return None
    value = element.text.strip()
    return value or None


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _media_type(suffix: str) -> str:
    return {
        ".pdf": "application/pdf",
        ".xml": "application/xml",
        ".json": "application/json",
        ".idm": "application/json",
        ".md": "text/markdown",
    }.get(suffix, "application/octet-stream")
