//! buildingSMART openBIM model ingestion, viewing, and steel BOM contracts.
//!
//! The current production focus is not text-to-model generation. This module
//! accepts openBIM IFC content exported from existing authoring workflows,
//! prepares a viewer manifest, and extracts a deterministic heavy-steel
//! component BOM from IFC element, material, and quantity relationships.

use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    runtime_context::{PermissionGuard, RequestContext, RuntimePermission, assert_runtime_scope},
    storage_router::{ElementIdNamespace, ViewerAdapterHint},
    viewer_adapter::ViewerCommandKind,
};

const OPENBIM_MODULE_ID: &str = "digital_twin";

/// buildingSMART openBIM standards the backend treats as first-class contracts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpenBimStandard {
    /// Industry Foundation Classes exchange model.
    Ifc,
    /// `IFC2x3` Coordination View era schema.
    #[serde(rename = "ifc2x3")]
    Ifc2x3,
    /// IFC4 Reference View / Design Transfer era schema.
    Ifc4,
    /// IFC4.3 infrastructure-capable schema.
    #[serde(rename = "ifc4x3")]
    Ifc4x3,
    /// Information Delivery Manual process and exchange requirements.
    Idm,
    /// Model View Definition exchange-view profile.
    Mvd,
    /// buildingSMART Data Dictionary semantic mapping.
    Bsdd,
    /// BIM Collaboration Format issue coordination.
    Bcf,
    /// Information Delivery Specification validation package.
    Ids,
    /// buildingSMART Validate service or equivalent validation report.
    Validate,
    /// Construction Operations Building information exchange handover data.
    Cobie,
    /// buildingSMART `OpenCDE` API contract reference.
    OpenCdeApi,
}

/// IFC schema detected from `FILE_SCHEMA`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IfcSchema {
    /// `IFC2x3`.
    #[serde(rename = "ifc2x3")]
    Ifc2x3,
    /// IFC4.
    Ifc4,
    /// IFC4.3.
    #[serde(rename = "ifc4x3")]
    Ifc4x3,
}

/// Source authoring workflow metadata. These are not runtime dependencies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceAuthoringTool {
    /// Generic CAD export workflow.
    Cad,
    /// Tekla Structures IFC export.
    TeklaStructures,
    /// Autodesk Revit IFC export.
    Revit,
    /// Rhino IFC/open geometry workflow.
    Rhino,
    /// `SketchUp` IFC/open geometry workflow.
    SketchUp,
    /// `SolidWorks` IFC/STEP-adjacent workflow.
    SolidWorks,
    /// Unknown or manually supplied source.
    Unknown,
}

/// BIM model ingest request for small preview/runtime tests.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenBimIngestRequest {
    /// Display name.
    pub name: String,
    /// Source tool metadata.
    pub source_authoring_tool: Option<SourceAuthoringTool>,
    /// IFC STEP physical file content.
    pub ifc_content: String,
    /// Optional actor fallback.
    pub actor: Option<String>,
}

/// Stored openBIM model summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenBimModelRecord {
    /// Model id.
    pub model_id: Uuid,
    /// Display name.
    pub name: String,
    /// Detected IFC schema.
    pub schema: IfcSchema,
    /// buildingSMART standards attached to this model.
    pub standards: Vec<OpenBimStandard>,
    /// Source authoring workflow metadata.
    pub source_authoring_tool: SourceAuthoringTool,
    /// Total physical/product element count found in IFC.
    pub element_count: usize,
    /// Heavy-steel BOM item count.
    pub steel_element_count: usize,
    /// Tenant id used for isolation.
    pub tenant_id: String,
    /// Project id used for isolation.
    pub project_id: String,
    /// Actor that ingested the model.
    pub actor: String,
    /// In-memory record version.
    pub version: u32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Viewer manifest for loading openBIM models without proprietary viewer lock-in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BimViewerManifest {
    /// Manifest id.
    pub manifest_id: Uuid,
    /// Model id.
    pub model_id: Uuid,
    /// Display name.
    pub model_name: String,
    /// Detected IFC schema.
    pub schema: IfcSchema,
    /// Preferred source geometry format.
    pub preferred_geometry_format: String,
    /// Element id namespace for selection and property lookup.
    pub element_id_namespace: ElementIdNamespace,
    /// Open viewer adapters the frontend may use.
    pub viewer_adapters: Vec<ViewerAdapterHint>,
    /// Auditable viewer commands supported for this model.
    pub supported_commands: Vec<ViewerCommandKind>,
    /// Total physical/product elements found in IFC.
    pub element_count: usize,
    /// Steel BOM element count.
    pub steel_element_count: usize,
    /// Source authoring workflow metadata.
    pub source_authoring_tool: SourceAuthoringTool,
    /// Manifest payload reserved for viewer adapters.
    pub payload: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// One heavy-steel BOM row extracted from IFC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteelBomItem {
    /// Stable row number.
    pub row_no: usize,
    /// IFC STEP instance id, for example `#120`.
    pub step_id: String,
    /// IFC `GlobalId`.
    pub ifc_guid: String,
    /// IFC entity, for example `IFCBEAM`.
    pub ifc_entity: String,
    /// Heavy-steel component category.
    pub category: String,
    /// Element name.
    pub name: Option<String>,
    /// Object type or predefined type.
    pub object_type: Option<String>,
    /// Element tag/mark.
    pub tag: Option<String>,
    /// Material name resolved from `IfcRelAssociatesMaterial`, when available.
    pub material: Option<String>,
    /// Profile name resolved from material/profile records, when available.
    pub profile: Option<String>,
    /// Per-row quantity.
    pub quantity: String,
    /// Quantity unit.
    pub unit: String,
    /// Length from IFC quantities, when available.
    pub length_m: Option<String>,
    /// Area from IFC quantities, when available.
    pub area_m2: Option<String>,
    /// Volume from IFC quantities, when available.
    pub volume_m3: Option<String>,
    /// Weight or mass from IFC quantities, when available.
    pub weight_kg: Option<String>,
    /// Source IFC line number.
    pub source_line: usize,
}

