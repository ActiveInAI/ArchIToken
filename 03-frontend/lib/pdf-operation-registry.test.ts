// lib/pdf-operation-registry.test.ts - PDF operation registry contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  normalizePdfOperationId,
  pdfOperationById,
  pdfOperationRegistry,
  pdfOperationsByCategory,
} from "./pdf-operation-registry";

describe("pdf operation registry", () => {
  it("covers Stirling-PDF tool families and PaddleOCR routes", () => {
    const ids = new Set(pdfOperationRegistry.map((operation) => operation.id));

    for (const id of [
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
      "paddleocr-ocr",
      "paddleocr-layout",
      "paddleocr-vl",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("normalizes common action aliases", () => {
    expect(normalizePdfOperationId("merge")).toBe("merge-pdfs");
    expect(normalizePdfOperationId("OCR_LAYOUT")).toBe("paddleocr-layout");
    expect(pdfOperationById("pdfa")?.apiPath).toBe("/api/v1/convert/pdf/pdfa");
    expect(pdfOperationById("compress")?.apiPath).toBe("/api/v1/misc/compress-pdf");
  });

  it("keeps OCR routes separate from PDF editing service routes", () => {
    expect(pdfOperationById("paddleocr-ocr")?.engine).toBe("paddleocr");
    expect(pdfOperationById("ocr-pdf")?.engine).toBe("stirling_pdf");
    expect(pdfOperationsByCategory().ocr_document_vision).toHaveLength(3);
  });
});
