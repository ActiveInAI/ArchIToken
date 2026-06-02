#!/usr/bin/env python3
"""Import SJG 157-2024 semantic dictionary categories from an authorized PDF.

The repository stores the schema and importer, not the full copyrighted
standard tables. Run this script against a locally authorized PDF copy to load
Appendix A rows into PostgreSQL.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, replace
from pathlib import Path
from urllib.parse import quote


STANDARD_ID = "sjg157-2024"
DEFAULT_PDF = Path("/home/insome/下载/《建筑工程信息模型语义字典标准》SJG 157-2024.pdf")
NAMESPACE_URI = "http://www.cbims.org.cn/ns/szbd#"
CODE_RE = re.compile(
    r"\b(?P<code>(?:10|12|16|30)-\d{2}\.\d{2}\.\d{2}(?:\.\d{2})?(?:\.\d{2})?)\b"
)
IFC_RE = re.compile(r"\b(?P<ifc>Ifc[A-Za-z0-9_]+)\b")


OBJECT_GROUP_BY_TABLE = {
    "10": "building",
    "12": "space",
    "16": "system",
    "30": "element",
}

LEVEL_NAMES = {
    1: "大类",
    2: "中类",
    3: "小类",
    4: "细类",
    5: "微类",
}


@dataclass(frozen=True)
class CategoryRow:
    """One Appendix A category row parsed from the PDF text layer."""

    code: str
    table_code: str
    object_group: str
    level_num: int
    level_name: str
    parent_code: str | None
    name_zh: str
    rdf_identifier: str
    rdf_uri: str
    ifc_entity: str | None
    ifc_mapping_raw: str
    terminology_raw: str
    remark: str | None
    source_line: int
    raw_text: str


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        nargs="?",
        default=str(DEFAULT_PDF),
        help="SJG 157-2024 PDF or pdftotext -layout text file.",
    )
    parser.add_argument("--emit-sql", type=Path, help="Write SQL to this file instead of stdout.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply generated SQL through psql. Requires --database-url or DATABASE_URL.",
    )
    parser.add_argument("--database-url", help="PostgreSQL URL used with --apply.")
    parser.add_argument("--dry-run", action="store_true", help="Print parse summary only.")
    parser.add_argument("--limit", type=int, help="Only emit the first N categories.")
    args = parser.parse_args()

    source = Path(args.source).expanduser()
    text_path = source
    cleanup_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        if source.suffix.lower() == ".pdf":
            cleanup_dir = tempfile.TemporaryDirectory(prefix="architoken-sjg157-")
            text_path = Path(cleanup_dir.name) / "sjg157-2024.txt"
            extract_pdf_text(source, text_path)

        lines = text_path.read_text(encoding="utf-8").splitlines()
        rows = parse_categories(lines)
        if args.limit is not None:
            rows = rows[: args.limit]
        source_sha256 = sha256_file(source) if source.is_file() else None

        if args.dry_run:
            print_summary(rows, source_sha256)
            return 0

        sql = render_sql(rows, source_sha256)
        if args.emit_sql:
            args.emit_sql.write_text(sql, encoding="utf-8")
            print(f"wrote {len(rows)} SJG 157 categories to {args.emit_sql}")
        elif not args.apply:
            sys.stdout.write(sql)

        if args.apply:
            apply_sql(sql, args.database_url)
        return 0
    finally:
        if cleanup_dir is not None:
            cleanup_dir.cleanup()


def extract_pdf_text(source: Path, target: Path) -> None:
    """Extract a layout-preserving text layer with poppler pdftotext."""

    if not source.is_file():
        raise SystemExit(f"source file not found: {source}")
    if shutil.which("pdftotext") is None:
        raise SystemExit("pdftotext is required to import SJG 157 PDF content")
    subprocess.run(["pdftotext", "-layout", str(source), str(target)], check=True)


def parse_categories(lines: list[str]) -> list[CategoryRow]:
    """Parse Appendix A category rows from a pdftotext -layout extraction."""

    start = find_heading_line(lines, "附录 A", min_index=300)
    end = find_heading_line(lines, "附录 B", min_index=start + 1)
    appendix = lines[start:end]

    candidate_indexes = [
        index
        for index, line in enumerate(appendix)
        if CODE_RE.search(line) is not None
    ]
    rows: list[CategoryRow] = []
    for ordinal, index in enumerate(candidate_indexes):
        line = appendix[index]
        match = CODE_RE.search(line)
        if match is None:
            continue
        code = match.group("code")
        table_code = code[:2]
        if table_code not in OBJECT_GROUP_BY_TABLE:
            continue
        code_start = match.start("code")
        name = parse_name(appendix, index, code_start)
        if not name:
            raise ValueError(f"could not parse category name for {code} at Appendix A line {index}")
        next_index = candidate_indexes[ordinal + 1] if ordinal + 1 < len(candidate_indexes) else len(appendix)
        raw_text = "\n".join(clean_block_lines(appendix[index:next_index])).strip()
        after_code = line[match.end("code") :].strip()
        ifc_match = IFC_RE.search(after_code)
        ifc_entity = ifc_match.group("ifc") if ifc_match else None
        ifc_mapping_raw = after_code
        terminology_raw = after_code[ifc_match.end("ifc") :].strip() if ifc_match else after_code
        remark = parse_remark(raw_text)
        level_num = category_level(code)
        rows.append(
            CategoryRow(
                code=code,
                table_code=table_code,
                object_group=OBJECT_GROUP_BY_TABLE[table_code],
                level_num=level_num,
                level_name=LEVEL_NAMES[level_num],
                parent_code=None,
                name_zh=name,
                rdf_identifier=f"szbd:{name}",
                rdf_uri=f"{NAMESPACE_URI}{quote(name, safe='')}",
                ifc_entity=ifc_entity,
                ifc_mapping_raw=ifc_mapping_raw,
                terminology_raw=terminology_raw,
                remark=remark,
                source_line=start + index + 1,
                raw_text=raw_text,
            )
        )

    by_code = {row.code for row in rows}
    with_parents = [replace(row, parent_code=parent_code(row.code, by_code)) for row in rows]
    return with_parents


def find_line(lines: list[str], needle: str, min_index: int = 0) -> int:
    """Find the first line containing needle after a minimum zero-based index."""

    for index, line in enumerate(lines[min_index:], min_index):
        if needle in line:
            return index
    raise ValueError(f"could not find {needle!r} after line {min_index}")


def find_heading_line(lines: list[str], heading: str, min_index: int = 0) -> int:
    """Find a standard heading line, ignoring body references to that heading."""

    for index, line in enumerate(lines[min_index:], min_index):
        if line.strip().startswith(heading):
            return index
    raise ValueError(f"could not find heading {heading!r} after line {min_index}")


def parse_name(lines: list[str], index: int, code_start: int) -> str:
    """Collect wrapped name fragments around the category code column."""

    current = lines[index]
    match = CODE_RE.search(current)
    if match is None:
        return ""
    parts: list[str] = []

    for before in range(index - 1, max(index - 4, -1), -1):
        fragment = name_fragment_before_code(lines[before], code_start)
        if fragment is None:
            break
        parts.insert(0, fragment)

    prefix = current[: match.start("code")].strip()
    if prefix:
        parts.append(prefix)

    for after in range(index + 1, min(index + 4, len(lines))):
        if CODE_RE.search(lines[after]) is not None:
            break
        fragment = name_fragment_before_code(lines[after], code_start)
        if fragment is None:
            break
        parts.append(fragment)

    return normalize_name("".join(parts))


def name_fragment_before_code(line: str, code_start: int) -> str | None:
    """Return a probable wrapped name fragment in the left table column."""

    stripped = line.strip()
    fragment = line[:code_start].strip()
    if not stripped or is_table_noise(stripped) or not fragment:
        return None
    first = len(line) - len(line.lstrip())
    if first >= code_start:
        return None
    if any(token in fragment for token in ("GB ", "SJG ", "Ifc", "扩展", "—", "/")):
        return None
    return fragment


def normalize_name(value: str) -> str:
    """Normalize PDF extraction spaces in Chinese category names."""

    return re.sub(r"\s+", "", value).strip()


def clean_block_lines(lines: list[str]) -> list[str]:
    """Drop table headers and page numbers from a raw row block."""

    return [line.rstrip() for line in lines if not is_table_noise(line.strip())]


def is_table_noise(stripped: str) -> bool:
    """Return true for repeated table headers, page numbers, and form-feed lines."""

    if not stripped:
        return True
    if stripped.isdigit():
        return True
    noise_tokens = (
        "类目名称",
        "领域规范术语",
        "方案设计（工程规划）",
        "施工图设计",
        "竣工移交",
        "续表 A.",
        "表 A.",
        "A.1",
        "A.2",
        "A.3",
        "A.4",
    )
    return any(token in stripped for token in noise_tokens)


def parse_remark(raw_text: str) -> str | None:
    """Extract a conservative remark fragment when the row contains extension notes."""

    for token in ("扩展", "GB/T 51269", "GB/T51269"):
        position = raw_text.find(token)
        if position >= 0:
            return " ".join(raw_text[position:].split())[:240]
    return None


def category_level(code: str) -> int:
    """Return SJG 157 hierarchy level from the non-zero code components."""

    _, rest = code.split("-", 1)
    parts = rest.split(".")
    level = sum(1 for part in parts if part != "00")
    return max(1, min(level, 5))


def parent_code(code: str, known_codes: set[str]) -> str | None:
    """Derive the nearest known upper category code."""

    table, rest = code.split("-", 1)
    parts = rest.split(".")
    candidates: list[str] = []
    if len(parts) > 3:
        candidates.append(f"{table}-" + ".".join(parts[:-1]))
    if len(parts) == 3 and parts[2] != "00":
        candidates.append(f"{table}-{parts[0]}.{parts[1]}.00")
    if parts[1] != "00":
        candidates.append(f"{table}-{parts[0]}.00.00")
    for candidate in candidates:
        if candidate in known_codes:
            return candidate
    return None


def render_sql(rows: list[CategoryRow], source_sha256: str | None) -> str:
    """Render idempotent SQL to upsert parsed categories."""

    statements = [
        "BEGIN;",
        "SET LOCAL statement_timeout = '5min';",
    ]
    if source_sha256:
        statements.append(
            "UPDATE semantic_dictionary_standards "
            f"SET source_sha256 = {sql_literal(source_sha256)}, "
            "ingestion_status = 'categories_imported', updated_at = NOW() "
            f"WHERE id = {sql_literal(STANDARD_ID)};"
        )
    for row in rows:
        statements.append(render_category_insert(row))
    statements.append("COMMIT;")
    return "\n".join(statements) + "\n"


def render_category_insert(row: CategoryRow) -> str:
    """Render one category upsert."""

    columns = [
        "standard_id",
        "code",
        "table_code",
        "object_group",
        "level_num",
        "level_name",
        "parent_code",
        "name_zh",
        "rdf_identifier",
        "rdf_uri",
        "ifc_entity",
        "ifc_mapping_raw",
        "terminology_raw",
        "remark",
        "source_line",
        "raw_text",
    ]
    values = [
        sql_literal(STANDARD_ID),
        sql_literal(row.code),
        sql_literal(row.table_code),
        sql_literal(row.object_group),
        str(row.level_num),
        sql_literal(row.level_name),
        sql_literal(row.parent_code),
        sql_literal(row.name_zh),
        sql_literal(row.rdf_identifier),
        sql_literal(row.rdf_uri),
        sql_literal(row.ifc_entity),
        sql_literal(row.ifc_mapping_raw),
        sql_literal(row.terminology_raw),
        sql_literal(row.remark),
        str(row.source_line),
        sql_literal(row.raw_text),
    ]
    assignments = [
        "table_code = EXCLUDED.table_code",
        "object_group = EXCLUDED.object_group",
        "level_num = EXCLUDED.level_num",
        "level_name = EXCLUDED.level_name",
        "parent_code = EXCLUDED.parent_code",
        "name_zh = EXCLUDED.name_zh",
        "rdf_identifier = EXCLUDED.rdf_identifier",
        "rdf_uri = EXCLUDED.rdf_uri",
        "ifc_entity = EXCLUDED.ifc_entity",
        "ifc_mapping_raw = EXCLUDED.ifc_mapping_raw",
        "terminology_raw = EXCLUDED.terminology_raw",
        "remark = EXCLUDED.remark",
        "source_line = EXCLUDED.source_line",
        "raw_text = EXCLUDED.raw_text",
        "updated_at = NOW()",
    ]
    return (
        "INSERT INTO semantic_dictionary_categories "
        f"({', '.join(columns)}) VALUES ({', '.join(values)}) "
        "ON CONFLICT (standard_id, code) DO UPDATE SET "
        f"{', '.join(assignments)};"
    )


def sql_literal(value: str | None) -> str:
    """Return a PostgreSQL string literal."""

    if value is None:
        return "NULL"
    return "'" + value.replace("\x00", "").replace("'", "''") + "'"


def apply_sql(sql: str, database_url: str | None) -> None:
    """Apply SQL through psql."""

    url = database_url or __import__("os").environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("--apply requires --database-url or DATABASE_URL")
    if shutil.which("psql") is None:
        raise SystemExit("psql is required for --apply")
    subprocess.run(["psql", url], input=sql, text=True, check=True)


def sha256_file(path: Path) -> str:
    """Return the SHA-256 hex digest for a file."""

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def print_summary(rows: list[CategoryRow], source_sha256: str | None) -> None:
    """Print parser summary for operator review."""

    counts: dict[str, int] = {}
    for row in rows:
        counts[row.object_group] = counts.get(row.object_group, 0) + 1
    print(json.dumps({"rows": len(rows), "groups": counts, "sourceSha256": source_sha256}, ensure_ascii=False, indent=2))
    for row in rows[:8]:
        print(f"{row.code} {row.name_zh} {row.ifc_entity or '-'} parent={row.parent_code or '-'}")


if __name__ == "__main__":
    raise SystemExit(main())