/// Heavy-steel BOM summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteelBomSummary {
    /// Total BOM rows.
    pub total_items: usize,
    /// Counts grouped by IFC entity.
    pub by_ifc_entity: BTreeMap<String, usize>,
    /// Counts grouped by heavy-steel category.
    pub by_category: BTreeMap<String, usize>,
}

/// Heavy-steel BOM export for one openBIM model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteelBomExport {
    /// Export id.
    pub export_id: Uuid,
    /// Source model id.
    pub model_id: Uuid,
    /// Source model name.
    pub model_name: String,
    /// Detected IFC schema.
    pub schema: IfcSchema,
    /// buildingSMART basis for extraction.
    pub standard: String,
    /// BOM rows.
    pub items: Vec<SteelBomItem>,
    /// BOM summary.
    pub summary: SteelBomSummary,
    /// CSV representation.
    pub csv: String,
    /// Creation timestamp.
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct StoredOpenBimModel {
    record: OpenBimModelRecord,
    viewer_manifest: BimViewerManifest,
    bom: SteelBomExport,
}

/// In-memory openBIM service.
#[derive(Debug, Clone)]
pub struct OpenBimService {
    models: Arc<RwLock<HashMap<Uuid, StoredOpenBimModel>>>,
    audit: Arc<ModuleAuditService>,
}

impl OpenBimService {
    /// Create an empty openBIM service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>) -> Self {
        Self {
            models: Arc::new(RwLock::new(HashMap::new())),
            audit,
        }
    }

    /// Ingest a buildingSMART IFC model into the preview runtime.
    ///
    /// # Errors
    /// Returns permission or validation errors when content is not IFC STEP or
    /// an accepted buildingSMART schema is missing.
    pub fn ingest_model_with_context(
        &self,
        context: &RequestContext,
        req: OpenBimIngestRequest,
    ) -> Result<OpenBimModelRecord> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
        let name = validate_model_name(&req.name)?;
        let parsed = parse_ifc_step(&req.ifc_content)?;
        let schema = parsed.schema;
        let bom_items = extract_steel_bom_items(&parsed.records);
        let element_count = parsed.product_element_count;
        let model_id = Uuid::new_v4();
        let now = Utc::now();
        let source_authoring_tool = req
            .source_authoring_tool
            .unwrap_or(SourceAuthoringTool::Unknown);
        let standards = standards_for_schema(schema);
        let record = OpenBimModelRecord {
            model_id,
            name,
            schema,
            standards: standards.clone(),
            source_authoring_tool,
            element_count,
            steel_element_count: bom_items.len(),
            tenant_id: context.tenant_id.clone(),
            project_id: context.project_id.clone(),
            actor: req.actor.unwrap_or_else(|| context.actor.clone()),
            version: 1,
            created_at: now,
            updated_at: now,
        };
        let viewer_manifest = viewer_manifest_for(&record, &standards);
        let bom = steel_bom_export_for(&record, bom_items, now);
        self.models.write().insert(
            model_id,
            StoredOpenBimModel {
                record: record.clone(),
                viewer_manifest,
                bom,
            },
        );
        let _event = self.audit.append(AuditEventInput {
            module_id: OPENBIM_MODULE_ID.to_owned(),
            actor: record.actor.clone(),
            action: AuditEventKind::AssetCreated,
            target_type: "openbim_model".to_owned(),
            target_id: model_id.to_string(),
            summary: "buildingSMART IFC model ingested".to_owned(),
            metadata: json!({
                "schema": record.schema,
                "standards": record.standards,
                "sourceAuthoringTool": record.source_authoring_tool,
                "elementCount": record.element_count,
                "steelElementCount": record.steel_element_count,
                "parser": "architoken-step-scanner",
                "stepEntityCount": parsed.entity_count,
                "stepGeometryMeshCount": parsed.geometry_mesh_count,
                "stepGeometryVertexCount": parsed.geometry_vertex_count,
                "stepGeometryTriangleCount": parsed.geometry_triangle_count,
                "stepGeometryFailureCount": parsed.geometry_failure_count,
                "context": context.audit_json()
            }),
        });
        Ok(record)
    }

    /// Get one openBIM model record.
    ///
    /// # Errors
    /// Returns missing model, permission, or tenant/project isolation errors.
    pub fn get_model_with_context(
        &self,
        context: &RequestContext,
        model_id: Uuid,
    ) -> Result<OpenBimModelRecord> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let stored = self
            .models
            .read()
            .get(&model_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("openbim_model_id={model_id}")))?;
        assert_runtime_scope(context, &stored.record.tenant_id, &stored.record.project_id)?;
        Ok(stored.record)
    }

    /// Get the viewer manifest for one openBIM model.
    ///
    /// # Errors
    /// Returns missing model, permission, or tenant/project isolation errors.
    pub fn viewer_manifest_with_context(
        &self,
        context: &RequestContext,
        model_id: Uuid,
    ) -> Result<BimViewerManifest> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let stored = self
            .models
            .read()
            .get(&model_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("openbim_model_id={model_id}")))?;
        assert_runtime_scope(context, &stored.record.tenant_id, &stored.record.project_id)?;
        Ok(stored.viewer_manifest)
    }

    /// Export the heavy-steel BOM for one openBIM model.
    ///
    /// # Errors
    /// Returns missing model, permission, or tenant/project isolation errors.
    pub fn steel_bom_with_context(
        &self,
        context: &RequestContext,
        model_id: Uuid,
    ) -> Result<SteelBomExport> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let stored = self
            .models
            .read()
            .get(&model_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("openbim_model_id={model_id}")))?;
        assert_runtime_scope(context, &stored.record.tenant_id, &stored.record.project_id)?;
        Ok(stored.bom)
    }
}

