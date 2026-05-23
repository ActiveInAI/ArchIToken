"""CadQuery parametric generation worker adapter."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir


def cadquery_generate(job: ConversionJob) -> WorkerResult:
    """Generate real CAD derivatives from a safe structured CadQuery primitive spec."""

    validate_job(job)
    spec = _primitive_spec(job.input)
    if unavailable := missing_python_dependency(
        job,
        adapter="cadquery",
        import_name="cadquery",
        install_hint="Install CadQuery/OCP in the worker image for STEP export. Pipe/tube specs can still produce a real STL mesh through the built-in ArchIToken parametric mesh fallback.",
    ):
        if _is_pipe_shape(spec):
            return _generate_faceted_pipe(job, spec, dependency_status=unavailable)
        return unavailable
    import cadquery as cq
    from cadquery import exporters

    model = _build_model(cq, spec)
    out_dir = output_dir(job)
    stem = str(job.input.get("name", "cadquery_model")).strip() or "cadquery_model"
    formats = job.input.get("outputFormats", ["step", "stl"])
    artifacts: list[WorkerArtifact] = []

    script_path = out_dir / f"{stem}.py"
    script_path.write_text(_script_for_spec(spec), encoding="utf-8")
    artifacts.append(
        artifact_for_path(
            script_path,
            job=job,
            media_type="text/x-python",
            role="source_script",
            metadata={"engine": "cadquery", "spec": spec},
        )
    )

    if "step" in formats:
        step_path = out_dir / f"{stem}.step"
        exporters.export(model, str(step_path))
        artifacts.append(
            artifact_for_path(
                step_path,
                job=job,
                media_type="model/step",
                role="cad_geometry",
                metadata={"engine": "cadquery", "format": "step"},
            )
        )
    if "stl" in formats:
        stl_path = out_dir / f"{stem}.stl"
        exporters.export(model, str(stl_path))
        artifacts.append(
            artifact_for_path(
                stl_path,
                job=job,
                media_type="model/stl",
                role="cad_mesh",
                metadata={"engine": "cadquery", "format": "stl"},
            )
        )

    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={"engine": "cadquery", "generated": True, "spec": spec, "artifactCount": len(artifacts)},
    )



def _is_pipe_shape(spec: dict[str, Any]) -> bool:
    return spec["shape"] in {"pipe", "tube", "steel_pipe"}


def _generate_faceted_pipe(
    job: ConversionJob,
    spec: dict[str, Any],
    *,
    dependency_status: WorkerResult,
) -> WorkerResult:
    """Generate a real pipe STL mesh without CadQuery when OCP wheels are unavailable."""

    length, outer_radius, inner_radius = _pipe_dimensions(spec["dimensions"])
    out_dir = output_dir(job)
    stem = str(job.input.get("name", "pipe_model")).strip() or "pipe_model"
    artifacts: list[WorkerArtifact] = []

    script_path = out_dir / f"{stem}_mesh.py"
    script_path.write_text(_faceted_pipe_script_for_spec(spec), encoding="utf-8")
    artifacts.append(
        artifact_for_path(
            script_path,
            job=job,
            media_type="text/x-python",
            role="source_script",
            metadata={"engine": "architoken_parametric_mesh", "spec": spec},
        )
    )

    stl_path = out_dir / f"{stem}.stl"
    _write_pipe_stl(stl_path, length=length, outer_radius=outer_radius, inner_radius=inner_radius)
    artifacts.append(
        artifact_for_path(
            stl_path,
            job=job,
            media_type="model/stl",
            role="cad_mesh",
            metadata={"engine": "architoken_parametric_mesh", "format": "stl", "faceted": True},
        )
    )

    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "engine": "architoken_parametric_mesh",
            "generated": True,
            "spec": spec,
            "artifactCount": len(artifacts),
            "fallback": True,
            "fallbackReason": dependency_status.error.get("message", "cadquery unavailable"),
            "derivativeLimitations": "Generated STL mesh only. STEP export requires CadQuery/OCP or another configured BRep kernel.",
        },
    )


def _write_pipe_stl(path: Path, *, length: float, outer_radius: float, inner_radius: float, segments: int = 96) -> None:
    import math

    half = length / 2.0
    lines = ["solid architoken_pipe"]

    def point(radius: float, index: int, z: float) -> tuple[float, float, float]:
        angle = 2.0 * math.pi * index / segments
        return (radius * math.cos(angle), radius * math.sin(angle), z)

    def facet(a: tuple[float, float, float], b: tuple[float, float, float], c: tuple[float, float, float]) -> None:
        lines.extend([
            "  facet normal 0 0 0",
            "    outer loop",
            f"      vertex {a[0]:.6f} {a[1]:.6f} {a[2]:.6f}",
            f"      vertex {b[0]:.6f} {b[1]:.6f} {b[2]:.6f}",
            f"      vertex {c[0]:.6f} {c[1]:.6f} {c[2]:.6f}",
            "    endloop",
            "  endfacet",
        ])

    for index in range(segments):
        next_index = (index + 1) % segments
        ob0 = point(outer_radius, index, -half)
        ot0 = point(outer_radius, index, half)
        ob1 = point(outer_radius, next_index, -half)
        ot1 = point(outer_radius, next_index, half)
        ib0 = point(inner_radius, index, -half)
        it0 = point(inner_radius, index, half)
        ib1 = point(inner_radius, next_index, -half)
        it1 = point(inner_radius, next_index, half)

        facet(ob0, ot0, ot1)
        facet(ob0, ot1, ob1)
        facet(ib0, it1, it0)
        facet(ib0, ib1, it1)
        facet(ot0, it0, it1)
        facet(ot0, it1, ot1)
        facet(ob0, ib1, ib0)
        facet(ob0, ob1, ib1)

    lines.append("endsolid architoken_pipe")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _faceted_pipe_script_for_spec(spec: dict[str, Any]) -> str:
    return f"""# Reproducible ArchIToken pipe mesh script.
