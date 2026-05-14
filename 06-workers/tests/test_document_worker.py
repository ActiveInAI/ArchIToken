from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.document_worker import markitdown_convert, mineru_parse
from architoken_workers.ocr_worker import paddleocr_parse
from architoken_workers.office_worker import libreoffice_convert
from architoken_workers.pdf_worker import mupdf_adapter, pdfium_adapter, stirling_pdf_adapter


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
    assert parsed.output["engine"] == "mineru"
    assert markdown.artifacts[0].name == "document.md"


def test_ocr_and_office_contracts() -> None:
    ocr = paddleocr_parse(_job(ConversionOperation.OCR))
    office = libreoffice_convert(_job(ConversionOperation.OFFICE_CONVERT))
    assert ocr.output["engine"] == "paddleocr"
    assert office.output["engine"] == "libreoffice_headless"


def test_pdf_adapter_boundaries() -> None:
    stirling = stirling_pdf_adapter(_job())
    pdfium = pdfium_adapter(_job())
    mupdf = mupdf_adapter(_job())
    assert stirling.output["mode"] == "reference_boundary"
    assert pdfium.output["adapter"] == "pdfium"
    assert mupdf.output["adapter"] == "mupdf"
