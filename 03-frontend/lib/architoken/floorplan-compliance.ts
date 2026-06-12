// lib/architoken/floorplan-compliance.ts - 户型规范预检（GB 50096/50016 可确定性子集）
// 定位：启发式预检，帮助在生成阶段拦截明显违规；不是报审依据，需专业复核。
// License: Apache-2.0

import {
  rectFromBlock,
  type GeneratedPlan,
  type PlanBlock,
} from "./floorplan-layout";
import { collectBlockOpenings } from "./floorplan-drawing";

export interface ComplianceIssue {
  id: string;
  rule: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  affectedIds: string[];
}

export interface ComplianceReport {
  schema: "architoken.floorplan_compliance_report.v1";
  reviewState: "professional_review_required";
  basis: string;
  passed: boolean;
  issueCounts: { error: number; warning: number; info: number };
  checks: string[];
  issues: ComplianceIssue[];
}

const MIN_AREA_SQM: Record<string, number> = {
  // GB 50096-2011 5.1.2/5.1.3（简化：主卧按双人卧 9㎡，次卧按单人卧 5㎡）
  主卧: 9,
  次卧: 5,
  客厅: 10,
  公共区: 10,
  客餐厅一体: 12,
  厨房: 3.5,
  卫生间: 2.5,
  主卫: 2.5,
};

const DAYLIGHT_PURPOSES = new Set(["主卧", "次卧", "客厅", "公共区", "客餐厅一体", "厨房"]);
const HABITABLE_PURPOSES = new Set(["主卧", "次卧", "客厅", "公共区", "客餐厅一体"]);
const EXIT_PURPOSES = new Set(["楼梯", "公共区", "客厅", "客餐厅一体"]);
const WINDOW_HEIGHT_M = 1.5;
const MIN_CORRIDOR_WIDTH_MM = 1000; // GB 50096 5.7.1 通卧室过道净宽 ≥ 1.0m
const ADVISORY_CORRIDOR_WIDTH_MM = 1200; // 入口过道 ≥ 1.2m
const MAX_EVACUATION_DISTANCE_MM = 20_000; // 户内疏散启发上限（advisory）
const MIN_DOOR_WIDTH_MM: Record<string, number> = {
  // GB 50096 5.8.7（简化）：卧室/起居 0.9m，厨房 0.8m，卫生间 0.7m
  主卧: 900,
  次卧: 900,
  厨房: 800,
  卫生间: 700,
  主卫: 700,
  储藏: 700,
};

export function checkFloorplanCompliance(
  plan: GeneratedPlan,
): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  const floors: Array<1 | 2> = plan.floors === 2 ? [1, 2] : [1];

  for (const floor of floors) {
    const blocks = plan.blocks.filter((block) => block.floor === floor);
    const exits = blocks.filter((block) => EXIT_PURPOSES.has(block.purpose));
    for (const block of blocks) {
      checkMinimumArea(block, issues);
      checkCorridorWidth(block, issues);
      const openings = collectBlockOpenings(block, blocks);
      checkDaylight(block, openings, issues);
      checkDoorWidth(block, openings, issues);
      checkEvacuation(block, exits, issues);
    }
  }
  checkWinterSunlight(plan, issues);
  issues.push({
    id: "compliance-review-required",
    rule: "平台原则",
    severity: "info",
    title: "需要专业审核",
    detail:
      "本报告为启发式规范预检（GB 50096/50016 可确定性子集），不含日照模拟与消防性能化分析，不得作为报审依据。",
    affectedIds: [plan.projectId],
  });

  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return {
    schema: "architoken.floorplan_compliance_report.v1",
    reviewState: "professional_review_required",
    basis: "GB 50096-2011 住宅设计规范 / GB 50016 建筑设计防火规范（启发式子集）",
    passed: counts.error === 0,
    issueCounts: counts,
    checks: [
      "最小使用面积（GB50096 5.1）",
      "直接天然采光与窗地比 1/7（GB50096 7.1）",
      "过道净宽 ≥ 1.0m（GB50096 5.7.1）",
      "门洞净宽（GB50096 5.8.7）",
      "户内疏散距离启发（≤20m，advisory）",
      "冬季日照：至少一间居室南向开窗（GB50096 7.1.1，时长需场地模拟）",
    ],
    issues,
  };
}

/**
 * GB50096 7.1.1：每套住宅应至少有一个居住空间能获得冬季日照。
 * 户型级可确定性检查：至少一间卧室/起居室在南向边（数据坐标 y=0 侧，south="-Y"）
 * 有采光窗。日照时长模拟需要场地/遮挡模型，不在户型级预检范围。
 */
function checkWinterSunlight(
  plan: GeneratedPlan,
  issues: ComplianceIssue[],
): void {
  const blocks = plan.blocks.filter(
    (block) => block.floor === 1 && HABITABLE_PURPOSES.has(block.purpose),
  );
  const floorBlocks = plan.blocks.filter((block) => block.floor === 1);
  const hasSouthWindow = blocks.some((block) => {
    const rect = rectFromBlock(block);
    if (rect.y0 > 100) return false; // 不贴南边界
    const openings = collectBlockOpenings(block, floorBlocks);
    // 边序 [南(y0), 北(y1), 西, 东]：检查南边（索引 0）的窗
    return (openings.get(0) ?? []).some((opening) => opening.kind === "window");
  });
  if (!hasSouthWindow) {
    issues.push({
      id: "winter-sunlight",
      rule: "GB50096 7.1.1",
      severity: "error",
      title: "无居住空间获得冬季日照",
      detail:
        "没有任何卧室/起居室在南向外墙开窗，无法满足至少一个居住空间获得冬季日照的要求（日照时长需场地模拟，另行复核）。",
      affectedIds: [plan.projectId],
    });
  }
}

