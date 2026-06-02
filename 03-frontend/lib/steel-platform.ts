// lib/steel-platform.ts - Detailed-design steel platform derivation kernel
// License: Apache-2.0

import type { GeneratedPlan } from "@/lib/architoken/floorplan-layout";

export type SteelPlatformReviewState = "professional_review_required";

export interface SteelPlatformSettings {
  modulusMm: number;
  maxSpanMm: number;
  floorHeightMm: number;
  mainColumnSection: string;
  mainBeamSection: string;
  constructionColumnSection: string;
  interiorWallSection: string;
  roofType: "平" | "单坡" | "双坡";
  roofRidgeAxis: "X" | "Y";
  roofSlopeDeg: number;
  eaveOverhangMm: number;
  purlinSpacingMm: number;
  constructionColumnEnabled: boolean;
  interiorWallEnabled: boolean;
  constructionColumnFirstOffsetMm: number;
  constructionColumnSecondOffsetMm: number;
  constructionColumnSpacingMm: number;
}

export interface SteelPlatformPoint {
  x: number;
  y: number;
}

export interface SteelPlatformPlanBlock {
  id: string;
  purpose: string;
  polygon: SteelPlatformPoint[];
  areaSqm: number;
  floor: 1 | 2;
}

export interface SteelPlatformColumn {
  id: string;
  gridId: string;
  floor: number;
  section: string;
  location: [number, number, number];
  netLengthMm: number;
}

export interface SteelPlatformBeam {
  id: string;
  axis: "X" | "Y";
  floor: number;
  levelId: string;
  section: string;
  from: [number, number];
  to: [number, number];
  midpoint: [number, number, number];
  netLengthMm: number;
  rotationDeg: 0 | 90;
}

export interface SteelPlatformConstructionColumn {
  id: string;
  floor: number;
  section: string;
  location: [number, number, number];
  heightMm: number;
  groupId: string;
}

export type SteelPlatformWallSide = "south" | "north" | "east" | "west";

export interface SteelPlatformWallBay {
  id: string;
  wallSide: SteelPlatformWallSide;
  floor: number;
  start: SteelPlatformPoint;
  end: SteelPlatformPoint;
  axis: "X" | "Y";
  lengthMm: number;
}

export interface SteelPlatformOpening {
  id: string;
  bayId?: string;
  wallSide: SteelPlatformWallSide;
  centerMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  openingType: "door" | "window";
  frameType: "3-edge" | "4-edge";
  floor: number;
}

export interface SteelPlatformConstructionColumnGroup {
  id: string;
  wallSide: SteelPlatformWallSide;
  floor: number;
  start: SteelPlatformPoint;
  end: SteelPlatformPoint;
  axis: "X" | "Y";
  columnLocations: SteelPlatformPoint[];
  openings: SteelPlatformOpening[];
}

export interface SteelPlatformInteriorDoor {
  wallId: string;
  positionMm: number;
  flip: 0 | 1 | 2 | 3;
}

export interface SteelPlatformInteriorWall {
  id: string;
  floor: number;
  start: SteelPlatformPoint;
  end: SteelPlatformPoint;
  axis: "X" | "Y";
  lengthMm: number;
  removed: boolean;
  hitExteriorOpening: boolean;
  door?: SteelPlatformInteriorDoor;
  columnLocations: SteelPlatformPoint[];
}

export interface SteelPlatformBomRow {
  category: string;
  item: string;
  count: number | null;
  lengthM: number | null;
  areaM2: number | null;
  weightT: number | null;
}

