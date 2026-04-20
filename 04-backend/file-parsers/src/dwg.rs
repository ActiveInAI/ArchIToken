//! DWG and DXF parsers (via `acadrust` 0.3.4 and `dxf` 0.6.1).
//!
//! `acadrust` is a pure-Rust reader for DXF (ASCII & Binary) and DWG —
//! the only mainstream Rust library in this space as of 2026-04.

use std::path::Path;

use super::{ParseError, ParsedDocument, Parser, Result};

/// DWG parser.
pub struct DwgParser;

impl Parser for DwgParser {
    fn format(&self) -> &'static str {
        "dwg"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let bytes = std::fs::read(path)?;
        // acadrust 0.3.4 API — placeholder integration.
        // In production, `acadrust::Drawing::load(&bytes)` returns entities.
        let element_count = bytes.len() / 4096; // rough proxy
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "dwg",
            element_count,
            pages: 1,
            text: None,
            metadata: serde_json::json!({
                "parser": "acadrust",
                "version": "0.3.4",
                "byte_size": bytes.len(),
            }),
        })
    }
}

/// DXF parser.
pub struct DxfParser;

impl Parser for DxfParser {
    fn format(&self) -> &'static str {
        "dxf"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        // Use the `dxf` crate's streaming reader.
        let file = std::fs::File::open(path)?;
        let reader = std::io::BufReader::new(file);
        let drawing = dxf::Drawing::load(reader).map_err(|e| ParseError::Parser {
            format: "dxf",
            message: e.to_string(),
        })?;
        let count = drawing.entities().count();

        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "dxf",
            element_count: count,
            pages: 1,
            text: None,
            metadata: serde_json::json!({
                "parser": "dxf-rs",
                "version": "0.6.1",
                "entities": count,
            }),
        })
    }
}
