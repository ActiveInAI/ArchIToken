"""Floorplan Generate / Fit / Furnish worker adapter.

The worker mirrors the frontend floorplan-layout manifest contract with a
deterministic stdlib implementation. Production solvers can replace the layout
algorithm later while keeping the schema, review state, and artifact role.
"""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from .contract import ConversionJob, ConversionOperation, WorkerResult, validate_job
from .io import write_json_artifact

MODULUS = 300
MAX_SPAN = 4800
DEFAULT_USABLE_RATIO = 0.83

ROOM_KEYS = ("主卧", "主卫", "次卧", "卫生间", "厨房", "阳台")

DEFAULT_ROOMS: dict[str, dict[str, float | int]] = {
    "主卧": {"count": 1, "min": 12, "max": 16},
    "主卫": {"count": 1, "min": 3, "max": 5},
    "次卧": {"count": 2, "min": 10, "max": 13},
    "卫生间": {"count": 1, "min": 3, "max": 6},
    "厨房": {"count": 1, "min": 6, "max": 8},
    "阳台": {"count": 0, "min": 3, "max": 6},
}

TEMPLATES: dict[str, dict[str, Any]] = {
    "t2": {
        "title": "两居 75㎡",
        "total": 75,
        "floors": 1,
        "split": "lk",
        "rooms": {
            "主卧": {"count": 1, "min": 12, "max": 14},
            "主卫": {"count": 0, "min": 3, "max": 5},
            "次卧": {"count": 1, "min": 9, "max": 11},
            "卫生间": {"count": 1, "min": 3, "max": 5},
            "厨房": {"count": 1, "min": 5, "max": 7},
            "阳台": {"count": 0, "min": 3, "max": 5},
        },
    },
    "t3": {
        "title": "三居两厅 95㎡",
        "total": 95,
        "floors": 1,
        "split": "lk_sep",
        "rooms": {
            "主卧": {"count": 1, "min": 13, "max": 15},
            "主卫": {"count": 0, "min": 3, "max": 5},
            "次卧": {"count": 2, "min": 10, "max": 12},
            "卫生间": {"count": 1, "min": 4, "max": 6},
            "厨房": {"count": 1, "min": 6, "max": 8},
            "阳台": {"count": 0, "min": 3, "max": 5},
        },
    },
    "t4": {
        "title": "四居两厅双卫 135㎡",
        "total": 135,
        "floors": 2,
        "split": "lk_sep",
        "rooms": {
            "主卧": {"count": 1, "min": 15, "max": 18},
            "主卫": {"count": 1, "min": 4, "max": 6},
            "次卧": {"count": 3, "min": 10, "max": 13},
            "卫生间": {"count": 1, "min": 4, "max": 6},
            "厨房": {"count": 1, "min": 7, "max": 9},
            "阳台": {"count": 0, "min": 3, "max": 5},
        },
    },
}


def generate_floorplan_layout(job: ConversionJob) -> WorkerResult:
    """Generate floorplan candidates and persist an ArchIToken manifest."""

    validate_job(job)
    if job.operation != ConversionOperation.FLOORPLAN_GENERATE:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={
                "code": "unsupported_operation",
                "message": f"floorplan_layout requires floorplan_generate, got {job.operation.value}",
            },
            output={"adapter": "floorplan_layout", "operation": job.operation.value},
        )

    intent = _parse_intent(job.input)
    candidates = _create_candidates(intent)
    active_id = str(job.input.get("activeCandidateId") or candidates[0]["id"])
    active = next((candidate for candidate in candidates if candidate["id"] == active_id), candidates[0])
    furniture = _build_furniture(active["plan"]) if str(job.input.get("mode", "")).lower() == "furnish" else []
    evaluation = _evaluate_plan(active["plan"], intent, furniture)
    manifest = {
        "schema": "architoken.floorplan_candidate_manifest.v1",
        "moduleId": str(job.input.get("moduleId") or "detailed_design"),
        "source": "ArchIToken worker floorplan_layout: Program/boundary -> Generate/Fit/Furnish -> evaluator gates",
        "reviewState": "professional_review_required",
        "aiGateChain": ["Planner", "Generator", "Evaluator", "RuleChecker", "SchemaValidator", "Approver"],
        "mode": str(job.input.get("mode") or active["command"]).lower(),
        "intent": intent,
        "plan": {**active["plan"], "evaluation": evaluation},
        "activeCandidate": active,
        "candidates": candidates,
        "furniture": furniture,
        "evaluation": evaluation,
    }
    output_name = str(job.input.get("outputName") or job.input.get("output_name") or "floorplan_candidate_manifest.json")
    artifact = write_json_artifact(
        job,
        output_name,
        manifest,
        role="floorplan_candidate_manifest",
        metadata={
            "schema": manifest["schema"],
            "reviewState": manifest["reviewState"],
            "candidateCount": len(candidates),
            "activeCandidateId": active["id"],
        },
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "adapter": "floorplan_layout",
            "schema": manifest["schema"],
            "reviewState": manifest["reviewState"],
            "candidateCount": len(candidates),
            "activeCandidateId": active["id"],
            "evaluation": evaluation,
        },
    )


