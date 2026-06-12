// lib/architoken/floorplan-layout.ts - shared Generate/Fit/Furnish layout kernel
// License: Apache-2.0

export type RoomKey = "主卧" | "主卫" | "次卧" | "卫生间" | "厨房" | "阳台";
export type PublicSplit = "auto" | "lk" | "lk_sep";
export type RoofType = "双坡" | "单坡" | "平";
export type RidgeAxis = "X" | "Y";
export type PlanFinderMode = "generate" | "fit" | "furnish" | "manage";
export type PlanCommand = "Generate" | "Fit" | "Furnish";
export type PlanSeverity = "info" | "warning" | "error";

export interface RoomDefinition {
  readonly key: RoomKey;
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly short: number;
  readonly locked: boolean;
  readonly hint: string;
}

export interface RoomRequirement {
  readonly count: number;
  readonly min: number;
  readonly max: number;
}

export interface TemplateConfig {
  readonly title: string;
  readonly total: number;
  readonly floors: 1 | 2;
  readonly split: PublicSplit;
  readonly rooms: Partial<Record<RoomKey, RoomRequirement>>;
}

export type TemplateRegistry = Record<string, TemplateConfig>;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface BoundarySegment {
  readonly id: string;
  readonly a: Point2D;
  readonly b: Point2D;
  readonly kind: "facade" | "party_wall" | "locked_wall" | "unknown";
}

export interface LayoutBoundaryInput {
  readonly polygon: ReadonlyArray<Point2D>;
  readonly entrance?: Point2D;
  readonly facadeSegments?: ReadonlyArray<BoundarySegment>;
  readonly fixedWallSegments?: ReadonlyArray<BoundarySegment>;
}

export interface StudioIntent {
  readonly totalAreaSqm: number;
  readonly south: "-Y" | "+Y";
  readonly floors: 1 | 2;
  readonly publicSplit: PublicSplit;
  readonly roofType: RoofType;
  readonly roofRidgeAxis: RidgeAxis;
  readonly rooms: Record<RoomKey, RoomRequirement>;
  readonly boundary?: LayoutBoundaryInput;
  readonly jurisdiction?: string;
  /** 体量形态：rect 矩形（默认）；l_shape 东北缺角 L 形（v1 单层）。 */
  readonly massing?: "rect" | "l_shape";
}

export interface PlanBlock {
  readonly id: string;
  readonly purpose: string;
  readonly polygon: ReadonlyArray<Point2D>;
  readonly areaSqm: number;
  readonly floor: 1 | 2;
  readonly stairKind?: "单跑" | "双跑";
  readonly source?: "generated" | "fit_template" | "locked" | "manual";
}

export interface PlanWarning {
  readonly room: string;
  readonly msg: string;
  readonly reason: string;
}

export interface GeneratedPlan {
  readonly projectId: string;
  readonly projectName: string;
  readonly intentLabel: string;
  readonly floors: 1 | 2;
  readonly blocks: ReadonlyArray<PlanBlock>;
  readonly designNotes: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<PlanWarning>;
  readonly evaluation?: PlanEvaluationReport;
  readonly summary: {
    readonly envelope: [number, number];
    readonly envelopeSqm: number;
    readonly targetSqm: number;
    readonly totalRoomSqm: number;
    readonly usableRatioEst: number;
    readonly blockCount: number;
    readonly floor1Sqm?: number;
    readonly floor2Sqm?: number;
  };
}

export interface PlanCandidate {
  readonly id: string;
  readonly title: string;
  readonly command: PlanCommand;
  readonly plan: GeneratedPlan;
  readonly score: number;
  readonly summary: string;
  readonly evaluation: PlanEvaluationReport;
}

export interface FurnitureItem {
  readonly id: string;
  readonly blockId: string;
  readonly label: string;
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly floor: 1 | 2;
  readonly color: string;
}

export interface BlockRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly w: number;
  readonly h: number;
}

export interface PlanEvaluationIssue {
  readonly id: string;
  readonly stage:
    | "Planner"
    | "Generator"
    | "Evaluator"
    | "RuleChecker"
    | "SchemaValidator"
    | "Approver";
  readonly severity: PlanSeverity;
  readonly title: string;
  readonly detail: string;
  readonly affectedIds: ReadonlyArray<string>;
}

export interface PlanEvaluationReport {
  readonly schema: "architoken.floorplan_evaluation_report.v1";
  readonly reviewState: "professional_review_required";
  readonly score: number;
  readonly passed: boolean;
  readonly issueCounts: Record<PlanSeverity, number>;
  readonly issues: ReadonlyArray<PlanEvaluationIssue>;
  readonly gates: ReadonlyArray<{
    readonly name: PlanEvaluationIssue["stage"];
    readonly status: "passed" | "blocked" | "needs_review";
  }>;
}

export interface FloorplanCdePayloadInput {
  readonly moduleId: "concept_design" | "detailed_design";
  readonly mode: PlanFinderMode;
  readonly intent: StudioIntent;
  readonly plan: GeneratedPlan;
  readonly activeCandidate: PlanCandidate | null;
  readonly candidates: ReadonlyArray<PlanCandidate>;
  readonly furniture: ReadonlyArray<FurnitureItem>;
  readonly constructionColumn: boolean;
}

export const MODULUS = 300;
export const MAX_SPAN = 4800;
export const DEFAULT_USABLE_RATIO = 0.83;

export const roomDefinitions: ReadonlyArray<RoomDefinition> = [
  {
    key: "主卧",
    count: 1,
    min: 12,
    max: 16,
    short: 3000,
    locked: true,
    hint: "南向",
  },
  {
    key: "主卫",
    count: 1,
    min: 3,
    max: 5,
    short: 1500,
    locked: false,
    hint: "套间",
  },
  {
    key: "次卧",
    count: 2,
    min: 10,
    max: 13,
    short: 2400,
    locked: false,
    hint: "南向",
  },
  {
    key: "卫生间",
    count: 1,
    min: 3,
    max: 6,
    short: 1500,
    locked: false,
    hint: "公卫",
  },
  {
    key: "厨房",
    count: 1,
    min: 6,
    max: 8,
    short: 1500,
    locked: true,
    hint: "",
  },
  {
    key: "阳台",
    count: 0,
    min: 3,
    max: 6,
    short: 1200,
    locked: false,
    hint: "可选",
  },
];

export const roomColors: Record<string, string> = {
  主卧: "#3b82f6",
  次卧: "#60a5fa",
  主卫: "#a78bfa",
  卫生间: "#94a3b8",
  客厅: "#10b981",
  餐厅: "#22c55e",
  客餐厅一体: "#34d399",
  厨房: "#fbbf24",
  阳台: "#fcd34d",
  楼梯: "#a855f7",
  走廊: "#cbd5e1",
  储藏: "#64748b",
  弹性区: "#e2e8f0",
  公共区: "#38bdf8",
};

