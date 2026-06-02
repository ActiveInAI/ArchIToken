from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from threading import Thread

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.docling_worker import docling_parse
from architoken_workers.document_worker import markitdown_convert, mineru_parse
from architoken_workers.ocr_worker import paddleocr_parse
from architoken_workers.office_worker import libreoffice_convert, officecli_convert
from architoken_workers.pdf_worker import (
    PDF_OPERATION_REGISTRY,
    mupdf_adapter,
    pdf_operation_manifest,
    pdfium_adapter,
    stirling_pdf_adapter,
)


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
    docling = docling_parse(_job())
    parsed = mineru_parse(_job())
    markdown = markitdown_convert(_job())
    if _completed_or_blocked(docling, "docling"):
        assert docling.output["engine"] == "docling"
    if _completed_or_blocked(parsed, "mineru"):
        assert parsed.output["engine"] == "mineru"
    if _completed_or_blocked(markdown, "markitdown"):
        assert markdown.artifacts[0].name == "document.md"


def test_ocr_and_office_contracts() -> None:
    ocr = paddleocr_parse(_job(ConversionOperation.OCR))
    office = libreoffice_convert(_job(ConversionOperation.OFFICE_CONVERT))
    officecli = officecli_convert(_job(ConversionOperation.OFFICE_CONVERT))
    if _completed_or_blocked(ocr, "paddleocr"):
        assert ocr.output["engine"] == "paddleocr"
    if _completed_or_blocked(office, "libreoffice"):
        assert office.output["engine"] == "libreoffice_headless"
        assert office.output["nativeSourceBound"] is True
        assert office.output["substitutePreview"] is False
        assert office.artifacts[0].role == "office_native_manifest"
    if _completed_or_blocked(officecli, "officecli"):
        assert officecli.output["engine"] == "officecli"


def test_officecli_structured_task_contract(tmp_path: Path) -> None:
    fake = tmp_path / "officecli"
    fake.write_text(
        """#!/usr/bin/env python3
from pathlib import Path
import sys

cmd = sys.argv[1]
if cmd == "create":
    Path(sys.argv[2]).write_text("created\\n", encoding="utf-8")
elif cmd in {"add", "set", "remove"}:
    target = Path(sys.argv[2])
    target.write_text(target.read_text(encoding="utf-8") + " ".join(sys.argv[1:]) + "\\n", encoding="utf-8")
elif cmd == "view":
    mode = sys.argv[3]
    if mode == "outline":
        print("Slide 1: OfficeCLI POC")
    elif mode == "html":
        out = Path(sys.argv[sys.argv.index("-o") + 1])
        out.write_text("<html><body>OfficeCLI POC</body></html>", encoding="utf-8")
    elif mode == "screenshot":
        out = Path(sys.argv[sys.argv.index("-o") + 1])
        out.mkdir(parents=True, exist_ok=True)
        (out / "page-1.png").write_bytes(b"\\x89PNG\\r\\n\\x1a\\n")
else:
    raise SystemExit(2)
""",
        encoding="utf-8",
    )
    fake.chmod(0o755)
    job = ConversionJob(
        job_id="job-officecli-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="document-worker-test",
        operation=ConversionOperation.OFFICE_CONVERT,
        source_asset_id="asset-office-1",
        source_file_id="file-office-1",
        input={
            "officecliBinary": str(fake),
            "outputDir": str(tmp_path / "out"),
            "officecliTask": {
                "targetName": "demo.pptx",
                "commands": [
                    {"verb": "add", "selector": "/", "type": "slide", "props": {"title": "OfficeCLI POC"}},
                ],
                "previewFormats": ["outline", "html"],
            },
        },
    )

    result = officecli_convert(job)

    assert result.status == "completed"
    assert result.output["engine"] == "officecli"
    assert result.output["schemaValidation"]["status"] == "validated"
    assert {artifact.role for artifact in result.artifacts} >= {
        "officecli_generated_office",
        "officecli_preview_outline",
        "officecli_preview_html",
        "officecli_manifest",
    }


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


