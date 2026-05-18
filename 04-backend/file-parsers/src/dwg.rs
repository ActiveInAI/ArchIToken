//! DWG and DXF parsers.
//!
//! DWG is handled through an executable adapter chain because the format is
//! proprietary. The backend first tries to derive a real DXF. Vector PDF sheet
//! fallback is disabled by default and may only run behind an explicit
//! licensed/runtime switch. DXF itself uses `dxf` 0.6.1 against the source file.

use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use super::{ParseError, ParsedDocument, Parser, Result};

/// DWG parser.
pub struct DwgParser;

impl Parser for DwgParser {
    fn format(&self) -> &'static str {
        "dwg"
    }

    fn parse(&self, path: &Path) -> Result<ParsedDocument> {
        let bytes = fs::read(path)?;
        let work_dir = derivative_work_dir(path);
        fs::create_dir_all(&work_dir)?;
        let mut attempts = Vec::new();

        if let Some(derived_dxf) = try_dwg_to_dxf(path, &work_dir, &mut attempts)? {
            let parsed_dxf = DxfParser.parse(&derived_dxf)?;
            return Ok(ParsedDocument {
                source_path: path.display().to_string(),
                format: "dwg",
                element_count: parsed_dxf.element_count,
                pages: parsed_dxf.pages,
                text: parsed_dxf.text,
                metadata: serde_json::json!({
                    "parser": "architoken-dwg-adapter-chain",
                    "mode": "dwg_to_dxf",
                    "sourceBytes": bytes.len(),
                    "derivedFormat": "dxf",
                    "derivedPath": derived_dxf,
                    "dxfMetadata": parsed_dxf.metadata,
                    "attempts": attempts,
                }),
            });
        }

        if let Some(pdf) = try_dwg_to_vector_pdf(path, &work_dir, &mut attempts)? {
            return Ok(ParsedDocument {
                source_path: path.display().to_string(),
                format: "dwg",
                element_count: pdf.sheet_count,
                pages: pdf.sheet_count.max(1),
                text: None,
                metadata: serde_json::json!({
                    "parser": "architoken-dwg-adapter-chain",
                    "mode": "dwg_to_vector_pdf",
                    "sourceBytes": bytes.len(),
                    "derivedFormat": "pdf",
                    "derivedSheets": pdf.sheets,
                    "adapter": pdf.adapter,
                    "attempts": attempts,
                }),
            });
        }

        Err(ParseError::Parser {
            format: "dwg",
            message: format!(
                "No DWG native/DXF/vector-PDF adapter produced a derivative for {}; attempts: {}",
                path.display(),
                attempts.join(" | ")
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
                "sourceBinding": "native_dxf_entities",
            }),
        })
    }
}

struct DwgPdfDerivative {
    adapter: &'static str,
    sheets: Vec<PathBuf>,
    sheet_count: usize,
}

fn try_dwg_to_dxf(
    source: &Path,
    work_dir: &Path,
    attempts: &mut Vec<String>,
) -> Result<Option<PathBuf>> {
    if let Some(path) = env_path("DWG_TO_DXF_PATH") {
        let target = work_dir.join(format!("{}.dxf", safe_stem(source)));
        attempts.push(format!("DWG_TO_DXF_PATH: {}", path.display()));
        if run_custom_dwg_to_dxf(&path, source, &target, attempts)? && looks_like_dxf(&target) {
            return Ok(Some(target));
        }
    }

    if let Some(path) =
        env_path("ODA_FILE_CONVERTER_PATH").or_else(|| find_on_path("ODAFileConverter"))
    {
        attempts.push(format!("ODAFileConverter: {}", path.display()));
        if let Some(dxf) = run_oda_file_converter(&path, source, work_dir, attempts)? {
            return Ok(Some(dxf));
        }
    }

    if let Some(path) = find_on_path("dwgread") {
        let target = work_dir.join(format!("{}.dxf", safe_stem(source)));
        attempts.push(format!("dwgread: {}", path.display()));
        if run_dwgread(&path, source, &target, attempts)? && looks_like_dxf(&target) {
            return Ok(Some(target));
        }
    }

    if let Some(path) = find_on_path("dwg2dxf") {
        let target = work_dir.join(format!("{}.dxf", safe_stem(source)));
        attempts.push(format!("dwg2dxf: {}", path.display()));
        if run_custom_dwg_to_dxf(&path, source, &target, attempts)? && looks_like_dxf(&target) {
            return Ok(Some(target));
        }
    }

    Ok(None)
}

fn try_dwg_to_vector_pdf(
    source: &Path,
    work_dir: &Path,
    attempts: &mut Vec<String>,
) -> Result<Option<DwgPdfDerivative>> {
    if std::env::var("ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK").as_deref() != Ok("1") {
        attempts.push(
            "DwgExporter vector PDF fallback disabled; set ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK=1 only for a licensed, watermark-free runtime".to_string(),
        );
        return Ok(None);
    }

    let Some(path) = find_on_path("DwgExporter") else {
        attempts.push("DwgExporter: not found".to_string());
        return Ok(None);
    };

    let export_stem = format!("{}-dwg", safe_stem(source));
    let workbook = work_dir.join(format!("{export_stem}.xlsx"));
    attempts.push(format!("DwgExporter: {}", path.display()));
    let output = run_process(
        &path,
        [
            source.as_os_str(),
            workbook.as_os_str(),
            OsStr::new("sheets2pdf"),
        ],
    )?;
    if !output.status.success() {
        attempts.push(format!("DwgExporter failed: {}", process_tail(&output)));
        return Ok(None);
    }

    let sheet_dir = work_dir.join(format!("SHEETS_PDF_{export_stem}"));
    let sheets = list_files_with_extension(&sheet_dir, "pdf")?;
    if sheets.is_empty() {
        attempts.push(format!(
            "DwgExporter completed but no PDF sheets were found in {}",
            sheet_dir.display()
        ));
        return Ok(None);
    }

    Ok(Some(DwgPdfDerivative {
        adapter: "datadrivenconstruction_ddc_dwgconverter",
        sheet_count: sheets.len(),
        sheets,
    }))
}