export interface SteelPlatformPackage {
  schema: "architoken.steel_platform_design_package.v1";
  moduleId: "detailed_design";
  sourceArchive: string;
  reviewState: SteelPlatformReviewState;
  units: {
    length: "mm";
    area: "m2";
    weight: "t";
  };
  plan: {
    projectId: string;
    projectName: string;
    floors: 1 | 2;
    outlinePolygon: SteelPlatformPoint[];
    blocks: SteelPlatformPlanBlock[];
    summary: {
      envelope: [number, number];
      grossAreaSqm: number;
      blockCount: number;
    };
  };
  settings: SteelPlatformSettings;
  structuralLayout: {
    grid: {
      xAxes: number[];
      yAxes: number[];
      levels: number;
    };
    columns: SteelPlatformColumn[];
    mainBeams: SteelPlatformBeam[];
    constructionColumns: SteelPlatformConstructionColumn[];
    constructionColumnGroups: SteelPlatformConstructionColumnGroup[];
    wallBays: SteelPlatformWallBay[];
    exteriorOpenings: SteelPlatformOpening[];
    interiorWalls: SteelPlatformInteriorWall[];
    removedInteriorWallIds: string[];
    floorSlabs: Array<{
      id: string;
      floor: number;
      polygon: SteelPlatformPoint[];
      areaSqm: number;
    }>;
    roof: {
      type: SteelPlatformSettings["roofType"];
      ridgeAxis: SteelPlatformSettings["roofRidgeAxis"];
      slopeDeg: number;
      eaveOverhangMm: number;
      purlinSpacingMm: number;
      baseZ: number;
      projectionAreaSqm: number;
      surfaceAreaSqm: number;
      purlinLengthM: number;
    };
    envelope: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      widthMm: number;
      depthMm: number;
    };
  };
  bom: {
    schema: "architoken.steel_platform_bom.v1";
    rows: SteelPlatformBomRow[];
    summary: {
      totalSteelT: number;
      totalMemberCount: number;
      floorAreaM2: number;
      roofAreaM2: number;
    };
  };
  ruleChecks: Array<{
    id: string;
    title: string;
    status: "passed" | SteelPlatformReviewState;
    sourceRef: string;
  }>;
  aiGateChain: Array<{
    name:
      | "Planner"
      | "Generator"
      | "Evaluator"
      | "RuleChecker"
      | "SchemaValidator"
      | "Approver";
    status: "passed" | "pending" | SteelPlatformReviewState;
  }>;
}

export interface SteelPlatformPackageOptions {
  outlinePolygon?: SteelPlatformPoint[];
  openings?: SteelPlatformOpening[];
  interiorDoors?: SteelPlatformInteriorDoor[];
  removedInteriorWallIds?: string[];
}

const STEEL_DENSITY_KG_M3 = 7850;

export const steelPlatformDefaultSettings: SteelPlatformSettings = {
  modulusMm: 300,
  maxSpanMm: 4800,
  floorHeightMm: 3000,
  mainColumnSection: "150x150x7x10",
  mainBeamSection: "150x194x6x9",
  constructionColumnSection: "40x40x2",
  interiorWallSection: "40x40x2",
  roofType: "双坡",
  roofRidgeAxis: "X",
  roofSlopeDeg: 25,
  eaveOverhangMm: 600,
  purlinSpacingMm: 900,
  constructionColumnEnabled: true,
  interiorWallEnabled: true,
  constructionColumnFirstOffsetMm: 250,
  constructionColumnSecondOffsetMm: 600,
  constructionColumnSpacingMm: 600,
};

export function createSteelPlatformPackage(
  plan: GeneratedPlan,
  settings: Partial<SteelPlatformSettings> = {},
  options: SteelPlatformPackageOptions = {},
): SteelPlatformPackage {
  const resolvedSettings = {
    ...steelPlatformDefaultSettings,
    ...settings,
  };
  const blocks = plan.blocks.map((block) => ({
    id: block.id,
    purpose: block.purpose,
    polygon: block.polygon.map((point) => ({ x: point.x, y: point.y })),
    areaSqm: block.areaSqm,
    floor: block.floor,
  }));
  const outlinePolygon =
    options.outlinePolygon && options.outlinePolygon.length >= 4
      ? options.outlinePolygon
      : outlineFromBlocks(blocks);
  const structuralLayout = deriveStructuralLayout(
    outlinePolygon,
    blocks,
    plan.floors,
    resolvedSettings,
    options,
  );
  const bom = computeSteelPlatformBom(structuralLayout, resolvedSettings);
  return {
    schema: "architoken.steel_platform_design_package.v1",
    moduleId: "detailed_design",
    sourceArchive: "user-supplied steel-platform-full.zip",
    reviewState: "professional_review_required",
    units: {
      length: "mm",
      area: "m2",
      weight: "t",
    },
    plan: {
      projectId: plan.projectId,
      projectName: plan.projectName,
      floors: plan.floors,
      outlinePolygon,
      blocks,
      summary: {
        envelope: plan.summary.envelope,
        grossAreaSqm: round2(
          blocks.reduce((sum, block) => sum + block.areaSqm, 0),
        ),
        blockCount: blocks.length,
      },
    },
    settings: resolvedSettings,
    structuralLayout,
    bom,
    ruleChecks: ruleChecks(outlinePolygon, structuralLayout, resolvedSettings),
    aiGateChain: [
      { name: "Planner", status: "passed" },
      { name: "Generator", status: "passed" },
      { name: "Evaluator", status: "passed" },
      { name: "RuleChecker", status: "professional_review_required" },
      { name: "SchemaValidator", status: "passed" },
      { name: "Approver", status: "pending" },
    ],
  };
}