function checkMinimumArea(block: PlanBlock, issues: ComplianceIssue[]): void {
  const minimum = MIN_AREA_SQM[block.purpose];
  if (minimum === undefined) return;
  if (block.areaSqm >= minimum) return;
  issues.push({
    id: `area-${block.id}`,
    rule: "GB50096 5.1",
    severity: block.areaSqm < minimum * 0.85 ? "error" : "warning",
    title: `${block.purpose}使用面积不足`,
    detail: `${block.purpose} ${block.areaSqm.toFixed(1)}㎡ 低于规范最小值 ${minimum}㎡。`,
    affectedIds: [block.id],
  });
}

function checkCorridorWidth(
  block: PlanBlock,
  issues: ComplianceIssue[],
): void {
  if (block.purpose !== "走廊" && block.purpose !== "过道") return;
  const rect = rectFromBlock(block);
  const width = Math.min(rect.w, rect.h);
  if (width < MIN_CORRIDOR_WIDTH_MM) {
    issues.push({
      id: `corridor-${block.id}`,
      rule: "GB50096 5.7.1",
      severity: "error",
      title: "走廊净宽不足",
      detail: `走廊净宽 ${width}mm 低于通卧室过道最小 ${MIN_CORRIDOR_WIDTH_MM}mm。`,
      affectedIds: [block.id],
    });
  } else if (width < ADVISORY_CORRIDOR_WIDTH_MM) {
    issues.push({
      id: `corridor-${block.id}`,
      rule: "GB50096 5.7.1",
      severity: "warning",
      title: "走廊净宽偏紧",
      detail: `走廊净宽 ${width}mm 低于入口过道建议值 ${ADVISORY_CORRIDOR_WIDTH_MM}mm。`,
      affectedIds: [block.id],
    });
  }
}

function checkDaylight(
  block: PlanBlock,
  openings: Map<number, Array<{ start: number; end: number; kind: string }>>,
  issues: ComplianceIssue[],
): void {
  if (!DAYLIGHT_PURPOSES.has(block.purpose)) return;
  const windows = [...openings.values()]
    .flat()
    .filter((opening) => opening.kind === "window");
  if (windows.length === 0) {
    issues.push({
      id: `daylight-${block.id}`,
      rule: "GB50096 7.1",
      severity: block.purpose === "厨房" ? "warning" : "error",
      title: `${block.purpose}无直接天然采光`,
      detail: `${block.purpose}（${block.id}）没有外墙采光窗，违反直接采光要求。`,
      affectedIds: [block.id],
    });
    return;
  }
  const windowAreaSqm = windows.reduce(
    (total, opening) =>
      total + ((opening.end - opening.start) / 1000) * WINDOW_HEIGHT_M,
    0,
  );
  if (windowAreaSqm / block.areaSqm < 1 / 7) {
    issues.push({
      id: `daylight-ratio-${block.id}`,
      rule: "GB50096 7.1.5",
      severity: "warning",
      title: `${block.purpose}窗地比不足`,
      detail: `${block.purpose} 窗面积 ${windowAreaSqm.toFixed(2)}㎡ / 地面 ${block.areaSqm.toFixed(1)}㎡ = ${(windowAreaSqm / block.areaSqm).toFixed(2)}，低于 1/7。`,
      affectedIds: [block.id],
    });
  }
}

function checkDoorWidth(
  block: PlanBlock,
  openings: Map<number, Array<{ start: number; end: number; kind: string }>>,
  issues: ComplianceIssue[],
): void {
  const minimum = MIN_DOOR_WIDTH_MM[block.purpose];
  if (minimum === undefined) return;
  const doors = [...openings.values()]
    .flat()
    .filter((opening) => opening.kind === "door");
  if (doors.length === 0) {
    issues.push({
      id: `door-missing-${block.id}`,
      rule: "GB50096 5.8",
      severity: "error",
      title: `${block.purpose}没有门`,
      detail: `${block.purpose}（${block.id}）未能在与连通空间共享的墙上布置门洞。`,
      affectedIds: [block.id],
    });
    return;
  }
  for (const door of doors) {
    const width = door.end - door.start;
    if (width < minimum) {
      issues.push({
        id: `door-width-${block.id}`,
        rule: "GB50096 5.8.7",
        severity: "error",
        title: `${block.purpose}门洞净宽不足`,
        detail: `门洞 ${width}mm 低于最小 ${minimum}mm。`,
        affectedIds: [block.id],
      });
    }
  }
}

function checkEvacuation(
  block: PlanBlock,
  exits: ReadonlyArray<PlanBlock>,
  issues: ComplianceIssue[],
): void {
  if (!HABITABLE_PURPOSES.has(block.purpose) || exits.length === 0) return;
  const rect = rectFromBlock(block);
  const cx = rect.x0 + rect.w / 2;
  const cy = rect.y0 + rect.h / 2;
  const nearest = Math.min(
    ...exits.map((exit) => {
      const exitRect = rectFromBlock(exit);
      return (
        Math.abs(exitRect.x0 + exitRect.w / 2 - cx) +
        Math.abs(exitRect.y0 + exitRect.h / 2 - cy)
      );
    }),
  );
  if (nearest > MAX_EVACUATION_DISTANCE_MM) {
    issues.push({
      id: `evacuation-${block.id}`,
      rule: "GB50016 户内疏散（启发）",
      severity: "warning",
      title: `${block.purpose}疏散距离偏长`,
      detail: `${block.purpose}中心到最近出口/楼梯曼哈顿距离 ${(nearest / 1000).toFixed(1)}m，超过启发上限 ${MAX_EVACUATION_DISTANCE_MM / 1000}m。`,
      affectedIds: [block.id],
    });
  }
}
