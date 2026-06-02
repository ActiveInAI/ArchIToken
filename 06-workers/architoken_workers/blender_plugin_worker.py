"""Blender add-on and extension worker adapter.

The adapter keeps Blender and all add-on code in an external process boundary.
Static audit is always allowed. Runtime execution requires an explicit job flag
and runs with job-scoped Blender user directories so plug-ins cannot mutate the
worker host profile.
"""

from __future__ import annotations

import ast
import json
import os
import subprocess
import tomllib
import zipfile
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked, missing_binary, resolve_binary, source_build_runtime_env
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, input_string, output_dir, source_path, write_json_artifact

PLUGIN_AUDIT_SCHEMA = "architoken.blender_plugin_audit.v1"
PLUGIN_RUN_SCHEMA = "architoken.blender_plugin_run.v1"

_RISK_IMPORTS = {
    "ctypes",
    "ftplib",
    "http",
    "multiprocessing",
    "os",
    "pathlib",
    "requests",
    "shutil",
    "socket",
    "subprocess",
    "sys",
    "urllib",
}
_RISK_CALLS = {
    "eval",
    "exec",
    "open",
    "compile",
    "__import__",
    "os.system",
    "os.popen",
    "subprocess.Popen",
    "subprocess.call",
    "subprocess.run",
    "shutil.rmtree",
}


def audit_blender_plugin(job: ConversionJob) -> WorkerResult:
    """Inspect a Blender add-on/extension package without executing it."""

    validate_job(job)
    source, source_blocked = _require_plugin_source(job)
    if source_blocked:
        return source_blocked
    assert source is not None

    audit = inspect_blender_plugin_source(source)
    artifact = write_json_artifact(
        job,
        "blender_plugin_audit.json",
        audit,
        role="blender_plugin_audit",
        metadata={"schema": PLUGIN_AUDIT_SCHEMA, "adapter": "blender_plugin"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "adapter": "blender_plugin",
            "schema": PLUGIN_AUDIT_SCHEMA,
            "sourcePath": str(source),
            "pluginId": audit["plugin"].get("id"),
            "sourceKind": audit["source"]["kind"],
            "executionAllowed": False,
            "riskCount": len(audit["risks"]),
        },
    )


def run_blender_plugin(job: ConversionJob) -> WorkerResult:
    """Install and optionally run a Blender add-on/extension in a job profile."""

    validate_job(job)
    if not bool(job.input.get("allowPluginExecution")):
        return blocked(
            job,
            adapter="blender_plugin",
            reason="Blender plug-in execution requires allowPluginExecution=true on the worker job.",
            install_hint="Run blender_plugin_audit first, then approve execution through the module workflow gate.",
        )

    source, source_blocked = _require_plugin_source(job)
    if source_blocked:
        return source_blocked
    assert source is not None

    blender_binary = os.getenv("BLENDER_BINARY", "blender")
    if unavailable := missing_binary(
        job,
        adapter="blender_plugin",
        binary=blender_binary,
        install_hint="Install Blender in the worker image or set BLENDER_BINARY to the headless executable.",
    ):
        return unavailable

    resolved_blender = resolve_binary(blender_binary) or blender_binary
    out_dir = output_dir(job)
    run_dir = out_dir / "blender_runtime"
    user_resources = run_dir / "user_resources"
    user_scripts = run_dir / "user_scripts"
    user_extensions = run_dir / "user_extensions"
    for directory in (user_resources, user_scripts, user_extensions):
        directory.mkdir(parents=True, exist_ok=True)

    audit = inspect_blender_plugin_source(source)
    module_names = _module_names(job, source, audit)
    operator_id = input_string(job, "operatorId", "operator_id")
    operator_props = job.input.get("operatorProps", job.input.get("operator_props", {}))
    if not isinstance(operator_props, dict):
        return blocked(
            job,
            adapter="blender_plugin",
            reason="operatorProps must be a JSON object when provided.",
            install_hint="Pass operatorProps as an object or omit it.",
        )

    status_path = out_dir / "blender_plugin_run.json"
    script = out_dir / "blender_plugin_runner.py"
    script.write_text(
        _runner_script(
            source=str(source),
            output_dir=str(out_dir),
            status_path=str(status_path),
            user_scripts=str(user_scripts),
            module_names=module_names,
            operator_id=operator_id,
            operator_props=operator_props,
            output_formats=_output_formats(job),
        ),
        encoding="utf-8",
    )
    env = source_build_runtime_env()
    env.update(
        {
            "BLENDER_USER_RESOURCES": str(user_resources),
            "BLENDER_USER_CONFIG": str(user_resources / "config"),
            "BLENDER_USER_SCRIPTS": str(user_scripts),
            "BLENDER_USER_EXTENSIONS": str(user_extensions),
            "PYTHONNOUSERSITE": "1",
        }
    )
    completed = subprocess.run(
        [
            resolved_blender,
            "--background",
            "--factory-startup",
            "--disable-autoexec",
            "--python-exit-code",
            "72",
            "--python",
            str(script),
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 900)),
        env=env,
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={
                "adapter": "blender_plugin",
                "schema": PLUGIN_RUN_SCHEMA,
                "sourcePath": str(source),
                "moduleNames": module_names,
            },
            error={
                "code": "blender_plugin_run_failed",
                "message": completed.stderr[-4000:] or completed.stdout[-4000:],
            },
        )

    artifacts: list[WorkerArtifact] = []
    if status_path.exists():
        artifacts.append(
            artifact_for_path(
                status_path,
                job=job,
                media_type="application/json",
                role="blender_plugin_run_manifest",
                metadata={"schema": PLUGIN_RUN_SCHEMA, "adapter": "blender_plugin"},
            )
        )
    for path in sorted(out_dir.glob("blender_plugin_output.*")):
        if path == status_path:
            continue
        artifacts.append(_scene_artifact(job, path))
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "adapter": "blender_plugin",
            "schema": PLUGIN_RUN_SCHEMA,
            "sourcePath": str(source),
            "moduleNames": module_names,
            "operatorId": operator_id,
            "outputFormats": _output_formats(job),
            "runtimeProfile": str(user_resources),
        },
    )