function deriveStructuralLayout(
  outlinePolygon: SteelPlatformPoint[],
  blocks: SteelPlatformPlanBlock[],
  floors: 1 | 2,
  settings: SteelPlatformSettings,
  options: SteelPlatformPackageOptions,
): SteelPlatformPackage["structuralLayout"] {
  const [minX, minY, maxX, maxY] = bounds(outlinePolygon);
  const envelope = {
    minX,
    minY,
    maxX,
    maxY,
    widthMm: maxX - minX,
    depthMm: maxY - minY,
  };
  const xAxes = gridLines(minX, maxX, settings.maxSpanMm, settings.modulusMm);
  const yAxes = gridLines(minY, maxY, settings.maxSpanMm, settings.modulusMm);
  const columns: SteelPlatformColumn[] = [];
  const mainBeams: SteelPlatformBeam[] = [];

  for (let floor = 1; floor <= floors; floor += 1) {
    const zBase = (floor - 1) * settings.floorHeightMm;
    xAxes.forEach((x, xIndex) => {
      yAxes.forEach((y, yIndex) => {
        if (!pointInsideOrOn({ x, y }, outlinePolygon)) return;
        const gridId = `${axisLetter(xIndex)}${yIndex + 1}`;
        columns.push({
          id: `C-${gridId}-F${floor}`,
          gridId,
          floor,
          section: settings.mainColumnSection,
          location: [x, y, zBase + settings.floorHeightMm / 2],
          netLengthMm: settings.floorHeightMm - 36,
        });
      });
    });

    const levelId = floor < floors ? `F${floor + 1}` : "FR";
    const z = floor * settings.floorHeightMm - 97;
    yAxes.forEach((y, yIndex) => {
      for (let xIndex = 0; xIndex < xAxes.length - 1; xIndex += 1) {
        const x1 = xAxes[xIndex];
        const x2 = xAxes[xIndex + 1];
        if (x1 === undefined || x2 === undefined) continue;
        if (!segmentInside({ x: x1, y }, { x: x2, y }, outlinePolygon))
          continue;
        mainBeams.push({
          id: `B-X-${axisLetter(xIndex)}${axisLetter(xIndex + 1)}-${yIndex + 1}-F${floor}`,
          axis: "X",
          floor,
          levelId,
          section: settings.mainBeamSection,
          from: [x1, y],
          to: [x2, y],
          midpoint: [(x1 + x2) / 2, y, z],
          netLengthMm: Math.max(0, Math.abs(x2 - x1) - 150),
          rotationDeg: 0,
        });
      }
    });
    xAxes.forEach((x, xIndex) => {
      for (let yIndex = 0; yIndex < yAxes.length - 1; yIndex += 1) {
        const y1 = yAxes[yIndex];
        const y2 = yAxes[yIndex + 1];
        if (y1 === undefined || y2 === undefined) continue;
        if (!segmentInside({ x, y: y1 }, { x, y: y2 }, outlinePolygon))
          continue;
        mainBeams.push({
          id: `B-Y-${axisLetter(xIndex)}-${yIndex + 1}${yIndex + 2}-F${floor}`,
          axis: "Y",
          floor,
          levelId,
          section: settings.mainBeamSection,
          from: [x, y1],
          to: [x, y2],
          midpoint: [x, (y1 + y2) / 2, z],
          netLengthMm: Math.max(0, Math.abs(y2 - y1) - 150),
          rotationDeg: 90,
        });
      }
    });
  }

  const wallBays = wallBaysFromOutline(outlinePolygon, xAxes, yAxes, floors);
  const exteriorOpenings = normalizeOpenings(options.openings ?? [], wallBays);
  const constructionColumnGroups = settings.constructionColumnEnabled
    ? constructionColumnGroupsFromBays(wallBays, exteriorOpenings, settings)
    : [];
  const constructionColumns = constructionColumnsFromGroups(
    constructionColumnGroups,
    settings,
  );
  const interiorWalls = settings.interiorWallEnabled
    ? interiorWallsFromBlocks(
        blocks,
        outlinePolygon,
        options.interiorDoors ?? [],
        options.removedInteriorWallIds ?? [],
        exteriorOpenings,
        settings,
      )
    : [];
  const slabArea = round2(polygonArea(outlinePolygon) / 1_000_000);
  const roofSurfaceArea = round2(
    slabArea *
      (settings.roofType === "平"
        ? 1
        : 1 / Math.cos((Math.PI / 180) * settings.roofSlopeDeg)),
  );
  const roofPurlinLengthM = round2(
    estimateRoofPurlinLength(outlinePolygon, settings) / 1000,
  );
  return {
    grid: { xAxes, yAxes, levels: floors + 1 },
    columns,
    mainBeams,
    constructionColumns,
    constructionColumnGroups,
    wallBays,
    exteriorOpenings,
    interiorWalls,
    removedInteriorWallIds: options.removedInteriorWallIds ?? [],
    floorSlabs: Array.from({ length: floors }, (_, index) => ({
      id: `FS-F${index + 1}`,
      floor: index + 1,
      polygon: outlinePolygon,
      areaSqm: slabArea,
    })),
    roof: {
      type: settings.roofType,
      ridgeAxis: settings.roofRidgeAxis,
      slopeDeg: settings.roofSlopeDeg,
      eaveOverhangMm: settings.eaveOverhangMm,
      purlinSpacingMm: settings.purlinSpacingMm,
      baseZ: floors * settings.floorHeightMm,
      projectionAreaSqm: slabArea,
      surfaceAreaSqm: roofSurfaceArea,
      purlinLengthM: roofPurlinLengthM,
    },
    envelope,
  };
}

