//! Generic XML parser (quick-xml 0.39.2).

use std::path::Path;

use super::{ParseError, ParsedDocument, Parser, Result};

pub struct XmlParser;

impl Parser for XmlParser {
    fn format(&self) -> &'static str {
        "xml"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let content = std::fs::read_to_string(path)?;
        let mut reader = quick_xml::Reader::from_str(&content);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();
        let mut element_count = 0usize;
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(quick_xml::events::Event::Start(_)) => element_count += 1,
                Ok(quick_xml::events::Event::Eof) => break,
                Err(e) => {
                    return Err(ParseError::Parser {
                        format: "xml",
                        message: e.to_string(),
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        Ok(ParsedDocument {
            source_path: path.display().to_string(),
            format: "xml",
            element_count,
            pages: 1,
            text: None,
            metadata: serde_json::json!({
                "parser": "quick-xml",
                "version": "0.39.2",
            }),
        })
    }
}
