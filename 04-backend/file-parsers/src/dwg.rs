//! DWG and DXF parsers.
//!
//! DWG remains a licensed external adapter boundary. DXF uses `dxf` 0.6.1.

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
        Err(ParseError::Parser {
            format: "dwg",
            message: format!(
                "DWG requires the licensed external adapter; read {} bytes from {}",
                bytes.len(),
                path.display()
            ),
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
        let mut reader = std::io::BufReader::new(file);
        let drawing = dxf::Drawing::load(&mut reader).map_err(|e| ParseError::Parser {
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