# This script uses only Python stdlib and writes an ASCII STL mesh.
from pathlib import Path
import math

SPEC = {spec!r}


def pipe_dimensions(dimensions):
    length = float(dimensions.get('length') or dimensions.get('height') or 1000.0)
    outer_radius = dimensions.get('outerRadius') or dimensions.get('radius')
    if outer_radius is None:
        outer_radius = (dimensions.get('outerDiameter') or dimensions.get('diameter') or 6.0) / 2.0
    inner_radius = dimensions.get('innerRadius')
    if inner_radius is None and dimensions.get('innerDiameter') is not None:
        inner_radius = dimensions['innerDiameter'] / 2.0
    if inner_radius is None:
        wall_thickness = dimensions.get('wallThickness') or min(0.5, outer_radius / 3.0)
        inner_radius = outer_radius - wall_thickness
    if inner_radius <= 0 or inner_radius >= outer_radius:
        raise ValueError('pipe inner radius must be positive and smaller than outer radius')
    return length, float(outer_radius), float(inner_radius)


def write_pipe_stl(path, length, outer_radius, inner_radius, segments=96):
    half = length / 2.0
    lines = ['solid architoken_pipe']

    def point(radius, index, z):
        angle = 2.0 * math.pi * index / segments
        return (radius * math.cos(angle), radius * math.sin(angle), z)

    def facet(a, b, c):
        lines.extend([
            '  facet normal 0 0 0',
            '    outer loop',
            f'      vertex {{a[0]:.6f}} {{a[1]:.6f}} {{a[2]:.6f}}',
            f'      vertex {{b[0]:.6f}} {{b[1]:.6f}} {{b[2]:.6f}}',
            f'      vertex {{c[0]:.6f}} {{c[1]:.6f}} {{c[2]:.6f}}',
            '    endloop',
            '  endfacet',
        ])

    for index in range(segments):
        next_index = (index + 1) % segments
        ob0 = point(outer_radius, index, -half)
        ot0 = point(outer_radius, index, half)
        ob1 = point(outer_radius, next_index, -half)
        ot1 = point(outer_radius, next_index, half)
        ib0 = point(inner_radius, index, -half)
        it0 = point(inner_radius, index, half)
        ib1 = point(inner_radius, next_index, -half)
        it1 = point(inner_radius, next_index, half)
        facet(ob0, ot0, ot1)
        facet(ob0, ot1, ob1)
        facet(ib0, it1, it0)
        facet(ib0, ib1, it1)
        facet(ot0, it0, it1)
        facet(ot0, it1, ot1)
        facet(ob0, ib1, ib0)
        facet(ob0, ob1, ib1)

    lines.append('endsolid architoken_pipe')
    path.write_text('\\n'.join(lines) + '\\n', encoding='utf-8')


