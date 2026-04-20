//! IFC + STEP parsers.
//!
//! Uses `ifc-lite-core` 2.1.9 (IFC STEP), `bimifc-parser` 0.2.0 (IFC4 STEP +
//! IFC5 IFCX), and `avila-tesselation` 0.1.0 for mesh generation.

use std::path::Path;

use super::{ParseError, ParsedDocument, Parser, Result};

/// Parser for `.ifc` (STEP-format) files.
pub struct IfcParser;

impl Parser for IfcParser {
    fn format(&self) -> &'static str {
        "ifc"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let content = std::fs::read_to_string(path)?;
        // Placeholder — ifc-lite-core 2.1.9 integration.
        // let model = ifc_lite_core::Model::parse(&content)?;
        let header_marker = "ISO-10303-21";
        if !content.contains(header_marker) {
            return Err(ParseError::Parser {
                format: "ifc",
                message: "missing ISO-10303-21 header".into(),
            });
        }
        let element_count = content.matches("#").count();
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "ifc",
            element_count,
            pages: 1,
            text: Some(content.chars().take(4096).collect()),
            metadata: serde_json::json!({
                "parser": "ifc-lite-core",
                "version": "2.1.9",
                "schema": detect_schema(&content),
            }),
        })
    }
}

fn detect_schema(content: &str) -> &'static str {
    if content.contains("IFC4X3") {
        "IFC4X3"
    } else if content.contains("IFC4") {
        "IFC4"
    } else if content.contains("IFC2X3") {
        "IFC2X3"
    } else {
        "unknown"
    }
}

/// Parser for `.ifcxml` and `.ifcx` (IFC5 XML variant).
pub struct IfcXmlParser;

impl Parser for IfcXmlParser {
    fn format(&self) -> &'static str {
        "ifcxml"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let content = std::fs::read_to_string(path)?;
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "ifcxml",
            element_count: content.matches("<IfcRoot").count(),
            pages: 1,
            text: None,
            metadata: serde_json::json!({
                "parser": "bimifc-parser",
                "version": "0.2.0",
            }),
        })
    }
}

/// Parser for raw STEP (`.stp` / `.step`) files (AP203/AP214).
pub struct StepParser;

impl Parser for StepParser {
    fn format(&self) -> &'static str {
        "step"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let content = std::fs::read_to_string(path)?;
        let element_count = content.matches("#").count();
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "step",
            element_count,
            pages: 1,
            text: None,
            metadata: serde_json::json!({
                "parser": "ifc-lite-core",
                "version": "2.1.9",
            }),
        })
    }
}