function computeSteelPlatformBom(
  layout: SteelPlatformPackage["structuralLayout"],
  settings: SteelPlatformSettings,
): SteelPlatformPackage["bom"] {
  const columnLengthMm = layout.columns.reduce(
    (sum, column) => sum + column.netLengthMm,
    0,
  );
  const beamLengthMm = layout.mainBeams.reduce(
    (sum, beam) => sum + beam.netLengthMm,
    0,
  );
  const constructionLengthMm = layout.constructionColumns.reduce(
    (sum, column) => sum + column.heightMm,
    0,
  );
  const interiorLengthMm = layout.interiorWalls
    .filter((wall) => !wall.removed)
    .reduce(
      (sum, wall) =>
        sum + wall.columnLocations.length * (settings.floorHeightMm - 194),
      0,
    );
  const floorAreaM2 = round2(
    layout.floorSlabs.reduce((sum, slab) => sum + slab.areaSqm, 0),
  );
  const exteriorWallAreaM2 = round2(
    layout.wallBays.reduce(
      (sum, bay) =>
        sum + (bay.lengthMm * (settings.floorHeightMm - 194)) / 1_000_000,
      0,
    ),
  );
  const openingAreaM2 = round2(
    layout.exteriorOpenings.reduce(
      (sum, opening) => sum + (opening.widthMm * opening.heightMm) / 1_000_000,
      0,
    ),
  );
  const interiorWallAreaM2 = round2(
    layout.interiorWalls
      .filter((wall) => !wall.removed)
      .reduce(
        (sum, wall) =>
          sum + (wall.lengthMm * (settings.floorHeightMm - 194)) / 1_000_000,
        0,
      ),
  );
  const roofAreaM2 = round2(layout.roof.surfaceAreaSqm);
  const rows: SteelPlatformBomRow[] = [
    bomSteelRow(
      "主体结构",
      `钢柱 ${settings.mainColumnSection}`,
      layout.columns.length,
      columnLengthMm,
      settings.mainColumnSection,
    ),
    bomSteelRow(
      "主体结构",
      `主梁 ${settings.mainBeamSection}`,
      layout.mainBeams.length,
      beamLengthMm,
      settings.mainBeamSection,
    ),
    bomSteelRow(
      "围护骨架",
      `构造柱 ${settings.constructionColumnSection}`,
      layout.constructionColumns.length,
      constructionLengthMm,
      settings.constructionColumnSection,
    ),
    bomSteelRow(
      "内墙龙骨",
      `内墙竖龙骨 ${settings.interiorWallSection}`,
      layout.interiorWalls.reduce(
        (sum, wall) => sum + (wall.removed ? 0 : wall.columnLocations.length),
        0,
      ),
      interiorLengthMm,
      settings.interiorWallSection,
    ),
    {
      category: "楼板",
      item: "楼承板+混凝土叠合层",
      count: layout.floorSlabs.length,
      lengthM: null,
      areaM2: floorAreaM2,
      weightT: null,
    },
    {
      category: "围护板材",
      item: "外墙 ALC/围护板",
      count: null,
      lengthM: null,
      areaM2: round2(Math.max(0, exteriorWallAreaM2 - openingAreaM2)),
      weightT: null,
    },
    {
      category: "围护洞口",
      item: "门窗洞口",
      count: layout.exteriorOpenings.length,
      lengthM: null,
      areaM2: openingAreaM2,
      weightT: null,
    },
    {
      category: "内墙",
      item: "内墙板/基层",
      count: layout.interiorWalls.filter((wall) => !wall.removed).length,
      lengthM: null,
      areaM2: interiorWallAreaM2,
      weightT: null,
    },
    {
      category: "围护板材",
      item: "屋面板",
      count: null,
      lengthM: null,
      areaM2: roofAreaM2,
      weightT: null,
    },
    {
      category: "屋面系统",
      item: `檩条 C160x60x3 @${settings.purlinSpacingMm}`,
      count: null,
      lengthM: layout.roof.purlinLengthM,
      areaM2: null,
      weightT: null,
    },
  ];
  return {
    schema: "architoken.steel_platform_bom.v1",
    rows,
    summary: {
      totalSteelT: round3(
        rows.reduce((sum, row) => sum + (row.weightT ?? 0), 0),
      ),
      totalMemberCount:
        layout.columns.length +
        layout.mainBeams.length +
        layout.constructionColumns.length +
        layout.interiorWalls.reduce(
          (sum, wall) => sum + (wall.removed ? 0 : wall.columnLocations.length),
          0,
        ),
      floorAreaM2,
      roofAreaM2,
    },
  };
}

