//! AEC file format parsers.
//!
//! The `Parser` trait abstracts over all supported formats. Concrete
//! implementations live in sub-modules; each wraps a best-in-class Rust
//! crate per 2026-04 docs.rs ecosystem survey.
//!
//! Supported formats (50+ total; this module is the core subset):
//! - DWG / DXF (via `acadrust` 0.3.4)
//! - IFC4 / IFC5 / STEP (via `ifc-lite-core` 2.1.9, `bimifc-parser` 0.2.0)
//! - PDF (via `pdf_oxide` 0.3.34)
//! - XML / XSD (via `quick-xml` 0.39.2, `xsd-parser` 1.5.2)
//!
//! Revit `.rvt` is bridged via official IFC Exporter — no direct reader.

#![deny(unsafe_code)]
#![warn(missing_docs, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod dwg;
pub mod ifc;
pub mod pdf;
pub mod xml;

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Errors produced during file parsing.
#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    /// Unknown or unsupported format.
    #[error("unsupported format: {0}")]
    Unsupported(String),

    /// IO failure.
    #[error(transparent)]
    Io(#[from] std::io::Error),

    /// Upstream parser failure.
    #[error("parser error ({format}): {message}")]
    Parser {
        /// Format name, e.g. "dwg".
        format: &'static str,
        /// Detail.
        message: String,
    },
}

/// Crate-local `Result`.
pub type Result<T> = std::result::Result<T, ParseError>;

/// A parsed document (abstract, format-agnostic).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    /// Original file path that was parsed.
    pub source_path: String,
    /// Normalized parser format identifier.
    pub format: &'static str,
    /// Format-specific count of parsed entities/elements.
    pub element_count: usize,
    /// Page count for paged formats; `1` for model and drawing formats.
    pub pages: usize,
    /// Extracted text preview or body when available.
    pub text: Option<String>,
    /// Parser-specific structured metadata.
    pub metadata: serde_json::Value,
}

/// Unified parser entry point.
pub trait Parser: Send + Sync {
    /// Human-readable format name (used for metrics).
    fn format(&self) -> &'static str;

    /// Attempt to parse a file from the given path.
    ///
    /// # Errors
    /// Returns `ParseError::Io` or `ParseError::Parser`.
    fn parse(&self, path: &Path) -> Result<ParsedDocument>;
}

/// Dispatch to the right parser based on file extension.
///
/// # Errors
/// Returns `ParseError::Unsupported` if the extension is unknown.
pub fn parse_auto(path: &Path) -> Result<ParsedDocument> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| ParseError::Unsupported(path.display().to_string()))?;

    match ext.as_str() {
        "dwg" => dwg::DwgParser.parse(path),
        "dxf" => dwg::DxfParser.parse(path),
        "ifc" => ifc::IfcParser.parse(path),
        "ifcxml" => ifc::IfcXmlParser.parse(path),
        "stp" | "step" => ifc::StepParser.parse(path),
        "pdf" => pdf::PdfParser.parse(path),
        "xml" => xml::XmlParser.parse(path),
        other => Err(ParseError::Unsupported(other.to_string())),
    }
}
