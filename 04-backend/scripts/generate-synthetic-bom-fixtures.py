#!/usr/bin/env python3
"""Generate synthetic heavy-steel BOM source fixtures for CI gates.

Produces a synthetic component-material BOM workbook (XLSX) and a synthetic
drawing-catalog document (DOCX) so the BOM database bridge gate can run
without the developer-local source files under ~/下载.

The workbook is real XLSX (stdlib zip + XML, inline strings) and is parseable
by `architoken_workers.component_bom_worker.parse_bom_workbook`. Its line
count (14) and total quantity (470) intentionally match the values baked into
`04-backend/migrations/20260609000001_component_bom_database_bridge.sql`, so
the parse result can be reconciled against the database bridge assertions.

Every fixture is clearly labelled synthetic; none of it is professional or
approved engineering data.
"""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

FIXED_ZIP_DATE = (1980, 1, 1, 0, 0, 0)

BOM_HEADERS = [
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
]

# 14 lines, total quantity 470 — must stay in sync with the bridge migration
# expectations (bom_line_count = 14, bom_total_quantity = 470).
BOM_LINES = [
    (1, "钢柱", "30-01.10.10", "Column_Main_GKZ1", "HW400x400", "3600", "A轴", "Q235B", "GKZ1", "S-101", "1F", "根", 2, 24),
    (2, "钢柱", "30-01.10.15", "Column_Side_GKZ2", "HW300x300", "3600", "B轴", "Q235B", "GKZ2", "S-102", "1F", "根", 2, 16),
    (3, "钢梁", "30-01.20.10", "Beam_Main_GKL1", "HN500x200", "7200", "横向", "Q235B", "GKL1", "S-201", "2F", "根", 4, 48),
    (4, "钢梁", "30-01.20.15", "Beam_Sec_GKL2", "HN300x150", "3600", "纵向", "Q235B", "GKL2", "S-202", "2F", "根", 4, 56),
    (5, "檩条", "30-01.30.10", "Purlin_Roof_LT1", "C160x60", "6000", "屋面", "Q235B", "LT1", "S-301", "RF", "根", 5, 60),
    (6, "支撑", "30-01.40.10", "Brace_X_ZC1", "L100x10", "4200", "山墙", "Q235B", "ZC1", "S-401", "1F", "根", 2, 32),
    (7, "楼梯", "30-01.50.10", "Stair_Str_LTB1", "PL12", "3000", "核心筒", "Q235B", "LTB1", "S-501", "1-2F", "部", 1, 8),
    (8, "底板", "30-01.60.10", "Plate_Base_DJB1", "PL30", "600", "柱脚", "Q235B", "DJB1", "S-601", "1F", "块", 4, 40),
    (9, "高强螺栓", "30-02.10.10", "Bolt_HS_M24", "M24", "", "梁柱节点", "10.9S", "M24x80", "S-701", "全层", "套", 8, 64),
    (10, "墙板", "30-03.10.10", "Wall_Panel_WQB1", "ALC150", "3000", "外墙", "ALC", "WQB1", "S-801", "1-2F", "块", 3, 36),
    (11, "楼承板", "30-03.20.10", "Floor_Deck_LCB1", "YXB65", "6000", "楼面", "Q235B", "LCB1", "S-802", "2F", "块", 3, 42),
    (12, "栏杆", "30-03.30.10", "Rail_Guard_HLG1", "D50", "1200", "走廊", "Q235B", "HLG1", "S-803", "2F", "段", 2, 20),
    (13, "连接节点", "30-02.20.10", "Conn_Node_JD1", "PL16", "", "梁柱节点", "Q235B", "JD1", "S-702", "全层", "套", 2, 18),
    (14, "紧固件组", "30-02.30.10", "Fastener_Set_JGJ1", "M16", "", "檩条节点", "8.8S", "JGJ1", "S-703", "RF", "套", 1, 6),
]

CATEGORY_REFERENCE_HEADERS = ["序号", "板块", "层级", "编码", "类目名称"]
CATEGORY_REFERENCE_ROWS = [
    (1, "结构", "3", "30-01.10.10", "钢柱"),
    (2, "结构", "3", "30-01.20.10", "钢梁"),
    (3, "结构", "3", "30-01.30.10", "檩条"),
    (4, "连接", "3", "30-02.10.10", "高强螺栓"),
    (5, "围护", "3", "30-03.10.10", "墙板"),
    (6, "围护", "3", "30-03.20.10", "楼承板"),
]