function ruleChecks(
  outlinePolygon: SteelPlatformPoint[],
  layout: SteelPlatformPackage["structuralLayout"],
  settings: SteelPlatformSettings,
): SteelPlatformPackage["ruleChecks"] {
  return [
    {
      id: "grid-modulus",
      title: "300mm 模数检查",
      status: allPointsOnModulus(outlinePolygon, settings.modulusMm)
        ? "passed"
        : "professional_review_required",
      sourceRef: "项目模数规则 / 经验规则",
    },
    {
      id: "member-span",
      title: "主梁跨距上限",
      status: layout.mainBeams.every(
        (beam) => beam.netLengthMm <= settings.maxSpanMm,
      )
        ? "passed"
        : "professional_review_required",
      sourceRef: "GB 50017 / 结构工程师复核",
    },
    {
      id: "steel-bom",
      title: "钢构件 BOM 完整性",
      status:
        layout.columns.length > 0 && layout.mainBeams.length > 0
          ? "passed"
          : "professional_review_required",
      sourceRef: "生产制造移交规则",
    },
    {
      id: "opening-enclosure",
      title: "门窗与围护同步",
      status:
        layout.exteriorOpenings.every((opening) =>
          layout.wallBays.some((bay) => bay.id === opening.bayId),
        ) &&
        layout.interiorWalls.every(
          (wall) => wall.lengthMm >= settings.modulusMm * 4,
        )
          ? "passed"
          : "professional_review_required",
      sourceRef: "外墙 bay / 内墙龙骨启发式校验",
    },
    {
      id: "professional-signoff",
      title: "结构与施工责任复核",
      status: "professional_review_required",
      sourceRef: "注册结构工程师 / 设计总工签审",
    },
  ];
}

function outlineFromBlocks(
  blocks: SteelPlatformPlanBlock[],
): SteelPlatformPoint[] {
  const points = blocks.flatMap((block) => block.polygon);
  const [minX, minY, maxX, maxY] = bounds(points);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function gridLines(
  start: number,
  end: number,
  maxSpan: number,
  modulus: number,
): number[] {
  const length = Math.max(0, end - start);
  if (length <= 0) return [start];
  const segments = Math.max(1, Math.ceil(length / maxSpan));
  const spacing = Math.max(
    modulus,
    Math.round(length / segments / modulus) * modulus,
  );
  const lines = [start];
  let current = start;
  while (current + spacing < end - modulus) {
    current += spacing;
    lines.push(Math.round(current));
  }
  if (lines.at(-1) !== end) lines.push(end);
  return lines;
}

function bounds(
  points: SteelPlatformPoint[],
): [number, number, number, number] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function polygonArea(points: SteelPlatformPoint[]): number {
  const signedArea =
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return next ? sum + point.x * next.y - next.x * point.y : sum;
    }, 0) / 2;
  return Math.abs(signedArea);
}