def test_pdf_operation_registry_covers_stirling_and_paddleocr_routes() -> None:
    manifest = pdf_operation_manifest()

    for operation_id in (
        "merge-pdfs",
        "split-pages",
        "extract-pages",
        "remove-pages",
        "rotate-pdf",
        "crop",
        "compress-pdf",
        "ocr-pdf",
        "text-editor-pdf",
        "redact",
        "fill",
        "basic-info",
        "filter-contains-text",
        "extract-attachments",
        "pipeline",
    ):
        assert operation_id in PDF_OPERATION_REGISTRY
        assert manifest[operation_id]["engine"] == "stirling_pdf"

    assert manifest["compress-pdf"]["apiPath"] == "/api/v1/misc/compress-pdf"
    assert manifest["paddleocr-ocr"]["engine"] == "paddleocr"
    assert manifest["paddleocr-layout"]["category"] == "ocr_document_vision"


def test_stirling_pdf_registered_operation_posts_to_service(tmp_path: Path, monkeypatch) -> None:
    seen: dict[str, object] = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
            seen["path"] = self.path
            seen["api_key"] = self.headers.get("X-API-KEY")
            seen["content_type"] = self.headers.get("Content-Type")
            seen["body"] = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.end_headers()
            self.wfile.write(b"%PDF-1.7\n% fake processed pdf\n")

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib handler API
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        monkeypatch.setenv("STIRLING_PDF_URL", f"http://127.0.0.1:{server.server_port}")
        monkeypatch.setenv("STIRLING_PDF_API_KEY", "test-key")
        source = tmp_path / "a.pdf"
        source.write_bytes(b"%PDF-1.7\n% a\n")
        extra = tmp_path / "b.pdf"
        extra.write_bytes(b"%PDF-1.7\n% b\n")
        job = ConversionJob(
            job_id="job-stirling-1",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="document-worker-test",
            operation=ConversionOperation.PDF_PARSE,
            source_asset_id="asset-pdf-1",
            source_file_id="file-pdf-1",
            input={
                "sourcePath": str(source),
                "additionalSourcePaths": [str(extra)],
                "outputDir": str(tmp_path / "out"),
                "pdfOperation": "merge-pdfs",
                "fields": {"sortType": "orderProvided", "removeCertSign": False},
            },
        )

        result = stirling_pdf_adapter(job)
    finally:
        server.shutdown()
        thread.join(timeout=2)

    assert result.status == "completed"
    assert result.output["mode"] == "service_adapter"
    assert result.output["operationId"] == "merge-pdfs"
    assert result.output["operationPath"] == "/api/v1/general/merge-pdfs"
    assert result.output["sourceCount"] == 2
    assert result.artifacts[0].role == "pdf_derivative"
    assert seen["path"] == "/api/v1/general/merge-pdfs"
    assert seen["api_key"] == "test-key"
    assert b'name="fileInput"; filename="a.pdf"' in seen["body"]
    assert b'name="fileInput"; filename="b.pdf"' in seen["body"]


def test_stirling_pdf_fill_uses_stirling_form_file_field(tmp_path: Path, monkeypatch) -> None:
    seen: dict[str, object] = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
            seen["path"] = self.path
            seen["body"] = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.end_headers()
            self.wfile.write(b"%PDF-1.7\n% filled pdf\n")

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib handler API
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        monkeypatch.setenv("STIRLING_PDF_URL", f"http://127.0.0.1:{server.server_port}")
        source = tmp_path / "form.pdf"
        source.write_bytes(b"%PDF-1.7\n% form\n")
        job = ConversionJob(
            job_id="job-stirling-fill",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="document-worker-test",
            operation=ConversionOperation.PDF_PARSE,
            source_asset_id="asset-pdf-1",
            source_file_id="file-pdf-1",
            input={
                "sourcePath": str(source),
                "outputDir": str(tmp_path / "out"),
                "pdfOperation": "fill",
                "fields": {"data": '{"name":"ArchIToken"}'},
            },
        )

        result = stirling_pdf_adapter(job)
    finally:
        server.shutdown()
        thread.join(timeout=2)

    assert result.status == "completed"
    assert seen["path"] == "/api/v1/form/fill"
    assert b'name="file"; filename="form.pdf"' in seen["body"]
    assert b'name="fileInput"; filename="form.pdf"' not in seen["body"]
