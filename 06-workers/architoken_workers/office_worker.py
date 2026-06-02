"""Backend-native Office worker adapter."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked, missing_binary, resolve_binary, source_build_runtime_env
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, input_string, output_dir, require_source_file, source_path, write_json_artifact

OFFICECLI_OUTPUT_EXTENSIONS = {".docx", ".xlsx", ".pptx"}
OFFICECLI_PREVIEW_FORMATS = {"outline", "html", "screenshot", "png"}


def libreoffice_convert(job: ConversionJob) -> WorkerResult:
    """Bind Office sources first and only export derivatives on explicit request."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="libreoffice",
        binary="libreoffice",
        install_hint="Install LibreOffice in the worker image for real DOC/DOCX/XLS/XLSX/PPT conversion.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="libreoffice",
        install_hint="Mount an Office source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    manifest = write_json_artifact(
        job,
        "office_native_manifest.json",
        {
            "sourceAssetId": job.source_asset_id,
            "sourceFileId": job.source_file_id,
            "sourcePath": str(source),
            "engine": "libreoffice_headless",
            "nativeSourceBound": True,
            "substitutePreview": False,
            "viewContract": "backend_native_office_manifest",
            "exportPolicy": "explicit_output_formats_only",
        },
        role="office_native_manifest",
        metadata={
            "engine": "libreoffice_headless",
            "sourcePath": str(source),
            "nativeSourceBound": True,
            "substitutePreview": False,
        },
    )
    formats = job.input.get("outputFormats", [])
    out_dir = output_dir(job)
    artifacts: list[WorkerArtifact] = [manifest]
    if not formats:
        return WorkerResult(
            job_id=job.job_id,
            status="completed",
            artifacts=tuple(artifacts),
            output={
                "engine": "libreoffice_headless",
                "converted": False,
                "nativeSourceBound": True,
                "substitutePreview": False,
                "artifactCount": len(artifacts),
            },
        )
    for output_format in formats:
        suffix = str(output_format).lower().lstrip(".")
        completed = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", suffix, "--outdir", str(out_dir), str(source)],
            check=False,
            capture_output=True,
            text=True,
            timeout=int(job.input.get("timeoutSeconds", 300)),
        )
        if completed.returncode != 0:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={"code": "libreoffice_conversion_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
                output={"engine": "libreoffice_headless", "sourcePath": str(source), "format": suffix},
            )
        target = out_dir / f"{source.stem}.{suffix}"
        if not target.exists():
            matches = list(out_dir.glob(f"{source.stem}.*"))
            target = max(matches, key=lambda path: path.stat().st_mtime) if matches else target
        artifacts.append(
            artifact_for_path(
                target,
                job=job,
                media_type=_media_type(suffix),
                role="office_explicit_export",
                metadata={
                    "engine": "libreoffice_headless",
                    "sourcePath": str(source),
                    "format": suffix,
                    "substitutePreview": False,
                    "explicitExport": True,
                },
            )
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "engine": "libreoffice_headless",
            "converted": True,
            "nativeSourceBound": True,
            "substitutePreview": False,
            "artifactCount": len(artifacts),
        },
    )