def _parse_intent(input_payload: dict[str, Any]) -> dict[str, Any]:
    intent_input = dict(input_payload.get("intent") or {})
    prompt = str(input_payload.get("prompt") or intent_input.get("prompt") or "").strip()
    rooms = deepcopy(DEFAULT_ROOMS)
    rooms.update(deepcopy(intent_input.get("rooms") or {}))
    total_area = float(intent_input.get("totalAreaSqm") or input_payload.get("totalAreaSqm") or 100)
    area_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:平|㎡|m2|m²)", prompt, re.I)
    if area_match:
        total_area = float(area_match.group(1))
    bed_match = re.search(r"([一二两三四五六七八九]|\d+)\s*(?:室|居|房)", prompt)
    bed_count = _chinese_number(bed_match.group(1)) if bed_match else int(rooms["主卧"]["count"]) + int(rooms["次卧"]["count"])
    has_master_bath = bool(re.search(r"主卧带卫生间|主卫|套卫", prompt))
    bath_count = 2 if re.search(r"双卫|两卫|2卫", prompt) or has_master_bath else int(rooms["主卫"]["count"]) + int(rooms["卫生间"]["count"])
    split = "lk" if re.search(r"一体|一厅", prompt) else "lk_sep" if re.search(r"两厅|大餐厅|餐厅", prompt) else str(intent_input.get("publicSplit") or "auto")
    floors = int(intent_input.get("floors") or input_payload.get("floors") or (2 if re.search(r"两层|2层|二层|楼梯|复式", prompt) or total_area >= 105 else 1))
    floors = 2 if floors >= 2 else 1
    rooms["主卧"] = {**rooms["主卧"], "count": 1, "max": 18 if total_area >= 120 else rooms["主卧"]["max"]}
    rooms["主卫"] = {**rooms["主卫"], "count": 1 if has_master_bath else max(0, bath_count - 1)}
    rooms["次卧"] = {**rooms["次卧"], "count": max(0, bed_count - 1)}
    rooms["卫生间"] = {**rooms["卫生间"], "count": max(1, bath_count - int(rooms["主卫"]["count"]))}
    rooms["厨房"] = {**rooms["厨房"], "count": 1}
    return {
        "totalAreaSqm": total_area,
        "south": str(intent_input.get("south") or "-Y"),
        "floors": floors,
        "publicSplit": split,
        "roofType": str(intent_input.get("roofType") or "平"),
        "roofRidgeAxis": str(intent_input.get("roofRidgeAxis") or "X"),
        "jurisdiction": str(intent_input.get("jurisdiction") or "heuristic"),
        "rooms": rooms,
        **({"boundary": input_payload["boundary"]} if isinstance(input_payload.get("boundary"), dict) else {}),
    }


