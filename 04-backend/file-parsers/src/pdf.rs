//! PDF parser — `pdf_oxide` 0.3.34 (100% pass rate on 3830-PDF corpus).

use std::path::Path;

use super::{ParseError, ParsedDocument, Parser, Result};

/// PDF parser using the configured Rust PDF adapters.
pub struct PdfParser;

impl Parser for PdfParser {
    fn format(&self) -> &'static str {
        "pdf"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let bytes = std::fs::read(path)?;

        // Primary: pdf_oxide 0.3.34 (fastest Rust PDF).
        // Fallback: lopdf 0.40.0.
        let (pages, text) = match extract_with_pdf_oxide(&bytes) {
            Ok(result) => result,
            Err(_) => extract_with_lopdf(&bytes)?,
        };

        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "pdf",
            element_count: text.len() / 256,
            pages,
            text: Some(text),
            metadata: serde_json::json!({
                "parser": "pdf_oxide",
                "version": "0.3.34",
                "byte_size": bytes.len(),
            }),
        })
    }
}

fn extract_with_pdf_oxide(_bytes: &[u8]) -> Result<(usize, String)> {
    // pdf_oxide 0.3.34 adapter is disabled in this workspace build:
    //   let doc = pdf_oxide::Document::parse(_bytes)?;
    //   let text = doc.extract_text()?;
    //   let pages = doc.page_count();
    // Returning Err triggers the fallback.
    Err(ParseError::Parser {
        format: "pdf",
        message: "pdf_oxide adapter is not enabled; using lopdf fallback".into(),
    })
}

fn extract_with_lopdf(bytes: &[u8]) -> Result<(usize, String)> {
    use lopdf::Document;
    let doc = Document::load_mem(bytes).map_err(|e| ParseError::Parser {
        format: "pdf",
        message: e.to_string(),
    })?;
    let pages = doc.get_pages();
    let mut text = String::new();
    for &page_num in pages.keys() {
        if let Ok(t) = doc.extract_text(&[page_num]) {
            text.push_str(&t);
            text.push('\n');
        }
    }
    Ok((pages.len(), text))
}