def officecli_convert(job: ConversionJob) -> WorkerResult:
    """Generate, edit, and preview OOXML files through the OfficeCLI process boundary."""

    validate_job(job)
    binary = input_string(job, "officecliBinary", "officecli_binary") or os.getenv("OFFICECLI_BINARY", "officecli")
    resolved_binary = resolve_binary(binary)
    if not resolved_binary:
        return blocked(
            job,
            adapter="officecli",
            reason=f"missing executable: {binary}",
            install_hint=(
                "Install OfficeCLI as an isolated worker binary or set OFFICECLI_BINARY/officecliBinary. "
                "Do not install it into gateway business logic."
            ),
        )

    task = _officecli_task(job)
    source: Path | None = None
    if source_path(job) is not None or input_string(job, "sourceObjectKey", "source_object_key"):
        source, blocked_result = require_source_file(
            job,
            adapter="officecli",
            install_hint="Mount an Office source file or provide a structured officecliTask for generation.",
        )
        if blocked_result:
            return blocked_result
    if source is None and task is None:
        return blocked(
            job,
            adapter="officecli",
            reason="missing worker input: sourcePath or officecliTask",
            install_hint="Pass sourcePath for preview/extraction or officecliTask for structured DOCX/XLSX/PPTX generation.",
        )

    validation = _validate_officecli_task(task) if task is not None else {"status": "not_required", "checks": []}
    if validation["status"] != "validated":
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "officecli", "validation": validation},
            error={"code": "invalid_officecli_task", "message": "; ".join(validation["errors"])},
        )

    command_log: list[dict[str, Any]] = []
    target = source
    artifacts: list[WorkerArtifact] = []
    if task is not None:
        target = _target_path(job, task, source)
        if source is not None and source != target:
            shutil.copy2(source, target)
        elif source is None and task.get("create", True) is not False:
            failed = _run_officecli(
                job,
                resolved_binary,
                ["create", str(target)],
                command_log,
                purpose="create",
            )
            if failed:
                return failed
        for command in task.get("commands", []):
            args = _officecli_command_args(command, target)
            failed = _run_officecli(job, resolved_binary, args, command_log, purpose=str(command.get("verb", "command")))
            if failed:
                return failed
        if target.is_file():
            artifacts.append(
                artifact_for_path(
                    target,
                    job=job,
                    media_type=_media_type(target.suffix),
                    role="officecli_generated_office",
                    metadata={
                        "engine": "officecli",
                        "sourcePath": str(source) if source else None,
                        "nativeSourceBound": source is not None,
                        "structuredTask": True,
                    },
                )
            )

    assert target is not None
    for preview_format in _preview_formats(job, task):
        preview_result, preview_artifacts = _run_preview(job, resolved_binary, target, preview_format, command_log)
        if preview_result:
            return preview_result
        artifacts.extend(preview_artifacts)

    manifest = write_json_artifact(
        job,
        "officecli_manifest.json",
        {
            "sourceAssetId": job.source_asset_id,
            "sourceFileId": job.source_file_id,
            "sourcePath": str(source) if source else None,
            "targetPath": str(target),
            "engine": "officecli",
            "adapter": "officecli",
            "nativeSourceBound": source is not None,
            "structuredTask": task is not None,
            "substitutePreview": False,
            "schemaValidation": validation,
            "commandLog": command_log,
            "previewFormats": _preview_formats(job, task),
            "professionalReviewRequired": True,
            "approvalBoundary": "Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver",
        },
        role="officecli_manifest",
        metadata={
            "engine": "officecli",
            "sourcePath": str(source) if source else None,
            "targetPath": str(target),
            "nativeSourceBound": source is not None,
            "structuredTask": task is not None,
            "substitutePreview": False,
        },
    )
    artifacts.append(manifest)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "engine": "officecli",
            "adapter": "officecli",
            "targetPath": str(target),
            "nativeSourceBound": source is not None,
            "structuredTask": task is not None,
            "substitutePreview": False,
            "artifactCount": len(artifacts),
            "schemaValidation": validation,
            "professionalReviewRequired": True,
        },
    )


def _officecli_task(job: ConversionJob) -> dict[str, Any] | None:
    raw = job.input.get("officecliTask") or job.input.get("officeTask") or job.input.get("documentTask")
    return raw if isinstance(raw, dict) else None


def _validate_officecli_task(task: dict[str, Any] | None) -> dict[str, Any]:
    errors: list[str] = []
    if task is None:
        return {"status": "not_required", "checks": []}
    target_name = str(task.get("targetName") or task.get("artifactName") or task.get("fileName") or "").strip()
    if target_name:
        suffix = Path(target_name).suffix.lower()
        if suffix not in OFFICECLI_OUTPUT_EXTENSIONS:
            errors.append(f"targetName must end with one of {sorted(OFFICECLI_OUTPUT_EXTENSIONS)}")
    commands = task.get("commands", [])
    if not isinstance(commands, list):
        errors.append("commands must be a list")
        commands = []
    for index, command in enumerate(commands):
        if not isinstance(command, dict):
            errors.append(f"commands[{index}] must be an object")
            continue
        verb = str(command.get("verb", "")).strip()
        if verb not in {"add", "set", "remove"}:
            errors.append(f"commands[{index}].verb must be add, set, or remove")
        if verb in {"add", "set", "remove"} and not str(command.get("selector", "")).strip():
            errors.append(f"commands[{index}].selector is required")
        props = command.get("props", {})
        if props and not isinstance(props, dict):
            errors.append(f"commands[{index}].props must be an object")
    return {
        "status": "validated" if not errors else "failed",
        "checks": [
            "target extension is an OOXML Office format",
            "commands use the allowlisted OfficeCLI verb set",
            "commands are argv tokens, not shell strings",
        ],
        "errors": errors,
    }


def _target_path(job: ConversionJob, task: dict[str, Any], source: Path | None) -> Path:
    name = str(task.get("targetName") or task.get("artifactName") or task.get("fileName") or "").strip()
    if not name:
        suffix = source.suffix if source and source.suffix.lower() in OFFICECLI_OUTPUT_EXTENSIONS else ".pptx"
        name = f"officecli-output{suffix}"
    safe_name = Path(name).name
    if Path(safe_name).suffix.lower() not in OFFICECLI_OUTPUT_EXTENSIONS:
        safe_name = f"{Path(safe_name).stem or 'officecli-output'}.pptx"
    return output_dir(job) / safe_name


