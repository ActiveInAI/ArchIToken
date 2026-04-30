export function DocumentWorkbench() {
  return (
    <section className="panel">
      <h2>DocumentWorkbench</h2>
      <p>
        PDF, Office, OCR, and document-AI shell. PDFium and MuPDF are adapter
        contracts; PDF.js is not the core runtime.
      </p>
      <div className="badge-row">
        {["PDFium", "MuPDF", "MinerU", "PaddleOCR", "MarkItDown", "LibreOffice"].map((tag) => (
          <span className="badge" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
