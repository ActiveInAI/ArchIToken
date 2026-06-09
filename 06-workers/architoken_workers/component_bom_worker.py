"""Component material BOM workbook importer.

The importer consumes the three source workbooks used by the current
ArchIToken heavy-steel P0 chain:

* SJG 157-2024 semantic dictionary category workbook.
* Prefabricated steel component naming-rule workbook.
* YingShe MeiJu component material BOM workbook.

It keeps workbook rows as source evidence and only produces review-required
structured artifacts. It does not approve manufacturing, procurement, costing
or construction data.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from .adapter_requirements import blocked
from .contract import ConversionJob, ConversionOperation, WorkerResult, validate_job
from .io import file_sha256, input_string, write_json_artifact, write_jsonl_artifact

XLSX_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
XLSX_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

BOM_REQUIRED_HEADERS = (
    "序号",
    "类目名称",
    "编码",
    "构件名称",
    "截面尺寸",
    "长度",
    "位置",
    "材料等级",
    "规格型号",
    "图号",
    "层次",
    "单位",
    "单套数量",
    "总数量",
    "单套重量(kg)",
    "总重量(kg)",
    "备注",
)

CODE_RE = re.compile(r"^(10|12|16|30)-\d{2}\.\d{2}\.\d{2}(?:\.\d{2})?(?:\.\d{2})?$")
COMPONENT_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9.\u4e00-\u9fff]+)+_V\d+$")
LENGTH_TOKEN_RE = re.compile(r"(?:^|_)L(?P<length>\d+(?:\.\d+)?)(?:_|$)", re.IGNORECASE)


@dataclass(frozen=True)
class WorkbookSheet:
    name: str
    rows: list[list[str]]
    dimension: str


def import_component_bom(job: ConversionJob) -> WorkerResult:
    """Import and validate the three source workbooks as review-required BOM data."""

    validate_job(job)
    if job.operation != ConversionOperation.COMPONENT_BOM_IMPORT:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "component_bom", "operation": job.operation.value},
            error={
                "code": "unsupported_operation",
                "message": "component_bom requires operation component_bom_import",
            },
        )

    source_paths = _source_paths(job)
    missing = [label for label, path in source_paths.items() if path is None or not path.is_file()]
    if missing:
        return blocked(
            job,
            adapter="component_bom",
            reason=f"missing readable workbook source(s): {', '.join(missing)}",
            install_hint=(
                "Pass sourcePath for 应舍美居_构件物料清单.xlsx, "
                "sjg157Path for 建筑工程信息模型语义字典编码表_SJG157-2024.xlsx, "
                "and namingRulePath for 装配式钢结构建筑构件标准化命名规则V1.0.xlsx."
            ),
        )

    assert source_paths["bom"] is not None
    assert source_paths["sjg157"] is not None
    assert source_paths["namingRule"] is not None
    bom_path = source_paths["bom"]
    sjg157_path = source_paths["sjg157"]
    naming_rule_path = source_paths["namingRule"]

    try:
        sjg_categories = parse_sjg157_categories(sjg157_path)
        naming_rules = parse_component_naming_rules(naming_rule_path)
        bom_payload = parse_bom_workbook(bom_path)
    except ValueError as exc:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "component_bom"},
            error={"code": "invalid_component_bom_workbook", "message": str(exc)},
        )

    category_by_code = {str(item["code"]): item for item in sjg_categories}
    validation = validate_component_bom(
        bom_payload["lines"],
        category_by_code=category_by_code,
        naming_rules=naming_rules,
        source_summary=bom_payload["summary"],
    )

    manifest = {
        "schema": "architoken.component_bom_import_manifest.v1",
        "adapter": "component_bom",
        "reviewState": "professional_review_required",
        "moduleId": str(job.input.get("moduleId") or "detailed_design"),
        "tenantId": job.tenant_id,
        "projectId": job.project_id,
        "sourceFiles": {
            "bom": source_file_manifest(bom_path),
            "sjg157": source_file_manifest(sjg157_path),
            "namingRule": source_file_manifest(naming_rule_path),
        },
        "counts": {
            "sjg157Categories": len(sjg_categories),
            "namingRules": len(naming_rules),
            "bomLines": len(bom_payload["lines"]),
            "categoryReferences": len(bom_payload["categoryReferences"]),
            "validationIssues": len(validation["issues"]),
            "validationErrors": validation["errorCount"],
            "validationWarnings": validation["warningCount"],
        },
        "summary": bom_payload["summary"],
        "validation": {
            "state": validation["state"],
            "professionalGate": "Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver",
            "ruleSources": [
                "SJG 157-2024 semantic dictionary category workbook",
                "Prefabricated steel component naming rule workbook V1.0",
                "YingShe MeiJu component material BOM workbook",
            ],
        },
    }

    artifacts = [
        write_json_artifact(
            job,
            "component_bom_import_manifest.json",
            manifest,
            role="component_bom_import_manifest",
            metadata={"schema": manifest["schema"], "reviewState": manifest["reviewState"]},
        ),
        write_jsonl_artifact(
            job,
            "component_bom_lines.jsonl",
            bom_payload["lines"],
            role="component_bom_lines",
            metadata={"schema": "architoken.component_bom_line.v1", "rowCount": len(bom_payload["lines"])},
        ),
        write_json_artifact(
            job,
            "component_bom_validation_issues.json",
            validation,
            role="component_bom_validation_report",
            metadata={
                "schema": "architoken.component_bom_validation_report.v1",
                "issueCount": len(validation["issues"]),
                "state": validation["state"],
            },
        ),
        write_jsonl_artifact(
            job,
            "sjg157_categories.jsonl",
            sjg_categories,
            role="sjg157_category_index",
            metadata={"schema": "architoken.sjg157_category.v1", "rowCount": len(sjg_categories)},
        ),
        write_jsonl_artifact(
            job,
            "component_naming_rules.jsonl",
            naming_rules,
            role="component_naming_rules",
            metadata={"schema": "architoken.component_naming_rule.v1", "rowCount": len(naming_rules)},
        ),
        write_jsonl_artifact(
            job,
            "component_bom_category_references.jsonl",
            bom_payload["categoryReferences"],
            role="component_bom_category_references",
            metadata={
                "schema": "architoken.component_bom_category_reference.v1",
                "rowCount": len(bom_payload["categoryReferences"]),
            },
        ),
    ]

    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "adapter": "component_bom",
            "schema": manifest["schema"],
            "reviewState": manifest["reviewState"],
            "validationState": validation["state"],
            "bomLines": len(bom_payload["lines"]),
            "totalQuantity": bom_payload["summary"]["totalQuantity"],
            "totalWeightKg": bom_payload["summary"]["totalWeightKg"],
            "sjg157Categories": len(sjg_categories),
            "namingRules": len(naming_rules),
            "validationIssues": len(validation["issues"]),
            "validationErrors": validation["errorCount"],
            "artifactCount": len(artifacts),
        },
    )


def parse_sjg157_categories(path: Path) -> list[dict[str, Any]]:
    """Parse the SJG157 category workbook into a canonical category index."""

    workbook = read_xlsx(path)
    sheet = workbook.get("全部类目索引")
    if not sheet:
        raise ValueError("SJG157 workbook missing sheet: 全部类目索引")

    header_index = find_header_row(sheet.rows, ("序号", "板块", "编码", "类目名称（含层级缩进）", "层级"))
    header = normalize_header_map(sheet.rows[header_index])
    categories: list[dict[str, Any]] = []
    for row_index, row in enumerate(sheet.rows[header_index + 1 :], start=header_index + 2):
        code = cell(row, header, "编码")
        if not code:
            continue
        raw_name = cell(row, header, "类目名称（含层级缩进）")
        categories.append(
            {
                "sequence": parse_int(cell(row, header, "序号")),
                "section": cell(row, header, "板块"),
                "code": code,
                "nameRaw": raw_name,
                "name": clean_label(raw_name),
                "level": cell(row, header, "层级"),
                "objectGroup": object_group_for_code(code),
                "sourceSheet": sheet.name,
                "sourceRow": row_index,
            }
        )
    return categories


def parse_component_naming_rules(path: Path) -> list[dict[str, Any]]:
    """Parse the steel-component naming-rule workbook."""

    workbook = read_xlsx(path)
    rules: list[dict[str, Any]] = []
    for sheet in workbook.values():
        header_index = find_first_header_row(sheet.rows)
        if header_index is None:
            continue
        header = normalize_header_map(sheet.rows[header_index])
        for row_index, row in enumerate(sheet.rows[header_index + 1 :], start=header_index + 2):
            sequence = cell(row, header, "序号") or cell(row, header, "版本号")
            if not sequence:
                continue
            if sheet.name == "版本号规则说明":
                rules.append(
                    {
                        "ruleKey": f"{sheet.name}:{cell(row, header, '版本号')}",
                        "sourceSheet": sheet.name,
                        "sourceRow": row_index,
                        "ruleType": "version",
                        "versionCode": cell(row, header, "版本号"),
                        "scenario": cell(row, header, "适用场景"),
                        "changeDescription": cell(row, header, "修改说明"),
                    }
                )
                continue
            if sheet.name == "通用命名总则":
                category = cell(row, header, "规则分类")
                content = cell(row, header, "规则内容")
                rules.append(
                    {
                        "ruleKey": f"{sheet.name}:{sequence}:{category}",
                        "sourceSheet": sheet.name,
                        "sourceRow": row_index,
                        "ruleType": "general",
                        "ruleCategory": category,
                        "ruleContent": content,
                        "codingNote": cell(row, header, "通用编码说明"),
                        "standardExample": cell(row, header, "示例"),
                        "remark": cell(row, header, "备注"),
                    }
                )
                continue

            formula = (
                cell(row, header, "标准命名公式")
                or cell(row, header, "命名公式")
                or cell(row, header, "标准命名规则")
            )
            example = cell(row, header, "标准命名实例") or cell(row, header, "标准实例")
            component_type = cell(row, header, "构件类型")
            if not formula and not example and not component_type:
                continue
            rules.append(
                {
                    "ruleKey": f"{sheet.name}:{sequence}:{component_type or formula}",
                    "sourceSheet": sheet.name,
                    "sourceRow": row_index,
                    "ruleType": "component",
                    "componentGroup": cell(row, header, "构件大类"),
                    "componentType": component_type,
                    "namingFormula": formula,
                    "standardExample": example,
                    "fieldNotes": cell(row, header, "各字段释义") or cell(row, header, "字段释义"),
                    "remark": cell(row, header, "备注"),
                    "prefix": naming_prefix(formula or example),
                }
            )
    return rules


def parse_bom_workbook(path: Path) -> dict[str, Any]:
    """Parse the component material BOM workbook."""

    workbook = read_xlsx(path)
    bom_sheet = workbook.get("物料清单")
    if not bom_sheet:
        raise ValueError("BOM workbook missing sheet: 物料清单")
    header_index = find_header_row(bom_sheet.rows, ("序号", "类目名称", "编码", "构件名称", "总数量"))
    header = normalize_header_map(bom_sheet.rows[header_index])
    lines: list[dict[str, Any]] = []
    total_row: dict[str, Any] | None = None
    for row_index, row in enumerate(bom_sheet.rows[header_index + 1 :], start=header_index + 2):
        sequence = cell(row, header, "序号")
        if not sequence:
            continue
        if "合" in sequence and "计" in sequence:
            total_row = {
                "sourceRow": row_index,
                "setQuantity": parse_number(cell(row, header, "单套数量")),
                "totalQuantity": parse_number(cell(row, header, "总数量")),
                "unitWeightKg": parse_number(cell(row, header, "单套重量(kg)")),
                "totalWeightKg": parse_number(cell(row, header, "总重量(kg)")),
            }
            continue
        line_no = parse_int(sequence)
        if line_no is None:
            continue
        line = {
            "lineNo": line_no,
            "sourceSheet": bom_sheet.name,
            "sourceRow": row_index,
            "sourceRange": f"A{row_index}:Q{row_index}",
            "categoryName": cell(row, header, "类目名称"),
            "categoryCode": cell(row, header, "编码"),
            "componentName": cell(row, header, "构件名称"),
            "sectionSize": cell(row, header, "截面尺寸"),
            "lengthMm": parse_number(cell(row, header, "长度")),
            "positionRef": cell(row, header, "位置"),
            "materialGrade": cell(row, header, "材料等级"),
            "specification": cell(row, header, "规格型号"),
            "drawingNo": cell(row, header, "图号"),
            "floorLevel": cell(row, header, "层次"),
            "unit": cell(row, header, "单位"),
            "setQuantity": parse_number(cell(row, header, "单套数量")) or 0,
            "totalQuantity": parse_number(cell(row, header, "总数量")) or 0,
            "unitWeightKg": parse_number(cell(row, header, "单套重量(kg)")),
            "totalWeightKg": parse_number(cell(row, header, "总重量(kg)")),
            "remark": cell(row, header, "备注"),
            "reviewState": "professional_review_required",
        }
        line["weightState"] = "provided" if line["unitWeightKg"] is not None and line["totalWeightKg"] is not None else "missing_in_source"
        lines.append(line)

    category_references = parse_bom_category_references(workbook)
    summary = {
        "sourceSheet": bom_sheet.name,
        "workbookDimension": bom_sheet.dimension,
        "lineCount": len(lines),
        "totalQuantity": sum(float(line["totalQuantity"]) for line in lines),
        "totalWeightKg": sum(float(line["totalWeightKg"] or 0) for line in lines),
        "sourceTotalRow": total_row,
    }
    return {"lines": lines, "summary": summary, "categoryReferences": category_references}


def parse_bom_category_references(workbook: dict[str, WorkbookSheet]) -> list[dict[str, Any]]:
    """Parse the hidden category reference sheet from the BOM workbook."""

    sheet = workbook.get("类目参照")
    if not sheet:
        return []
    header_index = find_header_row(sheet.rows, ("序号", "板块", "层级", "编码", "类目名称"))
    header = normalize_header_map(sheet.rows[header_index])
    refs: list[dict[str, Any]] = []
    for row_index, row in enumerate(sheet.rows[header_index + 1 :], start=header_index + 2):
        code = cell(row, header, "编码")
        if not code:
            continue
        refs.append(
            {
                "sequence": parse_int(cell(row, header, "序号")),
                "section": cell(row, header, "板块"),
                "level": cell(row, header, "层级"),
                "code": code,
                "name": clean_label(cell(row, header, "类目名称")),
                "sourceSheet": sheet.name,
                "sourceRow": row_index,
            }
        )
    return refs


def validate_component_bom(
    lines: list[dict[str, Any]],
    *,
    category_by_code: dict[str, dict[str, Any]],
    naming_rules: list[dict[str, Any]],
    source_summary: dict[str, Any],
) -> dict[str, Any]:
    """Validate BOM rows against SJG157 and naming-rule evidence."""

    allowed_prefixes = {str(rule.get("prefix")) for rule in naming_rules if rule.get("prefix")}
    issues: list[dict[str, Any]] = []
    for line in lines:
        source = {"sheet": line["sourceSheet"], "row": line["sourceRow"], "range": line["sourceRange"]}
        for field, column in (
            ("categoryName", "B"),
            ("categoryCode", "C"),
            ("componentName", "D"),
            ("unit", "L"),
            ("totalQuantity", "N"),
        ):
            if line.get(field) in {"", None}:
                issues.append(issue("error", "required_field_missing", f"{field} is required", line, source, column))

        code = str(line.get("categoryCode") or "")
        if code and not CODE_RE.match(code):
            issues.append(issue("error", "invalid_sjg157_code_format", f"Invalid SJG157 category code: {code}", line, source, "C"))
        category = category_by_code.get(code)
        if not category:
            issues.append(issue("error", "sjg157_category_not_found", f"SJG157 category code not found: {code}", line, source, "C"))
        elif clean_label(str(category["name"])) != clean_label(str(line["categoryName"])):
            issues.append(
                issue(
                    "warning",
                    "sjg157_category_name_mismatch",
                    f"BOM category name {line['categoryName']} differs from SJG157 {category['name']}",
                    line,
                    source,
                    "B:C",
                )
            )

        component_name = str(line.get("componentName") or "")
        if component_name and not COMPONENT_NAME_RE.match(component_name):
            issues.append(issue("warning", "naming_formula_not_matched", f"Component name does not match underscore/Vn rule: {component_name}", line, source, "D"))
        prefix = component_name.split("_", 1)[0] if "_" in component_name else component_name
        if prefix and allowed_prefixes and prefix not in allowed_prefixes:
            issues.append(issue("warning", "naming_prefix_not_in_rulebook", f"Naming prefix {prefix} is not declared by the naming-rule workbook", line, source, "D"))
        if prefix_category_conflict(prefix, str(line.get("categoryName") or "")):
            issues.append(
                issue(
                    "warning",
                    "component_prefix_category_conflict",
                    f"Naming prefix {prefix} conflicts with category {line.get('categoryName')}",
                    line,
                    source,
                    "B:D",
                )
            )

        length_token = extract_length_token(component_name) or extract_length_token(str(line.get("specification") or ""))
        length_mm = line.get("lengthMm")
        if length_token is not None and length_mm is not None and abs(float(length_token) - float(length_mm)) > 0.001:
            issues.append(
                issue(
                    "warning",
                    "length_token_source_mismatch",
                    f"Name/spec length L{length_token:g} differs from source length {float(length_mm):g}",
                    line,
                    source,
                    "D:F",
                )
            )
        if line.get("weightState") == "missing_in_source":
            issues.append(issue("warning", "weight_missing_in_source", "Weight columns are empty in source workbook; no weight is fabricated", line, source, "O:P"))

    source_total = source_summary.get("sourceTotalRow") or {}
    if source_total.get("totalQuantity") is not None and abs(float(source_total["totalQuantity"]) - float(source_summary["totalQuantity"])) > 0.001:
        issues.append(
            {
                "severity": "error",
                "code": "source_total_quantity_mismatch",
                "message": "BOM line total quantity does not match source total row",
                "source": source_total,
                "lineNo": None,
            }
        )

    error_count = sum(1 for item in issues if item["severity"] == "error")
    warning_count = sum(1 for item in issues if item["severity"] == "warning")
    return {
        "schema": "architoken.component_bom_validation_report.v1",
        "state": "blocked" if error_count else "professional_review_required",
        "errorCount": error_count,
        "warningCount": warning_count,
        "issues": issues,
    }


def source_file_manifest(path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "name": path.name,
        "sizeBytes": path.stat().st_size,
        "sha256": file_sha256(path),
    }


def _source_paths(job: ConversionJob) -> dict[str, Path | None]:
    return {
        "bom": path_input(job, "sourcePath", "source_path", "bomPath", "bom_path"),
        "sjg157": path_input(job, "sjg157Path", "sjg157_path", "semanticDictionaryPath", "semantic_dictionary_path"),
        "namingRule": path_input(job, "namingRulePath", "naming_rule_path", "componentNamingRulePath", "component_naming_rule_path"),
    }


def path_input(job: ConversionJob, *keys: str) -> Path | None:
    value = input_string(job, *keys)
    return Path(value) if value else None


def read_xlsx(path: Path) -> dict[str, WorkbookSheet]:
    """Read XLSX sheets using stdlib ZIP/XML parsing."""

    with zipfile.ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive)
        workbook_xml = ET.fromstring(archive.read("xl/workbook.xml"))
        rels_xml = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels_xml.findall(f"{{{PKG_REL_NS}}}Relationship")
        }
        sheets: dict[str, WorkbookSheet] = {}
        for sheet in workbook_xml.findall(f".//{{{XLSX_MAIN_NS}}}sheet"):
            name = str(sheet.attrib["name"])
            rel_id = sheet.attrib[f"{{{XLSX_REL_NS}}}id"]
            target = rel_targets[rel_id].lstrip("/")
            sheet_path = target if target.startswith("xl/") else f"xl/{target}"
            rows, dimension = read_sheet(archive, sheet_path, shared_strings)
            sheets[name] = WorkbookSheet(name=name, rows=rows, dimension=dimension)
        return sheets


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    values: list[str] = []
    for item in root.findall(f"{{{XLSX_MAIN_NS}}}si"):
        values.append("".join(node.text or "" for node in item.findall(f".//{{{XLSX_MAIN_NS}}}t")))
    return values


def read_sheet(
    archive: zipfile.ZipFile,
    sheet_path: str,
    shared_strings: list[str],
) -> tuple[list[list[str]], str]:
    root = ET.fromstring(archive.read(sheet_path))
    dimension = root.find(f"{{{XLSX_MAIN_NS}}}dimension")
    dimension_ref = dimension.attrib.get("ref", "") if dimension is not None else ""
    sparse_rows: dict[int, dict[int, str]] = {}
    max_row = 0
    max_col = 0
    for row in root.findall(f".//{{{XLSX_MAIN_NS}}}sheetData/{{{XLSX_MAIN_NS}}}row"):
        row_index = int(row.attrib.get("r", "0") or "0")
        if row_index <= 0:
            continue
        max_row = max(max_row, row_index)
        cells: dict[int, str] = {}
        for cell_node in row.findall(f"{{{XLSX_MAIN_NS}}}c"):
            ref = cell_node.attrib.get("r", "")
            col_index = column_index_from_ref(ref)
            if col_index <= 0:
                continue
            value = cell_value(cell_node, shared_strings)
            if value != "":
                cells[col_index] = value
            max_col = max(max_col, col_index)
        sparse_rows[row_index] = cells
    if dimension_ref and ":" in dimension_ref:
        max_col = max(max_col, column_index_from_ref(dimension_ref.split(":", 1)[1]))
    rows: list[list[str]] = []
    for row_index in range(1, max_row + 1):
        sparse = sparse_rows.get(row_index, {})
        rows.append([sparse.get(col_index, "") for col_index in range(1, max_col + 1)])
    return rows, dimension_ref


def cell_value(cell_node: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell_node.attrib.get("t", "")
    if cell_type == "inlineStr":
        return clean_cell_text("".join(node.text or "" for node in cell_node.findall(f".//{{{XLSX_MAIN_NS}}}t")))
    value_node = cell_node.find(f"{{{XLSX_MAIN_NS}}}v")
    if value_node is None or value_node.text is None:
        return ""
    raw = value_node.text
    if cell_type == "s":
        try:
            return clean_cell_text(shared_strings[int(raw)])
        except (IndexError, ValueError):
            return ""
    if cell_type == "b":
        return "TRUE" if raw == "1" else "FALSE"
    return clean_cell_text(raw)


def clean_cell_text(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def column_index_from_ref(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    result = 0
    for ch in letters.upper():
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result


def find_header_row(rows: list[list[str]], required: tuple[str, ...]) -> int:
    for index, row in enumerate(rows):
        values = {normalize_header(value) for value in row if value}
        if all(normalize_header(item) in values for item in required):
            return index
    raise ValueError(f"missing required header row: {', '.join(required)}")


def find_first_header_row(rows: list[list[str]]) -> int | None:
    for index, row in enumerate(rows):
        values = {normalize_header(value) for value in row if value}
        if "序号" in values or "版本号" in values:
            return index
    return None


def normalize_header_map(row: list[str]) -> dict[str, int]:
    return {normalize_header(value): index for index, value in enumerate(row) if normalize_header(value)}


def normalize_header(value: str) -> str:
    return value.strip().replace(" ", "")


def cell(row: list[str], header: dict[str, int], name: str) -> str:
    index = header.get(normalize_header(name))
    if index is None or index >= len(row):
        return ""
    return clean_cell_text(row[index])


def parse_int(value: object) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_number(value: object) -> float | None:
    text = str(value or "").strip().replace(",", "")
    if not text:
        return None
    try:
        numeric = float(text)
    except ValueError:
        return None
    return int(numeric) if numeric.is_integer() else numeric


def clean_label(value: str) -> str:
    return value.replace("\u3000", "").strip()


def object_group_for_code(code: str) -> str:
    if code.startswith("10-"):
        return "building"
    if code.startswith("12-"):
        return "space"
    if code.startswith("16-"):
        return "system"
    return "element"


def naming_prefix(value: str) -> str:
    first = str(value or "").strip().split("_", 1)[0]
    return first if first and first[0].isalpha() else ""


def extract_length_token(value: str) -> float | None:
    match = LENGTH_TOKEN_RE.search(value)
    if not match:
        return None
    return parse_number(match.group("length"))


def prefix_category_conflict(prefix: str, category_name: str) -> bool:
    category = clean_label(category_name)
    expected_terms = {
        "Column": ("柱",),
        "Beam": ("梁",),
        "Purlin": ("檩",),
        "Fastener": ("螺", "栓", "锚"),
        "Plate": ("板",),
        "Gutter": ("沟",),
    }
    terms = expected_terms.get(prefix)
    return bool(terms and not any(term in category for term in terms))


def issue(
    severity: str,
    code: str,
    message: str,
    line: dict[str, Any],
    source: dict[str, Any],
    column: str,
) -> dict[str, Any]:
    return {
        "severity": severity,
        "code": code,
        "message": message,
        "lineNo": line.get("lineNo"),
        "componentName": line.get("componentName"),
        "categoryCode": line.get("categoryCode"),
        "source": {**source, "column": column},
    }