fn validate_model_name(value: &str) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(HarnessError::InvalidInput(
            "openBIM model name is required".to_owned(),
        ));
    }
    Ok(trimmed.to_owned())
}

fn standards_for_schema(schema: IfcSchema) -> Vec<OpenBimStandard> {
    let mut standards = vec![
        OpenBimStandard::Ifc,
        OpenBimStandard::Idm,
        OpenBimStandard::Mvd,
        OpenBimStandard::Bsdd,
        OpenBimStandard::Bcf,
        OpenBimStandard::Ids,
        OpenBimStandard::Validate,
        OpenBimStandard::Cobie,
        OpenBimStandard::OpenCdeApi,
    ];
    standards.push(match schema {
        IfcSchema::Ifc2x3 => OpenBimStandard::Ifc2x3,
        IfcSchema::Ifc4 => OpenBimStandard::Ifc4,
        IfcSchema::Ifc4x3 => OpenBimStandard::Ifc4x3,
    });
    standards
}

fn viewer_manifest_for(
    record: &OpenBimModelRecord,
    standards: &[OpenBimStandard],
) -> BimViewerManifest {
    BimViewerManifest {
        manifest_id: Uuid::new_v4(),
        model_id: record.model_id,
        model_name: record.name.clone(),
        schema: record.schema,
        preferred_geometry_format: "ifc".to_owned(),
        element_id_namespace: ElementIdNamespace::IfcGuid,
        viewer_adapters: vec![
            ViewerAdapterHint::Ifc,
            ViewerAdapterHint::ThreeJs,
            ViewerAdapterHint::Tiles3d,
            ViewerAdapterHint::WebGpu,
        ],
        supported_commands: vec![
            ViewerCommandKind::LoadArtifact,
            ViewerCommandKind::SelectObjects,
            ViewerCommandKind::IsolateObjects,
            ViewerCommandKind::ClearIsolation,
            ViewerCommandKind::ZoomTo,
            ViewerCommandKind::SectionPlane,
            ViewerCommandKind::MeasureDistance,
            ViewerCommandKind::MeasureArea,
            ViewerCommandKind::Snapshot,
            ViewerCommandKind::ExportImage,
        ],
        element_count: record.element_count,
        steel_element_count: record.steel_element_count,
        source_authoring_tool: record.source_authoring_tool,
        payload: json!({
            "openBim": true,
            "buildingSmartStandards": standards,
            "sourceFormat": "ifc",
            "runtimeDependency": "open_viewer_adapter",
            "proprietaryViewerRequired": false,
            "currentFocus": ["bim_model_view", "steel_bom_export", "file_view_edit_modify"],
            "textToBimEnabledForThisPath": false
        }),
        created_at: Utc::now(),
    }
}

fn steel_bom_export_for(
    record: &OpenBimModelRecord,
    items: Vec<SteelBomItem>,
    generated_at: DateTime<Utc>,
) -> SteelBomExport {
    let summary = steel_bom_summary(&items);
    let csv = steel_bom_csv(&items);
    SteelBomExport {
        export_id: Uuid::new_v4(),
        model_id: record.model_id,
        model_name: record.name.clone(),
        schema: record.schema,
        standard: "buildingSMART openBIM IFC component BOM".to_owned(),
        items,
        summary,
        csv,
        generated_at,
    }
}

fn steel_bom_summary(items: &[SteelBomItem]) -> SteelBomSummary {
    let mut by_ifc_entity = BTreeMap::new();
    let mut by_category = BTreeMap::new();
    for item in items {
        *by_ifc_entity.entry(item.ifc_entity.clone()).or_insert(0) += 1;
        *by_category.entry(item.category.clone()).or_insert(0) += 1;
    }
    SteelBomSummary {
        total_items: items.len(),
        by_ifc_entity,
        by_category,
    }
}

fn steel_bom_csv(items: &[SteelBomItem]) -> String {
    let mut rows = vec![
        "row_no,step_id,ifc_guid,ifc_entity,category,name,object_type,tag,material,profile,quantity,unit,length_m,area_m2,volume_m3,weight_kg,source_line"
            .to_owned(),
    ];
    rows.extend(items.iter().map(|item| {
        [
            item.row_no.to_string(),
            item.step_id.clone(),
            item.ifc_guid.clone(),
            item.ifc_entity.clone(),
            item.category.clone(),
            item.name.clone().unwrap_or_default(),
            item.object_type.clone().unwrap_or_default(),
            item.tag.clone().unwrap_or_default(),
            item.material.clone().unwrap_or_default(),
            item.profile.clone().unwrap_or_default(),
            item.quantity.clone(),
            item.unit.clone(),
            item.length_m.clone().unwrap_or_default(),
            item.area_m2.clone().unwrap_or_default(),
            item.volume_m3.clone().unwrap_or_default(),
            item.weight_kg.clone().unwrap_or_default(),
            item.source_line.to_string(),
        ]
        .into_iter()
        .map(csv_escape)
        .collect::<Vec<_>>()
        .join(",")
    }));
    rows.join("\n")
}