def inspect_blender_plugin_source(source: Path) -> dict[str, Any]:
    """Return a JSON-safe audit payload for a Blender plug-in source."""

    files = _read_plugin_files(source)
    manifest = _first_toml(files)
    py_files = {name: content for name, content in files.items() if name.endswith(".py")}
    bl_infos = [_parse_bl_info(name, content) for name, content in py_files.items()]
    bl_infos = [info for info in bl_infos if info]
    entrypoints = [_entrypoint_for_file(name, content) for name, content in py_files.items()]
    entrypoints = [entry for entry in entrypoints if entry["register"] or entry["unregister"]]
    risks = sorted({risk for name, content in py_files.items() for risk in _scan_python_risks(name, content)})

    plugin = {
        "id": _plugin_value(manifest, bl_infos, "id") or _plugin_value(manifest, bl_infos, "name"),
        "name": _plugin_value(manifest, bl_infos, "name"),
        "version": _version_value(_plugin_value(manifest, bl_infos, "version")),
        "type": manifest.get("type") or "add-on",
        "license": manifest.get("license") or _plugin_value(manifest, bl_infos, "license"),
        "blenderVersionMin": manifest.get("blender_version_min") or _plugin_value(manifest, bl_infos, "blender"),
        "blenderVersionMax": manifest.get("blender_version_max"),
        "website": manifest.get("website") or _plugin_value(manifest, bl_infos, "doc_url"),
        "permissions": manifest.get("permissions", {}),
        "tags": manifest.get("tags", []),
        "pythonFileCount": len(py_files),
    }
    return {
        "schema": PLUGIN_AUDIT_SCHEMA,
        "source": {
            "path": str(source),
            "kind": _source_kind(source),
            "fileCount": len(files),
            "pythonFiles": sorted(py_files)[:200],
            "hasBlenderManifest": bool(manifest),
            "hasLegacyBlInfo": bool(bl_infos),
        },
        "plugin": plugin,
        "entrypoints": entrypoints,
        "risks": risks,
        "policy": {
            "executionBoundary": "external_process",
            "coreEmbeddingAllowed": False,
            "requiresManualLicenseReview": not bool(plugin.get("license")),
            "requiresHumanApprovalBeforeExecution": True,
        },
    }


