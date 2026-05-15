"""CGAL-backed geometry worker adapter through pygalmesh."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir


def cgal_generate_volume_mesh(job: ConversionJob) -> WorkerResult:
    """Generate a tetrahedral volume mesh with CGAL via pygalmesh."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="cgal",
        import_name="pygalmesh",
        install_hint="Install pygalmesh/CGAL in the worker image for CGAL geometry operations.",
    ):
        return unavailable

    import pygalmesh

    shape = str(job.input.get("shape", "ball")).lower()
    if shape != "ball":
        raise ValueError(f"unsupported CGAL primitive shape: {shape}")
    radius = float(job.input.get("radius", 1.0))
    max_cell_circumradius = float(job.input.get("maxCellCircumradius", radius / 8.0))
    mesh = pygalmesh.generate_mesh(
        pygalmesh.Ball([0.0, 0.0, 0.0], radius),
        max_cell_circumradius=max_cell_circumradius,
    )
    target = output_dir(job) / str(job.input.get("outputName", "cgal_volume_mesh.vtu"))
    mesh.write(str(target))
    artifact = artifact_for_path(
        target,
        job=job,
        media_type="model/vnd.vtk",
        role="cgal_volume_mesh",
        metadata={
            "engine": "cgal",
            "binding": "pygalmesh",
            "shape": shape,
            "radius": radius,
            "maxCellCircumradius": max_cell_circumradius,
        },
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "engine": "cgal",
            "binding": "pygalmesh",
            "shape": shape,
            "radius": radius,
            "artifactPath": artifact.metadata["path"],
        },
    )