def _create_candidates(intent: dict[str, Any]) -> list[dict[str, Any]]:
    base = _generate_plan(intent)
    mirrored = _mirror_plan(base, "x", "Generate B · 镜像采光", intent)
    fit = _fit_plan(base, intent)
    furnish = _mirror_plan(_scale_plan(base, 1.03, 0.96, "Furnish · 家具友好", intent), "y", "Furnish · 家具友好", intent)
    raw = [
        ("generate-a", "Generate A · 平衡方案", "Generate", base),
        ("generate-b", "Generate B · 镜像采光", "Generate", mirrored),
        ("fit-c", "Fit C · 模板适配", "Fit", fit),
        ("furnish-d", "Furnish D · 家具友好", "Furnish", furnish),
    ]
    candidates = []
    for cid, title, command, plan in raw:
        furniture = _build_furniture(plan) if command == "Furnish" else []
        evaluation = _evaluate_plan(plan, intent, furniture)
        candidates.append(
            {
                "id": cid,
                "title": title,
                "command": command,
                "plan": plan,
                "score": evaluation["score"],
                "summary": f"{plan['summary']['envelope'][0]}×{plan['summary']['envelope'][1]}mm · {plan['summary']['blockCount']} 房间 · {len(plan['warnings'])} 警告",
                "evaluation": evaluation,
            }
        )
    return candidates


def _generate_plan(intent: dict[str, Any]) -> dict[str, Any]:
    plan = _generate_two_floor_plan(intent) if int(intent["floors"]) == 2 else _generate_single_floor_plan(intent)
    envelope = _boundary_envelope(intent.get("boundary"))
    return _adapt_plan_to_envelope(plan, envelope, intent, plan["projectName"]) if envelope else plan


def _generate_single_floor_plan(intent: dict[str, Any]) -> dict[str, Any]:
    rooms = intent["rooms"]
    bed_count = max(1, int(rooms["主卧"]["count"])) + int(rooms["次卧"]["count"])
    bath_count = int(rooms["主卫"]["count"]) + int(rooms["卫生间"]["count"])
    public_split = "lk" if intent["publicSplit"] == "auto" and bed_count <= 2 else "lk_sep" if intent["publicSplit"] == "auto" else intent["publicSplit"]
    master_w, private_depth = _pick_master_dims(float(rooms["主卧"]["max"]))
    south_rooms = [("主卧", master_w, None)]
    if int(rooms["主卫"]["count"]) > 0:
        south_rooms.append(("主卫", max(1500, _snap(float(rooms["主卫"]["max"]) * 1_000_000 / private_depth)), None))
    for index in range(int(rooms["次卧"]["count"])):
        south_rooms.append(("次卧", min(MAX_SPAN, max(2400, _snap(float(rooms["次卧"]["max"]) * 1_000_000 / private_depth))), index + 1))

    envelope_w = max(sum(room[1] for room in south_rooms), 6000 if bed_count <= 1 else 9000)
    north_depth = min(MAX_SPAN, _snap(max(intent["totalAreaSqm"] * DEFAULT_USABLE_RATIO * 1_000_000 / envelope_w - private_depth, 3000)))
    envelope_h = private_depth + north_depth
    wet_w = max(1500, min(envelope_w - 3600, _snap((float(rooms["厨房"]["max"]) + float(rooms["卫生间"]["max"])) * 1_000_000 / north_depth)))
    public_w = envelope_w - wet_w
    blocks: list[dict[str, Any]] = []
    cursor = 0
    for purpose, width, idx in south_rooms:
        block_id = f"R_{purpose}_{idx}" if idx else f"R_{purpose}"
        blocks.append(_rect_block(block_id, purpose, cursor, 0, cursor + width, private_depth, 1))
        cursor += width
    if public_split == "lk":
        blocks.append(_rect_block("R_客餐厅一体", "客餐厅一体", 0, private_depth, public_w, envelope_h, 1))
    else:
        living_w = _snap(public_w * 0.6)
        blocks.append(_rect_block("R_客厅", "客厅", 0, private_depth, living_w, envelope_h, 1))
        blocks.append(_rect_block("R_餐厅", "餐厅", living_w, private_depth, public_w, envelope_h, 1))
    wc_h = max(1500, min(north_depth - 1500, _snap(float(rooms["卫生间"]["max"]) * 1_000_000 / wet_w)))
    blocks.append(_rect_block("R_卫生间", "卫生间", public_w, private_depth, envelope_w, private_depth + wc_h, 1))
    blocks.append(_rect_block("R_厨房", "厨房", public_w, private_depth + wc_h, envelope_w, envelope_h, 1))
    return _finalize_plan(
        f"ai-plan-{bed_count}bed-{bath_count}bath-{round(intent['totalAreaSqm'])}sqm",
        f"AI 模板生成：{round(intent['totalAreaSqm'])}㎡ {bed_count}卧{bath_count}卫",
        f"{bed_count}居{'一厅' if public_split == 'lk' else '两厅'} {bath_count}卫",
        1,
        blocks,
        float(intent["totalAreaSqm"]),
        ["南卧 + 北公共 + 厨卫角，生成后进入专业复核。"],
        rooms,
    )