export const templates: TemplateRegistry = {
  t2: {
    title: "两居 75㎡",
    total: 75,
    floors: 1,
    split: "lk",
    rooms: {
      主卧: { count: 1, min: 12, max: 14 },
      主卫: { count: 0, min: 3, max: 5 },
      次卧: { count: 1, min: 9, max: 11 },
      卫生间: { count: 1, min: 3, max: 5 },
      厨房: { count: 1, min: 5, max: 7 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
  t3: {
    title: "三居两厅 95㎡",
    total: 95,
    floors: 1,
    split: "lk_sep",
    rooms: {
      主卧: { count: 1, min: 13, max: 15 },
      主卫: { count: 0, min: 3, max: 5 },
      次卧: { count: 2, min: 10, max: 12 },
      卫生间: { count: 1, min: 4, max: 6 },
      厨房: { count: 1, min: 6, max: 8 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
  t3b: {
    title: "三居两厅 + 主卫 110㎡",
    total: 110,
    floors: 2,
    split: "lk_sep",
    rooms: {
      主卧: { count: 1, min: 14, max: 17 },
      主卫: { count: 1, min: 3, max: 5 },
      次卧: { count: 2, min: 10, max: 13 },
      卫生间: { count: 1, min: 4, max: 6 },
      厨房: { count: 1, min: 6, max: 8 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
  t4: {
    title: "四居两厅双卫 135㎡",
    total: 135,
    floors: 2,
    split: "lk_sep",
    rooms: {
      主卧: { count: 1, min: 15, max: 18 },
      主卫: { count: 1, min: 4, max: 6 },
      次卧: { count: 3, min: 10, max: 13 },
      卫生间: { count: 1, min: 4, max: 6 },
      厨房: { count: 1, min: 7, max: 9 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
};

export const paletteDefaults: Record<
  string,
  { readonly w: number; readonly h: number; readonly stairKind?: "单跑" | "双跑" }
> = {
  主卧: { w: 3600, h: 4500 },
  次卧: { w: 3000, h: 4200 },
  主卫: { w: 1500, h: 2400 },
  卫生间: { w: 1800, h: 2400 },
  客厅: { w: 3600, h: 4500 },
  餐厅: { w: 3000, h: 3600 },
  客餐厅一体: { w: 4800, h: 3600 },
  厨房: { w: 3000, h: 3000 },
  阳台: { w: 3000, h: 1500 },
  楼梯: { w: 2400, h: 3900, stairKind: "双跑" },
  储藏: { w: 1500, h: 1500 },
  弹性区: { w: 3000, h: 3000 },
};

export const initialIntent: StudioIntent = {
  totalAreaSqm: 100,
  south: "-Y",
  floors: 2,
  publicSplit: "auto",
  roofType: "平",
  roofRidgeAxis: "X",
  jurisdiction: "heuristic",
  rooms: Object.fromEntries(
    roomDefinitions.map((item) => [
      item.key,
      { count: item.count, min: item.min, max: item.max },
    ]),
  ) as Record<RoomKey, RoomRequirement>,
};

export function createPlanCandidates(intent: StudioIntent): PlanCandidate[] {
  const base = generatePlan(intent);
  const mirrored = mirrorPlan(base, intent, "x", "Generate B · 镜像采光");
  const fit = createFitPlan(intent, base);
  const furnishReady = createFurnishPlan(intent, base);
  const candidates: Array<Omit<PlanCandidate, "score" | "summary" | "evaluation">> = [
    {
      id: "generate-a",
      title: "Generate A · 平衡方案",
      command: "Generate",
      plan: base,
    },
    {
      id: "generate-b",
      title: "Generate B · 镜像采光",
      command: "Generate",
      plan: mirrored,
    },
    {
      id: "fit-c",
      title: "Fit C · 模板适配",
      command: "Fit",
      plan: fit,
    },
    {
      id: "furnish-d",
      title: "Furnish D · 家具友好",
      command: "Furnish",
      plan: furnishReady,
    },
  ];
  return candidates.map((candidate) => {
    const furniture = candidate.command === "Furnish" ? buildFurniture(candidate.plan) : [];
    const evaluation = evaluatePlan(candidate.plan, intent, furniture);
    return {
      ...candidate,
      evaluation,
      score: evaluation.score,
      summary: candidateSummary(candidate.plan),
    };
  });
}

export function buildPlanCdePayload(input: FloorplanCdePayloadInput) {
  const evaluation = evaluatePlan(input.plan, input.intent, input.furniture);
  return {
    schema: "architoken.floorplan_candidate_manifest.v1",
    moduleId: input.moduleId,
    source:
      "ArchIToken shared floorplan-layout kernel: boundary/program -> Generate/Fit/Furnish -> Evaluator -> RuleChecker -> SchemaValidator -> Approver",
    reviewState: "professional_review_required",
    aiGateChain: [
      "Planner",
      "Generator",
      "Evaluator",
      "RuleChecker",
      "SchemaValidator",
      "Approver",
    ],
    mode: input.mode,
    intent: input.intent,
    plan: { ...input.plan, evaluation },
    activeCandidate: input.activeCandidate,
    candidates: input.candidates,
    furniture: input.furniture,
    constructionColumn: input.constructionColumn,
    evaluation,
    createdAt: new Date().toISOString(),
  };
}

export function evaluatePlan(
  plan: GeneratedPlan,
  intent: StudioIntent = initialIntent,
  furniture: ReadonlyArray<FurnitureItem> = buildFurniture(plan),
): PlanEvaluationReport {
  const issues: PlanEvaluationIssue[] = [];
  for (const warning of plan.warnings) {
    issues.push({
      id: `area-${warning.room}`,
      stage: "Evaluator",
      severity: "warning",
      title: "房间面积偏离目标范围",
      detail: `${warning.msg}；${warning.reason}`,
      affectedIds: [warning.room],
    });
  }

  for (const room of roomDefinitions) {
    const required = intent.rooms[room.key];
    const actual = plan.blocks.filter((block) => block.purpose === room.key).length;
    if (actual < required.count) {
      issues.push({
        id: `count-${room.key}`,
        stage: "RuleChecker",
        severity: "error",
        title: `${room.key} 数量不足`,
        detail: `需求 ${required.count} 个，当前 ${actual} 个。`,
        affectedIds: [],
      });
    }
  }

  for (const block of plan.blocks) {
    const rect = rectFromBlock(block);
    if (!isSnapped(rect.x0) || !isSnapped(rect.y0) || !isSnapped(rect.w) || !isSnapped(rect.h)) {
      issues.push({
        id: `grid-${block.id}`,
        stage: "SchemaValidator",
        severity: "warning",
        title: "房间未完全落在模数网格",
        detail: `${block.id} 未满足 ${MODULUS}mm 模数 snap。`,
        affectedIds: [block.id],
      });
    }
    if (Math.max(rect.w, rect.h) > MAX_SPAN * 1.6) {
      issues.push({
        id: `span-${block.id}`,
        stage: "RuleChecker",
        severity: "warning",
        title: "房间跨度需要结构复核",
        detail: `${block.id} 最大边 ${Math.max(rect.w, rect.h)}mm，超过快速布置舒适范围。`,
        affectedIds: [block.id],
      });
    }
  }

  const usable = plan.summary.usableRatioEst;
  if (usable < 0.72 || usable > 1.05) {
    issues.push({
      id: "usable-ratio",
      stage: "Evaluator",
      severity: "warning",
      title: "使用面积率异常",
      detail: `当前估算使用面积率 ${usable.toFixed(2)}，需要确认建筑面积口径和边界输入。`,
      affectedIds: [plan.projectId],
    });
  }

  const wetBlocks = plan.blocks.filter((block) =>
    ["厨房", "卫生间", "主卫"].includes(block.purpose),
  );
  if (plan.floors === 2 && wetBlocks.length > 1 && !hasWetZoneOverlap(wetBlocks)) {
    issues.push({
      id: "wet-zone-stack",
      stage: "RuleChecker",
      severity: "warning",
      title: "上下层湿区未充分叠合",
      detail: "厨卫未形成稳定竖向湿区带，后续机电与结构深化需复核。",
      affectedIds: wetBlocks.map((block) => block.id),
    });
  }

  for (const item of furniture) {
    const block = plan.blocks.find((candidate) => candidate.id === item.blockId);
    if (!block) continue;
    const rect = rectFromBlock(block);
    const fits =
      item.x0 >= rect.x0 + 150 &&
      item.y0 >= rect.y0 + 150 &&
      item.x0 + item.w <= rect.x1 - 150 &&
      item.y0 + item.h <= rect.y1 - 150;
    if (!fits) {
      issues.push({
        id: `furniture-${item.id}`,
        stage: "RuleChecker",
        severity: "warning",
        title: "家具净距不足",
        detail: `${item.label} 与 ${block.purpose} 边界净距不足，需人工复核门洞、窗和通道。`,
        affectedIds: [item.id, block.id],
      });
    }
  }

  issues.push({
    id: "professional-review-required",
    stage: "Approver",
    severity: "info",
    title: "需要专业审核",
    detail:
      "当前结果为启发式设计候选；未绑定具体法域条文、项目合同和注册专业人员签审时，不得标记为合规、可报审或可施工。",
    affectedIds: [plan.projectId],
  });

  const counts = countIssues(issues);
  const score = Math.max(
    45,
    Math.min(98, 96 - counts.error * 18 - counts.warning * 5 - Math.abs(usable - DEFAULT_USABLE_RATIO) * 25),
  );
  return {
    schema: "architoken.floorplan_evaluation_report.v1",
    reviewState: "professional_review_required",
    score: Math.round(score),
    passed: counts.error === 0,
    issueCounts: counts,
    issues,
    gates: buildGates(issues),
  };
}

export function candidateSummary(plan: GeneratedPlan) {
  return `${plan.summary.envelope[0]}×${plan.summary.envelope[1]}mm · ${plan.summary.blockCount} 房间 · ${plan.warnings.length} 警告`;
}

export function scorePlan(plan: GeneratedPlan, intent: StudioIntent = initialIntent) {
  return evaluatePlan(plan, intent).score;
}

export function buildFurniture(plan: GeneratedPlan): FurnitureItem[] {
  return plan.blocks.flatMap((block) => furnitureForBlock(block));
}

export function generatePlan(intent: StudioIntent): GeneratedPlan {
  const generated =
    intent.massing === "l_shape"
      ? intent.floors === 2
        ? generateTwoFloorLShapedPlan(intent)
        : generateLShapedPlan(intent)
      : intent.floors === 2
        ? generateTwoFloorPlan(intent)
        : generateSingleFloorPlan(intent);
  const boundaryEnvelope = envelopeFromBoundary(intent.boundary);
  return boundaryEnvelope ? adaptPlanToEnvelope(generated, intent, boundaryEnvelope, generated.projectName) : generated;
}

export function normalizePlanFromBlocks(
  plan: GeneratedPlan,
  blocks: ReadonlyArray<PlanBlock>,
  rooms: Record<RoomKey, RoomRequirement> = initialIntent.rooms,
): GeneratedPlan {
  return finalizePlan({
    projectId: plan.projectId,
    projectName: plan.projectName,
    intentLabel: plan.intentLabel,
    floors: plan.floors,
    blocks,
    targetSqm: plan.summary.targetSqm,
    designNotes: plan.designNotes,
    rooms,
  });
}

export function computeLiveSummary(intent: StudioIntent) {
  const privateKeys: RoomKey[] = [
    "主卧",
    "主卫",
    "次卧",
    "卫生间",
    "厨房",
    "阳台",
  ];
  let privateMin = 0;
  let privateMax = 0;
  let privateCount = 0;
  for (const key of privateKeys) {
    const item = intent.rooms[key];
    privateCount += item.count;
    privateMin += item.count * item.min;
    privateMax += item.count * item.max;
  }
  const usable = intent.totalAreaSqm * DEFAULT_USABLE_RATIO;
  const publicMin = Math.max(0, usable - privateMax);
  const publicMax = Math.max(0, usable - privateMin);
  let check = "参数合理";
  let tone: "ok" | "warn" | "err" = "ok";
  if (privateMax > usable) {
    check = "私密区超总面积";
    tone = "err";
  } else if (publicMax < 14) {
    check = "公共区不足";
    tone = "warn";
  }
  return {
    privateRange: `${privateMin.toFixed(1)} ~ ${privateMax.toFixed(1)} ㎡`,
    privateCount,
    publicRange: `${publicMin.toFixed(1)} ~ ${publicMax.toFixed(1)} ㎡`,
    check,
    tone,
  };
}

export function parsePromptToIntent(prompt: string, base: StudioIntent): StudioIntent {
  const text = prompt.trim();
  const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:平|㎡|m2|m²)/i);
  const bedMatch = text.match(/([一二两三四五六七八九]|\d+)\s*(?:室|居|房)/);
  const bathCount = /双卫|两卫|2卫/.test(text)
    ? 2
    : /主卧带卫生间|主卫|套卫/.test(text)
      ? 2
      : 1;
  const hasMasterBath = /主卧带卫生间|主卫|套卫/.test(text);
  const split: PublicSplit = /一体|一厅/.test(text)
    ? "lk"
    : /两厅|大餐厅|餐厅/.test(text)
      ? "lk_sep"
      : base.publicSplit;
  const bedCount = bedMatch
    ? parseChineseNumber(bedMatch[1] ?? "3")
    : base.rooms.主卧.count + base.rooms.次卧.count;
  const totalAreaSqm = areaMatch ? Number(areaMatch[1]) : base.totalAreaSqm;
  const lShaped = /L\s*[形型]/i.test(text);
  // L 形：显式说两层/复式才出两层（不按面积自动升层）；矩形沿用面积/关键词推断。
  const floors: 1 | 2 = lShaped
    ? /两层|2层|二层|复式/.test(text)
      ? 2
      : 1
    : /两层|2层|二层|楼梯|复式/.test(text) || totalAreaSqm >= 105
      ? 2
      : 1;
  return {
    ...base,
    totalAreaSqm,
    floors,
    ...(lShaped ? { massing: "l_shape" as const } : {}),
    publicSplit: split,
    rooms: {
      ...base.rooms,
      主卧: {
        ...base.rooms.主卧,
        count: 1,
        max: totalAreaSqm >= 120 ? 18 : 16,
      },
      主卫: {
        ...base.rooms.主卫,
        count: hasMasterBath ? 1 : Math.max(0, bathCount - 1),
      },
      次卧: { ...base.rooms.次卧, count: Math.max(0, bedCount - 1) },
      卫生间: { ...base.rooms.卫生间, count: 1 },
      厨房: { ...base.rooms.厨房, count: 1 },
    },
  };
}

export function rectBlock(
  id: string,
  purpose: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  floor: 1 | 2,
  stairKind?: "单跑" | "双跑",
  source: PlanBlock["source"] = "generated",
): PlanBlock {
  const w = Math.max(MODULUS, x1 - x0);
  const h = Math.max(MODULUS, y1 - y0);
  return {
    id,
    purpose,
    polygon: rectToPolygon({ x0, y0, x1: x0 + w, y1: y0 + h, w, h }),
    areaSqm: roundArea((w * h) / 1e6),
    floor,
    source,
    ...(stairKind ? { stairKind } : {}),
  };
}

export function rectFromBlock(block: PlanBlock): BlockRect {
  const xs = block.polygon.map((point) => point.x);
  const ys = block.polygon.map((point) => point.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function rectToPolygon(rect: BlockRect): Point2D[] {
  return [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x1, y: rect.y1 },
    { x: rect.x0, y: rect.y1 },
  ];
}

export function computeEnvelope(blocks: ReadonlyArray<PlanBlock>): [number, number] {
  const xs = blocks.flatMap((block) => block.polygon.map((point) => point.x));
  const ys = blocks.flatMap((block) => block.polygon.map((point) => point.y));
  return [snap(Math.max(...xs, 1)), snap(Math.max(...ys, 1))];
}

export function buildGridLines(w: number, h: number, step: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let value = 0; value <= w; value += step) xs.push(value);
  for (let value = 0; value <= h; value += step) ys.push(value);
  return { x: xs, y: ys };
}

export function buildAxisPositions(lengthM: number, stepM: number) {
  const values: number[] = [];
  for (let value = 0; value <= lengthM + 0.001; value += stepM) {
    values.push(value);
  }
  if (values[values.length - 1] !== lengthM) values.push(lengthM);
  return values;
}

export function snap(value: number) {
  return Math.round(value / MODULUS) * MODULUS;
}

export function roundArea(value: number) {
  return Math.round(value * 100) / 100;
}

export function safeFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "");
}

function createFitPlan(intent: StudioIntent, base: GeneratedPlan): GeneratedPlan {
  const template = selectBestTemplate(intent);
  const templateIntent = intentFromTemplate(template, intent);
  const generated = templateIntent.floors === 2
    ? generateTwoFloorPlan(templateIntent)
    : generateSingleFloorPlan(templateIntent);
  const envelope = envelopeFromBoundary(intent.boundary) ?? base.summary.envelope;
  return adaptPlanToEnvelope(
    generated,
    intent,
    envelope,
    `Fit · ${template.title}`,
    [
      `Fit 模板：${template.title}，按房间数量、面积和楼层数匹配。`,
      "适配策略：模板检索 -> 外轮廓缩放 -> 模数 snap -> 规则评分。",
    ],
  );
}

function createFurnishPlan(intent: StudioIntent, base: GeneratedPlan): GeneratedPlan {
  const scaled = adaptPlanToEnvelope(
    base,
    intent,
    [snap(base.summary.envelope[0] * 1.03), snap(base.summary.envelope[1] * 0.96)],
    "Furnish · 家具友好",
    ["家具优化：轻微放宽面宽、压缩进深，优先保留床、沙发、餐桌和厨卫净距。"],
  );
  // X 镜像保持南北朝向：Y 镜像会把南卧翻到北面，违反冬季日照（GB50096 7.1.1）。
  return mirrorPlan(scaled, intent, "x", "Furnish · 家具友好");
}

function selectBestTemplate(intent: StudioIntent): TemplateConfig {
  const fallback = templates.t3 ?? Object.values(templates)[0];
  if (!fallback) {
    throw new Error("floorplan template registry is empty");
  }
  const bedroomTarget = Math.max(1, intent.rooms.主卧.count) + intent.rooms.次卧.count;
  const bathTarget = intent.rooms.主卫.count + intent.rooms.卫生间.count;
  let best: TemplateConfig | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const template of Object.values(templates)) {
    const bedroomTemplate =
      Math.max(1, template.rooms.主卧?.count ?? 1) + (template.rooms.次卧?.count ?? 0);
    const bathTemplate = (template.rooms.主卫?.count ?? 0) + (template.rooms.卫生间?.count ?? 0);
    const score =
      Math.abs(template.total - intent.totalAreaSqm) * 0.15 +
      Math.abs(bedroomTemplate - bedroomTarget) * 8 +
      Math.abs(bathTemplate - bathTarget) * 5 +
      (template.floors === intent.floors ? 0 : 12);
    if (score < bestScore) {
      best = template;
      bestScore = score;
    }
  }
  return best ?? fallback;
}

function intentFromTemplate(template: TemplateConfig, base: StudioIntent): StudioIntent {
  return {
    ...base,
    totalAreaSqm: base.totalAreaSqm,
    floors: base.floors,
    publicSplit: template.split,
    rooms: roomDefinitions.reduce(
      (acc, def) => {
        acc[def.key] = template.rooms[def.key] ?? base.rooms[def.key];
        return acc;
      },
      {} as Record<RoomKey, RoomRequirement>,
    ),
  };
}

function mirrorPlan(
  plan: GeneratedPlan,
  intent: StudioIntent,
  axis: "x" | "y",
  projectName: string,
): GeneratedPlan {
  const [envW, envH] = plan.summary.envelope;
  const blocks = plan.blocks.map((block) => ({
    ...block,
    id: `${block.id}_${axis === "x" ? "mx" : "my"}`,
    polygon: block.polygon.map((point) => ({
      x: axis === "x" ? snap(envW - point.x) : point.x,
      y: axis === "y" ? snap(envH - point.y) : point.y,
    })),
  }));
  return finalizePlan({
    projectId: `${plan.projectId}-${axis}-mirror`,
    projectName,
    intentLabel: plan.intentLabel,
    floors: plan.floors,
    blocks: blocks.map((block) => ({
      ...block,
      areaSqm: roundArea((rectFromBlock(block).w * rectFromBlock(block).h) / 1e6),
    })),
    targetSqm: plan.summary.targetSqm,
    designNotes: [
      ...plan.designNotes.slice(0, 2),
      axis === "x"
        ? "候选变体：按 X 方向镜像，用于快速比较入口和采光侧。"
        : "候选变体：按 Y 方向镜像，用于比较南北动线和家具摆放。",
    ],
    rooms: intent.rooms,
  });
}

function adaptPlanToEnvelope(
  plan: GeneratedPlan,
  intent: StudioIntent,
  envelope: [number, number],
  projectName: string,
  extraNotes: ReadonlyArray<string> = [],
): GeneratedPlan {
  const [sourceW, sourceH] = plan.summary.envelope;
  const scaleX = sourceW > 0 ? envelope[0] / sourceW : 1;
  const scaleY = sourceH > 0 ? envelope[1] / sourceH : 1;
  const blocks = plan.blocks.map((block) => {
    const polygon = block.polygon.map((point) => ({
      x: Math.max(0, snap(point.x * scaleX)),
      y: Math.max(0, snap(point.y * scaleY)),
    }));
    return {
      ...block,
      source: "fit_template" as const,
      id: `${block.id}_fit`,
      polygon,
      areaSqm: roundArea(
        (rectFromBlock({ ...block, polygon }).w * rectFromBlock({ ...block, polygon }).h) / 1e6,
      ),
    };
  });
  return finalizePlan({
    projectId: `${plan.projectId}-fit-${envelope[0]}-${envelope[1]}`,
    projectName,
    intentLabel: plan.intentLabel,
    floors: plan.floors,
    blocks,
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      ...extraNotes,
      ...plan.designNotes.slice(0, 3),
      "所有候选均为专业复核前的工程启发式结果。",
    ],
    rooms: intent.rooms,
  });
}

function generateSingleFloorPlan(intent: StudioIntent): GeneratedPlan {
  const rooms = intent.rooms;
  const master = rooms.主卧;
  const masterBath = rooms.主卫;
  const secondary = rooms.次卧;
  const wc = rooms.卫生间;
  const kitchen = rooms.厨房;
  const balcony = rooms.阳台;
  const bedCount = Math.max(1, master.count) + secondary.count;
  const bathCount = masterBath.count + wc.count;
  const publicSplit =
    intent.publicSplit === "auto"
      ? bedCount <= 2
        ? "lk"
        : "lk_sep"
      : intent.publicSplit;
  const [masterW, privateDepth] = pickMasterDims(master.max || 16);

  const southRooms: Array<{ purpose: string; w: number; idx?: number }> = [
    { purpose: "主卧", w: masterW },
  ];
  if (masterBath.count > 0) {
    southRooms.push({
      purpose: "主卫",
      w: Math.max(1500, snap((masterBath.max * 1e6) / privateDepth)),
    });
  }
  for (let index = 0; index < secondary.count; index += 1) {
    southRooms.push({
      purpose: "次卧",
      w: Math.min(
        MAX_SPAN,
        Math.max(2400, snap((secondary.max * 1e6) / privateDepth)),
      ),
      idx: index + 1,
    });
  }

  let envelopeW = southRooms.reduce((sum, room) => sum + room.w, 0);
  envelopeW = Math.max(envelopeW, bedCount <= 1 ? 6000 : 9000);
  // 公共带必须与最后一间卧室至少重叠 1200mm，否则该卧室开不出门（GB50096 5.8）。
  const lastBedStart = southRooms
    .slice(0, -1)
    .reduce((sum, room) => sum + room.w, 0);
  const minPublicW = lastBedStart + 1200;
  const targetInnerArea = intent.totalAreaSqm * DEFAULT_USABLE_RATIO * 1e6;
  let northDepth = Math.min(
    MAX_SPAN,
    snap(Math.max(targetInnerArea / envelopeW - privateDepth, 3000)),
  );
  const kitchenWetArea = kitchen.max + (wc.count > 0 ? wc.max : 0);
  let wetW = Math.max(
    1500,
    Math.min(envelopeW - 3600, snap((kitchenWetArea * 1e6) / northDepth)),
  );
  if (envelopeW - wetW < minPublicW) {
    const cappedWet = envelopeW - minPublicW;
    if (cappedWet >= 1500) {
      wetW = snap(cappedWet);
    } else {
      envelopeW = snap(minPublicW + Math.max(1500, wetW));
    }
  }
  // 湿区面积保障：wetW 被压窄后用深度补偿，避免厨房低于规范最小面积。
  northDepth = Math.max(
    northDepth,
    snap(Math.ceil((kitchenWetArea * 1e6) / wetW / MODULUS) * MODULUS),
  );
  const envelopeH = privateDepth + northDepth;
  const publicW = envelopeW - wetW;
  const blocks: PlanBlock[] = [];

  let cursor = 0;
  for (const room of southRooms) {
    const id = room.idx ? `R_${room.purpose}_${room.idx}` : `R_${room.purpose}`;
    blocks.push(rectBlock(id, room.purpose, cursor, 0, cursor + room.w, privateDepth, 1));
    cursor += room.w;
  }

  if (publicSplit === "lk") {
    blocks.push(rectBlock("R_客餐厅一体", "客餐厅一体", 0, privateDepth, publicW, envelopeH, 1));
  } else {
    const livingW = snap(publicW * 0.6);
    blocks.push(rectBlock("R_客厅", "客厅", 0, privateDepth, livingW, envelopeH, 1));
    blocks.push(rectBlock("R_餐厅", "餐厅", livingW, privateDepth, publicW, envelopeH, 1));
  }

  if (wc.count > 0) {
    const wcH = Math.max(
      1500,
      Math.min(northDepth - 1500, snap((wc.max * 1e6) / wetW)),
    );
    blocks.push(rectBlock("R_卫生间", "卫生间", publicW, privateDepth, envelopeW, privateDepth + wcH, 1));
    blocks.push(rectBlock("R_厨房", "厨房", publicW, privateDepth + wcH, envelopeW, envelopeH, 1));
  } else {
    blocks.push(rectBlock("R_厨房", "厨房", publicW, privateDepth, envelopeW, envelopeH, 1));
  }

  if (balcony.count > 0) {
    blocks.push(rectBlock("R_阳台", "阳台", 0, envelopeH, Math.min(3600, envelopeW), envelopeH + 1500, 1));
  }

  return finalizePlan({
    projectId: `ai-plan-${bedCount}bed-${bathCount}bath-${Math.round(intent.totalAreaSqm)}sqm`,
    projectName: `AI 模板生成：${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫`,
    intentLabel: `${bedCount}居${publicSplit === "lk" ? "一厅" : "两厅"} ${bathCount}卫`,
    floors: 1,
    blocks,
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      `南向（Y 小）：主卧${masterBath.count ? "+主卫" : ""} + 次卧×${secondary.count}`,
      `北向（Y 大）：${publicSplit === "lk" ? "客餐厅一体" : "客厅+餐厅"} + 厨房${wc.count ? "+公卫" : ""}`,
      "模板化布局：南卧 + 北公共 + 厨卫角，生成后进入专业复核。",
    ],
    rooms,
  });
}

/**
 * L 形体量（v1 单层）：南卧带 + 中部公共带（与矩形模板同构）+ 西北臂，
 * 缺角留在东北角作为室外（庭院/露台用地）。所有房间仍为矩形，
 * 体量并集呈 L 形，图纸/彩平/IFC/线稿管线无需特殊处理。
 */
function generateLShapedPlan(intent: StudioIntent): GeneratedPlan {
  const rooms = intent.rooms;
  const master = rooms.主卧;
  const masterBath = rooms.主卫;
  const secondary = rooms.次卧;
  const wc = rooms.卫生间;
  const kitchen = rooms.厨房;
  const bedCount = Math.max(1, master.count) + secondary.count;
  const bathCount = masterBath.count + wc.count;
  const publicSplit =
    intent.publicSplit === "auto"
      ? bedCount <= 2
        ? "lk"
        : "lk_sep"
      : intent.publicSplit;
  const [masterW, privateDepth] = pickMasterDims(master.max || 16);

  const southRooms: Array<{ purpose: string; w: number; idx?: number }> = [
    { purpose: "主卧", w: masterW },
  ];
  if (masterBath.count > 0) {
    southRooms.push({
      purpose: "主卫",
      w: Math.max(1500, snap((masterBath.max * 1e6) / privateDepth)),
    });
  }
  for (let index = 0; index < secondary.count; index += 1) {
    southRooms.push({
      purpose: "次卧",
      w: Math.min(
        MAX_SPAN,
        Math.max(2400, snap((secondary.max * 1e6) / privateDepth)),
      ),
      idx: index + 1,
    });
  }

  let envelopeW = southRooms.reduce((sum, room) => sum + room.w, 0);
  envelopeW = Math.max(envelopeW, bedCount <= 1 ? 6000 : 9000);
  // 公共带必须与最后一间卧室至少重叠 1200mm，否则该卧室开不出门（GB50096 5.8）。
  const lastBedStart = southRooms
    .slice(0, -1)
    .reduce((sum, room) => sum + room.w, 0);
  const minPublicW = lastBedStart + 1200;
  const targetInnerArea = intent.totalAreaSqm * DEFAULT_USABLE_RATIO * 1e6;
  // 西北臂约占目标面积 16%，其余分给南卧带 + 中部公共带。
  const armW = snap(envelopeW * 0.55);
  const armDepth = Math.max(
    1800,
    Math.min(3600, snap((targetInnerArea * 0.16) / armW)),
  );
  let midDepth = Math.min(
    MAX_SPAN,
    snap(Math.max((targetInnerArea * 0.84) / envelopeW - privateDepth, 2400)),
  );
  const kitchenWetArea = kitchen.max + (wc.count > 0 ? wc.max : 0);
  let wetW = Math.max(
    1500,
    Math.min(envelopeW - 3600, snap((kitchenWetArea * 1e6) / midDepth)),
  );
  if (envelopeW - wetW < minPublicW) {
    const cappedWet = envelopeW - minPublicW;
    if (cappedWet >= 1500) {
      wetW = snap(cappedWet);
    } else {
      envelopeW = snap(minPublicW + Math.max(1500, wetW));
    }
  }
  const publicW = envelopeW - wetW;
  // 公共区最小面积保障：客厅 ≥10㎡（lk_sep 按 0.6 占比反推），客餐厅一体 ≥12㎡；
  // 湿区面积保障：厨卫目标面积在 wetW 被压窄后用深度补偿。
  const minPublicArea = publicSplit === "lk" ? 12.5e6 : 17.5e6;
  midDepth = Math.max(
    midDepth,
    snap(Math.ceil(minPublicArea / publicW / MODULUS) * MODULUS),
    snap(Math.ceil((kitchenWetArea * 1e6) / wetW / MODULUS) * MODULUS),
  );
  const midTop = privateDepth + midDepth;
  const blocks: PlanBlock[] = [];

  let cursor = 0;
  for (const room of southRooms) {
    const id = room.idx ? `R_${room.purpose}_${room.idx}` : `R_${room.purpose}`;
    blocks.push(rectBlock(id, room.purpose, cursor, 0, cursor + room.w, privateDepth, 1));
    cursor += room.w;
  }

  if (publicSplit === "lk") {
    blocks.push(rectBlock("R_客餐厅一体", "客餐厅一体", 0, privateDepth, publicW, midTop, 1));
  } else {
    const livingW = snap(publicW * 0.6);
    blocks.push(rectBlock("R_客厅", "客厅", 0, privateDepth, livingW, midTop, 1));
    blocks.push(rectBlock("R_餐厅", "餐厅", livingW, privateDepth, publicW, midTop, 1));
  }
  if (wc.count > 0) {
    const wcH = Math.max(
      1500,
      Math.min(midDepth - 1500, snap((wc.max * 1e6) / wetW)),
    );
    blocks.push(rectBlock("R_卫生间", "卫生间", publicW, privateDepth, envelopeW, privateDepth + wcH, 1));
    blocks.push(rectBlock("R_厨房", "厨房", publicW, privateDepth + wcH, envelopeW, midTop, 1));
  } else {
    blocks.push(rectBlock("R_厨房", "厨房", publicW, privateDepth, envelopeW, midTop, 1));
  }

  // 西北臂：阳台 + 弹性区；x ≥ armW 的东北角为室外缺角。
  const balconyW = Math.min(2700, snap(armW * 0.4));
  blocks.push(rectBlock("R_阳台", "阳台", 0, midTop, balconyW, midTop + armDepth, 1));
  blocks.push(rectBlock("R_弹性区", "弹性区", balconyW, midTop, armW, midTop + armDepth, 1));

  return finalizePlan({
    projectId: `ai-plan-lshape-${bedCount}bed-${bathCount}bath-${Math.round(intent.totalAreaSqm)}sqm`,
    projectName: `AI L形户型：${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫`,
    intentLabel: `${bedCount}居${publicSplit === "lk" ? "一厅" : "两厅"} ${bathCount}卫 · L形`,
    floors: 1,
    blocks,
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      `南向：主卧${masterBath.count ? "+主卫" : ""} + 次卧×${secondary.count}；中部：${publicSplit === "lk" ? "客餐厅一体" : "客厅+餐厅"} + 厨卫角。`,
      `西北臂（阳台+弹性区）深 ${armDepth}mm；东北缺角 ${envelopeW - armW}×${armDepth}mm 为室外。`,
      "L 形体量启发布局（v1 单层），生成后进入专业复核。",
    ],
    rooms,
  });
}

/**
 * 双层 L 形：同一 L 足迹两层堆叠——1F 公共层（客餐厅/厨卫/楼梯），
 * 2F 卧室层（南卧带 + 走廊 + 楼梯对位）。东北缺角两层均为室外。
 * 与矩形两层模板一致，totalAreaSqm 按基底足迹理解。
 */
function generateTwoFloorLShapedPlan(intent: StudioIntent): GeneratedPlan {
  const rooms = intent.rooms;
  const master = rooms.主卧;
  const masterBath = rooms.主卫;
  const secondary = rooms.次卧;
  const wc = rooms.卫生间;
  const kitchen = rooms.厨房;
  const bedCount = Math.max(1, master.count) + secondary.count;
  const bathCount = masterBath.count + wc.count;
  const [masterW, privateDepth] = pickMasterDims(master.max || 16);

  // 2F 南卧带决定足迹宽度（与单层 L 同构）。
  const southRooms: Array<{ purpose: string; w: number; idx?: number }> = [
    { purpose: "主卧", w: masterW },
  ];
  if (masterBath.count > 0) {
    southRooms.push({
      purpose: "主卫",
      w: Math.max(1500, snap((masterBath.max * 1e6) / privateDepth)),
    });
  }
  for (let index = 0; index < secondary.count; index += 1) {
    southRooms.push({
      purpose: "次卧",
      w: Math.min(
        MAX_SPAN,
        Math.max(2400, snap((secondary.max * 1e6) / privateDepth)),
      ),
      idx: index + 1,
    });
  }
  let envelopeW = southRooms.reduce((sum, room) => sum + room.w, 0);
  envelopeW = Math.max(envelopeW, 9000);
  const lastBedStart = southRooms
    .slice(0, -1)
    .reduce((sum, room) => sum + room.w, 0);
  const minPublicW = lastBedStart + 1200;
  if (envelopeW < minPublicW + 1500) envelopeW = snap(minPublicW + 1500);

  const targetInnerArea = intent.totalAreaSqm * DEFAULT_USABLE_RATIO * 1e6;
  const armW = snap(envelopeW * 0.55);
  const armDepth = Math.max(
    1800,
    Math.min(3600, snap((targetInnerArea * 0.16) / armW)),
  );
  const corridorDepth = 1200;
  const stairW = 2700;
  // 中带深度：覆盖目标面积之余满足厨卫与楼梯需求。
  let midDepth = Math.min(
    MAX_SPAN,
    snap(Math.max((targetInnerArea * 0.84) / envelopeW - privateDepth, 3000)),
  );
  midDepth = Math.max(midDepth, corridorDepth + 2400);
  const midTop = privateDepth + midDepth;
  const armTop = midTop + armDepth;
  const stairX0 = envelopeW - stairW;

  const blocks: PlanBlock[] = [];

  // ---- 1F 公共层 ----
  const livingW = snap(envelopeW * 0.55);
  blocks.push(
    rectBlock("R_1F_客厅", "客厅", 0, 0, livingW, privateDepth, 1),
    rectBlock("R_1F_餐厅", "餐厅", livingW, 0, envelopeW, privateDepth, 1),
  );
  // 中带：厨房贴西外墙（采光）、卫生间居中、公共区连通、楼梯贴东。
  const kitchenW = Math.max(
    1800,
    Math.min(3300, snap((kitchen.max * 1e6) / midDepth)),
  );
  const wcW = wc.count > 0 ? Math.max(1500, snap((wc.max * 1e6) / midDepth)) : 0;
  blocks.push(
    rectBlock("R_1F_厨房", "厨房", 0, privateDepth, kitchenW, midTop, 1),
  );
  if (wc.count > 0) {
    blocks.push(
      rectBlock("R_1F_卫生间", "卫生间", kitchenW, privateDepth, kitchenW + wcW, midTop, 1),
    );
  }
  blocks.push(
    rectBlock("R_1F_公共区", "公共区", kitchenW + wcW, privateDepth, stairX0, midTop, 1),
    rectBlock("R_1F_楼梯", "楼梯", stairX0, privateDepth, envelopeW, midTop, 1, "双跑"),
  );
  // 西北臂：阳台 + 弹性区（缺角 x ≥ armW 为室外）。
  const balconyW = Math.min(2700, snap(armW * 0.4));
  blocks.push(
    rectBlock("R_1F_阳台", "阳台", 0, midTop, balconyW, armTop, 1),
    rectBlock("R_1F_弹性区", "弹性区", balconyW, midTop, armW, armTop, 1),
  );

  // ---- 2F 卧室层 ----
  let cursor = 0;
  for (const room of southRooms) {
    const id = room.idx
      ? `R_2F_${room.purpose}_${room.idx}`
      : `R_2F_${room.purpose}`;
    blocks.push(
      rectBlock(id, room.purpose, cursor, 0, cursor + room.w, privateDepth, 2),
    );
    cursor += room.w;
  }
  // 走廊连通南卧与楼梯；楼梯与 1F 完全对位。
  blocks.push(
    rectBlock("R_2F_走廊", "走廊", 0, privateDepth, envelopeW, privateDepth + corridorDepth, 2),
  );
  const lowerY0 = privateDepth + corridorDepth;
  const bath2W = Math.max(1800, snap(((wc.count > 0 ? wc.max : 3) * 1e6) / (midTop - lowerY0)));
  blocks.push(
    rectBlock("R_2F_卫生间", "卫生间", 0, lowerY0, bath2W, midTop, 2),
    rectBlock("R_2F_弹性区", "弹性区", bath2W, lowerY0, stairX0, midTop, 2),
    rectBlock("R_2F_楼梯", "楼梯", stairX0, lowerY0, envelopeW, midTop, 2, "双跑"),
    rectBlock("R_2F_弹性区_B", "弹性区", 0, midTop, armW, armTop, 2),
  );

  return finalizePlan({
    projectId: `ai-plan-lshape-two-floor-${bedCount}bed-${bathCount}bath-${Math.round(intent.totalAreaSqm)}sqm`,
    projectName: `AI 双层L形户型：${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫`,
    intentLabel: `${bedCount}居两厅 ${bathCount}卫 · L形 · 2层`,
    floors: 2,
    blocks,
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      "1F 公共层：客厅+餐厅（南）、厨卫+公共区+楼梯（中带）、阳台+弹性区（西北臂）。",
      "2F 卧室层：南卧带 + 走廊连通楼梯，楼梯上下完全对位；东北缺角两层均为室外。",
      "双层 L 形启发布局，生成后进入专业复核。",
    ],
    rooms,
  });
}

function generateTwoFloorPlan(intent: StudioIntent): GeneratedPlan {
  const rooms = intent.rooms;
  const bedCount = Math.max(1, rooms.主卧.count) + rooms.次卧.count;
  const bathCount = rooms.主卫.count + rooms.卫生间.count;
  const footprintTarget = Math.max(100, intent.totalAreaSqm * 1.08);
  const envelopeW = snap(Math.max(12000, Math.sqrt(footprintTarget * 1e6 * 1.33)));
  const envelopeH = snap(Math.max(9000, (footprintTarget * 1e6) / envelopeW));
  const c1 = snap(envelopeW * 0.31);
  const c2 = snap(envelopeW * 0.55);
  const c3 = snap(envelopeW * 0.75);
  const r1 = snap(envelopeH * 0.33);
  const r2 = snap(envelopeH * 0.62);
  const corridorDepth = 1200;
  const blocks: PlanBlock[] = [
    rectBlock("R_1F_公共区", "公共区", 0, 0, c1, r1, 1),
    rectBlock("R_1F_厨房", "厨房", c1, 0, c2, r1, 1),
    rectBlock("R_1F_卫生间", "卫生间", c2, 0, c3, r1, 1),
    rectBlock("R_1F_楼梯", "楼梯", c3, 0, envelopeW, r1, 1, "双跑"),
    rectBlock("R_1F_客厅", "客厅", 0, r1, c2, r2, 1),
    rectBlock("R_1F_餐厅", "餐厅", c2, r1, c3, r2, 1),
    rectBlock("R_1F_弹性区_A", "弹性区", c3, r1, envelopeW, r2, 1),
    rectBlock("R_1F_弹性区_B", "弹性区", 0, r2, c1, envelopeH, 1),
    rectBlock("R_1F_弹性区_C", "弹性区", c1, r2, c2, envelopeH, 1),
    rectBlock("R_1F_弹性区_D", "弹性区", c2, r2, c3, envelopeH, 1),
    rectBlock("R_1F_弹性区_E", "弹性区", c3, r2, envelopeW, envelopeH, 1),
    rectBlock("R_2F_主卧", "主卧", 0, 0, c2, r1, 2),
    rectBlock("R_2F_主卫", "主卫", c2, 0, c3, r1, 2),
    rectBlock("R_2F_楼梯", "楼梯", c3, 0, envelopeW, r1, 2, "双跑"),
    // 2F 走廊：连通楼梯与所有房间，房间门统一开向走廊而非互相穿套。
    rectBlock("R_2F_走廊", "走廊", 0, r1, envelopeW, r1 + corridorDepth, 2),
    rectBlock("R_2F_次卧_1", "次卧", 0, r1 + corridorDepth, c1, r2 + corridorDepth, 2),
    rectBlock("R_2F_卫生间", "卫生间", c1, r1 + corridorDepth, c2, r2 + corridorDepth, 2),
    // 储藏放内侧、次卧靠东外墙：卧室必须有直接天然采光（GB50096 7.1）。
    rectBlock("R_2F_储藏", "储藏", c2, r1 + corridorDepth, c3, r2 + corridorDepth, 2),
    rectBlock("R_2F_次卧_2", "次卧", c3, r1 + corridorDepth, envelopeW, r2 + corridorDepth, 2),
    rectBlock("R_2F_弹性区_A", "弹性区", 0, r2 + corridorDepth, c1, envelopeH, 2),
    rectBlock("R_2F_弹性区_B", "弹性区", c1, r2 + corridorDepth, c2, envelopeH, 2),
    rectBlock("R_2F_弹性区_C", "弹性区", c2, r2 + corridorDepth, c3, envelopeH, 2),
    rectBlock("R_2F_弹性区_D", "弹性区", c3, r2 + corridorDepth, envelopeW, envelopeH, 2),
  ];

  for (let index = 2; index < rooms.次卧.count; index += 1) {
    const x0 = snap(((index - 2) % 2) * (envelopeW / 2));
    const y0 = snap(envelopeH - 3000 - Math.floor((index - 2) / 2) * 3000);
    blocks.push(rectBlock(`R_2F_次卧_${index + 1}`, "次卧", x0, y0, x0 + 3000, y0 + 3000, 2));
  }

  return finalizePlan({
    projectId: `ai-plan-two-floor-${bedCount}bed-${bathCount}bath-${Math.round(intent.totalAreaSqm)}sqm`,
    projectName: `AI 两层户型：${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫`,
    intentLabel: `${bedCount}居两厅 ${bathCount}卫 · 2 层`,
    floors: 2,
    blocks: rooms.主卫.count > 0 ? blocks : blocks.filter((block) => block.purpose !== "主卫"),
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      "1F：公共区 + 厨房 + 卫生间 + 楼梯，弹性区等待深化分配。",
      "2F：主卧 + 次卧 + 公卫 + 楼梯，走廊连通楼梯与各房间，上下层楼梯位置完全对齐。",
      "3D：按外轮廓生成层板、柱网、梁网和房间底色，后续可进入构件深化。",
    ],
    rooms,
  });
}

function finalizePlan({
  projectId,
  projectName,
  intentLabel,
  floors,
  blocks,
  targetSqm,
  designNotes,
  rooms,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly intentLabel: string;
  readonly floors: 1 | 2;
  readonly blocks: ReadonlyArray<PlanBlock>;
  readonly targetSqm: number;
  readonly designNotes: ReadonlyArray<string>;
  readonly rooms: Record<RoomKey, RoomRequirement>;
}): GeneratedPlan {
  const envelope = computeEnvelope(blocks);
  const totalRoomSqm = roundArea(blocks.reduce((sum, block) => sum + block.areaSqm, 0));
  const warnings = collectWarnings(blocks, rooms);
  const floor1Sqm = roundArea(
    blocks.filter((block) => block.floor === 1).reduce((sum, block) => sum + block.areaSqm, 0),
  );
  const floor2Sqm = roundArea(
    blocks.filter((block) => block.floor === 2).reduce((sum, block) => sum + block.areaSqm, 0),
  );
  return {
    projectId,
    projectName,
    intentLabel,
    floors,
    blocks,
    designNotes,
    warnings,
    summary: {
      envelope,
      envelopeSqm: roundArea((envelope[0] * envelope[1]) / 1e6),
      targetSqm,
      totalRoomSqm,
      usableRatioEst: targetSqm ? roundArea(totalRoomSqm / targetSqm) : 0,
      blockCount: blocks.length,
      ...(floors === 2 ? { floor1Sqm, floor2Sqm } : {}),
    },
  };
}

function collectWarnings(
  blocks: ReadonlyArray<PlanBlock>,
  rooms: Record<RoomKey, RoomRequirement>,
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  for (const block of blocks) {
    if (!isRoomKey(block.purpose)) continue;
    const cfg = rooms[block.purpose];
    if (!cfg || cfg.count === 0) continue;
    if (block.areaSqm > cfg.max * 1.1) {
      warnings.push({
        room: block.id,
        msg: `${block.id} 实际 ${block.areaSqm.toFixed(1)}㎡ 超过目标 max ${cfg.max}㎡`,
        reason: "模数 snap、边界适配或短边约束导致，需人工复核。",
      });
    } else if (block.areaSqm < cfg.min * 0.9) {
      warnings.push({
        room: block.id,
        msg: `${block.id} 实际 ${block.areaSqm.toFixed(1)}㎡ 低于目标 min ${cfg.min}㎡`,
        reason: "目标面积偏紧、模板适配压缩或房间被压缩，需人工复核。",
      });
    }
  }
  return warnings;
}

function furnitureForBlock(block: PlanBlock): FurnitureItem[] {
  const rect = rectFromBlock(block);
  const base = {
    blockId: block.id,
    floor: block.floor,
  };
  const centerX = rect.x0 + rect.w / 2;
  const centerY = rect.y0 + rect.h / 2;
  if (["主卧", "次卧"].includes(block.purpose)) {
    return [
      {
        ...base,
        id: `${block.id}-bed`,
        label: "床",
        x0: clampSnap(rect.x0 + 450, rect.x0 + 150, rect.x1 - 1650),
        y0: clampSnap(rect.y0 + 450, rect.y0 + 150, rect.y1 - 1950),
        w: Math.min(2100, Math.max(1500, rect.w - 1200)),
        h: 1800,
        color: "#bfdbfe",
      },
      {
        ...base,
        id: `${block.id}-wardrobe`,
        label: "柜",
        x0: clampSnap(rect.x1 - 900, rect.x0 + 150, rect.x1 - 750),
        y0: clampSnap(rect.y0 + 300, rect.y0 + 150, rect.y1 - 1500),
        w: 600,
        h: Math.min(2400, Math.max(1200, rect.h - 600)),
        color: "#dbeafe",
      },
    ];
  }
  if (["客厅", "公共区", "客餐厅一体"].includes(block.purpose)) {
    return [
      {
        ...base,
        id: `${block.id}-sofa`,
        label: "沙发",
        x0: clampSnap(centerX - 1200, rect.x0 + 150, rect.x1 - 2550),
        y0: clampSnap(centerY - 600, rect.y0 + 150, rect.y1 - 1050),
        w: Math.min(2400, Math.max(1500, rect.w - 900)),
        h: 900,
        color: "#bbf7d0",
      },
      {
        ...base,
        id: `${block.id}-table`,
        label: "几",
        x0: clampSnap(centerX - 450, rect.x0 + 150, rect.x1 - 1050),
        y0: clampSnap(centerY + 600, rect.y0 + 150, rect.y1 - 750),
        w: 900,
        h: 600,
        color: "#86efac",
      },
    ];
  }
  if (block.purpose === "餐厅") {
    return [
      {
        ...base,
        id: `${block.id}-dining`,
        label: "餐桌",
        x0: clampSnap(centerX - 900, rect.x0 + 150, rect.x1 - 1950),
        y0: clampSnap(centerY - 600, rect.y0 + 150, rect.y1 - 1350),
        w: 1800,
        h: 1200,
        color: "#bbf7d0",
      },
    ];
  }
  if (block.purpose === "厨房") {
    return [
      {
        ...base,
        id: `${block.id}-cabinet`,
        label: "橱柜",
        x0: rect.x0 + 150,
        y0: rect.y0 + 150,
        w: Math.max(900, rect.w - 300),
        h: 600,
        color: "#fde68a",
      },
    ];
  }
  if (["卫生间", "主卫"].includes(block.purpose)) {
    return [
      {
        ...base,
        id: `${block.id}-bath`,
        label: "洁具",
        x0: clampSnap(centerX - 450, rect.x0 + 150, rect.x1 - 1050),
        y0: clampSnap(centerY - 450, rect.y0 + 150, rect.y1 - 1050),
        w: 900,
        h: 900,
        color: "#e0e7ff",
      },
    ];
  }
  return [];
}

function pickMasterDims(areaTarget: number, minShort = 3000, ratio = 1.2): [number, number] {
  const targetSide = Math.sqrt((areaTarget * 1e6) / ratio);
  const w = Math.max(minShort, Math.min(snap(targetSide), MAX_SPAN));
  const h = Math.max(minShort, Math.min(snap((areaTarget * 1e6) / w), MAX_SPAN));
  return [w, h];
}

function envelopeFromBoundary(boundary: LayoutBoundaryInput | undefined): [number, number] | null {
  if (!boundary?.polygon.length) return null;
  const xs = boundary.polygon.map((point) => point.x);
  const ys = boundary.polygon.map((point) => point.y);
  const width = snap(Math.max(...xs) - Math.min(...xs));
  const height = snap(Math.max(...ys) - Math.min(...ys));
  return width > 0 && height > 0 ? [width, height] : null;
}

function parseChineseNumber(value: string) {
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  return Number(value) || map[value] || 3;
}

function countIssues(issues: ReadonlyArray<PlanEvaluationIssue>): Record<PlanSeverity, number> {
  return issues.reduce(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { info: 0, warning: 0, error: 0 },
  );
}

function buildGates(issues: ReadonlyArray<PlanEvaluationIssue>): PlanEvaluationReport["gates"] {
  const stages: PlanEvaluationIssue["stage"][] = [
    "Planner",
    "Generator",
    "Evaluator",
    "RuleChecker",
    "SchemaValidator",
    "Approver",
  ];
  return stages.map((stage) => {
    const stageIssues = issues.filter((issue) => issue.stage === stage);
    const hasError = stageIssues.some((issue) => issue.severity === "error");
    const hasWarning = stageIssues.some((issue) => issue.severity === "warning");
    return {
      name: stage,
      status: hasError ? "blocked" : hasWarning || stage === "Approver" ? "needs_review" : "passed",
    };
  });
}

function hasWetZoneOverlap(blocks: ReadonlyArray<PlanBlock>) {
  const floor1 = blocks.filter((block) => block.floor === 1).map(rectFromBlock);
  const floor2 = blocks.filter((block) => block.floor === 2).map(rectFromBlock);
  if (!floor1.length || !floor2.length) return true;
  return floor1.some((a) => floor2.some((b) => rectOverlapArea(a, b) > 1_000_000));
}

function rectOverlapArea(a: BlockRect, b: BlockRect) {
  const x = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const y = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return x * y;
}

function isRoomKey(value: string): value is RoomKey {
  return ["主卧", "主卫", "次卧", "卫生间", "厨房", "阳台"].includes(value);
}

function isSnapped(value: number) {
  return Math.abs(value - snap(value)) < 0.001;
}

function clampSnap(value: number, min: number, max: number) {
  if (max < min) return snap(min);
  return snap(Math.min(max, Math.max(min, value)));
}
