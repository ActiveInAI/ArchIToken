// lib/pdf-operation-registry.ts - PDF operation routing contract
// License: Apache-2.0

export type PdfOperationEngine = "stirling_pdf" | "paddleocr";

export type PdfOperationCategory =
  | "page_operations"
  | "conversion"
  | "security_signing"
  | "content_extraction_removal"
  | "document_editing_analysis"
  | "form_fields"
  | "multi_tool_automation"
  | "viewing_display"
  | "analysis"
  | "filtering"
  | "attachments_comments"
  | "ocr_document_vision";

export interface PdfOperationSpec {
  id: string;
  label: string;
  category: PdfOperationCategory;
  engine: PdfOperationEngine;
  apiPath?: string;
  note?: string;
}

const stirling = (
  id: string,
  label: string,
  category: PdfOperationCategory,
  apiPath?: string,
  note?: string,
): PdfOperationSpec => ({
  id,
  label,
  category,
  engine: "stirling_pdf",
  ...(apiPath ? { apiPath } : {}),
  ...(note ? { note } : {}),
});

const paddleocr = (
  id: string,
  label: string,
  note?: string,
): PdfOperationSpec => ({
  id,
  label,
  category: "ocr_document_vision",
  engine: "paddleocr",
  ...(note ? { note } : {}),
});