fn csv_escape(value: String) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        return format!("\"{}\"", value.replace('"', "\"\""));
    }
    value
}

fn detect_ifc_schema(content: &str) -> Result<IfcSchema> {
    let uppercase = content.to_ascii_uppercase();
    if !uppercase.contains("ISO-10303-21") {
        return Err(HarnessError::InvalidInput(
            "buildingSMART IFC STEP content must start with ISO-10303-21".to_owned(),
        ));
    }
    if !uppercase.contains("FILE_SCHEMA") {
        return Err(HarnessError::InvalidInput(
            "buildingSMART IFC content must include FILE_SCHEMA".to_owned(),
        ));
    }
    if uppercase.contains("IFC4X3") {
        return Ok(IfcSchema::Ifc4x3);
    }
    if uppercase.contains("IFC4") {
        return Ok(IfcSchema::Ifc4);
    }
    if uppercase.contains("IFC2X3") {
        return Ok(IfcSchema::Ifc2x3);
    }
    Err(HarnessError::InvalidInput(
        "unsupported IFC schema; expected IFC2X3, IFC4, or IFC4X3".to_owned(),
    ))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct StepRecord {
    id: String,
    entity: String,
    args: Vec<String>,
    line_no: usize,
}

#[derive(Debug, Clone)]
struct IfcParseOutput {
    schema: IfcSchema,
    records: Vec<StepRecord>,
    entity_count: usize,
    product_element_count: usize,
    geometry_mesh_count: usize,
    geometry_vertex_count: usize,
    geometry_triangle_count: usize,
    geometry_failure_count: usize,
}

#[derive(Debug, Clone, Copy)]
struct StepEntitySpan<'a> {
    statement: &'a str,
    start: usize,
}

#[cfg(test)]
fn parse_ifc_records(content: &str) -> Result<Vec<StepRecord>> {
    parse_ifc_step(content).map(|parsed| parsed.records)
}

fn parse_ifc_step(content: &str) -> Result<IfcParseOutput> {
    let schema = detect_ifc_schema(content)?;
    let line_starts = line_starts(content);
    let records = step_entity_spans(content)
        .into_iter()
        .filter_map(|span| {
            let line_no = line_number_at(&line_starts, span.start);
            parse_step_record(span.statement, line_no)
        })
        .collect::<Vec<_>>();

    if records.is_empty() {
        return Err(HarnessError::InvalidInput(
            "buildingSMART IFC content did not contain decodable STEP entities".to_owned(),
        ));
    }

    let product_element_count = count_physical_elements(&records);

    Ok(IfcParseOutput {
        schema,
        entity_count: records.len(),
        records,
        product_element_count,
        geometry_mesh_count: 0,
        geometry_vertex_count: 0,
        geometry_triangle_count: 0,
        geometry_failure_count: 0,
    })
}

fn step_entity_spans(content: &str) -> Vec<StepEntitySpan<'_>> {
    let mut spans = Vec::new();
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
                spans.push(StepEntitySpan { statement, start });
            }
            start = idx + ch.len_utf8();
        }
    }

    spans
}

fn line_starts(content: &str) -> Vec<usize> {
    let mut starts = vec![0];
    for (idx, byte) in content.bytes().enumerate() {
        if byte == b'\n' {
            starts.push(idx + 1);
        }
    }
    starts
}

fn line_number_at(line_starts: &[usize], offset: usize) -> usize {
    line_starts.partition_point(|start| *start <= offset)
}

fn parse_step_record(statement: &str, line_no: usize) -> Option<StepRecord> {
    let statement = statement.trim();
    let hash_pos = statement.find('#')?;
    let eq_pos = statement[hash_pos..].find('=')? + hash_pos;
    let id = statement[hash_pos..eq_pos].trim().to_owned();
    let body = statement[eq_pos + 1..].trim().trim_end_matches(';').trim();
    let open = body.find('(')?;
    let close = body.rfind(')')?;
    let entity = body[..open].trim().to_ascii_uppercase();
    let args = split_top_level_args(&body[open + 1..close]);
    Some(StepRecord {
        id,
        entity,
        args,
        line_no,
    })
}

fn split_top_level_args(value: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut depth = 0_u32;
    let mut in_string = false;
    let mut chars = value.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\'' {
            current.push(ch);
            if chars.peek() == Some(&'\'') {
                current.push(chars.next().expect("peeked quote exists"));
                continue;
            }
            in_string = !in_string;
            continue;
        }
        if !in_string {
            match ch {
                '(' => depth = depth.saturating_add(1),
                ')' => depth = depth.saturating_sub(1),
                ',' if depth == 0 => {
                    args.push(current.trim().to_owned());
                    current.clear();
                    continue;
                }
                _ => {}
            }
        }
        current.push(ch);
    }
    if !current.trim().is_empty() || value.ends_with(',') {
        args.push(current.trim().to_owned());
    }
    args
}

