from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.document_worker import markitdown_convert, mineru_parse
from architoken_workers.ocr_worker import paddleocr_parse
from architoken_workers.office_worker import libreoffice_convert
from architoken_workers.pdf_worker import mupdf_adapter, pdfium_adapter, stirling_pdf_adapter


def _completed_or_blocked(result, adapter: str) -> bool:
    assert result.status in {"completed", "blocked"}
    if result.status == "blocked":
        assert result.error["code"] == "adapter_not_configured"
        assert result.output["adapter"] == adapter
        assert result.output["available"] is False
        assert result.output["installHint"]
        return False
    return True


def _job(operation: ConversionOperation = ConversionOperation.PDF_PARSE) -> ConversionJob:
    return ConversionJob(
        job_id="job-doc-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="document-worker-test",
        operation=operation,
        source_asset_id="asset-doc-1",
        source_file_id="file-doc-1",
    )


def test_document_parse_and_markdown_contracts() -> None:
    parsed = mineru_parse(_job())
    markdown = markitdown_convert(_job())
    if _completed_or_blocked(parsed, "mineru"):
        assert parsed.output["engine"] == "mineru"
    if _completed_or_blocked(markdown, "markitdown"):
        assert markdown.artifacts[0].name == "document.md"


def test_ocr_and_office_contracts() -> None:
    ocr = paddleocr_parse(_job(ConversionOperation.OCR))
    office = libreoffice_convert(_job(ConversionOperation.OFFICE_CONVERT))
    if _completed_or_blocked(ocr, "paddleocr"):
        assert ocr.output["engine"] == "paddleocr"
    if _completed_or_blocked(office, "libreoffice"):
        assert office.output["engine"] == "libreoffice_headless"


def test_pdf_adapter_boundaries() -> None:
    stirling = stirling_pdf_adapter(_job())
    pdfium = pdfium_adapter(_job())
    mupdf = mupdf_adapter(_job())
    if _completed_or_blocked(stirling, "stirling_pdf"):
        assert stirling.output["mode"] == "service_adapter"
    if _completed_or_blocked(pdfium, "pdfium"):
        assert pdfium.output["adapter"] == "pdfium"
    if _completed_or_blocked(mupdf, "mupdf"):
        assert mupdf.output["adapter"] == "mupdf"