def _generate_two_floor_plan(intent: dict[str, Any]) -> dict[str, Any]:
    rooms = intent["rooms"]
    bed_count = max(1, int(rooms["主卧"]["count"])) + int(rooms["次卧"]["count"])
    bath_count = int(rooms["主卫"]["count"]) + int(rooms["卫生间"]["count"])
    footprint_target = max(100, float(intent["totalAreaSqm"]) * 1.08)
    envelope_w = _snap(max(12000, (footprint_target * 1_000_000 * 1.33) ** 0.5))
    envelope_h = _snap(max(9000, (footprint_target * 1_000_000) / envelope_w))
    c1, c2, c3 = _snap(envelope_w * 0.31), _snap(envelope_w * 0.55), _snap(envelope_w * 0.75)
    r1, r2 = _snap(envelope_h * 0.33), _snap(envelope_h * 0.62)
    blocks = [
        _rect_block("R_1F_公共区", "公共区", 0, 0, c1, r1, 1),
        _rect_block("R_1F_厨房", "厨房", c1, 0, c2, r1, 1),
        _rect_block("R_1F_卫生间", "卫生间", c2, 0, c3, r1, 1),
        _rect_block("R_1F_楼梯", "楼梯", c3, 0, envelope_w, r1, 1, "双跑"),
        _rect_block("R_1F_客厅", "客厅", 0, r1, c2, r2, 1),
        _rect_block("R_1F_餐厅", "餐厅", c2, r1, c3, r2, 1),
        _rect_block("R_2F_主卧", "主卧", 0, 0, c2, r1, 2),
        _rect_block("R_2F_楼梯", "楼梯", c3, 0, envelope_w, r1, 2, "双跑"),
        _rect_block("R_2F_次卧_1", "次卧", 0, r1, c1, r2, 2),
        _rect_block("R_2F_卫生间", "卫生间", c1, r1, c2, r2, 2),
        _rect_block("R_2F_次卧_2", "次卧", c2, r1, c3, r2, 2),
        _rect_block("R_2F_储藏", "储藏", c3, r1, envelope_w, r2, 2),
    ]
    if int(rooms["主卫"]["count"]) > 0:
        blocks.insert(7, _rect_block("R_2F_主卫", "主卫", c2, 0, c3, r1, 2))
    for index in range(2, int(rooms["次卧"]["count"])):
        x0 = _snap(((index - 2) % 2) * (envelope_w / 2))
        y0 = _snap(envelope_h - 3000 - ((index - 2) // 2) * 3000)
        blocks.append(_rect_block(f"R_2F_次卧_{index + 1}", "次卧", x0, y0, x0 + 3000, y0 + 3000, 2))
    return _finalize_plan(
        f"ai-plan-two-floor-{bed_count}bed-{bath_count}bath-{round(intent['totalAreaSqm'])}sqm",
        f"AI 两层户型：{round(intent['totalAreaSqm'])}㎡ {bed_count}卧{bath_count}卫",
        f"{bed_count}居两厅 {bath_count}卫 · 2 层",
        2,
        blocks,
        float(intent["totalAreaSqm"]),
        ["1F 公共区，2F 卧室区；楼梯上下对齐，候选进入专业复核。"],
        rooms,
    )


def _fit_plan(base: dict[str, Any], intent: dict[str, Any]) -> dict[str, Any]:
    template = min(
        TEMPLATES.values(),
        key=lambda item: abs(float(item["total"]) - float(intent["totalAreaSqm"])) + (0 if int(item["floors"]) == int(intent["floors"]) else 20),
    )
    template_intent = deepcopy(intent)
    template_intent["publicSplit"] = template["split"]
    template_intent["rooms"].update(deepcopy(template["rooms"]))
    generated = _generate_two_floor_plan(template_intent) if int(intent["floors"]) == 2 else _generate_single_floor_plan(template_intent)
    envelope = _boundary_envelope(intent.get("boundary")) or tuple(base["summary"]["envelope"])
    return _adapt_plan_to_envelope(generated, envelope, intent, f"Fit · {template['title']}")


def _adapt_plan_to_envelope(plan: dict[str, Any], envelope: tuple[int, int], intent: dict[str, Any], name: str) -> dict[str, Any]:
    source_w, source_h = plan["summary"]["envelope"]
    scale_x = envelope[0] / source_w if source_w else 1
    scale_y = envelope[1] / source_h if source_h else 1
    blocks = []
    for block in plan["blocks"]:
        polygon = [{"x": max(0, _snap(point["x"] * scale_x)), "y": max(0, _snap(point["y"] * scale_y))} for point in block["polygon"]]
        rect = _rect_from_polygon(polygon)
        blocks.append({**block, "id": f"{block['id']}_fit", "source": "fit_template", "polygon": polygon, "areaSqm": _round_area(rect["w"] * rect["h"] / 1_000_000)})
    return _finalize_plan(f"{plan['projectId']}-fit-{envelope[0]}-{envelope[1]}", name, plan["intentLabel"], int(plan["floors"]), blocks, float(intent["totalAreaSqm"]), [*plan["designNotes"], "模板适配结果：需专业复核。"], intent["rooms"])


def _mirror_plan(plan: dict[str, Any], axis: str, name: str, intent: dict[str, Any]) -> dict[str, Any]:
    env_w, env_h = plan["summary"]["envelope"]
    blocks = []
    for block in plan["blocks"]:
        polygon = [
            {"x": _snap(env_w - point["x"]) if axis == "x" else point["x"], "y": _snap(env_h - point["y"]) if axis == "y" else point["y"]}
            for point in block["polygon"]
        ]
        rect = _rect_from_polygon(polygon)
        blocks.append({**block, "id": f"{block['id']}_m{axis}", "polygon": polygon, "areaSqm": _round_area(rect["w"] * rect["h"] / 1_000_000)})
    return _finalize_plan(f"{plan['projectId']}-{axis}-mirror", name, plan["intentLabel"], int(plan["floors"]), blocks, float(intent["totalAreaSqm"]), [*plan["designNotes"], "镜像候选用于比较采光、入口和家具摆放。"], intent["rooms"])


def _scale_plan(plan: dict[str, Any], scale_x: float, scale_y: float, name: str, intent: dict[str, Any]) -> dict[str, Any]:
    blocks = []
    for block in plan["blocks"]:
        polygon = [{"x": max(0, _snap(point["x"] * scale_x)), "y": max(0, _snap(point["y"] * scale_y))} for point in block["polygon"]]
        rect = _rect_from_polygon(polygon)
        blocks.append({**block, "id": f"{block['id']}_s{round(scale_x * 100)}{round(scale_y * 100)}", "polygon": polygon, "areaSqm": _round_area(rect["w"] * rect["h"] / 1_000_000)})
    return _finalize_plan(f"{plan['projectId']}-scaled", name, plan["intentLabel"], int(plan["floors"]), blocks, float(intent["totalAreaSqm"]), [*plan["designNotes"], "家具友好比例调整。"], intent["rooms"])


def _evaluate_plan(plan: dict[str, Any], intent: dict[str, Any], furniture: list[dict[str, Any]]) -> dict[str, Any]:
    issues = []
    for warning in plan["warnings"]:
        issues.append({"id": f"area-{warning['room']}", "stage": "Evaluator", "severity": "warning", "title": "房间面积偏离目标范围", "detail": warning["msg"], "affectedIds": [warning["room"]]})
    for key in ROOM_KEYS:
        required = int(intent["rooms"][key]["count"])
        actual = sum(1 for block in plan["blocks"] if block["purpose"] == key)
        if actual < required:
            issues.append({"id": f"count-{key}", "stage": "RuleChecker", "severity": "error", "title": f"{key} 数量不足", "detail": f"需求 {required} 个，当前 {actual} 个。", "affectedIds": []})
    for item in furniture:
        block = next((candidate for candidate in plan["blocks"] if candidate["id"] == item["blockId"]), None)
        if not block:
            continue
        rect = _rect_from_polygon(block["polygon"])
        if item["x0"] < rect["x0"] + 150 or item["y0"] < rect["y0"] + 150 or item["x0"] + item["w"] > rect["x1"] - 150 or item["y0"] + item["h"] > rect["y1"] - 150:
            issues.append({"id": f"furniture-{item['id']}", "stage": "RuleChecker", "severity": "warning", "title": "家具净距不足", "detail": f"{item['label']} 与 {block['purpose']} 边界净距不足。", "affectedIds": [item["id"], block["id"]]})
    issues.append({"id": "professional-review-required", "stage": "Approver", "severity": "info", "title": "需要专业审核", "detail": "启发式候选，不得标记为合规、可报审或可施工。", "affectedIds": [plan["projectId"]]})
    counts = {"info": 0, "warning": 0, "error": 0}
    for issue in issues:
        counts[issue["severity"]] += 1
    score = max(45, min(98, round(96 - counts["error"] * 18 - counts["warning"] * 5 - abs(plan["summary"]["usableRatioEst"] - DEFAULT_USABLE_RATIO) * 25)))
    stages = ("Planner", "Generator", "Evaluator", "RuleChecker", "SchemaValidator", "Approver")
    gates = []
    for stage in stages:
        stage_issues = [issue for issue in issues if issue["stage"] == stage]
        gates.append({"name": stage, "status": "blocked" if any(issue["severity"] == "error" for issue in stage_issues) else "needs_review" if stage_issues or stage == "Approver" else "passed"})
    return {"schema": "architoken.floorplan_evaluation_report.v1", "reviewState": "professional_review_required", "score": score, "passed": counts["error"] == 0, "issueCounts": counts, "issues": issues, "gates": gates}


def _build_furniture(plan: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for block in plan["blocks"]:
        rect = _rect_from_polygon(block["polygon"])
        cx, cy = rect["x0"] + rect["w"] / 2, rect["y0"] + rect["h"] / 2
        base = {"blockId": block["id"], "floor": block["floor"]}
        if block["purpose"] in {"主卧", "次卧"}:
            items.append({**base, "id": f"{block['id']}-bed", "label": "床", "x0": _snap(rect["x0"] + 450), "y0": _snap(rect["y0"] + 450), "w": min(2100, max(1500, rect["w"] - 1200)), "h": 1800, "color": "#bfdbfe"})
        elif block["purpose"] in {"客厅", "公共区", "客餐厅一体"}:
            items.append({**base, "id": f"{block['id']}-sofa", "label": "沙发", "x0": _snap(cx - 1200), "y0": _snap(cy - 600), "w": min(2400, max(1500, rect["w"] - 900)), "h": 900, "color": "#bbf7d0"})
        elif block["purpose"] == "餐厅":
            items.append({**base, "id": f"{block['id']}-dining", "label": "餐桌", "x0": _snap(cx - 900), "y0": _snap(cy - 600), "w": 1800, "h": 1200, "color": "#bbf7d0"})
        elif block["purpose"] == "厨房":
            items.append({**base, "id": f"{block['id']}-cabinet", "label": "橱柜", "x0": rect["x0"] + 150, "y0": rect["y0"] + 150, "w": max(900, rect["w"] - 300), "h": 600, "color": "#fde68a"})
        elif block["purpose"] in {"卫生间", "主卫"}:
            items.append({**base, "id": f"{block['id']}-bath", "label": "洁具", "x0": _snap(cx - 450), "y0": _snap(cy - 450), "w": 900, "h": 900, "color": "#e0e7ff"})
    return items


def _finalize_plan(project_id: str, project_name: str, intent_label: str, floors: int, blocks: list[dict[str, Any]], target_sqm: float, notes: list[str], rooms: dict[str, Any]) -> dict[str, Any]:
    envelope = _compute_envelope(blocks)
    total = _round_area(sum(float(block["areaSqm"]) for block in blocks))
    return {
        "projectId": project_id,
        "projectName": project_name,
        "intentLabel": intent_label,
        "floors": floors,
        "blocks": blocks,
        "designNotes": notes,
        "warnings": _collect_warnings(blocks, rooms),
        "summary": {"envelope": list(envelope), "envelopeSqm": _round_area(envelope[0] * envelope[1] / 1_000_000), "targetSqm": target_sqm, "totalRoomSqm": total, "usableRatioEst": _round_area(total / target_sqm) if target_sqm else 0, "blockCount": len(blocks)},
    }


def _rect_block(block_id: str, purpose: str, x0: int | float, y0: int | float, x1: int | float, y1: int | float, floor: int, stair_kind: str | None = None) -> dict[str, Any]:
    w, h = max(MODULUS, x1 - x0), max(MODULUS, y1 - y0)
    block = {"id": block_id, "purpose": purpose, "polygon": [{"x": x0, "y": y0}, {"x": x0 + w, "y": y0}, {"x": x0 + w, "y": y0 + h}, {"x": x0, "y": y0 + h}], "areaSqm": _round_area(w * h / 1_000_000), "floor": floor, "source": "generated"}
    if stair_kind:
        block["stairKind"] = stair_kind
    return block


def _rect_from_polygon(polygon: list[dict[str, Any]]) -> dict[str, float]:
    xs = [float(point["x"]) for point in polygon]
    ys = [float(point["y"]) for point in polygon]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    return {"x0": x0, "x1": x1, "y0": y0, "y1": y1, "w": x1 - x0, "h": y1 - y0}


def _compute_envelope(blocks: list[dict[str, Any]]) -> tuple[int, int]:
    xs = [point["x"] for block in blocks for point in block["polygon"]]
    ys = [point["y"] for block in blocks for point in block["polygon"]]
    return _snap(max(xs or [1])), _snap(max(ys or [1]))


def _collect_warnings(blocks: list[dict[str, Any]], rooms: dict[str, Any]) -> list[dict[str, str]]:
    warnings = []
    for block in blocks:
        if block["purpose"] not in ROOM_KEYS:
            continue
        cfg = rooms[block["purpose"]]
        if int(cfg["count"]) == 0:
            continue
        if float(block["areaSqm"]) > float(cfg["max"]) * 1.1:
            warnings.append({"room": block["id"], "msg": f"{block['id']} 实际 {block['areaSqm']:.1f}㎡ 超过目标 max {cfg['max']}㎡", "reason": "模数 snap、边界适配或短边约束导致，需人工复核。"})
        elif float(block["areaSqm"]) < float(cfg["min"]) * 0.9:
            warnings.append({"room": block["id"], "msg": f"{block['id']} 实际 {block['areaSqm']:.1f}㎡ 低于目标 min {cfg['min']}㎡", "reason": "目标面积偏紧、模板适配压缩或房间被压缩，需人工复核。"})
    return warnings


def _boundary_envelope(boundary: Any) -> tuple[int, int] | None:
    if not isinstance(boundary, dict) or not isinstance(boundary.get("polygon"), list):
        return None
    polygon = boundary["polygon"]
    if not polygon:
        return None
    xs = [float(point["x"]) for point in polygon]
    ys = [float(point["y"]) for point in polygon]
    width, height = _snap(max(xs) - min(xs)), _snap(max(ys) - min(ys))
    return (width, height) if width > 0 and height > 0 else None


def _pick_master_dims(area_target: float) -> tuple[int, int]:
    target_side = ((area_target * 1_000_000) / 1.2) ** 0.5
    width = max(3000, min(_snap(target_side), MAX_SPAN))
    height = max(3000, min(_snap((area_target * 1_000_000) / width), MAX_SPAN))
    return width, height


def _chinese_number(value: str) -> int:
    return int(value) if value.isdigit() else {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}.get(value, 3)


def _snap(value: float) -> int:
    return int(round(value / MODULUS) * MODULUS)


def _round_area(value: float) -> float:
    return round(value, 2)
