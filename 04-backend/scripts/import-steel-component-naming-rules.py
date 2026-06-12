#!/usr/bin/env python3
"""Import the prefabricated-steel component standardized naming-rule workbook.

The repository stores the schema and importer, not the source workbook itself.
Run this against a locally authorized copy of
``装配式钢结构建筑构件标准化命名规则V1.0.xlsx`` to load the rules into
``component_bom_naming_rules`` as tenant-scoped source evidence. Imported rows
stay ``professional_review_required`` until a responsible professional approves
them through the platform workflow.

The workbook has eight sheets:

* 通用命名总则          -> rule_type='general'  (field-definition rules)
* 主体钢构件命名规则    -> rule_type='component'
* 围护配套构件命名规则  -> rule_type='component'
* 机电部品构件命名规则  -> rule_type='component'
* 紧固件构件命名规则    -> rule_type='component'
* 钢结构连接件命名规则  -> rule_type='component'
* 钢楼梯系统构件命名规则 -> rule_type='component'
* 版本号规则说明        -> rule_type='version'

Each component rule yields a canonical naming prefix (e.g. ``Beam_Main``) and a
single leading construct token (e.g. ``Beam``) that aligns with the
``allowedNamingPrefixes`` allow-list enforced in
``03-frontend/lib/component-bom.ts``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl


DEFAULT_WORKBOOK = Path(
    "/home/insome/下载/装配式钢结构建筑构件标准化命名规则V1.0.xlsx"
)
DEFAULT_SJG157 = Path(
    "/home/insome/下载/《建筑工程信息模型语义字典标准》SJG 157-2024.pdf"
)
MANIFEST_SCHEMA = "architoken.component_naming_rule.v1"

GENERAL_SHEET = "通用命名总则"
VERSION_SHEET = "版本号规则说明"
COMPONENT_SHEETS = {
    "主体钢构件命名规则": "主体钢构件",
    "围护配套构件命名规则": "围护配套构件",
    "机电部品构件命名规则": "机电部品构件",
    "紧固件构件命名规则": "紧固件构件",
    "钢结构连接件命名规则": "钢结构连接件",
    "钢楼梯系统构件命名规则": "钢楼梯系统构件",
}

VERSION_CODE_RE = re.compile(r"(?:^|_)(V\d+)(?:_|$)")
# A naming-formula token is "fixed" while it stays ASCII (English placeholder
# names like Beam/Main); the first token carrying CJK marks a variable field.
CJK_RE = re.compile(r"[一-鿿]")


@dataclass(frozen=True)
class NamingRuleRow:
    source_sheet: str
    source_row: int
    rule_key: str
    rule_type: str
    rule_category: str
    component_group: str
    component_type: str
    prefix: str
    naming_formula: str
    standard_example: str
    field_notes: str
    version_code: str
    metadata: dict[str, object] = field(default_factory=dict)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "workbook",
        nargs="?",
        default=str(DEFAULT_WORKBOOK),
        help="Naming-rule .xlsx workbook.",
    )
    parser.add_argument("--tenant-id", required=True, help="Target tenant UUID.")
    parser.add_argument("--project-id", required=True, help="Target project UUID.")
    parser.add_argument("--module-id", default="detailed_design", help="Owning module id.")
    parser.add_argument(
        "--sjg157-path",
        default=str(DEFAULT_SJG157),
        help="SJG 157-2024 source path recorded on the import batch.",
    )
    parser.add_argument("--emit-sql", type=Path, help="Write SQL here instead of stdout.")
    parser.add_argument("--apply", action="store_true", help="Apply through psql.")
    parser.add_argument("--database-url", help="PostgreSQL URL used with --apply.")
    parser.add_argument("--dry-run", action="store_true", help="Print parse summary only.")
    args = parser.parse_args()

    workbook = Path(args.workbook).expanduser()
    if not workbook.is_file():
        raise SystemExit(f"workbook not found: {workbook}")

    rows = parse_workbook(workbook)
    if not rows:
        raise SystemExit("no naming rules parsed; refusing to write an empty import")

    if args.dry_run:
        print_summary(rows)
        return 0

    sql = render_sql(
        rows,
        tenant_id=args.tenant_id,
        project_id=args.project_id,
        module_id=args.module_id,
        workbook=workbook,
        sjg157_path=args.sjg157_path,
    )
    if args.emit_sql:
        args.emit_sql.write_text(sql, encoding="utf-8")
        print(f"wrote {len(rows)} naming rules to {args.emit_sql}")
    elif not args.apply:
        sys.stdout.write(sql)

    if args.apply:
        apply_sql(sql, args.database_url)
        print(f"applied {len(rows)} naming rules")
    return 0


def parse_workbook(path: Path) -> list[NamingRuleRow]:
    wb = openpyxl.load_workbook(path, data_only=True)
    rows: list[NamingRuleRow] = []
    for ws in wb.worksheets:
        title = ws.title
        grid = [
            ["" if cell is None else str(cell).strip() for cell in row]
            for row in ws.iter_rows(values_only=True)
        ]
        if title == GENERAL_SHEET:
            rows.extend(parse_general(title, grid))
        elif title == VERSION_SHEET:
            rows.extend(parse_version(title, grid))
        elif title in COMPONENT_SHEETS:
            rows.extend(parse_component(title, COMPONENT_SHEETS[title], grid))
        # 未知 sheet 被忽略，绝不臆造规则。
    return rows


def parse_general(sheet: str, grid: list[list[str]]) -> list[NamingRuleRow]:
    # 列：序号 | 规则分类 | 规则内容 | 通用编码说明 | 示例 | 备注
    out: list[NamingRuleRow] = []
    for excel_row, cells in enumerate(grid, start=1):
        if excel_row <= 2:
            continue
        seq, category, content, note, example, remark = pad(cells, 6)
        if not category and not content:
            continue
        out.append(
            NamingRuleRow(
                source_sheet=sheet,
                source_row=excel_row,
                rule_key=f"general-{seq or excel_row}",
                rule_type="general",
                rule_category=category,
                component_group="",
                component_type="",
                prefix="",
                naming_formula=content,
                standard_example=example,
                field_notes=join_notes(note, remark),
                version_code="",
                metadata={"sequence": seq, "remark": remark, "encodingNote": note},
            )
        )
    return out


def parse_version(sheet: str, grid: list[list[str]]) -> list[NamingRuleRow]:
    # 列：版本号 | 适用场景 | 修改说明
    out: list[NamingRuleRow] = []
    for excel_row, cells in enumerate(grid, start=1):
        if excel_row <= 2:
            continue
        version, scenario, description = pad(cells, 3)
        if not version:
            continue
        out.append(
            NamingRuleRow(
                source_sheet=sheet,
                source_row=excel_row,
                rule_key=f"version-{slug(version)}",
                rule_type="version",
                rule_category=scenario,
                component_group="",
                component_type="",
                prefix="",
                naming_formula="",
                standard_example="",
                field_notes=description,
                version_code=normalize_version(version),
                metadata={"scenario": scenario},
            )
        )
    return out


def parse_component(sheet: str, section: str, grid: list[list[str]]) -> list[NamingRuleRow]:
    # 列：序号 | 构件大类 | 构件类型 | 标准命名公式 | 标准命名实例 | 各字段释义 | 备注
    out: list[NamingRuleRow] = []
    for excel_row, cells in enumerate(grid, start=1):
        if excel_row <= 2:
            continue
        seq, group, ctype, formula, example, notes, remark = pad(cells, 7)
        if not formula and not ctype:
            continue
        prefix = leading_token(formula) or leading_token(example)
        rule_key = canonical_prefix(formula) or canonical_prefix(example) or prefix
        out.append(
            NamingRuleRow(
                source_sheet=sheet,
                source_row=excel_row,
                rule_key=rule_key or f"{slug(section)}-{seq or excel_row}",
                rule_type="component",
                rule_category=section,
                component_group=group,
                component_type=ctype,
                prefix=prefix,
                naming_formula=formula,
                standard_example=example,
                field_notes=join_notes(notes, remark),
                version_code=extract_version(example),
                metadata={"sequence": seq, "remark": remark},
            )
        )
    return out


def pad(cells: list[str], width: int) -> list[str]:
    return (cells + [""] * width)[:width]


def join_notes(*parts: str) -> str:
    chunks = [p.strip() for p in parts if p and p.strip()]
    return " ｜ ".join(chunks)


def leading_token(formula: str) -> str:
    """First underscore token of a naming formula (the construct type prefix)."""

    if not formula:
        return ""
    token = formula.split("_", 1)[0].strip()
    return "" if CJK_RE.search(token) else token


def canonical_prefix(formula: str) -> str:
    """Leading ASCII tokens up to the first variable (CJK) field: Beam_Main."""

    if not formula:
        return ""
    fixed: list[str] = []
    for token in formula.split("_"):
        token = token.strip()
        if not token or CJK_RE.search(token):
            break
        fixed.append(token)
    return "_".join(fixed)


def extract_version(example: str) -> str:
    match = VERSION_CODE_RE.search(example or "")
    return match.group(1) if match else ""


def normalize_version(raw: str) -> str:
    match = re.search(r"V\d+", raw or "")
    return match.group(0) if match else raw.strip()


def slug(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-z一-鿿]+", "-", value or "").strip("-")
    return cleaned or "rule"


def render_sql(
    rows: list[NamingRuleRow],
    *,
    tenant_id: str,
    project_id: str,
    module_id: str,
    workbook: Path,
    sjg157_path: str,
) -> str:
    workbook_path = str(workbook)
    workbook_sha = sha256_file(workbook)
    batch_selector = (
        "(SELECT import_batch_id FROM component_bom_import_batches WHERE "
        f"tenant_id = {lit(tenant_id)} AND project_id = {lit(project_id)} "
        f"AND module_id = {lit(module_id)} AND source_bom_path = {lit(workbook_path)} "
        f"AND source_sjg157_path = {lit(sjg157_path)} "
        f"AND source_naming_rule_path = {lit(workbook_path)})"
    )

    statements = [
        "BEGIN;",
        "SET LOCAL statement_timeout = '5min';",
        f"SET LOCAL app.current_tenant = {lit(tenant_id)};",
        render_batch_upsert(
            tenant_id=tenant_id,
            project_id=project_id,
            module_id=module_id,
            workbook_path=workbook_path,
            workbook_sha=workbook_sha,
            sjg157_path=sjg157_path,
            naming_rule_count=len(rows),
        ),
    ]
    for row in rows:
        statements.append(
            render_rule_upsert(
                row,
                tenant_id=tenant_id,
                project_id=project_id,
                module_id=module_id,
                workbook_path=workbook_path,
                batch_selector=batch_selector,
            )
        )
    statements.append("COMMIT;")
    return "\n".join(statements) + "\n"


def render_batch_upsert(
    *,
    tenant_id: str,
    project_id: str,
    module_id: str,
    workbook_path: str,
    workbook_sha: str,
    sjg157_path: str,
    naming_rule_count: int,
) -> str:
    metadata = json.dumps(
        {"importKind": "naming_rules_only", "manifestSchema": MANIFEST_SCHEMA},
        ensure_ascii=False,
    )
    columns = [
        "tenant_id",
        "project_id",
        "module_id",
        "adapter_id",
        "worker_operation",
        "manifest_schema",
        "status",
        "review_state",
        "source_bom_path",
        "source_bom_sha256",
        "source_sjg157_path",
        "source_naming_rule_path",
        "source_naming_rule_sha256",
        "naming_rule_count",
        "metadata",
    ]
    values = [
        lit(tenant_id),
        lit(project_id),
        lit(module_id),
        lit("component_bom"),
        lit("component_naming_rule_import"),
        lit(MANIFEST_SCHEMA),
        lit("professional_review_required"),
        lit("professional_review_required"),
        lit(workbook_path),
        lit(workbook_sha),
        lit(sjg157_path),
        lit(workbook_path),
        lit(workbook_sha),
        str(naming_rule_count),
        f"{lit(metadata)}::jsonb",
    ]
    return (
        "INSERT INTO component_bom_import_batches "
        f"({', '.join(columns)}) VALUES ({', '.join(values)}) "
        "ON CONFLICT (tenant_id, project_id, module_id, source_bom_path, "
        "source_sjg157_path, source_naming_rule_path) DO UPDATE SET "
        "naming_rule_count = EXCLUDED.naming_rule_count, "
        "source_naming_rule_sha256 = EXCLUDED.source_naming_rule_sha256, "
        "metadata = EXCLUDED.metadata, updated_at = NOW();"
    )


def render_rule_upsert(
    row: NamingRuleRow,
    *,
    tenant_id: str,
    project_id: str,
    module_id: str,
    workbook_path: str,
    batch_selector: str,
) -> str:
    columns = [
        "tenant_id",
        "project_id",
        "module_id",
        "import_batch_id",
        "source_path",
        "source_sheet",
        "source_row",
        "rule_key",
        "rule_type",
        "rule_category",
        "component_group",
        "component_type",
        "prefix",
        "naming_formula",
        "standard_example",
        "field_notes",
        "version_code",
        "status",
        "metadata",
    ]
    values = [
        lit(tenant_id),
        lit(project_id),
        lit(module_id),
        batch_selector,
        lit(workbook_path),
        lit(row.source_sheet),
        str(row.source_row),
        lit(row.rule_key),
        lit(row.rule_type),
        lit(row.rule_category),
        lit(row.component_group),
        lit(row.component_type),
        lit(row.prefix),
        lit(row.naming_formula),
        lit(row.standard_example),
        lit(row.field_notes),
        lit(row.version_code),
        lit("professional_review_required"),
        f"{lit(json.dumps(row.metadata, ensure_ascii=False))}::jsonb",
    ]
    assignments = [
        "import_batch_id = EXCLUDED.import_batch_id",
        "rule_key = EXCLUDED.rule_key",
        "rule_type = EXCLUDED.rule_type",
        "rule_category = EXCLUDED.rule_category",
        "component_group = EXCLUDED.component_group",
        "component_type = EXCLUDED.component_type",
        "prefix = EXCLUDED.prefix",
        "naming_formula = EXCLUDED.naming_formula",
        "standard_example = EXCLUDED.standard_example",
        "field_notes = EXCLUDED.field_notes",
        "version_code = EXCLUDED.version_code",
        "status = EXCLUDED.status",
        "metadata = EXCLUDED.metadata",
        "updated_at = NOW()",
    ]
    return (
        "INSERT INTO component_bom_naming_rules "
        f"({', '.join(columns)}) VALUES ({', '.join(values)}) "
        "ON CONFLICT (tenant_id, project_id, source_path, source_sheet, source_row) "
        f"DO UPDATE SET {', '.join(assignments)};"
    )


def lit(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("\x00", "").replace("'", "''") + "'"


def apply_sql(sql: str, database_url: str | None) -> None:
    import os

    url = database_url or os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("--apply requires --database-url or DATABASE_URL")
    if shutil.which("psql") is None:
        raise SystemExit("psql is required for --apply")
    subprocess.run(["psql", url], input=sql, text=True, check=True)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def print_summary(rows: list[NamingRuleRow]) -> None:
    by_type: dict[str, int] = {}
    by_sheet: dict[str, int] = {}
    for row in rows:
        by_type[row.rule_type] = by_type.get(row.rule_type, 0) + 1
        by_sheet[row.source_sheet] = by_sheet.get(row.source_sheet, 0) + 1
    print(json.dumps({"rows": len(rows), "byType": by_type, "bySheet": by_sheet}, ensure_ascii=False, indent=2))
    for row in rows:
        if row.rule_type == "component":
            print(f"  [{row.prefix:<14}] {row.rule_key:<22} {row.component_group}/{row.component_type}")


if __name__ == "__main__":
    raise SystemExit(main())