def _require_plugin_source(job: ConversionJob) -> tuple[Path | None, WorkerResult | None]:
    path = source_path(job)
    if path is None:
        return None, blocked(
            job,
            adapter="blender_plugin",
            reason="missing worker input: sourcePath",
            install_hint="Pass a Blender add-on .py, extension .zip, or source directory as sourcePath.",
        )
    if not path.exists():
        return None, blocked(
            job,
            adapter="blender_plugin",
            reason=f"sourcePath does not exist: {path}",
            install_hint="Mount the plugin package or source directory into the worker.",
        )
    if path.is_file() and path.suffix.lower() not in {".py", ".zip"}:
        return None, blocked(
            job,
            adapter="blender_plugin",
            reason=f"unsupported Blender plugin source file: {path.suffix}",
            install_hint="Use a .py add-on file, a .zip extension package, or a source directory.",
        )
    return path, None


def _read_plugin_files(source: Path) -> dict[str, str]:
    if source.is_dir():
        return _read_directory_files(source)
    if source.suffix.lower() == ".zip":
        return _read_zip_files(source)
    return {source.name: source.read_text(encoding="utf-8", errors="replace")}


def _read_directory_files(source: Path) -> dict[str, str]:
    files: dict[str, str] = {}
    for path in sorted(source.rglob("*")):
        if len(files) >= 512:
            break
        if not path.is_file() or path.stat().st_size > 512 * 1024:
            continue
        rel = path.relative_to(source).as_posix()
        if _text_candidate(rel):
            files[rel] = path.read_text(encoding="utf-8", errors="replace")
    return files


def _read_zip_files(source: Path) -> dict[str, str]:
    files: dict[str, str] = {}
    with zipfile.ZipFile(source) as package:
        for info in sorted(package.infolist(), key=lambda item: item.filename):
            if len(files) >= 512:
                break
            if info.is_dir() or info.file_size > 512 * 1024:
                continue
            name = info.filename
            if not _text_candidate(name):
                continue
            files[name] = package.read(info).decode("utf-8", errors="replace")
    return files


def _text_candidate(name: str) -> bool:
    suffix = Path(name).suffix.lower()
    return suffix in {".py", ".toml", ".json", ".txt", ".md", ".xml"}


def _first_toml(files: dict[str, str]) -> dict[str, Any]:
    for name, content in files.items():
        if Path(name).name != "blender_manifest.toml":
            continue
        try:
            data = tomllib.loads(content)
            return data if isinstance(data, dict) else {}
        except tomllib.TOMLDecodeError:
            return {"_parse_error": "invalid blender_manifest.toml"}
    return {}


def _parse_bl_info(name: str, content: str) -> dict[str, Any]:
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return {}
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        if not any(isinstance(target, ast.Name) and target.id == "bl_info" for target in node.targets):
            continue
        try:
            value = ast.literal_eval(node.value)
        except Exception:
            return {"_source": name, "_parse_error": "bl_info is not a literal"}
        if isinstance(value, dict):
            value["_source"] = name
            return value
    return {}


def _entrypoint_for_file(name: str, content: str) -> dict[str, Any]:
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return {"file": name, "register": False, "unregister": False, "operators": []}
    functions = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
    operators = []
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name) and target.id == "bl_idname":
                            try:
                                operators.append(ast.literal_eval(item.value))
                            except Exception:
                                pass
    return {
        "file": name,
        "register": "register" in functions,
        "unregister": "unregister" in functions,
        "operators": sorted(str(operator) for operator in operators),
    }