fn clean_step_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if matches!(trimmed, "$" | "*") {
        return None;
    }
    if let Some(inner) = trimmed
        .strip_prefix('\'')
        .and_then(|candidate| candidate.strip_suffix('\''))
    {
        let value = decode_step_text(&inner.replace("''", "'"));
        return (!value.trim().is_empty()).then_some(value);
    }
    trimmed
        .strip_prefix("IFCLABEL(")
        .or_else(|| trimmed.strip_prefix("IFCTEXT("))
        .or_else(|| trimmed.strip_prefix("IFCIDENTIFIER("))
        .and_then(|inner| inner.strip_suffix(')'))
        .and_then(clean_step_string)
}

fn decode_step_text(value: &str) -> String {
    let mut decoded = decode_step_utf16_blocks(value);
    decoded = decode_step_single_byte_escapes(&decoded);
    decoded
}

fn decode_step_utf16_blocks(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(start) = rest.find("\\X2\\") {
        output.push_str(&rest[..start]);
        let after_start = &rest[start + 4..];
        let Some(end) = after_start.find("\\X0\\") else {
            output.push_str(&rest[start..]);
            return output;
        };
        output.push_str(&decode_utf16_hex(&after_start[..end]));
        rest = &after_start[end + 4..];
    }
    output.push_str(rest);
    output
}

fn decode_step_single_byte_escapes(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '\\' || chars.peek() != Some(&'X') {
            output.push(ch);
            continue;
        }
        chars.next();
        if chars.peek() != Some(&'\\') {
            output.push_str("\\X");
            continue;
        }
        chars.next();
        let hi = chars.next();
        let lo = chars.next();
        match (hi, lo) {
            (Some(hi), Some(lo)) => {
                let hex = [hi, lo].iter().collect::<String>();
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    output.push(char::from(byte));
                } else {
                    output.push_str("\\X\\");
                    output.push(hi);
                    output.push(lo);
                }
            }
            _ => output.push_str("\\X\\"),
        }
    }
    output
}

fn decode_utf16_hex(hex: &str) -> String {
    let units = hex
        .as_bytes()
        .chunks(4)
        .filter_map(|chunk| {
            if chunk.len() != 4 {
                return None;
            }
            std::str::from_utf8(chunk)
                .ok()
                .and_then(|value| u16::from_str_radix(value, 16).ok())
        })
        .collect::<Vec<_>>();
    String::from_utf16_lossy(&units)
}

fn parse_ref_list(value: &str) -> Vec<String> {
    let trimmed = value.trim();
    let inner = trimmed
        .strip_prefix('(')
        .and_then(|candidate| candidate.strip_suffix(')'))
        .unwrap_or(trimmed);
    split_top_level_args(inner)
        .into_iter()
        .filter(|arg| arg.starts_with('#'))
        .collect()
}

fn parse_ref(value: &str) -> Option<String> {
    let trimmed = value.trim();
    trimmed.starts_with('#').then_some(trimmed.to_owned())
}

fn parse_measure(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if matches!(trimmed, "$" | "*") {
        return None;
    }
    let cleaned = trimmed
        .trim_start_matches("IFCLENGTHMEASURE(")
        .trim_start_matches("IFCAREAMEASURE(")
        .trim_start_matches("IFCVOLUMEMEASURE(")
        .trim_start_matches("IFCMASSMEASURE(")
        .trim_start_matches("IFCCOUNTMEASURE(")
        .trim_end_matches(')')
        .trim();
    cleaned.parse::<f64>().ok().map(format_measure)
}

fn format_measure(value: f64) -> String {
    let formatted = format!("{value:.6}");
    formatted
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_owned()
}

fn count_physical_elements(records: &[StepRecord]) -> usize {
    records
        .iter()
        .filter(|record| is_physical_element(&record.entity))
        .count()
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

fn is_heavy_steel_bom_entity(entity: &str) -> bool {
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
    )
}

fn extract_steel_bom_items(records: &[StepRecord]) -> Vec<SteelBomItem> {
    let material_profiles = build_material_profile_map(records);
    let quantities = build_quantity_map(records);

    let mut items = records
        .iter()
        .filter(|record| is_heavy_steel_bom_entity(&record.entity))
        .enumerate()
        .map(|(idx, record)| {
            let quantity = quantities.get(&record.id);
            let material_profile = material_profiles.get(&record.id);
            SteelBomItem {
                row_no: idx + 1,
                step_id: record.id.clone(),
                ifc_guid: clean_arg(record, 0).unwrap_or_else(|| record.id.clone()),
                ifc_entity: record.entity.clone(),
                category: steel_category_for(&record.entity).to_owned(),
                name: clean_arg(record, 2),
                object_type: clean_arg(record, 4).or_else(|| clean_arg(record, 8)),
                tag: clean_arg(record, 7),
                material: material_profile.and_then(|value| value.material.clone()),
                profile: material_profile.and_then(|value| value.profile.clone()),
                quantity: quantity
                    .and_then(|value| value.count.clone())
                    .unwrap_or_else(|| "1".to_owned()),
                unit: quantity
                    .and_then(|value| value.count.as_ref().map(|_| "ea".to_owned()))
                    .unwrap_or_else(|| "ea".to_owned()),
                length_m: quantity.and_then(|value| value.length_m.clone()),
                area_m2: quantity.and_then(|value| value.area_m2.clone()),
                volume_m3: quantity.and_then(|value| value.volume_m3.clone()),
                weight_kg: quantity.and_then(|value| value.weight_kg.clone()),
                source_line: record.line_no,
            }
        })
        .collect::<Vec<_>>();
    items.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.ifc_entity.cmp(&right.ifc_entity))
            .then_with(|| left.name.cmp(&right.name))
            .then_with(|| left.step_id.cmp(&right.step_id))
    });
    for (idx, item) in items.iter_mut().enumerate() {
        item.row_no = idx + 1;
    }
    items
}