function pointInsideOrOn(
  point: SteelPlatformPoint,
  polygon: SteelPlatformPoint[],
): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (!a || !b) continue;
    if (pointOnSegment(point, a, b)) return true;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnSegment(
  point: SteelPlatformPoint,
  a: SteelPlatformPoint,
  b: SteelPlatformPoint,
): boolean {
  const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > 1e-6) return false;
  return (
    point.x >= Math.min(a.x, b.x) - 1e-6 &&
    point.x <= Math.max(a.x, b.x) + 1e-6 &&
    point.y >= Math.min(a.y, b.y) - 1e-6 &&
    point.y <= Math.max(a.y, b.y) + 1e-6
  );
}

function segmentInside(
  a: SteelPlatformPoint,
  b: SteelPlatformPoint,
  polygon: SteelPlatformPoint[],
): boolean {
  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    pointInsideOrOn(a, polygon) &&
    pointInsideOrOn(b, polygon) &&
    pointInsideOrOn(midpoint, polygon)
  );
}

function wallBaysFromOutline(
  outlinePolygon: SteelPlatformPoint[],
  xAxes: number[],
  yAxes: number[],
  floors: 1 | 2,
): SteelPlatformWallBay[] {
  const bays: SteelPlatformWallBay[] = [];
  const [minX, minY, maxX, maxY] = bounds(outlinePolygon);
  for (let floor = 1; floor <= floors; floor += 1) {
    outlinePolygon.forEach((start, edgeIndex) => {
      const end = outlinePolygon[(edgeIndex + 1) % outlinePolygon.length];
      if (!end) return;
      const axis: "X" | "Y" =
        Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "X" : "Y";
      const side = wallSideForEdge(start, end, { minX, minY, maxX, maxY });
      const splitValues = axis === "X" ? xAxes : yAxes;
      const a = axis === "X" ? start.x : start.y;
      const b = axis === "X" ? end.x : end.y;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const values = [
        lo,
        ...splitValues.filter((value) => value > lo && value < hi),
        hi,
      ]
        .sort((left, right) => left - right)
        .filter(
          (value, index, list) =>
            index === 0 || Math.abs(value - list[index - 1]!) > 1e-6,
        );
      for (let index = 0; index < values.length - 1; index += 1) {
        const v1 = values[index]!;
        const v2 = values[index + 1]!;
        const bayStart =
          axis === "X" ? { x: v1, y: start.y } : { x: start.x, y: v1 };
        const bayEnd = axis === "X" ? { x: v2, y: end.y } : { x: end.x, y: v2 };
        const orientedStart = a <= b ? bayStart : bayEnd;
        const orientedEnd = a <= b ? bayEnd : bayStart;
        const lengthMm = distance(orientedStart, orientedEnd);
        if (lengthMm < 300) continue;
        bays.push({
          id: `WB-${side}-E${edgeIndex + 1}-${index + 1}-F${floor}`,
          wallSide: side,
          floor,
          start: orientedStart,
          end: orientedEnd,
          axis,
          lengthMm,
        });
      }
    });
  }
  return bays;
}

function wallSideForEdge(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  box: { minX: number; minY: number; maxX: number; maxY: number },
): SteelPlatformWallSide {
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dx >= dy) {
    return Math.abs(mid.y - box.minY) <= Math.abs(mid.y - box.maxY)
      ? "south"
      : "north";
  }
  return Math.abs(mid.x - box.minX) <= Math.abs(mid.x - box.maxX)
    ? "west"
    : "east";
}

function normalizeOpenings(
  openings: SteelPlatformOpening[],
  wallBays: SteelPlatformWallBay[],
): SteelPlatformOpening[] {
  return openings.reduce<SteelPlatformOpening[]>((acc, opening, index) => {
    const bay =
      wallBays.find((candidate) => candidate.id === opening.bayId) ??
      nearestBayForOpening(opening, wallBays);
    if (!bay) return acc;
    acc.push({
      ...opening,
      id: opening.id || `OP-${index + 1}`,
      bayId: bay.id,
      wallSide: bay.wallSide,
      centerMm: clamp(
        opening.centerMm,
        bayAxisMin(bay) + opening.widthMm / 2,
        bayAxisMax(bay) - opening.widthMm / 2,
      ),
      floor: bay.floor,
    });
    return acc;
  }, []);
}

