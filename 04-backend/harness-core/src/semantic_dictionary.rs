//! Semantic dictionary contracts for SJG 157-2024.
//!
//! The standard tables are loaded into `PostgreSQL` by
//! `scripts/import-sjg157-semantic-dictionary.py` from an authorized local PDF.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Stable id for the SJG 157-2024 dictionary registration.
pub const SJG157_STANDARD_ID: &str = "sjg157-2024";

/// Fallback source file name used before the PDF importer records a digest.
pub const SJG157_SOURCE_FILE_NAME: &str = "《建筑工程信息模型语义字典标准》SJG 157-2024.pdf";

/// Query parameters for listing semantic dictionary categories.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticCategoryQuery {
    /// Search text matched against code, Chinese name, IFC entity, and raw row.
    pub q: Option<String>,
    /// Object group: `building`, `space`, `element`, or `system`.
    pub object_group: Option<String>,
    /// SJG 157 table code: `10`, `12`, `16`, or `30`.
    pub table_code: Option<String>,
    /// IFC entity filter, for example `IfcWall`.
    pub ifc_entity: Option<String>,
    /// Hierarchy level from 1 to 5.
    pub level: Option<i16>,
    /// Result limit.
    pub limit: Option<i64>,
    /// Offset for pagination.
    pub offset: Option<i64>,
}

impl SemanticCategoryQuery {
    /// Return a bounded page size.
    #[must_use]
    pub fn bounded_limit(&self) -> i64 {
        self.limit.unwrap_or(50).clamp(1, 200)
    }

    /// Return a non-negative offset.
    #[must_use]
    pub fn bounded_offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }

    /// Return normalized search text.
    #[must_use]
    pub fn normalized_query(&self) -> Option<String> {
        self.q
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }
}

/// SJG 157 standard registry record.
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SemanticDictionaryStandard {
    /// Internal registry id.
    pub id: String,
    /// Standard code.
    pub standard_code: String,
    /// Chinese title.
    pub title_zh: String,
    /// English title.
    pub title_en: String,
    /// Jurisdiction.
    pub jurisdiction: String,
    /// Source authority.
    pub source_authority: String,
    /// Publication date.
    pub published_on: NaiveDate,
    /// Effective date.
    pub effective_on: NaiveDate,
    /// Digital representation method.
    pub digital_representation: String,
    /// Namespace prefix.
    pub namespace_prefix: String,
    /// Namespace URI.
    pub namespace_uri: String,
    /// Source file name.
    pub source_file_name: String,
    /// Optional SHA-256 digest recorded by the importer.
    pub source_sha256: Option<String>,
    /// Import status.
    pub ingestion_status: String,
    /// Extra metadata.
    pub metadata: serde_json::Value,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Semantic dictionary category row.
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SemanticDictionaryCategory {
    /// Category code.
    pub code: String,
    /// Table code.
    pub table_code: String,
    /// Object group.
    pub object_group: String,
    /// Hierarchy level number.
    pub level_num: i16,
    /// Hierarchy level label.
    pub level_name: String,
    /// Parent category code when known.
    pub parent_code: Option<String>,
    /// Parent Chinese name when known.
    pub parent_name_zh: Option<String>,
    /// Chinese category name.
    pub name_zh: String,
    /// RDF identifier, for example `szbd:住宅`.
    pub rdf_identifier: String,
    /// Full RDF URI.
    pub rdf_uri: String,
    /// IFC entity mapping.
    pub ifc_entity: Option<String>,
    /// Raw IFC mapping cell.
    pub ifc_mapping_raw: Option<String>,
    /// Raw terminology cell or nearby row text.
    pub terminology_raw: Option<String>,
    /// Remark cell when parsed.
    pub remark: Option<String>,
    /// PDF text extraction line for traceability.
    pub source_line: Option<i32>,
}

/// Category list response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticCategoryListResponse {
    /// Standard metadata.
    pub standard: SemanticDictionaryStandard,
    /// Category rows.
    pub items: Vec<SemanticDictionaryCategory>,
    /// Total rows matching the query.
    pub total: i64,
    /// Applied limit.
    pub limit: i64,
    /// Applied offset.
    pub offset: i64,
}

/// Return static SJG 157 metadata when `PostgreSQL` is not configured.
#[must_use]
pub fn sjg157_fallback_standard() -> SemanticDictionaryStandard {
    SemanticDictionaryStandard {
        id: SJG157_STANDARD_ID.to_owned(),
        standard_code: "SJG 157-2024".to_owned(),
        title_zh: "建筑工程信息模型语义字典标准".to_owned(),
        title_en: "Standard for Building Engineering Information Modeling Semantic Data Dictionary"
            .to_owned(),
        jurisdiction: "深圳市".to_owned(),
        source_authority: "深圳市住房和建设局".to_owned(),
        published_on: NaiveDate::from_ymd_opt(2024, 2, 15).unwrap_or(NaiveDate::MIN),
        effective_on: NaiveDate::from_ymd_opt(2024, 4, 1).unwrap_or(NaiveDate::MIN),
        digital_representation: "RDF/RDFS/OWL".to_owned(),
        namespace_prefix: "szbd".to_owned(),
        namespace_uri: "http://www.cbims.org.cn/ns/szbd#".to_owned(),
        source_file_name: SJG157_SOURCE_FILE_NAME.to_owned(),
        source_sha256: None,
        ingestion_status: "metadata_registered".to_owned(),
        metadata: serde_json::json!({
            "objectGroups": ["building", "space", "element", "system"],
            "tableCodes": {
                "building": "10",
                "space": "12",
                "element": "30",
                "system": "16"
            },
            "importRequired": true
        }),
        updated_at: Utc::now(),
    }
}