fn clean_arg(record: &StepRecord, idx: usize) -> Option<String> {
    record.args.get(idx).and_then(|arg| clean_step_string(arg))
}

fn steel_category_for(entity: &str) -> &'static str {
    match entity {
        "IFCBEAM" => "steel_beam",
        "IFCCOLUMN" => "steel_column",
        "IFCMEMBER" => "steel_member",
        "IFCPLATE" => "steel_plate",
        "IFCELEMENTASSEMBLY" => "steel_assembly",
        "IFCFASTENER" | "IFCMECHANICALFASTENER" => "steel_fastener",
        "IFCDISCRETEACCESSORY" => "steel_accessory",
        "IFCBUILDINGELEMENTPROXY" => "steel_proxy",
        _ => "steel_component",
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct MaterialProfile {
    material: Option<String>,
    profile: Option<String>,
}

fn build_material_profile_map(records: &[StepRecord]) -> HashMap<String, MaterialProfile> {
    let by_id: HashMap<String, StepRecord> = records
        .iter()
        .map(|record| (record.id.clone(), record.clone()))
        .collect();
    let mut resolved = HashMap::new();
    for record in records
        .iter()
        .filter(|record| record.entity == "IFCRELASSOCIATESMATERIAL")
    {
        let related = record
            .args
            .get(4)
            .map_or_else(Vec::new, |arg| parse_ref_list(arg));
        let material_ref = record.args.get(5).and_then(|arg| parse_ref(arg));
        let material_profile = material_ref
            .as_deref()
            .map_or_else(MaterialProfile::default, |id| {
                resolve_material_profile(id, &by_id, 0)
            });
        for object_id in related {
            resolved.insert(object_id, material_profile.clone());
        }
    }
    resolved
}

fn resolve_material_profile(
    id: &str,
    by_id: &HashMap<String, StepRecord>,
    depth: usize,
) -> MaterialProfile {
    if depth > 8 {
        return MaterialProfile::default();
    }
    let Some(record) = by_id.get(id) else {
        return MaterialProfile::default();
    };
    match record.entity.as_str() {
        "IFCMATERIAL" => MaterialProfile {
            material: clean_arg(record, 0),
            profile: None,
        },
        "IFCMATERIALPROFILE" => {
            let material = record
                .args
                .get(2)
                .and_then(|arg| parse_ref(arg))
                .map(|id| resolve_material_profile(&id, by_id, depth + 1))
                .and_then(|value| value.material)
                .or_else(|| clean_arg(record, 0));
            let profile = record
                .args
                .get(3)
                .and_then(|arg| parse_ref(arg))
                .and_then(|id| by_id.get(&id))
                .and_then(|profile_record| {
                    clean_arg(profile_record, 1).or_else(|| clean_arg(profile_record, 0))
                });
            MaterialProfile { material, profile }
        }
        "IFCMATERIALPROFILESET" => {
            let profiles = record
                .args
                .get(2)
                .map_or_else(Vec::new, |arg| parse_ref_list(arg));
            merge_material_profiles(
                profiles
                    .iter()
                    .map(|id| resolve_material_profile(id, by_id, depth + 1)),
            )
        }
        "IFCMATERIALPROFILESETUSAGE" => record
            .args
            .first()
            .and_then(|arg| parse_ref(arg))
            .map_or_else(MaterialProfile::default, |id| {
                resolve_material_profile(&id, by_id, depth + 1)
            }),
        "IFCMATERIALLAYERSETUSAGE" => record
            .args
            .first()
            .and_then(|arg| parse_ref(arg))
            .map_or_else(MaterialProfile::default, |id| {
                resolve_material_profile(&id, by_id, depth + 1)
            }),
        "IFCMATERIALLAYERSET" => {
            let layers = record
                .args
                .first()
                .map_or_else(Vec::new, |arg| parse_ref_list(arg));
            merge_material_profiles(
                layers
                    .iter()
                    .map(|id| resolve_material_profile(id, by_id, depth + 1)),
            )
        }
        "IFCMATERIALLAYER" => record
            .args
            .first()
            .and_then(|arg| parse_ref(arg))
            .map_or_else(MaterialProfile::default, |id| {
                resolve_material_profile(&id, by_id, depth + 1)
            }),
        entity if entity.contains("PROFILEDEF") => MaterialProfile {
            material: None,
            profile: clean_arg(record, 1).or_else(|| clean_arg(record, 0)),
        },
        _ => MaterialProfile::default(),
    }
}

fn merge_material_profiles(values: impl Iterator<Item = MaterialProfile>) -> MaterialProfile {
    let mut materials = Vec::new();
    let mut profiles = Vec::new();
    for value in values {
        if let Some(material) = value.material
            && !materials.contains(&material)
        {
            materials.push(material);
        }
        if let Some(profile) = value.profile
            && !profiles.contains(&profile)
        {
            profiles.push(profile);
        }
    }
    MaterialProfile {
        material: (!materials.is_empty()).then(|| materials.join(" + ")),
        profile: (!profiles.is_empty()).then(|| profiles.join(" + ")),
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct QuantityFacts {
    length_m: Option<String>,
    area_m2: Option<String>,
    volume_m3: Option<String>,
    weight_kg: Option<String>,
    count: Option<String>,
}

fn build_quantity_map(records: &[StepRecord]) -> HashMap<String, QuantityFacts> {
    let by_id: HashMap<String, StepRecord> = records
        .iter()
        .map(|record| (record.id.clone(), record.clone()))
        .collect();
    let mut quantity_sets = HashMap::new();

    for record in records
        .iter()
        .filter(|record| record.entity == "IFCELEMENTQUANTITY")
    {
        let quantity_refs = record
            .args
            .iter()
            .rev()
            .find(|arg| arg.trim().starts_with('('))
            .map_or_else(Vec::new, |arg| parse_ref_list(arg));
        let mut facts = QuantityFacts::default();
        for quantity_ref in quantity_refs {
            if let Some(quantity_record) = by_id.get(&quantity_ref) {
                merge_quantity_record(&mut facts, quantity_record);
            }
        }
        quantity_sets.insert(record.id.clone(), facts);
    }

    let mut by_element = HashMap::new();
    for record in records
        .iter()
        .filter(|record| record.entity == "IFCRELDEFINESBYPROPERTIES")
    {
        let related = record
            .args
            .get(4)
            .map_or_else(Vec::new, |arg| parse_ref_list(arg));
        let quantity_set_ref = record.args.get(5).and_then(|arg| parse_ref(arg));
        if let Some(facts) = quantity_set_ref.and_then(|id| quantity_sets.get(&id).cloned()) {
            for element_id in related {
                by_element
                    .entry(element_id)
                    .and_modify(|existing| merge_quantity_facts(existing, &facts))
                    .or_insert_with(|| facts.clone());
            }
        }
    }
    by_element
}

fn merge_quantity_record(facts: &mut QuantityFacts, record: &StepRecord) {
    let name = clean_arg(record, 0)
        .unwrap_or_default()
        .to_ascii_lowercase();
    let value = record.args.iter().rev().find_map(|arg| parse_measure(arg));
    let Some(value) = value else {
        return;
    };
    match record.entity.as_str() {
        "IFCQUANTITYLENGTH" if facts.length_m.is_none() => facts.length_m = Some(value),
        "IFCQUANTITYAREA" if facts.area_m2.is_none() => facts.area_m2 = Some(value),
        "IFCQUANTITYVOLUME" if facts.volume_m3.is_none() => facts.volume_m3 = Some(value),
        "IFCQUANTITYWEIGHT" if facts.weight_kg.is_none() => facts.weight_kg = Some(value),
        "IFCQUANTITYCOUNT" if facts.count.is_none() => facts.count = Some(value),
        _ if name.contains("length") && facts.length_m.is_none() => facts.length_m = Some(value),
        _ if name.contains("area") && facts.area_m2.is_none() => facts.area_m2 = Some(value),
        _ if name.contains("volume") && facts.volume_m3.is_none() => facts.volume_m3 = Some(value),
        _ if (name.contains("weight") || name.contains("mass")) && facts.weight_kg.is_none() => {
            facts.weight_kg = Some(value);
        }
        _ if name.contains("count") && facts.count.is_none() => facts.count = Some(value),
        _ => {}
    }
}

fn merge_quantity_facts(target: &mut QuantityFacts, source: &QuantityFacts) {
    if target.length_m.is_none() {
        target.length_m.clone_from(&source.length_m);
    }
    if target.area_m2.is_none() {
        target.area_m2.clone_from(&source.area_m2);
    }
    if target.volume_m3.is_none() {
        target.volume_m3.clone_from(&source.volume_m3);
    }
    if target.weight_kg.is_none() {
        target.weight_kg.clone_from(&source.weight_kg);
    }
    if target.count.is_none() {
        target.count.clone_from(&source.count);
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use crate::{
        module_audit::ModuleAuditService,
        runtime_context::{RequestContext, RequestContextInput, RuntimeProfile},
    };

    use super::{
        IfcSchema, OpenBimIngestRequest, OpenBimService, SourceAuthoringTool, detect_ifc_schema,
        extract_steel_bom_items, parse_ifc_records, parse_ifc_step,
    };

    fn heavy_steel_ifc() -> String {
        r"ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('heavy-steel.ifc','2026-05-14T00:00:00',('architoken'),('architoken'),'Tekla Structures','ArchIToken','');
FILE_SCHEMA(('IFC4X3_ADD2'));
ENDSEC;
DATA;
#10=IFCBEAM('1sBeamGuid0000000000001',#1,'B-001',$,'H Beam',#20,#30,'B-001',.BEAM.);
#11=IFCCOLUMN('1sColumnGuid0000000001',#1,'C-001',$,'Box Column',#21,#31,'C-001',.COLUMN.);
#12=IFCPLATE('1sPlateGuid00000000001',#1,'PL-001',$,'Gusset Plate',#22,#32,'PL-001',.USERDEFINED.);
#13=IFCMECHANICALFASTENER('1sBoltGuid000000000001',#1,'M24 Bolt',$,'Bolt',#23,#33,'BOLT-001',.BOLT.);
#40=IFCMATERIAL('Q355B',$,$);
#41=IFCISHAPEPROFILEDEF(.AREA.,'HN400X200',#50,400.,200.,8.,13.,12.);
#42=IFCMATERIALPROFILE('Q355B-HN400',$,#40,#41,$,$);
#43=IFCMATERIALPROFILESET('BeamProfile',$,(#42),$);
#44=IFCMATERIALPROFILESETUSAGE(#43,$,$);
#45=IFCRELASSOCIATESMATERIAL('mat-rel-1',#1,$,$,(#10,#11),#44);
#46=IFCRELASSOCIATESMATERIAL('mat-rel-2',#1,$,$,(#12,#13),#40);
#50=IFCCARTESIANPOINT((0.,0.));
#60=IFCQUANTITYLENGTH('Length',$,$,12.5,$);
#61=IFCQUANTITYWEIGHT('Weight',$,$,845.25,$);
#62=IFCQUANTITYCOUNT('Count',$,$,24,$);
#70=IFCELEMENTQUANTITY('qset-beam',#1,'BaseQuantities',$,$,(#60,#61));
#71=IFCELEMENTQUANTITY('qset-bolt',#1,'BaseQuantities',$,$,(#62));
#80=IFCRELDEFINESBYPROPERTIES('qrel-1',#1,$,$,(#10),#70);
#81=IFCRELDEFINESBYPROPERTIES('qrel-2',#1,$,$,(#13),#71);
ENDSEC;
END-ISO-10303-21;"
            .to_owned()
    }

    fn context() -> RequestContext {
        RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some("tenant-a".to_owned()),
                project_id: Some("project-a".to_owned()),
                actor: Some("engineer".to_owned()),
                roles: Some(vec!["engineer".to_owned()]),
                request_id: Some("req-openbim".to_owned()),
                correlation_id: Some("corr-openbim".to_owned()),
            },
            RuntimeProfile::Production,
        )
        .expect("context should parse")
    }

    #[test]
    fn detects_buildingsmart_ifc_schema() {
        assert_eq!(
            detect_ifc_schema(&heavy_steel_ifc()).expect("schema"),
            IfcSchema::Ifc4x3
        );
    }

    #[test]
    fn extracts_heavy_steel_bom_from_ifc_entities_materials_and_quantities() {
        let records = parse_ifc_records(&heavy_steel_ifc()).expect("records");
        let items = extract_steel_bom_items(&records);

        assert_eq!(items.len(), 4);
        let beam = items
            .iter()
            .find(|item| item.ifc_entity == "IFCBEAM")
            .expect("beam row");
        assert_eq!(beam.ifc_guid, "1sBeamGuid0000000000001");
        assert_eq!(beam.category, "steel_beam");
        assert_eq!(beam.material.as_deref(), Some("Q355B"));
        assert_eq!(beam.profile.as_deref(), Some("HN400X200"));
        assert_eq!(beam.length_m.as_deref(), Some("12.5"));
        assert_eq!(beam.weight_kg.as_deref(), Some("845.25"));

        let bolt = items
            .iter()
            .find(|item| item.ifc_entity == "IFCMECHANICALFASTENER")
            .expect("bolt row");
        assert_eq!(bolt.quantity, "24");
        assert_eq!(bolt.unit, "ea");
    }

    #[test]
    fn step_scanner_counts_entities_and_elements() {
        let parsed = parse_ifc_step(&heavy_steel_ifc()).expect("ifc step parse");

        assert_eq!(parsed.schema, IfcSchema::Ifc4x3);
        assert_eq!(parsed.product_element_count, 4);
        assert_eq!(parsed.entity_count, 19);
        assert_eq!(parsed.geometry_mesh_count, 0);
    }

    #[test]
    fn decodes_ifc_step_encoded_chinese_text_for_bom() {
        let content = heavy_steel_ifc().replace(
            "#10=IFCBEAM('1sBeamGuid0000000000001',#1,'B-001',$,'H Beam',#20,#30,'B-001',.BEAM.);",
            "#10=IFCBEAM('1sBeamGuid0000000000001',#1,'\\X2\\4E2D6587\\X0\\',$,'H Beam',#20,#30,'B-001',.BEAM.);",
        );
        let records = parse_ifc_records(&content).expect("records");
        let items = extract_steel_bom_items(&records);
        let beam = items
            .iter()
            .find(|item| item.ifc_entity == "IFCBEAM")
            .expect("beam row");

        assert_eq!(beam.name.as_deref(), Some("中文"));
    }

    #[test]
    fn service_ingests_model_and_prepares_viewer_manifest_and_csv_bom() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = OpenBimService::new(audit);
        let context = context();
        let model = service
            .ingest_model_with_context(
                &context,
                OpenBimIngestRequest {
                    name: "Heavy Steel Test Model".to_owned(),
                    source_authoring_tool: Some(SourceAuthoringTool::TeklaStructures),
                    ifc_content: heavy_steel_ifc(),
                    actor: None,
                },
            )
            .expect("model ingests");

        assert_eq!(model.schema, IfcSchema::Ifc4x3);
        assert_eq!(model.steel_element_count, 4);

        let manifest = service
            .viewer_manifest_with_context(&context, model.model_id)
            .expect("viewer manifest");
        assert_eq!(manifest.model_id, model.model_id);
        assert_eq!(manifest.preferred_geometry_format, "ifc");
        assert!(!manifest.viewer_adapters.is_empty());

        let bom = service
            .steel_bom_with_context(&context, model.model_id)
            .expect("bom export");
        assert_eq!(bom.summary.total_items, 4);
        assert!(bom.csv.contains("steel_beam"));
        assert!(bom.csv.contains("Q355B"));
    }

    #[test]
    fn rejects_non_ifc_content() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = OpenBimService::new(audit);
        let err = service
            .ingest_model_with_context(
                &context(),
                OpenBimIngestRequest {
                    name: "bad".to_owned(),
                    source_authoring_tool: Some(SourceAuthoringTool::Cad),
                    ifc_content: "not ifc".to_owned(),
                    actor: None,
                },
            )
            .expect_err("non IFC content must reject");
        assert!(format!("{err}").contains("ISO-10303-21"));
    }
}
