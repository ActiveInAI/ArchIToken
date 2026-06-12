#!/usr/bin/env python3
"""architoken_usd_to_bom.py <input.usd|.usda|.usdc|.usdz> <output.json> [--csv-dir DIR] [--name NAME]

USD/USDZ 真实 BOM(官方 Pixar OpenUSD usd-core):
- 按 prim 类型统计;实例化(instanceable)按原型分组真实计数
- Mesh 给出面数;世界包围盒按 stage 的 metersPerUnit 换算为米
不臆测材料/重量。
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

from pxr import Usd, UsdGeom


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extract BOM from USD/USDZ stage")
    parser.add_argument("paths", nargs="*")
    parser.add_argument("--input", dest="source")
    parser.add_argument("--output", dest="output")
    parser.add_argument("--csv-dir", default=None)
    parser.add_argument("--name", default=None)
    args = parser.parse_args(argv)
    source_arg = args.source or (args.paths[0] if args.paths else None)
    output_arg = args.output or (args.paths[1] if len(args.paths) >= 2 else None)
    if not source_arg or not output_arg:
        parser.error("source and output are required")
    source, output = Path(source_arg), Path(output_arg)

    started = time.time()
    stage = Usd.Stage.Open(str(source))
    if stage is None:
        raise SystemExit(f"OpenUSD 无法打开 stage: {source}")
    meters_per_unit = UsdGeom.GetStageMetersPerUnit(stage)
    bbox_cache = UsdGeom.BBoxCache(
        Usd.TimeCode.Default(), [UsdGeom.Tokens.default_, UsdGeom.Tokens.render]
    )

    groups: dict[str, list[dict]] = defaultdict(list)
    total_meshes = 0
    total_faces = 0
    for prim in stage.Traverse(Usd.TraverseInstanceProxies()):
        if not prim.IsA(UsdGeom.Mesh):
            continue
        total_meshes += 1
        mesh = UsdGeom.Mesh(prim)
        counts_attr = mesh.GetFaceVertexCountsAttr().Get()
        face_count = len(counts_attr) if counts_attr else 0
        total_faces += face_count
        # 实例代理归到原型路径分组 = 真实实例计数;非实例按自身 prim 名
        if prim.IsInstanceProxy():
            proto = prim.GetPrimInPrototype()
            group_key = str(proto.GetPath())
        else:
            group_key = prim.GetName()
        bound = bbox_cache.ComputeWorldBound(prim).ComputeAlignedRange()
        size = bound.GetSize() if not bound.IsEmpty() else None
        groups[group_key].append(
            {
                "path": str(prim.GetPath()),
                "faces": face_count,
                "sizeM": [round(v * meters_per_unit, 4) for v in size]
                if size is not None
                else None,
            }
        )

    if not groups:
        raise SystemExit("USD stage 未包含任何 Mesh prim")

    lines = []
    for index, (key, members) in enumerate(
        sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])), start=1
    ):
        lines.append(
            {
                "lineNo": index,
                "name": key.rsplit("/", 1)[-1] or key,
                "prototype": key,
                "quantity": len(members),
                "unit": "实例",
                "quantityBasis": "OpenUSD prim/实例真实计数(含 instance proxy)",
                "facesPerInstance": members[0]["faces"],
                "sizeM": members[0]["sizeM"],
                "measureBasis": f"世界包围盒×metersPerUnit({meters_per_unit})",
            }
        )

    manifest = {
        "schema": "architoken.model_bom_manifest.v1",
        "sourceFormat": source.suffix.lower(),
        "sourcePath": str(source),
        "engine": f"OpenUSD usd-core {Usd.GetVersion() if hasattr(Usd, 'GetVersion') else ''}".strip(),
        "projectName": args.name or source.stem,
        "reviewState": "professional_review_required",
        "quantityBasis": "usd_prim_instance_count",
        "measureBasis": "world_bbox_meters",
        "metersPerUnit": meters_per_unit,
        "summary": {
            "lineCount": len(lines),
            "elementCount": total_meshes,
            "totalQuantity": total_meshes,
            "totalFaces": total_faces,
        },
        "lines": lines,
        "durationSeconds": round(time.time() - started, 2),
        "notes": [
            "数量为 OpenUSD stage 的 Mesh prim/实例真实计数;实例化引用按原型分组。",
            "尺寸为世界包围盒按 stage metersPerUnit 换算(米);USD 无材料密度语义,不计算重量。",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.csv_dir:
        csv_dir = Path(args.csv_dir)
        csv_dir.mkdir(parents=True, exist_ok=True)
        with (csv_dir / "bom_summary.csv").open("w", newline="", encoding="utf-8-sig") as fh:
            writer = csv.writer(fh)
            writer.writerow(["行号", "构件/原型", "数量", "单位", "数量依据", "单实例面数", "包围盒m", "评审状态"])
            for line in lines:
                writer.writerow([
                    line["lineNo"], line["name"], line["quantity"], line["unit"],
                    line["quantityBasis"], line["facesPerInstance"],
                    "x".join(str(v) for v in line["sizeM"]) if line["sizeM"] else "",
                    "待专业评审",
                ])

    print(json.dumps({"status": "ok", "lines": len(lines), "meshes": total_meshes}), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