export const pdfOperationRegistry = [
  stirling("merge-pdfs", "Merge PDFs", "page_operations", "/api/v1/general/merge-pdfs"),
  stirling("split-pages", "Split PDFs", "page_operations", "/api/v1/general/split-pages"),
  stirling("extract-pages", "Extract Pages", "page_operations"),
  stirling("remove-pages", "Remove Pages", "page_operations", "/api/v1/general/remove-pages"),
  stirling("rearrange-pages", "Rearrange Pages", "page_operations", "/api/v1/general/rearrange-pages"),
  stirling("rotate-pdf", "Rotate PDFs", "page_operations", "/api/v1/general/rotate-pdf"),
  stirling("crop", "Crop Pages", "page_operations", "/api/v1/general/crop"),
  stirling("scale-pages", "Scale Pages", "page_operations", "/api/v1/general/scale-pages"),
  stirling("add-page-numbers", "Add Page Numbers", "page_operations", "/api/v1/misc/add-page-numbers"),
  stirling("pdf-to-single-page", "PDF to Single Page", "page_operations", "/api/v1/general/pdf-to-single-page"),
  stirling("multi-page-layout", "Multi-Page Layout", "page_operations", "/api/v1/general/multi-page-layout"),
  stirling("booklet-imposition", "Booklet Imposition", "page_operations", "/api/v1/general/booklet-imposition"),
  stirling("overlay-pdf", "Overlay PDFs", "page_operations", "/api/v1/general/overlay-pdfs"),
  stirling("split-pdf-by-sections", "Split by Sections", "page_operations", "/api/v1/general/split-pdf-by-sections"),
  stirling("split-pdf-by-chapters", "Split by Chapters", "page_operations", "/api/v1/general/split-pdf-by-chapters"),
  stirling("auto-split-pdf", "Auto Split PDF", "page_operations", "/api/v1/misc/auto-split-pdf"),
  stirling("split-by-size-or-count", "Split by Size/Count", "page_operations", "/api/v1/general/split-by-size-or-count"),
  stirling("add-attachments", "Add Attachments", "attachments_comments", "/api/v1/misc/add-attachments"),
  stirling("pdf-to-img", "PDF to Image", "conversion", "/api/v1/convert/pdf/img"),
  stirling("img-to-pdf", "Image to PDF", "conversion", "/api/v1/convert/img/pdf"),
  stirling("file-to-pdf", "File to PDF", "conversion", "/api/v1/convert/file/pdf"),
  stirling("pdf-to-word", "PDF to Word", "conversion", "/api/v1/convert/pdf/word"),
  stirling("pdf-to-presentation", "PDF to Presentation", "conversion", "/api/v1/convert/pdf/presentation"),
  stirling("pdf-to-text", "PDF to Text", "conversion", "/api/v1/convert/pdf/text"),
  stirling("pdf-to-html", "PDF to HTML", "conversion", "/api/v1/convert/pdf/html"),
  stirling("pdf-to-xml", "PDF to XML", "conversion", "/api/v1/convert/pdf/xml"),
  stirling("pdf-to-markdown", "PDF to Markdown", "conversion", "/api/v1/convert/pdf/markdown"),
  stirling("pdf-to-csv", "PDF to CSV", "conversion", "/api/v1/convert/pdf/csv"),
  stirling("pdf-to-epub", "PDF to EPUB", "conversion", "/api/v1/convert/pdf/epub"),
  stirling("pdf-to-vector", "PDF to Vector", "conversion", "/api/v1/convert/pdf/vector"),
  stirling("pdf-to-video", "PDF to Video", "conversion"),
  stirling("pdf-to-json", "PDF to JSON", "conversion"),
  stirling("pdf-to-rtf", "PDF to RTF", "conversion"),
  stirling("pdf-to-cbz", "PDF to CBZ", "conversion", "/api/v1/convert/pdf/cbz"),
  stirling("pdf-to-cbr", "PDF to CBR", "conversion", "/api/v1/convert/pdf/cbr", "May be disabled when the rar dependency is not installed."),
  stirling("pdf-to-pdfa", "PDF to PDF/A", "conversion", "/api/v1/convert/pdf/pdfa"),
  stirling("html-to-pdf", "HTML to PDF", "conversion", "/api/v1/convert/html/pdf"),
  stirling("url-to-pdf", "URL to PDF", "conversion", "/api/v1/convert/url/pdf", "May be disabled by deployment endpoint policy."),
  stirling("markdown-to-pdf", "Markdown to PDF", "conversion", "/api/v1/convert/markdown/pdf"),
  stirling("eml-to-pdf", "Email to PDF", "conversion", "/api/v1/convert/eml/pdf"),
  stirling("cbz-to-pdf", "CBZ to PDF", "conversion", "/api/v1/convert/cbz/pdf"),
  stirling("cbr-to-pdf", "CBR to PDF", "conversion", "/api/v1/convert/cbr/pdf", "May be disabled when the rar dependency is not installed."),
  stirling("ebook-to-pdf", "Ebook to PDF", "conversion", "/api/v1/convert/ebook/pdf"),
  stirling("svg-to-pdf", "SVG to PDF", "conversion", "/api/v1/convert/svg/pdf"),
  stirling("json-to-pdf", "JSON to PDF", "conversion"),
  stirling("vector-to-pdf", "Vector to PDF", "conversion", "/api/v1/convert/vector/pdf"),
  stirling("add-password", "Add Password Protection", "security_signing", "/api/v1/security/add-password"),
  stirling("remove-password", "Remove Password", "security_signing", "/api/v1/security/remove-password"),
  stirling("change-permissions", "Change Permissions", "security_signing"),
  stirling("add-watermark", "Add Watermark", "security_signing", "/api/v1/security/add-watermark"),
  stirling("add-stamp", "Add Stamp", "security_signing", "/api/v1/misc/add-stamp"),
  stirling("sanitize-pdf", "Sanitize PDF", "security_signing", "/api/v1/security/sanitize-pdf"),
  stirling("flatten", "Flatten Form Fields", "security_signing", "/api/v1/misc/flatten"),
  stirling("unlock-pdf-forms", "Unlock PDF Forms", "security_signing", "/api/v1/misc/unlock-pdf-forms"),
  stirling("cert-sign", "Certificate Sign", "security_signing", "/api/v1/security/cert-sign"),
  stirling("sign", "Draw/Text/Image Signature", "security_signing", undefined, "Visual signing uses proprietary/workflow endpoints in some deployments."),
  stirling("remove-cert-sign", "Remove Certificate Signature", "security_signing", "/api/v1/security/remove-cert-sign"),
  stirling("validate-signature", "Validate Signature", "security_signing", "/api/v1/security/validate-signature"),
  stirling("verify-pdf", "Verify PDF", "security_signing", "/api/v1/security/verify-pdf"),
  stirling("redact", "Redact Information", "security_signing", "/api/v1/security/redact"),
  stirling("auto-redact", "Auto Redact", "security_signing", "/api/v1/security/auto-redact"),
  stirling("timestamp-pdf", "Timestamp PDF", "security_signing", "/api/v1/security/timestamp-pdf"),
  stirling("extract-images", "Extract Images", "content_extraction_removal", "/api/v1/misc/extract-images"),
  stirling("extract-image-scans", "Extract Image Scans", "content_extraction_removal", "/api/v1/misc/extract-image-scans"),
  stirling("remove-image-pdf", "Remove Images", "content_extraction_removal", "/api/v1/general/remove-image-pdf"),
  stirling("remove-annotations", "Remove Annotations", "content_extraction_removal"),
  stirling("remove-blanks", "Remove Blank Pages", "content_extraction_removal", "/api/v1/misc/remove-blanks"),
  stirling("ocr-pdf", "OCR with Stirling-PDF/OCRmyPDF", "content_extraction_removal", "/api/v1/misc/ocr-pdf"),
  stirling("extract-attachments", "Extract Attachments", "attachments_comments", "/api/v1/misc/extract-attachments"),
  stirling("list-attachments", "List Attachments", "attachments_comments", "/api/v1/misc/list-attachments"),
  stirling("delete-attachment", "Delete Attachment", "attachments_comments", "/api/v1/misc/delete-attachment"),
  stirling("rename-attachment", "Rename Attachment", "attachments_comments", "/api/v1/misc/rename-attachment"),
  stirling("add-comments", "Add Comments", "attachments_comments", "/api/v1/misc/add-comments"),
  stirling("text-editor-pdf", "Text Editor", "document_editing_analysis", "/api/v1/convert/pdf/text-editor", "Text editing may require follow-up job/page endpoints."),
  stirling("edit-table-of-contents", "Edit Table of Contents", "document_editing_analysis", "/api/v1/general/edit-table-of-contents"),
  stirling("update-metadata", "Change Metadata", "document_editing_analysis", "/api/v1/misc/update-metadata"),
  stirling("get-info-on-pdf", "Get PDF Info", "document_editing_analysis", "/api/v1/security/get-info-on-pdf"),
  stirling("compare", "Compare PDFs", "document_editing_analysis"),
  stirling("adjust-contrast", "Adjust Contrast", "document_editing_analysis"),
  stirling("replace-invert-pdf", "Replace/Invert Colors", "document_editing_analysis", "/api/v1/misc/replace-invert-pdf"),
  stirling("scanner-effect", "Scanner Effect", "document_editing_analysis", "/api/v1/misc/scanner-effect"),
  stirling("repair", "Repair PDF", "document_editing_analysis", "/api/v1/misc/repair"),
  stirling("add-image", "Add Image to PDF", "document_editing_analysis", "/api/v1/misc/add-image"),
  stirling("basic-info", "Basic PDF Info", "analysis", "/api/v1/analysis/basic-info"),
  stirling("document-properties", "Document Properties", "analysis", "/api/v1/analysis/document-properties"),
  stirling("font-info", "Font Info", "analysis", "/api/v1/analysis/font-info"),
  stirling("annotation-info", "Annotation Info", "analysis", "/api/v1/analysis/annotation-info"),
  stirling("page-count", "Page Count", "analysis", "/api/v1/analysis/page-count"),
  stirling("page-dimensions", "Page Dimensions", "analysis", "/api/v1/analysis/page-dimensions"),
  stirling("security-info", "Security Info", "analysis", "/api/v1/analysis/security-info"),
  stirling("fields", "Form Fields", "form_fields", "/api/v1/form/fields"),
  stirling("fields-with-coordinates", "Form Fields with Coordinates", "form_fields", "/api/v1/form/fields-with-coordinates"),
  stirling("form-fields", "Analyze Form Fields", "form_fields", "/api/v1/analysis/form-fields"),
  stirling("fill", "Fill Form Fields", "form_fields", "/api/v1/form/fill"),
  stirling("modify-fields", "Modify Form Fields", "form_fields", "/api/v1/form/modify-fields"),
  stirling("delete-fields", "Delete Form Fields", "form_fields", "/api/v1/form/delete-fields"),
  stirling("extract-form-csv", "Extract Form Data CSV", "form_fields", "/api/v1/form/extract-csv"),
  stirling("extract-form-xlsx", "Extract Form Data XLSX", "form_fields", "/api/v1/form/extract-xlsx"),
  stirling("multi-tool", "Multi-Tool Workbench", "multi_tool_automation", undefined, "Multi-tool workbench may be UI-only in some deployments."),
  stirling("compress-pdf", "Compress PDFs", "multi_tool_automation", "/api/v1/misc/compress-pdf"),
  stirling("automate", "Automation", "multi_tool_automation"),
  stirling("pipeline", "Pipeline", "multi_tool_automation", "/api/v1/pipeline/handleData"),
  stirling("auto-rename", "Auto Rename", "multi_tool_automation", "/api/v1/misc/auto-rename"),
  stirling("decompress-pdf", "Decompress PDF", "multi_tool_automation", "/api/v1/misc/decompress-pdf"),
  stirling("filter-contains-image", "Filter Pages Containing Images", "filtering", "/api/v1/filter/filter-contains-image"),
  stirling("filter-contains-text", "Filter Pages Containing Text", "filtering", "/api/v1/filter/filter-contains-text"),
  stirling("filter-file-size", "Filter by File Size", "filtering", "/api/v1/filter/filter-file-size"),
  stirling("filter-page-count", "Filter by Page Count", "filtering", "/api/v1/filter/filter-page-count"),
  stirling("filter-page-rotation", "Filter by Page Rotation", "filtering", "/api/v1/filter/filter-page-rotation"),
  stirling("filter-page-size", "Filter by Page Size", "filtering", "/api/v1/filter/filter-page-size"),
  stirling("view-pdf", "PDF Viewer", "viewing_display", undefined, "Official docs mark PDF viewing as front-end exclusive."),
  stirling("show-javascript", "Show JavaScript in PDF", "viewing_display", "/api/v1/misc/show-javascript"),
  paddleocr("paddleocr-ocr", "PaddleOCR PDF/Image OCR"),
  paddleocr("paddleocr-layout", "PaddleOCR layout extraction"),
  paddleocr("paddleocr-vl", "PaddleOCR-VL document parsing"),
] as const satisfies readonly PdfOperationSpec[];

export const pdfOperationAliases: Record<string, string> = {
  merge: "merge-pdfs",
  split: "split-pages",
  compress: "compress-pdf",
  ocr: "paddleocr-ocr",
  "ocr-layout": "paddleocr-layout",
  "ocr-vl": "paddleocr-vl",
  "stirling-ocr": "ocr-pdf",
  pdfa: "pdf-to-pdfa",
  metadata: "update-metadata",
};

export function normalizePdfOperationId(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return pdfOperationAliases[normalized] ?? normalized;
}

export function pdfOperationById(value: string): PdfOperationSpec | undefined {
  const normalized = normalizePdfOperationId(value);
  return pdfOperationRegistry.find((operation) => operation.id === normalized);
}

export function pdfOperationsByCategory(): Record<
  PdfOperationCategory,
  PdfOperationSpec[]
> {
  const grouped = {} as Record<PdfOperationCategory, PdfOperationSpec[]>;
  for (const operation of pdfOperationRegistry) {
    grouped[operation.category] = grouped[operation.category] ?? [];
    grouped[operation.category].push(operation);
  }
  return grouped;
}
