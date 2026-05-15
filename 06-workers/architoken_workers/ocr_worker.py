"""OCR worker adapter."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def paddleocr_parse(job: ConversionJob) -> WorkerResult:
    """Run PaddleOCR over a PDF/image source and emit structured OCR JSON."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="paddleocr",
        import_name="paddleocr",
        install_hint="Install PaddleOCR in the worker image for real PDF/image OCR.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="paddleocr",
        install_hint="Mount a PDF/image source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    from paddleocr import PaddleOCR

    lang = str(job.input.get("lang", "ch"))
    try:
        ocr = PaddleOCR(use_angle_cls=True, lang=lang)
        raw = ocr.ocr(str(source), cls=True)
    except TypeError:
        ocr = PaddleOCR(lang=lang)
        raw = ocr.predict(str(source))
    artifact = write_json_artifact(
        job,
        "paddleocr_blocks.json",
        _json_safe(raw),
        role="ocr",
        metadata={"engine": "paddleocr", "sourcePath": str(source), "lang": lang},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"engine": "paddleocr", "sourcePath": str(source), "lang": lang},
    )


def _json_safe(value: object) -> object:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    if hasattr(value, "tolist"):
        return _json_safe(value.tolist())
    return str(value)