def _officecli_command_args(command: dict[str, Any], target: Path) -> list[str]:
    verb = str(command.get("verb", "")).strip()
    selector = str(command.get("selector", "")).strip()
    args = [verb, str(target), selector]
    if item_type := str(command.get("type", "")).strip():
        args.extend(["--type", item_type])
    props = command.get("props", {})
    if isinstance(props, dict):
        for key, value in sorted(props.items()):
            args.extend(["--prop", f"{_safe_arg(key)}={_safe_arg(value)}"])
    return args


def _safe_arg(value: Any) -> str:
    text = str(value)
    if "\x00" in text:
        raise ValueError("OfficeCLI command arguments must not contain NUL bytes")
    return text


def _preview_formats(job: ConversionJob, task: dict[str, Any] | None) -> list[str]:
    raw = job.input.get("previewFormats")
    if raw is None and task is not None:
        raw = task.get("previewFormats")
    if raw is None:
        raw = job.input.get("officecliViews")
    if raw is None:
        raw = []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    formats = []
    for item in raw:
        value = str(item).lower().strip().lstrip(".")
        if value in OFFICECLI_PREVIEW_FORMATS and value not in formats:
            formats.append("screenshot" if value == "png" else value)
    return formats


def _run_preview(
    job: ConversionJob,
    binary: str,
    target: Path,
    preview_format: str,
    command_log: list[dict[str, Any]],
) -> tuple[WorkerResult | None, list[WorkerArtifact]]:
    artifacts: list[WorkerArtifact] = []
    if preview_format == "outline":
        completed = _run_officecli_capture(job, binary, ["view", str(target), "outline"], command_log, purpose="view:outline")
        if isinstance(completed, WorkerResult):
            return completed, artifacts
        outline_path = output_dir(job) / f"{target.stem}.outline.txt"
        outline_path.write_text(completed.stdout, encoding="utf-8")
        artifacts.append(
            artifact_for_path(
                outline_path,
                job=job,
                media_type="text/plain",
                role="officecli_preview_outline",
                metadata={"engine": "officecli", "sourcePath": str(target), "previewFormat": "outline"},
            )
        )
        return None, artifacts
    if preview_format == "html":
        html_path = output_dir(job) / f"{target.stem}.html"
        failed = _run_officecli(job, binary, ["view", str(target), "html", "-o", str(html_path)], command_log, purpose="view:html")
        if failed:
            return failed, artifacts
        if html_path.is_file():
            artifacts.append(
                artifact_for_path(
                    html_path,
                    job=job,
                    media_type="text/html",
                    role="officecli_preview_html",
                    metadata={"engine": "officecli", "sourcePath": str(target), "previewFormat": "html"},
                )
            )
        return None, artifacts
    screenshot_dir = output_dir(job) / f"{target.stem}-screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    failed = _run_officecli(
        job,
        binary,
        ["view", str(target), "screenshot", "-o", str(screenshot_dir)],
        command_log,
        purpose="view:screenshot",
    )
    if failed:
        return failed, artifacts
    for path in sorted(screenshot_dir.glob("*.png")):
        artifacts.append(
            artifact_for_path(
                path,
                job=job,
                media_type="image/png",
                role="officecli_preview_screenshot",
                metadata={"engine": "officecli", "sourcePath": str(target), "previewFormat": "screenshot"},
            )
        )
    return None, artifacts


def _run_officecli(
    job: ConversionJob,
    binary: str,
    args: list[str],
    command_log: list[dict[str, Any]],
    *,
    purpose: str,
) -> WorkerResult | None:
    completed = _run_officecli_capture(job, binary, args, command_log, purpose=purpose)
    return completed if isinstance(completed, WorkerResult) else None


def _run_officecli_capture(
    job: ConversionJob,
    binary: str,
    args: list[str],
    command_log: list[dict[str, Any]],
    *,
    purpose: str,
) -> subprocess.CompletedProcess[str] | WorkerResult:
    env = source_build_runtime_env()
    env.setdefault("OFFICECLI_SKIP_UPDATE", "1")
    completed = subprocess.run(
        [binary, *args],
        check=False,
        capture_output=True,
        text=True,
        env=env,
        timeout=int(job.input.get("timeoutSeconds", 300)),
    )
    command_log.append(
        {
            "purpose": purpose,
            "argv": [Path(binary).name, *args],
            "returnCode": completed.returncode,
            "stdoutTail": completed.stdout[-1000:],
            "stderrTail": completed.stderr[-1000:],
        }
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"engine": "officecli", "adapter": "officecli", "purpose": purpose},
            error={"code": "officecli_command_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
        )
    return completed


def _media_type(output_format: str) -> str:
    key = output_format.lower().lstrip(".")
    return {
        "pdf": "application/pdf",
        "html": "text/html",
        "txt": "text/plain",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }.get(key, "application/octet-stream")
