//! Lightweight native metadata parsers for open geometry exchange formats.
//!
//! Full geometry tessellation is delegated to the CAD worker/OCCT boundary.
//! These parsers keep the Rust backend able to identify, count and route native
//! source files without replacing them with screenshots or fabricated geometry.

use std::{fs, path::Path};

use super::{ParsedDocument, Parser, Result};

/// STL mesh parser.
pub struct StlParser;

impl Parser for StlParser {
    fn format(&self) -> &'static str {
        "stl"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let bytes = fs::read(path)?;
        let stl = classify_stl(&bytes);

        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "stl",
            element_count: stl.triangle_count,
            pages: 1,
            text: stl.preview,
            metadata: serde_json::json!({
                "parser": "architoken-stl-native-metadata",
                "sourceBinding": "native_stl_mesh",
                "encoding": stl.encoding,
                "triangles": stl.triangle_count,
                "sourceBytes": bytes.len(),
                "geometryWorker": "06-workers/architoken_workers/cad_worker.py",
                "workerRoute": "OCCT/OCP or STL mesh tessellation",
            }),
        })
    }
}

/// IGES / IGS exchange parser.
pub struct IgesParser;

impl Parser for IgesParser {
    fn format(&self) -> &'static str {
        "iges"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let bytes = fs::read(path)?;
        let text = String::from_utf8_lossy(&bytes);
        let stats = count_iges_sections(&text);
        let preview = text
            .lines()
            .take(12)
            .collect::<Vec<_>>()
            .join("\n")
            .chars()
            .take(2000)
            .collect::<String>();

        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "iges",
            element_count: stats.directory_entries,
            pages: 1,
            text: Some(preview),
            metadata: serde_json::json!({
                "parser": "architoken-iges-native-metadata",
                "sourceBinding": "native_iges_exchange",
                "records": stats.records,
                "startRecords": stats.start_records,
                "globalRecords": stats.global_records,
                "directoryEntryRecords": stats.directory_records,
                "directoryEntries": stats.directory_entries,
                "parameterRecords": stats.parameter_records,
                "terminateRecords": stats.terminate_records,
                "sourceBytes": bytes.len(),
                "geometryWorker": "06-workers/architoken_workers/cad_worker.py",
                "workerRoute": "OCCT/OCP IGES tessellation",
            }),
        })
    }
}

/// 3DXML package/source parser.
pub struct ThreeDXmlParser;

impl Parser for ThreeDXmlParser {
    fn format(&self) -> &'static str {
        "3dxml"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let bytes = fs::read(path)?;
        let is_zip_package = bytes.starts_with(b"PK\x03\x04");
        let preview = if is_zip_package {
            None
        } else {
            Some(
                String::from_utf8_lossy(&bytes)
                    .chars()
                    .take(2000)
                    .collect::<String>(),
            )
        };

        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "3dxml",
            element_count: usize::from(is_zip_package || preview.is_some()),
            pages: 1,
            text: preview,
            metadata: serde_json::json!({
                "parser": "architoken-3dxml-native-envelope",
                "sourceBinding": "native_3dxml_source",
                "packaging": if is_zip_package { "zip_container" } else { "xml_text" },
                "sourceBytes": bytes.len(),
                "geometryWorker": "06-workers/architoken_workers/cad_worker.py",
                "workerRoute": "3DXML adapter / OCCT derivative when configured",
            }),
        })
    }
}

struct StlStats {
    encoding: &'static str,
    triangle_count: usize,
    preview: Option<String>,
}

fn classify_stl(bytes: &[u8]) -> StlStats {
    if looks_like_ascii_stl(bytes) {
        let text = String::from_utf8_lossy(bytes);
        let triangle_count = text
            .lines()
            .filter(|line| line.trim_start().starts_with("facet normal"))
            .count();
        return StlStats {
            encoding: "ascii",
            triangle_count,
            preview: Some(text.chars().take(2000).collect()),
        };
    }

    let triangle_count = bytes
        .get(80..84)
        .and_then(|raw| raw.try_into().ok())
        .map(u32::from_le_bytes)
        .map_or(0, |value| value as usize);

    StlStats {
        encoding: "binary",
        triangle_count,
        preview: None,
    }
}

fn looks_like_ascii_stl(bytes: &[u8]) -> bool {
    let head = bytes
        .get(..bytes.len().min(512))
        .map(String::from_utf8_lossy)
        .unwrap_or_default()
        .to_ascii_lowercase();
    head.trim_start().starts_with("solid") && head.contains("facet")
}

#[derive(Default)]
struct IgesStats {
    records: usize,
    start_records: usize,
    global_records: usize,
    directory_records: usize,
    directory_entries: usize,
    parameter_records: usize,
    terminate_records: usize,
}

fn count_iges_sections(text: &str) -> IgesStats {
    let mut stats = IgesStats::default();
    for line in text.lines() {
        stats.records += 1;
        let section = line.as_bytes().get(72).copied().map_or_else(
            || {
                line.chars()
                    .rev()
                    .find(|ch| matches!(ch, 'S' | 'G' | 'D' | 'P' | 'T'))
                    .unwrap_or(' ')
            },
            char::from,
        );
        match section {
            'S' => stats.start_records += 1,
            'G' => stats.global_records += 1,
            'D' => stats.directory_records += 1,
            'P' => stats.parameter_records += 1,
            'T' => stats.terminate_records += 1,
            _ => {}
        }
    }
    stats.directory_entries = stats.directory_records / 2;
    stats
}
