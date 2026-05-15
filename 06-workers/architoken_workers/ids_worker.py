"""buildingSMART IDS validation worker adapter."""

from __future__ import annotations

from pathlib import Path

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def validate_ids(job: ConversionJob) -> WorkerResult:
    """Validate IFC against a buildingSMART IDS file with ifctester when configured."""

    validate_job(job)
    ids_path = job.input.get("idsPath") or job.input.get("ids_path")
    if not ids_path:
        artifact = write_json_artifact(
            job,
            "ids_validation_report.json",
            {"standard": "IDS", "passed": None, "findings": [], "reason": "idsPath was not provided"},
            role="validation_report",
            metadata={"standard": "IDS"},
        )
        return WorkerResult(
            job_id=job.job_id,
            status="completed",
            artifacts=(artifact,),
            output={"standard": "IDS", "passed": None, "findings": [], "reason": "idsPath was not provided"},
        )
    if unavailable := missing_python_dependency(
        job,
        adapter="ifctester",
        import_name="ifctester",
        install_hint="Install ifctester in the worker image for real buildingSMART IDS validation.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="ifctester",
        install_hint="Mount the source IFC file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked
    ids_file = Path(str(ids_path))
    if not ids_file.is_file():
        return WorkerResult(
            job_id=job.job_id,
            status="blocked",
            error={"code": "ids_file_not_found", "message": f"idsPath is not a readable file: {ids_file}"},
            output={"standard": "IDS", "available": False, "idsPath": str(ids_file)},
        )

    import ifcopenshell
    import ifctester.ids
    import ifctester.reporter

    model = ifcopenshell.open(str(source))
    ids = ifctester.ids.open(str(ids_file))
    ids.validate(model)
    reporter = ifctester.reporter.Json(ids)
    report = reporter.report()
    artifact = write_json_artifact(job, "ids_validation_report.json", report, role="validation_report", metadata={"standard": "IDS"})
    passed = bool(report.get("status", False) or report.get("passed", False))
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"standard": "IDS", "passed": passed, "reportPath": artifact.metadata["path"]},
    )