function nearestBayForOpening(
  opening: SteelPlatformOpening,
  wallBays: SteelPlatformWallBay[],
): SteelPlatformWallBay | undefined {
  const candidates = wallBays.filter(
    (bay) => bay.wallSide === opening.wallSide && bay.floor === opening.floor,
  );
  return candidates
    .map((bay) => ({
      bay,
      distance: Math.abs(
        opening.centerMm - (bayAxisMin(bay) + bayAxisMax(bay)) / 2,
      ),
    }))
    .sort((left, right) => left.distance - right.distance)
    .at(0)?.bay;
}

function constructionColumnGroupsFromBays(
  wallBays: SteelPlatformWallBay[],
  openings: SteelPlatformOpening[],
  settings: SteelPlatformSettings,
): SteelPlatformConstructionColumnGroup[] {
  return wallBays.map((bay) => ({
    id: `CCG-${bay.id}`,
    wallSide: bay.wallSide,
    floor: bay.floor,
    start: bay.start,
    end: bay.end,
    axis: bay.axis,
    columnLocations: columnLocationsOnSegment(
      bay.start,
      bay.end,
      settings.constructionColumnFirstOffsetMm,
      settings.constructionColumnSecondOffsetMm,
      settings.constructionColumnSpacingMm,
    ),
    openings: openings.filter((opening) => opening.bayId === bay.id),
  }));
}

function constructionColumnsFromGroups(
  groups: SteelPlatformConstructionColumnGroup[],
  settings: SteelPlatformSettings,
): SteelPlatformConstructionColumn[] {
  const columns: SteelPlatformConstructionColumn[] = [];
  groups.forEach((group) => {
    const zBase = (group.floor - 1) * settings.floorHeightMm;
    group.columnLocations.forEach((point, index) => {
      columns.push({
        id: `CC-${group.id}-${index + 1}`,
        floor: group.floor,
        section: settings.constructionColumnSection,
        location: [
          round2(point.x),
          round2(point.y),
          zBase + (settings.floorHeightMm - 194) / 2,
        ],
        heightMm: settings.floorHeightMm - 194,
        groupId: group.id,
      });
    });
  });
  return columns;
}

function interiorWallsFromBlocks(
  blocks: SteelPlatformPlanBlock[],
  outlinePolygon: SteelPlatformPoint[],
  doors: SteelPlatformInteriorDoor[],
  removedIds: string[],
  openings: SteelPlatformOpening[],
  settings: SteelPlatformSettings,
): SteelPlatformInteriorWall[] {
  const candidateMap = new Map<
    string,
    {
      floor: number;
      start: SteelPlatformPoint;
      end: SteelPlatformPoint;
      axis: "X" | "Y";
      count: number;
    }
  >();
  for (const block of blocks) {
    for (let index = 0; index < block.polygon.length; index += 1) {
      const start = block.polygon[index]!;
      const end = block.polygon[(index + 1) % block.polygon.length]!;
      const lengthMm = distance(start, end);
      if (lengthMm < settings.modulusMm * 4) continue;
      if (segmentOnPolygonBoundary(start, end, outlinePolygon)) continue;
      const axis: "X" | "Y" =
        Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "X" : "Y";
      const key = segmentKey(start, end, block.floor);
      const existing = candidateMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        candidateMap.set(key, {
          floor: block.floor,
          start,
          end,
          axis,
          count: 1,
        });
      }
    }
  }
  return Array.from(candidateMap.values())
    .filter((candidate) => candidate.count >= 1)
    .map((candidate, index) => {
      const id = `IW-F${candidate.floor}-${index + 1}`;
      const door = doors.find((item) => item.wallId === id);
      return {
        id,
        floor: candidate.floor,
        start: candidate.start,
        end: candidate.end,
        axis: candidate.axis,
        lengthMm: distance(candidate.start, candidate.end),
        removed: removedIds.includes(id),
        hitExteriorOpening: wallHitsExteriorOpening(candidate, openings),
        ...(door ? { door } : {}),
        columnLocations: columnLocationsOnSegment(
          candidate.start,
          candidate.end,
          settings.constructionColumnFirstOffsetMm,
          settings.constructionColumnSecondOffsetMm,
          settings.constructionColumnSpacingMm,
        ),
      };
    });
}

function columnLocationsOnSegment(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  firstOffset: number,
  secondOffset: number,
  spacing: number,
): SteelPlatformPoint[] {
  const length = distance(start, end);
  if (length < firstOffset * 2) return [];
  const offsets = [firstOffset, secondOffset];
  for (
    let current = secondOffset + spacing;
    current < length - firstOffset;
    current += spacing
  ) {
    offsets.push(current);
  }
  return offsets
    .filter((offset) => offset > 0 && offset < length)
    .map((offset) => interpolate(start, end, offset / length));
}