def _scan_python_risks(name: str, content: str) -> set[str]:
    risks: set[str] = set()
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return {f"{name}:syntax_error"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root in _RISK_IMPORTS:
                    risks.add(f"{name}:import:{root}")
        elif isinstance(node, ast.ImportFrom) and node.module:
            root = node.module.split(".", 1)[0]
            if root in _RISK_IMPORTS:
                risks.add(f"{name}:import:{root}")
        elif isinstance(node, ast.Call):
            call_name = _call_name(node.func)
            if call_name in _RISK_CALLS:
                risks.add(f"{name}:call:{call_name}")
    return risks


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _call_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return ""


def _plugin_value(manifest: dict[str, Any], bl_infos: list[dict[str, Any]], key: str) -> Any:
    if key in manifest:
        return manifest[key]
    for info in bl_infos:
        if key in info:
            return info[key]
    return None


def _version_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        return ".".join(str(part) for part in value)
    return str(value)


def _source_kind(source: Path) -> str:
    if source.is_dir():
        return "directory"
    if source.suffix.lower() == ".zip":
        return "extension_zip"
    return "python_addon"


def _module_names(job: ConversionJob, source: Path, audit: dict[str, Any]) -> list[str]:
    explicit = job.input.get("addonModules", job.input.get("addon_modules"))
    if isinstance(explicit, str) and explicit.strip():
        return [item.strip() for item in explicit.split(",") if item.strip()]
    if isinstance(explicit, list):
        return [str(item).strip() for item in explicit if str(item).strip()]
    plugin_id = audit["plugin"].get("id")
    if isinstance(plugin_id, str) and plugin_id.strip() and source.suffix.lower() == ".zip":
        return [plugin_id.strip()]
    return [source.stem if source.is_file() else source.name]


def _output_formats(job: ConversionJob) -> list[str]:
    formats = job.input.get("outputFormats", job.input.get("output_formats", ["blend"]))
    if isinstance(formats, str):
        formats = [formats]
    if not isinstance(formats, list):
        formats = ["blend"]
    allowed = {"blend", "glb", "gltf", "usd", "usda", "usdc"}
    return [str(item).lower() for item in formats if str(item).lower() in allowed] or ["blend"]


def _scene_artifact(job: ConversionJob, path: Path) -> WorkerArtifact:
    suffix = path.suffix.lower()
    media_type = {
        ".blend": "application/x-blender",
        ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json",
        ".usd": "model/vnd.usd",
        ".usda": "model/vnd.usd",
        ".usdc": "model/vnd.usd",
    }.get(suffix, "application/octet-stream")
    return artifact_for_path(
        path,
        job=job,
        media_type=media_type,
        role="blender_plugin_scene_artifact",
        metadata={"schema": PLUGIN_RUN_SCHEMA, "adapter": "blender_plugin"},
    )


def _runner_script(
    *,
    source: str,
    output_dir: str,
    status_path: str,
    user_scripts: str,
    module_names: list[str],
    operator_id: str | None,
    operator_props: dict[str, Any],
    output_formats: list[str],
) -> str:
    return f"""
import json
import shutil
import sys
from pathlib import Path

import bpy

source = Path({source!r})
output_dir = Path({output_dir!r})
status_path = Path({status_path!r})
user_scripts = Path({user_scripts!r})
module_names = {module_names!r}
operator_id = {operator_id!r}
operator_props = {json.dumps(operator_props, sort_keys=True)!r}
output_formats = {output_formats!r}

addons_dir = user_scripts / "addons"
addons_dir.mkdir(parents=True, exist_ok=True)

if source.is_dir():
    target = addons_dir / source.name
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
elif source.suffix.lower() == ".py":
    shutil.copy2(source, addons_dir / source.name)
elif source.suffix.lower() == ".zip":
    if hasattr(bpy.ops, "extensions") and hasattr(bpy.ops.extensions, "package_install_files"):
        try:
            bpy.ops.extensions.package_install_files(filepath=str(source), enable_on_install=True, overwrite=True)
        except Exception:
            bpy.ops.preferences.addon_install(filepath=str(source), overwrite=True)
    else:
        bpy.ops.preferences.addon_install(filepath=str(source), overwrite=True)
else:
    raise RuntimeError(f"unsupported plugin source: {{source}}")

bpy.ops.preferences.addon_refresh()
enabled = []
enable_errors = {{}}
for module_name in module_names:
    try:
        bpy.ops.preferences.addon_enable(module=module_name)
        enabled.append(module_name)
    except Exception as exc:
        enable_errors[module_name] = str(exc)

operator_result = None
if operator_id:
    namespace, name = operator_id.split(".", 1)
    operator = getattr(getattr(bpy.ops, namespace), name)
    operator_result = sorted(str(item) for item in operator(**json.loads(operator_props)))

artifacts = []
for fmt in output_formats:
    target = output_dir / f"blender_plugin_output.{{fmt}}"
    if fmt == "blend":
        bpy.ops.wm.save_as_mainfile(filepath=str(target))
    elif fmt in ("glb", "gltf"):
        bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB" if fmt == "glb" else "GLTF_SEPARATE")
    elif fmt in ("usd", "usda", "usdc"):
        bpy.ops.wm.usd_export(filepath=str(target))
    if target.exists():
        artifacts.append(str(target))

status_path.write_text(json.dumps({{
    "schema": {PLUGIN_RUN_SCHEMA!r},
    "enabledModules": enabled,
    "enableErrors": enable_errors,
    "operatorId": operator_id,
    "operatorResult": operator_result,
    "artifacts": artifacts,
}}, indent=2, sort_keys=True), encoding="utf-8")
"""
