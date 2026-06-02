"""OCR worker adapter."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def paddleocr_parse(job: ConversionJob) -> WorkerResult:
    """Run PaddleOCR over a PDF/image source and emit structured OCR JSON."""

    validate_job(job)
    mode = _ocr_mode(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="paddleocr",
        import_name="paddleocr",
        install_hint="Install PaddleOCR in the worker image for real PDF/image OCR.",
    ):
        return unavailable
    if unavailable := missing_python_dependency(
        job,
        adapter="paddleocr",
        import_name="paddle",
        install_hint="Install paddlepaddle in the worker image for PaddleOCR inference.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="paddleocr",
        install_hint="Mount a PDF/image source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    lang = str(job.input.get("lang", "ch"))
    raw = _run_paddleocr(source, lang=lang, mode=mode, job=job)
    artifact = write_json_artifact(
        job,
        "paddleocr_blocks.json",
        _json_safe(raw),
        role="ocr",
        metadata={"engine": "paddleocr", "ocrMode": mode, "sourcePath": str(source), "lang": lang},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"engine": "paddleocr", "ocrMode": mode, "sourcePath": str(source), "lang": lang},
    )


def _ocr_mode(job: ConversionJob) -> str:
    value = str(job.input.get("ocrMode", job.input.get("pdfOperation", "paddleocr-ocr"))).strip().lower()
    if value in {"paddleocr-layout", "layout", "ppstructure", "ppstructurev3"}:
        return "layout"
    if value in {"paddleocr-vl", "vl", "paddleocrvl"}:
        return "vl"
    return "ocr"


def _run_paddleocr(source: object, *, lang: str, mode: str, job: ConversionJob) -> object:
    if mode == "layout":
        from paddleocr import PPStructureV3

        parser = PPStructureV3(lang=lang, **_paddleocr_options(job))
        return parser.predict(str(source))
    if mode == "vl":
        from paddleocr import PaddleOCRVL

        parser = PaddleOCRVL(**_paddleocr_options(job))
        return parser.predict(str(source))

    from paddleocr import PaddleOCR

    try:
        parser = PaddleOCR(use_angle_cls=True, lang=lang, **_paddleocr_options(job))
        return parser.ocr(str(source), cls=True)
    except TypeError:
        parser = PaddleOCR(lang=lang, **_paddleocr_options(job))
        return parser.predict(str(source))


def _paddleocr_options(job: ConversionJob) -> dict[str, object]:
    options = job.input.get("paddleocrOptions", {})
    if not isinstance(options, dict):
        raise ValueError("job.input.paddleocrOptions must be an object")
    return dict(options)


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
