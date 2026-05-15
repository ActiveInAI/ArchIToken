//! IFC + STEP parsers.
//!
//! Uses an internal STEP text scanner for IFC metadata counts. Geometry kernels
//! remain external adapter work because the Rust parser dependency set must pass
//! enterprise license and advisory policy.

use std::path::Path;

use super::{ParseError, ParsedDocument, Parser, Result};

#[derive(Debug, Clone, Default)]
#[allow(clippy::struct_field_names)]
struct IfcDocumentSummary {
    entity_count: usize,
    product_element_count: usize,
    geometry_mesh_count: usize,
    geometry_vertex_count: usize,
    geometry_triangle_count: usize,
    geometry_failure_count: usize,
}

/// Parser for `.ifc` (STEP-format) files.
pub struct IfcParser;

impl Parser for IfcParser {
    fn format(&self) -> &'static str {
        "ifc"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let content = std::fs::read_to_string(path)?;
        let header_marker = "ISO-10303-21";
        if !content.contains(header_marker) {
            return Err(ParseError::Parser {
                format: "ifc",
                message: "missing ISO-10303-21 header".into(),
            });
        }
        let summary = summarize_ifc_step(&content)?;
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "ifc",
            element_count: summary.entity_count,
            pages: 1,
            text: Some(content.chars().take(4096).collect()),
            metadata: serde_json::json!({
                "parser": "architoken-step-scanner",
                "version": "2.0.0",
                "schema": detect_schema(&content),
                "entityCount": summary.entity_count,
                "productElementCount": summary.product_element_count,
                "geometryMeshCount": summary.geometry_mesh_count,
                "geometryVertexCount": summary.geometry_vertex_count,
                "geometryTriangleCount": summary.geometry_triangle_count,
                "geometryFailureCount": summary.geometry_failure_count,
            }),
        })
    }
}

fn summarize_ifc_step(content: &str) -> Result<IfcDocumentSummary> {
    let mut summary = IfcDocumentSummary::default();

    for statement in step_entity_statements(content) {
        let Some(entity) = step_entity_name(statement) else {
            continue;
        };
        summary.entity_count += 1;
        if is_physical_element(entity) {
            summary.product_element_count += 1;
        }
    }

    if summary.entity_count == 0 {
        return Err(ParseError::Parser {
            format: "ifc",
            message: "STEP scanner found no entities".into(),
        });
    }

    Ok(summary)
}

fn step_entity_statements(content: &str) -> Vec<&str> {
    let mut statements = Vec::new();
    let mut start = 0;
    let mut in_string = false;
    let mut chars = content.char_indices().peekable();

    while let Some((idx, ch)) = chars.next() {
        if ch == '\'' {
            if matches!(chars.peek(), Some((_, '\''))) {
                chars.next();
            } else {
                in_string = !in_string;
            }
            continue;
        }
        if ch == ';' && !in_string {
            let statement = &content[start..=idx];
            if statement.trim_start().starts_with('#') {
                statements.push(statement);
            }
            start = idx + ch.len_utf8();
        }
    }

    statements
}

fn step_entity_name(statement: &str) -> Option<&str> {
    let hash_pos = statement.find('#')?;
    let eq_pos = statement[hash_pos..].find('=')? + hash_pos;
    let body = statement[eq_pos + 1..].trim();
    let open = body.find('(')?;
    Some(body[..open].trim())
}

fn is_physical_element(entity: &str) -> bool {
    matches!(
        entity.to_ascii_uppercase().as_str(),
        "IFCBEAM"
            | "IFCCOLUMN"
            | "IFCMEMBER"
            | "IFCPLATE"
            | "IFCELEMENTASSEMBLY"
            | "IFCBUILDINGELEMENTPROXY"
            | "IFCFASTENER"
            | "IFCMECHANICALFASTENER"
            | "IFCDISCRETEACCESSORY"
            | "IFCREINFORCINGBAR"
            | "IFCREINFORCINGMESH"
            | "IFCWALL"
            | "IFCSLAB"
            | "IFCROOF"
            | "IFCSTAIR"
            | "IFCRAILING"
    )
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
                "parser": "ifcxml-lite",
                "version": "2.0.0",
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
        let element_count = count_step_entities(&content);
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "step",
            element_count,
            pages: 1,
            text: None,
            metadata: serde_json::json!({
                "parser": "architoken-step-scanner",
                "version": "2.0.0",
            }),
        })
    }
}

fn count_step_entities(content: &str) -> usize {
    step_entity_statements(content).len()
}
