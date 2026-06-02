"""Adapters for large external OSS applications kept outside the core runtime."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

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
    local_source = source_path(job)
    source_format = _source_format(job)
    requests_ifc = _requests_skp_ifc_output(job)
    if source_format == "skp" and requests_ifc:
        skp_ifc_command = _skp_ifc_command_adapter_config()
        if skp_ifc_command is not None:
            if not local_source or not local_source.is_file():
                return blocked(
                    job,
                    adapter="licensed_bim_adapter",
                    reason="missing local SKP source file for Prengine SKP->IFC command adapter",
                    install_hint="Pass sourcePath for SKP->IFC command conversion.",
                )
            return _run_skp_ifc_command_adapter(job, local_source, skp_ifc_command)

    skp_command = _skp_command_adapter_config()
    if source_format == "skp" and not requests_ifc and skp_command is not None:
        if not local_source or not local_source.is_file():
            return blocked(
                job,
                adapter="licensed_bim_adapter",
                reason="missing local SKP source file for Prengine command adapter",
                install_hint="Pass sourcePath for SKP command conversion.",
            )
        result = _run_skp_command_adapter(job, local_source, skp_command)
        if result.status == "completed":
            return result
        fallback = _find_skp_glb_fallback(job, local_source)
        if fallback is not None:
            return _skp_glb_fallback_result(job, local_source, fallback, previous_result=result)
        return result

    base_url = _licensed_bim_adapter_url(job)
    if not base_url:
        if source_format == "skp" and requests_ifc:
            return blocked(
                job,
                adapter="licensed_bim_adapter",
                reason=(
                    "missing real SKP->IFC adapter; no command or licensed "
                    "SketchUp conversion service is configured"
                ),
                install_hint=(
                    "Install or mount a legal SketchUp Ruby sidecar and set "
                    "PRENGINE_SKP_TO_IFC_COMMAND plus optional PRENGINE_SKP_TO_IFC_ARGS, "
                    "or configure SKETCHUP_ADAPTER_URL/LICENSED_BIM_ADAPTER_URL. The sidecar "
                    "may use Sketchup::Model#export, BIM-Tools SketchUp-IFC-Manager as an "
                    "isolated GPL process, or Speckle SketchUp Connector; SKP->IFC will not "
                    "fall back to GLB or package listings."
                ),
            )
        if source_format == "skp" and local_source and local_source.is_file():
            fallback = _find_skp_glb_fallback(job, local_source)
            if fallback is not None:
                return _skp_glb_fallback_result(job, local_source, fallback)
        return blocked(
            job,
            adapter="licensed_bim_adapter",
            reason=(
                "missing licensed BIM/CAD adapter URL; configure RVT_ADAPTER_URL, "
                "SKETCHUP_ADAPTER_URL, RHINO_ADAPTER_URL, LICENSED_BIM_ADAPTER_URL, "
                "PRENGINE_SKP_CONVERTER_COMMAND for SKP->GLB, or "
                "PRENGINE_SKP_TO_IFC_COMMAND for SKP->IFC"
            ),
            install_hint=(
                "Configure a licensed Autodesk/Revit, SketchUp, Rhino, Trimble/Speckle, "
                "or enterprise conversion service that returns persisted IFC/GLB/STEP artifacts. "
                "For SKP, PRENGINE_SKP_CONVERTER_COMMAND may wrap Sketchup::Model#export GLB, "
                "the MIT Yulio glTF exporter, Speckle SketchUp Connector, or another legal "
                "external converter command for GLB previews; PRENGINE_SKP_TO_IFC_COMMAND "
                "must produce real IFC for OpenBIM exchange."
            ),
        )

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
        "sourceFormat": source_format,
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
            "sourceFormat": source_format,
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
            "sourceFormat": source_format,
            "artifactCount": len(artifacts) + 1,
            "response": response,
        },
    )


def _run_skp_ifc_command_adapter(
    job: ConversionJob,
    source: Path,
    command_config: tuple[str, list[str]],
) -> WorkerResult:
    command, configured_args = command_config
    output_path = output_dir(job) / f"{source.stem}.ifc"
    args = _skp_command_args(configured_args, source, output_path, job)
    timeout = int(job.input.get("timeoutSeconds", 3600))
    completed = subprocess.run(
        [command, *args],
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=str(output_dir(job)),
    )
    valid_ifc = _is_ifc_file(output_path)
    manifest = write_json_artifact(
        job,
        "skp_ifc_command_adapter_manifest.json",
        {
            "schema": "architoken.skp_ifc_command_adapter_manifest.v1",
            "sourcePath": str(source),
            "outputPath": str(output_path),
            "targetFormat": "ifc",
            "command": [command, *args],
            "returnCode": completed.returncode,
            "stdoutTail": (completed.stdout or "")[-4000:],
            "stderrTail": (completed.stderr or "")[-4000:],
            "licenseBoundary": "external_licensed_adapter",
            "sourceOfRecord": "skp",
            "validIfc": valid_ifc,
            "sourceReferences": [
                "https://ruby.sketchup.com/Sketchup/Model.html",
                "https://github.com/BIM-Tools/SketchUp-IFC-Manager",
                "https://github.com/specklesystems/speckle-sketchup",
            ],
        },
        role="licensed_bim_adapter_manifest",
        metadata={
            "adapter": "licensed_bim_adapter",
            "sourceFormat": "skp",
            "targetFormat": "ifc",
            "engine": "Prengine",
        },
    )
    if completed.returncode != 0 or not valid_ifc:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            artifacts=(manifest,),
            output={
                "adapter": "licensed_bim_adapter",
                "engine": "Prengine",
                "sourceFormat": "skp",
                "targetFormat": "ifc",
                "converterPath": command,
                "returnCode": completed.returncode,
                "validIfc": valid_ifc,
            },
            error={
                "code": "skp_ifc_command_adapter_failed",
                "message": (
                    completed.stderr
                    or completed.stdout
                    or "Prengine SKP->IFC command adapter did not produce a valid IFC artifact"
                )[-4000:],
            },
        )

    artifact = artifact_for_path(
        output_path,
        job=job,
        media_type="application/p21",
        role="openbim_ifc",
        metadata={
            "adapter": "licensed_bim_adapter",
            "engine": "Prengine",
            "sourceFormat": "skp",
            "targetFormat": "ifc",
            "converterPath": command,
            "sourcePath": str(source),
        },
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact, manifest),
        output={
            "adapter": "licensed_bim_adapter",
            "engine": "Prengine",
            "sourceFormat": "skp",
            "targetFormat": "ifc",
            "artifactCount": 2,
            "converterPath": command,
        },
    )


def _run_skp_command_adapter(
    job: ConversionJob,
    source: Path,
    command_config: tuple[str, list[str]],
) -> WorkerResult:
    command, configured_args = command_config
    output_path = output_dir(job) / f"{source.stem}.glb"
    args = _skp_command_args(configured_args, source, output_path, job)
    timeout = int(job.input.get("timeoutSeconds", 3600))
    completed = subprocess.run(
        [command, *args],
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=str(output_dir(job)),
    )
    manifest = write_json_artifact(
        job,
        "skp_command_adapter_manifest.json",
        {
            "schema": "architoken.skp_command_adapter_manifest.v1",
            "sourcePath": str(source),
            "outputPath": str(output_path),
            "command": [command, *args],
            "returnCode": completed.returncode,
            "stdoutTail": (completed.stdout or "")[-4000:],
            "stderrTail": (completed.stderr or "")[-4000:],
            "licenseBoundary": "external_licensed_adapter",
            "sourceReferences": [
                "https://ruby.sketchup.com/file.exporter_options.html",
                "https://github.com/YulioTech/SketchUp-glTF-Exporter-Ruby",
                "https://github.com/specklesystems/speckle-sketchup",
            ],
        },
        role="licensed_bim_adapter_manifest",
        metadata={
            "adapter": "licensed_bim_adapter",
            "sourceFormat": "skp",
            "engine": "Prengine",
        },
    )
    if (
        completed.returncode != 0
        or not output_path.is_file()
        or output_path.stat().st_size <= 0
        or not _is_glb_file(output_path)
    ):
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            artifacts=(manifest,),
            output={
                "adapter": "licensed_bim_adapter",
                "engine": "Prengine",
                "sourceFormat": "skp",
                "converterPath": command,
                "returnCode": completed.returncode,
                "validGlb": _is_glb_file(output_path),
            },
            error={
                "code": "skp_command_adapter_failed",
                "message": (
                    completed.stderr
                    or completed.stdout
                    or "Prengine SKP command adapter did not produce a valid GLB artifact"
                )[-4000:],
            },
        )

    artifact = artifact_for_path(
        output_path,
        job=job,
        media_type="model/gltf-binary",
        role="skp_glb",
        metadata={
            "adapter": "licensed_bim_adapter",
            "engine": "Prengine",
            "sourceFormat": "skp",
            "converterPath": command,
            "sourcePath": str(source),
        },
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact, manifest),
        output={
            "adapter": "licensed_bim_adapter",
            "engine": "Prengine",
            "sourceFormat": "skp",
            "artifactCount": 2,
            "converterPath": command,
        },
    )


def _skp_glb_fallback_result(
    job: ConversionJob,
    source: Path,
    fallback: Path,
    previous_result: WorkerResult | None = None,
) -> WorkerResult:
    target = output_dir(job) / f"{source.stem}.glb"
    if fallback.resolve() != target.resolve():
        shutil.copyfile(fallback, target)
    manifest = write_json_artifact(
        job,
        "skp_glb_fallback_manifest.json",
        {
            "schema": "architoken.skp_glb_fallback_manifest.v1",
            "sourcePath": str(source),
            "fallbackPath": str(fallback),
            "outputPath": str(target),
            "rule": "glb_as_last_fallback",
            "sourceOfRecord": "skp",
            "substitutePreview": False,
            "previousError": previous_result.error if previous_result else None,
        },
        role="licensed_bim_adapter_manifest",
        metadata={
            "adapter": "licensed_bim_adapter",
            "sourceFormat": "skp",
            "engine": "Prengine",
            "fallback": "glb",
        },
    )
    artifact = artifact_for_path(
        target,
        job=job,
        media_type="model/gltf-binary",
        role="skp_glb_fallback",
        metadata={
            "adapter": "licensed_bim_adapter",
            "engine": "Prengine",
            "sourceFormat": "skp",
            "sourcePath": str(source),
            "fallbackPath": str(fallback),
            "fallback": "glb",
        },
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact, manifest),
        output={
            "adapter": "licensed_bim_adapter",
            "engine": "Prengine",
            "sourceFormat": "skp",
            "artifactCount": 2,
            "fallback": "glb",
            "fallbackPath": str(fallback),
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


def _skp_ifc_command_adapter_config() -> tuple[str, list[str]] | None:
    command = (
        os.getenv("PRENGINE_SKP_TO_IFC_COMMAND", "").strip()
        or os.getenv("SKP_TO_IFC_COMMAND", "").strip()
        or os.getenv("SKETCHUP_TO_IFC_COMMAND", "").strip()
    )
    if not command:
        return _common_skp_ifc_command_adapter_config()
    return _skp_ifc_command_adapter_config_from_env(command)


def _skp_ifc_command_adapter_config_from_env(command: str) -> tuple[str, list[str]]:
    raw_args = (
        os.getenv("PRENGINE_SKP_TO_IFC_ARGS")
        or os.getenv("SKP_TO_IFC_ARGS")
        or os.getenv("SKETCHUP_TO_IFC_ARGS")
    )
    if not raw_args:
        return command, ["{source}", "{output}"]
    parsed = json.loads(raw_args)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError("PRENGINE_SKP_TO_IFC_ARGS must be a JSON string array")
    return command, parsed


def _common_skp_ifc_command_adapter_config() -> tuple[str, list[str]] | None:
    candidates = (
        (os.getenv("SKP2IFC_BIN", "").strip(), ["{source}", "{output}"]),
        (os.getenv("SKP_TO_IFC_BIN", "").strip(), ["{source}", "{output}"]),
        (os.getenv("SKETCHUP_TO_IFC_BIN", "").strip(), ["--input", "{source}", "--output", "{output}"]),
        ("prengine-skp-to-ifc", ["{source}", "{output}"]),
        ("sketchup-ruby-export-ifc", ["--input", "{source}", "--output", "{output}"]),
        ("sketchup-ifc-manager-export", ["--input", "{source}", "--output", "{output}"]),
        ("skp2ifc", ["{source}", "{output}"]),
        ("skp-to-ifc", ["{source}", "{output}"]),
        ("sketchup-to-ifc", ["--input", "{source}", "--output", "{output}"]),
        ("sketchup2ifc", ["{source}", "{output}"]),
    )
    for command, args in candidates:
        if command and shutil.which(command):
            return command, args
    return None


def _skp_command_adapter_config() -> tuple[str, list[str]] | None:
    command = (
        os.getenv("PRENGINE_SKP_CONVERTER_COMMAND", "").strip()
        or os.getenv("SKP_CONVERTER_COMMAND", "").strip()
    )
    if not command:
        return _common_skp_glb_command_adapter_config()
    return _skp_command_adapter_config_from_env(command)


def _skp_command_adapter_config_from_env(command: str) -> tuple[str, list[str]]:
    raw_args = os.getenv("PRENGINE_SKP_CONVERTER_ARGS") or os.getenv("SKP_CONVERTER_ARGS")
    if not raw_args:
        return command, ["{source}", "{output}"]
    parsed = json.loads(raw_args)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError("PRENGINE_SKP_CONVERTER_ARGS must be a JSON string array")
    return command, parsed


def _common_skp_glb_command_adapter_config() -> tuple[str, list[str]] | None:
    candidates = (
        (os.getenv("SKP2GLB_BIN", "").strip(), ["{source}", "{output}"]),
        (os.getenv("SKP_TO_GLB_BIN", "").strip(), ["{source}", "{output}"]),
        (os.getenv("SKETCHUP_TO_GLTF_BIN", "").strip(), ["--input", "{source}", "--output", "{output}"]),
        ("prengine-skp-to-glb", ["{source}", "{output}"]),
        ("sketchup-ruby-export-glb", ["--input", "{source}", "--output", "{output}"]),
        ("yulio-skp-to-glb", ["--input", "{source}", "--output", "{output}"]),
        ("skp2glb", ["{source}", "{output}"]),
        ("skp-to-glb", ["{source}", "{output}"]),
        ("skp2gltf", ["{source}", "{output}"]),
        ("sketchup-to-gltf", ["--input", "{source}", "--output", "{output}"]),
        ("sketchup2gltf", ["{source}", "{output}"]),
    )
    for command, args in candidates:
        if command and shutil.which(command):
            return command, args
    return None


def _find_skp_glb_fallback(job: ConversionJob, source: Path) -> Path | None:
    explicit = input_string(
        job,
        "glbFallbackPath",
        "glb_fallback_path",
        "fallbackGlbPath",
        "fallback_glb_path",
    )
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    candidates.extend(
        [
            source.with_suffix(".glb"),
            output_dir(job) / f"{source.stem}.glb",
        ]
    )
    for directory in _skp_derivative_search_dirs(job, source):
        candidates.extend(_collect_glb_files(directory, max_depth=3))
    for candidate in candidates:
        if candidate != source and _is_glb_file(candidate):
            return candidate
    return None


def _skp_derivative_search_dirs(job: ConversionJob, source: Path) -> list[Path]:
    checksum = input_string(job, "sourceChecksum", "source_checksum", "checksum")
    checksum16 = checksum[:16] if checksum else None
    roots = [
        input_string(job, "derivativesRoot", "derivatives_root"),
        os.getenv("ARCHITOKEN_LOCAL_UPLOADS_DIR", "").strip(),
    ]
    dirs: list[Path] = []
    for raw_root in roots:
        if not raw_root:
            continue
        root = Path(raw_root)
        dirs.extend(
            [
                root / "derivatives" / "skp" / job.source_file_id,
                root / "derivatives" / job.source_file_id,
                root / ".derivatives" / "skp" / job.source_file_id,
                root / ".derivatives" / job.source_file_id,
            ]
        )
        if checksum:
            dirs.extend(
                [
                    root / "derivatives" / "skp" / checksum,
                    root / "derivatives" / "glb" / checksum,
                    root / "derivatives" / job.source_file_id / checksum / "glb",
                    root / "derivatives" / job.source_file_id / checksum,
                    root / "derivatives" / checksum,
                    root / ".derivatives" / "skp" / checksum,
                    root / ".derivatives" / "glb" / checksum,
                    root / ".derivatives" / checksum,
                ]
            )
        if checksum16:
            dirs.extend(
                [
                    root / "derivatives" / "skp" / "v1-real-glb" / checksum16,
                    root / "derivatives" / "skp" / checksum16,
                    root / "derivatives" / "glb" / checksum16,
                    root / "derivatives" / job.source_file_id / checksum16 / "glb",
                    root / "derivatives" / job.source_file_id / checksum16,
                    root / "derivatives" / checksum16,
                    root / ".derivatives" / "skp" / checksum16,
                    root / ".derivatives" / "glb" / checksum16,
                    root / ".derivatives" / checksum16,
                ]
            )
    dirs.extend([source.parent / "derivatives", output_dir(job) / "derivatives"])
    seen: set[Path] = set()
    unique: list[Path] = []
    for directory in dirs:
        resolved = directory.expanduser()
        if resolved in seen:
            continue
        seen.add(resolved)
        unique.append(resolved)
    return unique


def _collect_glb_files(directory: Path, *, max_depth: int) -> list[Path]:
    try:
        entries = list(directory.iterdir())
    except OSError:
        return []
    files: list[Path] = []
    for entry in entries:
        if entry.is_file() and entry.suffix.lower() == ".glb":
            files.append(entry)
            continue
        if entry.is_dir() and max_depth > 0:
            files.extend(_collect_glb_files(entry, max_depth=max_depth - 1))
    return files


def _is_glb_file(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size >= 4 and path.read_bytes()[:4] == b"glTF"
    except OSError:
        return False


def _is_ifc_file(path: Path) -> bool:
    try:
        if not path.is_file() or path.stat().st_size <= 0:
            return False
        prefix = path.read_bytes()[:65536].decode("latin-1", errors="ignore").upper()
    except OSError:
        return False
    return "ISO-10303-21" in prefix[:4096] and "FILE_SCHEMA" in prefix


def _requests_skp_ifc_output(job: ConversionJob) -> bool:
    target = input_string(job, "targetFormat", "target_format", "format")
    if target and target.lower().lstrip(".") == "ifc":
        return True
    for key in ("outputFormats", "output_formats", "targetFormats", "target_formats"):
        value = job.input.get(key)
        if isinstance(value, list) and any(
            isinstance(item, str) and item.lower().lstrip(".") == "ifc"
            for item in value
        ):
            return True
        if isinstance(value, str) and value.lower().lstrip(".") == "ifc":
            return True
    return False


def _skp_command_args(
    configured_args: list[str],
    source: Path,
    output_path: Path,
    job: ConversionJob,
) -> list[str]:
    replacements = {
        "source": str(source),
        "input": str(source),
        "output": str(output_path),
        "fileId": job.source_file_id,
        "fileName": str(
            job.input.get("sourceFileName")
            or job.input.get("source_file_name")
            or source.name
        ),
    }
    args: list[str] = []
    for configured in configured_args:
        value = configured
        for key, replacement in replacements.items():
            value = value.replace(f"{{{key}}}", replacement)
        args.append(value)
    return args


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