fn run_custom_dwg_to_dxf(
    executable: &Path,
    source: &Path,
    target: &Path,
    attempts: &mut Vec<String>,
) -> Result<bool> {
    let output = run_process(
        executable,
        [OsStr::new("-o"), target.as_os_str(), source.as_os_str()],
    )?;
    if output.status.success() && target.exists() {
        return Ok(true);
    }
    attempts.push(format!(
        "{} -o failed: {}",
        executable.display(),
        process_tail(&output)
    ));

    let output = run_process(executable, [source.as_os_str(), target.as_os_str()])?;
    if output.status.success() && target.exists() {
        return Ok(true);
    }
    attempts.push(format!(
        "{} positional failed: {}",
        executable.display(),
        process_tail(&output)
    ));
    Ok(false)
}

fn run_oda_file_converter(
    executable: &Path,
    source: &Path,
    work_dir: &Path,
    attempts: &mut Vec<String>,
) -> Result<Option<PathBuf>> {
    let input_dir = work_dir.join("oda-in");
    let output_dir = work_dir.join("oda-out");
    fs::create_dir_all(&input_dir)?;
    fs::create_dir_all(&output_dir)?;
    let input_file = input_dir.join(
        source
            .file_name()
            .unwrap_or_else(|| OsStr::new("source.dwg")),
    );
    fs::copy(source, &input_file)?;

    let output = run_process(
        executable,
        [
            input_dir.as_os_str(),
            output_dir.as_os_str(),
            OsStr::new("ACAD2018"),
            OsStr::new("DXF"),
            OsStr::new("0"),
            OsStr::new("1"),
        ],
    )?;
    if !output.status.success() {
        attempts.push(format!(
            "ODAFileConverter failed: {}",
            process_tail(&output)
        ));
        return Ok(None);
    }
    let mut candidates = list_files_with_extension(&output_dir, "dxf")?;
    candidates.sort();
    Ok(candidates
        .into_iter()
        .find(|candidate| looks_like_dxf(candidate)))
}

fn run_dwgread(
    executable: &Path,
    source: &Path,
    target: &Path,
    attempts: &mut Vec<String>,
) -> Result<bool> {
    let output = run_process(
        executable,
        [OsStr::new("-O"), OsStr::new("DXF"), source.as_os_str()],
    )?;
    if output.status.success() && output.stdout.starts_with(b"0") {
        fs::write(target, output.stdout)?;
        return Ok(true);
    }
    attempts.push(format!("dwgread stdout failed: {}", process_tail(&output)));
    Ok(false)
}

fn run_process<I, S>(executable: &Path, args: I) -> Result<Output>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    Command::new(executable)
        .args(args)
        .output()
        .map_err(ParseError::Io)
}

fn process_tail(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let text = if stderr.trim().is_empty() {
        stdout
    } else {
        stderr
    };
    text.chars()
        .rev()
        .take(600)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>()
        .replace('\n', " ")
}

fn derivative_work_dir(source: &Path) -> PathBuf {
    let mut dir = std::env::temp_dir();
    dir.push("architoken-dwg-derivatives");
    dir.push(format!(
        "{}-{}",
        safe_stem(source),
        uuid::Uuid::new_v4().simple()
    ));
    dir
}

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .map(PathBuf::from)
        .filter(|path| path.exists())
}

fn find_on_path(binary: &str) -> Option<PathBuf> {
    for variable in ["ARCHITOKEN_LIBREDWG_BIN", "LIBREDWG_BIN_DIR"] {
        if let Some(path) = env_path(variable).map(|dir| dir.join(binary))
            && path.exists()
        {
            return Some(path);
        }
    }

    for dir in [
        "/tmp/architoken-libredwg/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/snap/bin",
    ] {
        let candidate = Path::new(dir).join(binary);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(binary))
            .find(|candidate| candidate.exists())
    })
}

fn list_files_with_extension(dir: &Path, extension: &str) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            files.extend(list_files_with_extension(&path, extension)?);
        } else if path
            .extension()
            .and_then(OsStr::to_str)
            .is_some_and(|value| value.eq_ignore_ascii_case(extension))
        {
            files.push(path);
        }
    }
    Ok(files)
}

fn looks_like_dxf(path: &Path) -> bool {
    let Ok(bytes) = fs::read(path) else {
        return false;
    };
    let head = String::from_utf8_lossy(&bytes[..bytes.len().min(4096)]).to_ascii_uppercase();
    head.contains("SECTION") && (head.contains("HEADER") || head.contains("ENTITIES"))
}

fn safe_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or("source")
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect()
}
