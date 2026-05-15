"""ForgeCAD adapter.

ForgeCAD runs as an isolated service or external CLI process. The worker does
not embed ForgeCAD app code into ArchIToken core, and completed jobs must return
real generated artifact bytes, not only a manifest.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, input_string, output_dir, require_source_file, source_path, write_json_artifact


def forgecad_generate(job: ConversionJob) -> WorkerResult:
    """Generate CAD through ForgeCAD service or CLI and persist real artifacts."""

    validate_job(job)

    script_path, script_artifact, script_blocked = _prepare_script(job)
    binary = shutil.which(str(job.input.get("forgecadBinary", "")).strip()) if job.input.get("forgecadBinary") else None
    binary = binary or shutil.which("forgecad")
    prefer_service = bool(str(job.input.get("preferForgecadService", "")).lower() in {"1", "true", "yes"})
    if binary and script_path and not prefer_service:
        return _forgecad_cli_generate(job, binary, script_path, script_artifact)
    if os.getenv("FORGECAD_URL", "").strip():
        return _forgecad_service_generate(job)
    if script_blocked:
        return script_blocked
    return blocked(
        job,
        adapter="forgecad",
        reason="missing ForgeCAD runtime: configure FORGECAD_URL or install the forgecad CLI",
        install_hint="Set FORGECAD_URL for the isolated service or install npm package forgecad in the worker image.",
    )


def _forgecad_service_generate(job: ConversionJob) -> WorkerResult:
    """Route Text-to-CAD to a configured ForgeCAD service and persist returned bytes."""

    base_url = os.environ["FORGECAD_URL"].rstrip("/")
    payload = {
        "jobId": job.job_id,
        "tenantId": job.tenant_id,
        "projectId": job.project_id,
        "actor": job.actor,
        "prompt": job.input.get("prompt"),
        "forgecadScript": job.input.get("forgecadScript") or job.input.get("forgeScript"),
        "cadSpec": job.input.get("cadSpec") or job.input.get("spec"),
        "outputFormats": job.input.get("outputFormats", ["step"]),
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    token = os.getenv("FORGECAD_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"{base_url}/v1/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 120))) as response:
        service_response = json.loads(response.read().decode("utf-8"))
    artifacts = _artifacts_from_service_response(job, service_response)
    artifact = write_json_artifact(
        job,
        "forgecad_generation_manifest.json",
        {"request": payload, "response": service_response},
        role="forgecad_generation_manifest",
        metadata={"adapter": "forgecad"},
    )
    if not artifacts:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            artifacts=(artifact,),
            output={"adapter": "forgecad", "mode": "service", "response": service_response},
            error={
                "code": "forgecad_service_missing_artifacts",
                "message": "ForgeCAD service response did not include generated artifact bytes.",
            },
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple([*artifacts, artifact]),
        output={"adapter": "forgecad", "mode": "service", "response": service_response, "artifactCount": len(artifacts) + 1},
    )


def _forgecad_cli_generate(
    job: ConversionJob,
    binary: str,
    script_path: Path,
    script_artifact: WorkerArtifact | None,
) -> WorkerResult:
    """Run the local ForgeCAD CLI in the worker container."""

    out_dir = output_dir(job)
    timeout_seconds = int(job.input.get("timeoutSeconds", 300))
    validation = subprocess.run(
        [binary, "run", str(script_path)],
        cwd=out_dir,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    run_log = write_json_artifact(
        job,
        "forgecad_cli_run.json",
        {
            "command": [binary, "run", str(script_path)],
            "returnCode": validation.returncode,
            "stdout": validation.stdout[-8000:],
            "stderr": validation.stderr[-8000:],
        },
        role="forgecad_cli_log",
        metadata={"adapter": "forgecad", "mode": "cli"},
    )
    if validation.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            artifacts=tuple(artifact for artifact in (script_artifact, run_log) if artifact),
            output={"adapter": "forgecad", "mode": "cli", "scriptPath": str(script_path)},
            error={"code": "forgecad_run_failed", "message": validation.stderr[-4000:] or validation.stdout[-4000:]},
        )

    artifacts: list[WorkerArtifact] = [artifact for artifact in (script_artifact, run_log) if artifact]
    export_formats = _output_formats(job)
    for output_format in export_formats:
        before = _file_snapshot(out_dir)
        command = _forgecad_export_command(binary, output_format, script_path)
        completed = subprocess.run(
            command,
            cwd=out_dir,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        log = write_json_artifact(
            job,
            f"forgecad_{output_format}_export.json",
            {
                "command": command,
                "returnCode": completed.returncode,
                "stdout": completed.stdout[-8000:],
                "stderr": completed.stderr[-8000:],
            },
            role="forgecad_cli_log",
            metadata={"adapter": "forgecad", "mode": "cli", "format": output_format},
        )
        artifacts.append(log)
        if completed.returncode != 0:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                artifacts=tuple(artifacts),
                output={"adapter": "forgecad", "mode": "cli", "scriptPath": str(script_path), "format": output_format},
                error={
                    "code": "forgecad_export_failed",
                    "message": completed.stderr[-4000:] or completed.stdout[-4000:],
                },
            )
        exported = _new_exported_files(out_dir, before, output_format)
        if not exported:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                artifacts=tuple(artifacts),
                output={"adapter": "forgecad", "mode": "cli", "scriptPath": str(script_path), "format": output_format},
                error={
                    "code": "forgecad_export_missing_output",
                    "message": f"ForgeCAD export command completed without producing a .{output_format} artifact.",
                },
            )
        for path in exported:
            artifacts.append(
                artifact_for_path(
                    path,
                    job=job,
                    media_type=_media_type(path.suffix.lower().lstrip(".")),
                    role="cad_geometry" if path.suffix.lower() in {".step", ".stp", ".brep"} else "cad_derivative",
                    metadata={"adapter": "forgecad", "mode": "cli", "format": output_format},
                )
            )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "adapter": "forgecad",
            "mode": "cli",
            "scriptPath": str(script_path),
            "formats": export_formats,
            "artifactCount": len(artifacts),
        },
    )


def _prepare_script(job: ConversionJob) -> tuple[Path | None, WorkerArtifact | None, WorkerResult | None]:
    """Return a ForgeCAD script path from source bytes, inline script, or structured CAD spec."""

    out_dir = output_dir(job)
    inline_script = input_string(job, "forgecadScript", "forgeScript")
    if inline_script:
        script_path = out_dir / str(job.input.get("name", "architoken_model.forge.js"))
        if script_path.suffix not in {".js", ".ts"}:
            script_path = script_path.with_suffix(".forge.js")
        script_path.write_text(inline_script, encoding="utf-8")
        return script_path, _script_artifact(job, script_path), None

    cad_spec = job.input.get("cadSpec") or job.input.get("spec")
    if isinstance(cad_spec, dict):
        script_path = out_dir / f"{str(job.input.get('name', 'architoken_model')).strip() or 'architoken_model'}.forge.js"
        script_path.write_text(_script_for_cad_spec(cad_spec), encoding="utf-8")
        return script_path, _script_artifact(job, script_path), None

    path = source_path(job)
    if path is not None or input_string(job, "sourceObjectKey", "source_object_key"):
        source, blocked_result = require_source_file(
            job,
            adapter="forgecad",
            install_hint="Mount a .forge.js/.forge.ts source file or pass sourceObjectKey for ForgeCAD CLI execution.",
        )
        if blocked_result:
            return None, None, blocked_result
        if source and source.suffix.lower() in {".js", ".ts"} and ".forge" in source.name:
            local_script = out_dir / source.name
            if source.resolve() != local_script.resolve():
                local_script.write_bytes(source.read_bytes())
            return local_script, _script_artifact(job, local_script), None
        return None, None, blocked(
            job,
            adapter="forgecad",
            reason=f"source is not a ForgeCAD script: {source}",
            install_hint="Use a .forge.js/.forge.ts source or provide cadSpec/forgecadScript.",
        )
    return None, None, None


def _script_artifact(job: ConversionJob, script_path: Path) -> WorkerArtifact:
    return artifact_for_path(
        script_path,
        job=job,
        media_type="application/javascript",
        role="forgecad_source_script",
        metadata={"adapter": "forgecad", "mode": "cli"},
    )


def _script_for_cad_spec(cad_spec: dict[str, Any]) -> str:
    shape = str(cad_spec.get("shape", "box")).lower().strip()
    dimensions = cad_spec.get("dimensions", {})
    if not isinstance(dimensions, dict):
        raise ValueError("cadSpec.dimensions must be an object")
    if shape == "box":
        length = _dimension(dimensions, "length", 100.0)
        width = _dimension(dimensions, "width", 100.0)
        height = _dimension(dimensions, "height", 100.0)
        return f"return {{ model: box({length}, {width}, {height}).color('#4f7bbf') }};\n"
    if shape == "cylinder":
        radius = _dimension(dimensions, "radius", 25.0)
        height = _dimension(dimensions, "height", 100.0)
        return f"return {{ model: cylinder({height}, {radius}).color('#4f7bbf') }};\n"
    if shape == "plate_with_holes":
        length = _dimension(dimensions, "length", 200.0)
        width = _dimension(dimensions, "width", 100.0)
        thickness = _dimension(dimensions, "thickness", 10.0)
        hole_radius = _dimension(dimensions, "holeRadius", 6.0)
        inset = _dimension(dimensions, "inset", 20.0)
        return (
            f"const base = box({length}, {width}, {thickness}).color('#4f7bbf');\n"
            f"const hole = cylinder({thickness * 3}, {hole_radius});\n"
            "return {\n"
            f"  model: base.subtract(hole.translate({-length / 2 + inset}, {-width / 2 + inset}, {-thickness}))\n"
            f"    .subtract(hole.translate({length / 2 - inset}, {width / 2 - inset}, {-thickness}))\n"
            "};\n"
        )
    raise ValueError(f"unsupported ForgeCAD cadSpec.shape: {shape}")


def _dimension(dimensions: dict[str, Any], name: str, default: float) -> float:
    value = dimensions.get(name, default)
    if not isinstance(value, int | float):
        raise ValueError(f"cadSpec.dimensions.{name} must be numeric")
    if value <= 0:
        raise ValueError(f"cadSpec.dimensions.{name} must be positive")
    return float(value)


def _output_formats(job: ConversionJob) -> list[str]:
    raw = job.input.get("outputFormats", ["step"])
    if not isinstance(raw, list) or not all(isinstance(value, str) for value in raw):
        raise ValueError("job.input.outputFormats must be a list of strings")
    formats = [value.lower().lstrip(".") for value in raw if value.strip()]
    return formats or ["step"]


def _forgecad_export_command(binary: str, output_format: str, script_path: Path) -> list[str]:
    if output_format in {"png", "render", "3d"}:
        return [binary, "render", "3d", str(script_path)]
    if output_format == "inspect":
        return [binary, "render", "inspect", str(script_path)]
    return [binary, "export", output_format, str(script_path)]


def _file_snapshot(path: Path) -> set[Path]:
    return {item.resolve() for item in path.rglob("*") if item.is_file()}


def _new_exported_files(path: Path, before: set[Path], output_format: str) -> list[Path]:
    suffixes = _suffixes_for_format(output_format)
    return [
        item
        for item in sorted(path.rglob("*"))
        if item.is_file() and item.resolve() not in before and item.suffix.lower() in suffixes
    ]


def _suffixes_for_format(output_format: str) -> set[str]:
    return {
        "step": {".step", ".stp"},
        "stp": {".step", ".stp"},
        "stl": {".stl"},
        "brep": {".brep"},
        "png": {".png"},
        "render": {".png"},
        "3d": {".png"},
        "inspect": {".png", ".json"},
    }.get(output_format, {f".{output_format}"})


def _artifacts_from_service_response(job: ConversionJob, service_response: dict[str, Any]) -> list[WorkerArtifact]:
    raw_artifacts = service_response.get("artifacts") or service_response.get("files") or []
    if isinstance(service_response.get("contentBase64"), str):
        raw_artifacts = [
            {
                "name": service_response.get("name") or "forgecad_model.step",
                "mediaType": service_response.get("mediaType") or "model/step",
                "contentBase64": service_response["contentBase64"],
            }
        ]
    if not isinstance(raw_artifacts, list):
        raise ValueError("ForgeCAD service response artifacts/files must be a list")
    artifacts: list[WorkerArtifact] = []
    out_dir = output_dir(job)
    for index, artifact in enumerate(raw_artifacts):
        if not isinstance(artifact, dict) or not isinstance(artifact.get("contentBase64"), str):
            continue
        name = str(artifact.get("name") or f"forgecad_artifact_{index}.bin")
        media_type = str(artifact.get("mediaType") or artifact.get("contentType") or "application/octet-stream")
        target = out_dir / Path(name).name
        target.write_bytes(base64.b64decode(artifact["contentBase64"]))
        artifacts.append(
            artifact_for_path(
                target,
                job=job,
                media_type=media_type,
                role=str(artifact.get("role") or "cad_geometry"),
                metadata={"adapter": "forgecad", "mode": "service"},
            )
        )
    return artifacts


def _media_type(output_format: str) -> str:
    return {
        "step": "model/step",
        "stp": "model/step",
        "stl": "model/stl",
        "brep": "model/brep",
        "png": "image/png",
        "json": "application/json",
    }.get(output_format, "application/octet-stream")
