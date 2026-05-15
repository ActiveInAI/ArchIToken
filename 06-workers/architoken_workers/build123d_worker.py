"""build123d parametric CAD generation worker adapter."""

from __future__ import annotations

from typing import Any

from .adapter_requirements import blocked, missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir


def build123d_generate(job: ConversionJob) -> WorkerResult:
    """Generate CAD derivatives with build123d from a structured primitive spec."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="build123d",
        import_name="build123d",
        install_hint="Install build123d in the worker image for real OpenCascade-backed CAD generation.",
    ):
        return unavailable
    spec, spec_error = _primitive_spec(job)
    if spec_error:
        return spec_error

    import build123d as bd
    from build123d import export_step, export_stl

    model = _build_model(bd, spec)
    out_dir = output_dir(job)
    stem = str(job.input.get("name", "build123d_model")).strip() or "build123d_model"
    formats = job.input.get("outputFormats", ["step", "stl"])
    if not isinstance(formats, list) or not all(isinstance(value, str) for value in formats):
        raise ValueError("job.input.outputFormats must be a list of strings")
    normalized_formats = {value.lower().lstrip(".") for value in formats}
    artifacts: list[WorkerArtifact] = []

    script_path = out_dir / f"{stem}.py"
    script_path.write_text(_script_for_spec(spec), encoding="utf-8")
    artifacts.append(
        artifact_for_path(
            script_path,
            job=job,
            media_type="text/x-python",
            role="source_script",
            metadata={"engine": "build123d", "spec": spec},
        )
    )

    if "step" in normalized_formats or "stp" in normalized_formats:
        step_path = out_dir / f"{stem}.step"
        export_step(model, str(step_path))
        artifacts.append(
            artifact_for_path(
                step_path,
                job=job,
                media_type="model/step",
                role="cad_geometry",
                metadata={"engine": "build123d", "format": "step"},
            )
        )
    if "stl" in normalized_formats:
        stl_path = out_dir / f"{stem}.stl"
        export_stl(model, str(stl_path))
        artifacts.append(
            artifact_for_path(
                stl_path,
                job=job,
                media_type="model/stl",
                role="cad_mesh",
                metadata={"engine": "build123d", "format": "stl"},
            )
        )

    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={"engine": "build123d", "generated": True, "spec": spec, "artifactCount": len(artifacts)},
    )


def _primitive_spec(job: ConversionJob) -> tuple[dict[str, Any] | None, WorkerResult | None]:
    raw = job.input.get("build123dSpec") or job.input.get("cadSpec") or job.input.get("spec")
    if raw is None:
        return None, blocked(
            job,
            adapter="build123d",
            reason="missing worker input: build123dSpec",
            install_hint="Pass a structured build123dSpec/cadSpec object; arbitrary user Python is not executed.",
        )
    if not isinstance(raw, dict):
        raise ValueError("build123d generation requires a structured build123dSpec object")
    shape = str(raw.get("shape", "")).lower().strip()
    if not shape:
        raise ValueError("build123dSpec.shape is required")
    units = str(raw.get("units", "mm"))
    dimensions = raw.get("dimensions", {})
    if not isinstance(dimensions, dict):
        raise ValueError("build123dSpec.dimensions must be an object")
    return {"shape": shape, "units": units, "dimensions": dimensions}, None


def _build_model(bd: Any, spec: dict[str, Any]) -> Any:
    shape = spec["shape"]
    dimensions = spec["dimensions"]
    with bd.BuildPart() as part:
        if shape == "box":
            bd.Box(
                _dimension(dimensions, "length", 100.0),
                _dimension(dimensions, "width", 100.0),
                _dimension(dimensions, "height", 100.0),
            )
        elif shape == "cylinder":
            bd.Cylinder(
                radius=_dimension(dimensions, "radius", 25.0),
                height=_dimension(dimensions, "height", 100.0),
            )
        elif shape == "plate_with_holes":
            length = _dimension(dimensions, "length", 200.0)
            width = _dimension(dimensions, "width", 100.0)
            thickness = _dimension(dimensions, "thickness", 10.0)
            hole_radius = _dimension(dimensions, "holeRadius", 6.0)
            inset = _dimension(dimensions, "inset", 20.0)
            bd.Box(length, width, thickness)
            with bd.Locations(
                (-length / 2 + inset, -width / 2 + inset, 0),
                (length / 2 - inset, width / 2 - inset, 0),
            ):
                bd.Cylinder(radius=hole_radius, height=thickness * 2, mode=bd.Mode.SUBTRACT)
        else:
            raise ValueError(f"unsupported build123d primitive shape: {shape}")
    return part.part


def _dimension(dimensions: dict[str, Any], name: str, default: float) -> float:
    value = dimensions.get(name, default)
    if not isinstance(value, int | float):
        raise ValueError(f"build123dSpec.dimensions.{name} must be numeric")
    if value <= 0:
        raise ValueError(f"build123dSpec.dimensions.{name} must be positive")
    return float(value)


def _script_for_spec(spec: dict[str, Any]) -> str:
    return (
        "import build123d as bd\n"
        "from build123d import export_step, export_stl\n\n"
        f"SPEC = {spec!r}\n\n"
        "# Generated by ArchIToken worker from a structured, non-arbitrary build123d spec.\n"
        "def dimension(dimensions, name, default):\n"
        "    value = dimensions.get(name, default)\n"
        "    if value <= 0:\n"
        "        raise ValueError(f'{name} must be positive')\n"
        "    return float(value)\n\n"
        "def build_model(spec):\n"
        "    shape = spec['shape']\n"
        "    dimensions = spec['dimensions']\n"
        "    with bd.BuildPart() as part:\n"
        "        if shape == 'box':\n"
        "            bd.Box(dimension(dimensions, 'length', 100.0), dimension(dimensions, 'width', 100.0), dimension(dimensions, 'height', 100.0))\n"
        "        elif shape == 'cylinder':\n"
        "            bd.Cylinder(radius=dimension(dimensions, 'radius', 25.0), height=dimension(dimensions, 'height', 100.0))\n"
        "        elif shape == 'plate_with_holes':\n"
        "            length = dimension(dimensions, 'length', 200.0)\n"
        "            width = dimension(dimensions, 'width', 100.0)\n"
        "            thickness = dimension(dimensions, 'thickness', 10.0)\n"
        "            hole_radius = dimension(dimensions, 'holeRadius', 6.0)\n"
        "            inset = dimension(dimensions, 'inset', 20.0)\n"
        "            bd.Box(length, width, thickness)\n"
        "            with bd.Locations((-length / 2 + inset, -width / 2 + inset, 0), (length / 2 - inset, width / 2 - inset, 0)):\n"
        "                bd.Cylinder(radius=hole_radius, height=thickness * 2, mode=bd.Mode.SUBTRACT)\n"
        "        else:\n"
        "            raise ValueError(f'unsupported build123d primitive shape: {shape}')\n"
        "    return part.part\n\n"
        "result = build_model(SPEC)\n"
    )