TITLE_ROWS = [
    ["SYNTHETIC FIXTURE · 合成测试数据（非真实项目数据）"],
    ["重钢装配式酒店 · 构件物料清单（CI 合成样例）"],
    ["来源: 04-backend/scripts/generate-synthetic-bom-fixtures.py"],
    [],
]


def column_ref(index: int) -> str:
    ref = ""
    index += 1
    while index > 0:
        index, rem = divmod(index - 1, 26)
        ref = chr(ord("A") + rem) + ref
    return ref


def sheet_xml(rows: list[list[object]]) -> str:
    max_cols = max((len(row) for row in rows), default=1)
    dimension = f"A1:{column_ref(max_cols - 1)}{len(rows)}"
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        f'<dimension ref="{dimension}"/>',
        "<sheetData>",
    ]
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for col_index, value in enumerate(row):
            if value is None or value == "":
                continue
            ref = f"{column_ref(col_index)}{row_index}"
            if isinstance(value, (int, float)):
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>')
        parts.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    parts.append("</sheetData></worksheet>")
    return "".join(parts)


def write_zip(path: Path, entries: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_DATE)
            archive.writestr(info, content)


def build_bom_workbook(path: Path) -> None:
    bom_rows: list[list[object]] = [list(row) for row in TITLE_ROWS]
    bom_rows.append(list(BOM_HEADERS))
    total_quantity = 0
    for line in BOM_LINES:
        row: list[object] = list(line)
        # pad: 单套重量(kg) / 总重量(kg) intentionally missing (matches real
        # source: weight_state = missing_in_source), 备注 marks synthetic.
        row.extend(["", "", "合成数据"])
        bom_rows.append(row)
        total_quantity += line[13]
    bom_rows.append(["合计", "", "", "", "", "", "", "", "", "", "", "", "", total_quantity, "", "", ""])

    reference_rows: list[list[object]] = [["SYNTHETIC FIXTURE · 类目参照（合成样例）"], []]
    reference_rows.append(list(CATEGORY_REFERENCE_HEADERS))
    reference_rows.extend(list(row) for row in CATEGORY_REFERENCE_ROWS)

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets>'
        '<sheet name="物料清单" sheetId="1" r:id="rId1"/>'
        '<sheet name="类目参照" sheetId="2" r:id="rId2"/>'
        "</sheets></workbook>"
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
        "</Relationships>"
    )
    write_zip(
        path,
        {
            "[Content_Types].xml": content_types,
            "_rels/.rels": root_rels,
            "xl/workbook.xml": workbook,
            "xl/_rels/workbook.xml.rels": workbook_rels,
            "xl/worksheets/sheet1.xml": sheet_xml(bom_rows),
            "xl/worksheets/sheet2.xml": sheet_xml(reference_rows),
        },
    )


def build_drawing_catalog(path: Path) -> None:
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    paragraphs = "".join(
        f"<w:p><w:r><w:t>{escape(text)}</w:t></w:r></w:p>"
        for text in (
            "SYNTHETIC FIXTURE · 合成测试数据（非真实项目图纸）",
            "重钢装配式酒店深化图纸目录（CI 合成样例）",
            "来源: 04-backend/scripts/generate-synthetic-bom-fixtures.py",
        )
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paragraphs}</w:body></w:document>"
    )
    write_zip(
        path,
        {
            "[Content_Types].xml": content_types,
            "_rels/.rels": root_rels,
            "word/document.xml": document,
        },
    )


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: generate-synthetic-bom-fixtures.py <output-dir>", file=sys.stderr)
        return 1
    out_dir = Path(sys.argv[1])
    workbook_path = out_dir / "synthetic_构件物料清单.xlsx"
    catalog_path = out_dir / "synthetic_深化图纸目录.docx"
    build_bom_workbook(workbook_path)
    build_drawing_catalog(catalog_path)
    print(workbook_path)
    print(catalog_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
