"""Blender headless worker adapter."""

from __future__ import annotations

import os
import subprocess

from .adapter_requirements import blocked, missing_binary
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file


def blender_headless_convert(job: ConversionJob) -> WorkerResult:
    """Convert a Blender-supported scene/model to GLB with the Blender Python API."""

    validate_job(job)
    source, source_blocked = require_source_file(
        job,
        adapter="blender",
        install_hint="Mount a Blender-supported source file into the worker and pass sourcePath in the job input.",
    )
    if source_blocked:
        return source_blocked
    if source.suffix.lower() in {".obj", ".fbx"}:
        return blocked(
            job,
            adapter="blender",
            reason="OBJ/FBX are abandoned legacy source formats in the PanAEC Engine route.",
            install_hint="Normalize upstream to OpenUSD/USDZ/3D Tiles first, or use glTF/GLB only as an audited fallback.",
        )

    blender_binary = os.getenv("BLENDER_BINARY", "blender")
    if unavailable := missing_binary(
        job,
        adapter="blender",
        binary=blender_binary,
        install_hint="Install Blender in the worker image or set BLENDER_BINARY to the headless executable.",
    ):
        return unavailable

    out_dir = output_dir(job)
    target = out_dir / f"{source.stem}.glb"
    script = out_dir / "blender_convert.py"
    script.write_text(_blender_script(str(source), str(target)), encoding="utf-8")
    completed = subprocess.run(
        [blender_binary, "--background", "--python", str(script)],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 600)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "blender_conversion_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"engine": "blender", "sourcePath": str(source)},
        )
    artifact = artifact_for_path(
        target,
        job=job,
        media_type="model/gltf-binary",
        role="scene_glb",
        metadata={"engine": "blender", "sourcePath": str(source)},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"engine": "blender", "converted": True, "targetPath": str(target)},
    )


def _blender_script(source: str, target: str) -> str:
    return f"""
import bpy
from pathlib import Path

source = Path({source!r})
target = {target!r}

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

suffix = source.suffix.lower()
if suffix == ".blend":
    bpy.ops.wm.open_mainfile(filepath=str(source))
elif suffix in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=str(source))
elif suffix == ".stl":
    bpy.ops.wm.stl_import(filepath=str(source))
elif suffix == ".dae":
    bpy.ops.wm.collada_import(filepath=str(source))
elif suffix in (".usd", ".usda", ".usdc", ".usdz"):
    bpy.ops.wm.usd_import(filepath=str(source))
else:
    raise ValueError(f"unsupported Blender source format: {{suffix}}")

bpy.ops.export_scene.gltf(filepath=target, export_format="GLB")
"""