if __name__ == '__main__':
    length, outer_radius, inner_radius = pipe_dimensions(SPEC['dimensions'])
    write_pipe_stl(Path('architoken_pipe.stl'), length, outer_radius, inner_radius)
"""

def _primitive_spec(input_payload: dict[str, Any]) -> dict[str, Any]:
    raw = input_payload.get("cadquerySpec") or input_payload.get("spec") or input_payload
    if not isinstance(raw, dict):
        raise ValueError("CadQuery generation requires a structured cadquerySpec object")
    shape = str(raw.get("shape", "box")).lower()
    units = str(raw.get("units", "mm"))
    dimensions = raw.get("dimensions", {})
    if not isinstance(dimensions, dict):
        raise ValueError("cadquerySpec.dimensions must be an object")
    return {"shape": shape, "units": units, "dimensions": dimensions}


def _build_model(cq: Any, spec: dict[str, Any]) -> Any:
    shape = spec["shape"]
    dimensions = spec["dimensions"]
    if shape == "box":
        length = _dimension(dimensions, "length", 100.0)
        width = _dimension(dimensions, "width", 100.0)
        height = _dimension(dimensions, "height", 100.0)
        return cq.Workplane("XY").box(length, width, height)
    if shape == "cylinder":
        radius = _dimension(dimensions, "radius", 25.0)
        height = _dimension(dimensions, "height", 100.0)
        return cq.Workplane("XY").cylinder(height, radius)
    if shape in {"pipe", "tube", "steel_pipe"}:
        length, outer_radius, inner_radius = _pipe_dimensions(dimensions)
        outer = cq.Workplane("XY").cylinder(length, outer_radius)
        cutter = cq.Workplane("XY").cylinder(length + 2.0, inner_radius)
        return outer.cut(cutter)
    if shape == "plate_with_holes":
        length = _dimension(dimensions, "length", 200.0)
        width = _dimension(dimensions, "width", 100.0)
        thickness = _dimension(dimensions, "thickness", 10.0)
        hole_radius = _dimension(dimensions, "holeRadius", 6.0)
        inset = _dimension(dimensions, "inset", 20.0)
        return (
            cq.Workplane("XY")
            .box(length, width, thickness)
            .faces(">Z")
            .workplane()
            .pushPoints([(-length / 2 + inset, -width / 2 + inset), (length / 2 - inset, width / 2 - inset)])
            .hole(hole_radius * 2)
        )
    raise ValueError(f"unsupported CadQuery primitive shape: {shape}")


def _pipe_dimensions(dimensions: dict[str, Any]) -> tuple[float, float, float]:
    length = _optional_dimension(dimensions, "length") or _optional_dimension(dimensions, "height") or 1000.0
    outer_radius = _optional_dimension(dimensions, "outerRadius")
    if outer_radius is None:
        outer_radius = _optional_dimension(dimensions, "radius")
    if outer_radius is None:
        outer_diameter = _optional_dimension(dimensions, "outerDiameter")
        if outer_diameter is None:
            outer_diameter = _optional_dimension(dimensions, "diameter") or 6.0
        outer_radius = outer_diameter / 2.0
    inner_radius = _optional_dimension(dimensions, "innerRadius")
    if inner_radius is None:
        inner_diameter = _optional_dimension(dimensions, "innerDiameter")
        if inner_diameter is not None:
            inner_radius = inner_diameter / 2.0
    if inner_radius is None:
        wall_thickness = _optional_dimension(dimensions, "wallThickness") or min(0.5, outer_radius / 3.0)
        inner_radius = outer_radius - wall_thickness
    if inner_radius <= 0:
        raise ValueError("cadquerySpec.dimensions.innerRadius must remain positive after wall thickness")
    if inner_radius >= outer_radius:
        raise ValueError("cadquerySpec pipe inner radius must be smaller than outer radius")
    return length, outer_radius, inner_radius


def _optional_dimension(dimensions: dict[str, Any], name: str) -> float | None:
    if name not in dimensions or dimensions[name] is None:
        return None
    return _dimension(dimensions, name, 0.0)


def _dimension(dimensions: dict[str, Any], name: str, default: float) -> float:
    value = dimensions.get(name, default)
    if not isinstance(value, int | float):
        raise ValueError(f"cadquerySpec.dimensions.{name} must be numeric")
    if value <= 0:
        raise ValueError(f"cadquerySpec.dimensions.{name} must be positive")
    return float(value)


def _script_for_spec(spec: dict[str, Any]) -> str:
    return (
        "import cadquery as cq\n"
        "from cadquery import exporters\n\n"
        f"SPEC = {spec!r}\n\n"
        "# Generated by ArchIToken worker from a structured, non-arbitrary CadQuery spec.\n"
        "def dimension(dimensions, name, default):\n"
        "    value = dimensions.get(name, default)\n"
        "    if value <= 0:\n"
        "        raise ValueError(f'{name} must be positive')\n"
        "    return float(value)\n\n"
        "def build_model(spec):\n"
        "    shape = spec['shape']\n"
        "    dimensions = spec['dimensions']\n"
        "    if shape == 'box':\n"
        "        return cq.Workplane('XY').box(\n"
        "            dimension(dimensions, 'length', 100.0),\n"
        "            dimension(dimensions, 'width', 100.0),\n"
        "            dimension(dimensions, 'height', 100.0),\n"
        "        )\n"
        "    if shape == 'cylinder':\n"
        "        return cq.Workplane('XY').cylinder(\n"
        "            dimension(dimensions, 'height', 100.0),\n"
        "            dimension(dimensions, 'radius', 25.0),\n"
        "        )\n"
        "    if shape in {'pipe', 'tube', 'steel_pipe'}:\n"
        "        length = dimension(dimensions, 'length', dimensions.get('height', 1000.0))\n"
        "        outer_radius = dimensions.get('outerRadius') or dimensions.get('radius')\n"
        "        if outer_radius is None:\n"
        "            outer_radius = (dimensions.get('outerDiameter') or dimensions.get('diameter') or 6.0) / 2.0\n"
        "        inner_radius = dimensions.get('innerRadius')\n"
        "        if inner_radius is None and dimensions.get('innerDiameter') is not None:\n"
        "            inner_radius = dimensions['innerDiameter'] / 2.0\n"
        "        if inner_radius is None:\n"
        "            wall_thickness = dimensions.get('wallThickness') or min(0.5, outer_radius / 3.0)\n"
        "            inner_radius = outer_radius - wall_thickness\n"
        "        if inner_radius <= 0 or inner_radius >= outer_radius:\n"
        "            raise ValueError('pipe inner radius must be positive and smaller than outer radius')\n"
        "        outer = cq.Workplane('XY').cylinder(length, outer_radius)\n"
        "        cutter = cq.Workplane('XY').cylinder(length + 2.0, inner_radius)\n"
        "        return outer.cut(cutter)\n"
        "    if shape == 'plate_with_holes':\n"
        "        length = dimension(dimensions, 'length', 200.0)\n"
        "        width = dimension(dimensions, 'width', 100.0)\n"
        "        thickness = dimension(dimensions, 'thickness', 10.0)\n"
        "        hole_radius = dimension(dimensions, 'holeRadius', 6.0)\n"
        "        inset = dimension(dimensions, 'inset', 20.0)\n"
        "        return (\n"
        "            cq.Workplane('XY')\n"
        "            .box(length, width, thickness)\n"
        "            .faces('>Z')\n"
        "            .workplane()\n"
        "            .pushPoints([(-length / 2 + inset, -width / 2 + inset), (length / 2 - inset, width / 2 - inset)])\n"
        "            .hole(hole_radius * 2)\n"
        "        )\n"
        "    raise ValueError(f'unsupported CadQuery primitive shape: {shape}')\n\n"
        "result = build_model(SPEC)\n"
    )
