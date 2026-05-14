# Phase 7 Document AI Pipeline

The document worker adapter covers:

- `mineru_parse`
- `paddleocr_parse`
- `markitdown_convert`
- `libreoffice_convert`
- `stirling_pdf_adapter`
- `pdfium_adapter`
- `mupdf_adapter`

PDF.js is not the core PDF runtime. PDFium and MuPDF remain adapter contracts, Stirling-PDF remains an adapter/reference candidate, and LibreOffice/PaddleOCR/MinerU/MarkItDown run behind isolated worker contracts.

The Rust API remains responsible for asset state, conversion job state, tenant/project isolation, RBAC, audit, object bindings, and OpenAPI contracts.