function segmentOnPolygonBoundary(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  polygon: SteelPlatformPoint[],
): boolean {
  return polygon.some((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return next ? segmentCollinearContained(start, end, point, next) : false;
  });
}

function segmentCollinearContained(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  boundaryStart: SteelPlatformPoint,
  boundaryEnd: SteelPlatformPoint,
): boolean {
  return (
    pointOnSegment(start, boundaryStart, boundaryEnd) &&
    pointOnSegment(end, boundaryStart, boundaryEnd)
  );
}

function wallHitsExteriorOpening(
  wall: {
    floor: number;
    start: SteelPlatformPoint;
    end: SteelPlatformPoint;
    axis: "X" | "Y";
  },
  openings: SteelPlatformOpening[],
): boolean {
  return openings.some((opening) => {
    if (opening.floor !== wall.floor) return false;
    const openingMin = opening.centerMm - opening.widthMm / 2;
    const openingMax = opening.centerMm + opening.widthMm / 2;
    return [wall.start, wall.end].some((point) => {
      const axisValue =
        opening.wallSide === "south" || opening.wallSide === "north"
          ? point.x
          : point.y;
      return axisValue >= openingMin && axisValue <= openingMax;
    });
  });
}

function estimateRoofPurlinLength(
  outlinePolygon: SteelPlatformPoint[],
  settings: SteelPlatformSettings,
): number {
  const [minX, minY, maxX, maxY] = bounds(outlinePolygon);
  const width = maxX - minX + settings.eaveOverhangMm * 2;
  const depth = maxY - minY + settings.eaveOverhangMm * 2;
  const along = settings.roofRidgeAxis === "X" ? width : depth;
  const across = settings.roofRidgeAxis === "X" ? depth : width;
  const multiplier =
    settings.roofType === "平"
      ? 1
      : 1 / Math.cos((Math.PI / 180) * settings.roofSlopeDeg);
  const count = Math.max(2, Math.ceil(across / settings.purlinSpacingMm) + 1);
  return along * count * multiplier;
}

function distance(a: SteelPlatformPoint, b: SteelPlatformPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function interpolate(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  ratio: number,
): SteelPlatformPoint {
  return {
    x: round2(start.x + (end.x - start.x) * ratio),
    y: round2(start.y + (end.y - start.y) * ratio),
  };
}

function segmentKey(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  floor: number,
): string {
  const a = `${round2(start.x)},${round2(start.y)}`;
  const b = `${round2(end.x)},${round2(end.y)}`;
  return `${floor}:${[a, b].sort().join("|")}`;
}

function bayAxisMin(bay: SteelPlatformWallBay): number {
  return bay.axis === "X"
    ? Math.min(bay.start.x, bay.end.x)
    : Math.min(bay.start.y, bay.end.y);
}

function bayAxisMax(bay: SteelPlatformWallBay): number {
  return bay.axis === "X"
    ? Math.max(bay.start.x, bay.end.x)
    : Math.max(bay.start.y, bay.end.y);
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function bomSteelRow(
  category: string,
  item: string,
  count: number,
  lengthMm: number,
  section: string,
): SteelPlatformBomRow {
  const lengthM = lengthMm / 1000;
  return {
    category,
    item,
    count,
    lengthM: round2(lengthM),
    areaM2: null,
    weightT: round3((sectionKgPerM(section) * lengthM) / 1000),
  };
}

function sectionKgPerM(section: string): number {
  const parts = section
    .toLowerCase()
    .replaceAll("x", "×")
    .split("×")
    .map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 4) {
    const [h, b, tw, tf] = parts as [number, number, number, number];
    return (
      (2 * b * tf + Math.max(0, h - 2 * tf) * tw) * 1e-6 * STEEL_DENSITY_KG_M3
    );
  }
  if (parts.length === 3) {
    const [w, h, t] = parts as [number, number, number];
    return (
      (w * h - Math.max(0, w - 2 * t) * Math.max(0, h - 2 * t)) *
      1e-6 *
      STEEL_DENSITY_KG_M3
    );
  }
  return 0;
}

function allPointsOnModulus(
  points: SteelPlatformPoint[],
  modulus: number,
): boolean {
  return points.every(
    (point) =>
      Math.abs(point.x % modulus) < 1e-6 && Math.abs(point.y % modulus) < 1e-6,
  );
}

function axisLetter(index: number): string {
  if (index < 26) return String.fromCharCode("A".charCodeAt(0) + index);
  return `A${index - 25}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
