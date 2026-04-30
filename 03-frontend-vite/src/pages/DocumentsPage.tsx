import { DocumentWorkbench } from "../components/DocumentWorkbench";
import { PageHero } from "../components/PageHero";

export function DocumentsPage() {
  return (
    <>
      <PageHero
        eyebrow="Document AI"
        title="Documents"
        summary="PDF, Office, OCR, and Markdown extraction contracts for worker-side adapters and auditable conversion output."
        tags={["PDFium", "MuPDF", "MinerU", "PaddleOCR", "LibreOffice"]}
      />
      <DocumentWorkbench />
    </>
  );
}
