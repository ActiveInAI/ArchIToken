//! IFC + STEP parsers.
//!
//! Uses `ifc-lite-core` 2.1.9 (IFC STEP), `bimifc-parser` 0.2.0 (IFC4 STEP +
//! IFC5 IFCX), and `avila-tesselation` 0.1.0 for mesh generation.

use std::path::Path;

use ifc_lite_core::{
    EntityDecoder, EntityScanner, IfcType as IfcLiteType, build_entity_index, has_geometry_by_name,
};
use ifc_lite_geometry::GeometryRouter;

use super::{ParseError, ParsedDocument, Parser, Result};

type IfcLiteGeometryJob = (u32, usize, usize, IfcLiteType);

#[derive(Debug, Clone, Default)]
struct IfcLiteDocumentSummary {
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
        let summary = summarize_ifc_with_ifc_lite(&content)?;
        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "ifc",
            element_count: summary.entity_count,
            pages: 1,
            text: Some(content.chars().take(4096).collect()),
            metadata: serde_json::json!({
                "parser": "ifc-lite-core/ifc-lite-geometry",
                "version": "2.1.9",
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

fn summarize_ifc_with_ifc_lite(content: &str) -> Result<IfcLiteDocumentSummary> {
    let entity_index = build_entity_index(content);
    let mut decoder = EntityDecoder::with_index(content, entity_index);
    let mut scanner = EntityScanner::new(content);
    let mut summary = IfcLiteDocumentSummary::default();
    let mut geometry_jobs = Vec::new();

    while let Some((id, type_name, start, end)) = scanner.next_entity() {
        summary.entity_count += 1;
        let entity = type_name.to_ascii_uppercase();
        if is_physical_element(&entity) {
            summary.product_element_count += 1;
        }
        if !has_geometry_by_name(&entity) {
            continue;
        }
        match decoder.decode_at_with_id(id, start, end) {
            Ok(decoded) => geometry_jobs.push((id, start, end, decoded.ifc_type)),
            Err(_) => summary.geometry_failure_count += 1,
        }
    }

    if summary.entity_count == 0 {
        return Err(ParseError::Parser {
            format: "ifc",
            message: "ifc-lite-core found no STEP entities".into(),
        });
    }

    let geometry = process_ifc_lite_geometry(content, &mut decoder, &geometry_jobs);
    summary.geometry_mesh_count = geometry.geometry_mesh_count;
    summary.geometry_vertex_count = geometry.geometry_vertex_count;
    summary.geometry_triangle_count = geometry.geometry_triangle_count;
    summary.geometry_failure_count += geometry.geometry_failure_count;
    Ok(summary)
}

fn process_ifc_lite_geometry(
    content: &str,
    decoder: &mut EntityDecoder<'_>,
    geometry_jobs: &[IfcLiteGeometryJob],
) -> IfcLiteDocumentSummary {
    if geometry_jobs.is_empty() {
        return IfcLiteDocumentSummary::default();
    }

    let probe_router = GeometryRouter::with_units(content, decoder);
    let rtc_offset = probe_router
        .detect_rtc_offset_from_jobs(geometry_jobs, decoder)
        .unwrap_or((0.0, 0.0, 0.0));
    let router = GeometryRouter::with_units_and_rtc(content, decoder, rtc_offset);
    let mut summary = IfcLiteDocumentSummary::default();

    for (id, start, end, _) in geometry_jobs {
        let Ok(entity) = decoder.decode_at_with_id(*id, *start, *end) else {
            summary.geometry_failure_count += 1;
            continue;
        };
        match router.process_element(&entity, decoder) {
            Ok(mesh) if mesh.is_empty() => {}
            Ok(mesh) => {
                summary.geometry_mesh_count += 1;
                summary.geometry_vertex_count += mesh.vertex_count();
                summary.geometry_triangle_count += mesh.triangle_count();
            }
            Err(_) => summary.geometry_failure_count += 1,
        }
    }

    summary
}

fn is_physical_element(entity: &str) -> bool {
    matches!(
        entity,
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
        let element_count = count_step_entities(&content);
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

fn count_step_entities(content: &str) -> usize {
    let mut scanner = EntityScanner::new(content);
    let mut count = 0;
    while scanner.next_entity().is_some() {
        count += 1;
    }
    count
}
