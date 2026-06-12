import { describe, expect, it } from "vitest";

import { renderCadDrawingDxf } from "../panai-cad-drawing";
import {
  isPanAIFloorplanSuiteIntent,
  isPanAITextToBimIntent,
  resolvePanAITaskType,
} from "../panai-workbench-chat";
import {
  floorplanToDrawingSpec,
  renderFloorplanColorSvg,
} from "./floorplan-drawing";
import {
  buildFurniture,
  createPlanCandidates,
  initialIntent,
  parsePromptToIntent,
} from "./floorplan-layout";
import {
  floorplanToBimSpec,
  validateTextToBimSpec,
} from "./text-to-bim-spec";

function samplePlan(prompt = "生成120平三室两厅双卫的户型") {
  const intent = parsePromptToIntent(prompt, initialIntent);
  const candidates = createPlanCandidates(intent);
  return candidates.reduce((best, item) =>
    item.score > best.score ? item : best,
  ).plan;
}

describe("floorplanToDrawingSpec", () => {
  it("renders walls, axis grid, openings, dimensions, frame and labels", () => {
    const plan = samplePlan();
    const spec = floorplanToDrawingSpec(plan);
    const layers = new Set(
      spec.entities.map((entity) => entity.layer ?? "GEOM"),
    );
    for (const layer of ["WALL", "AXIS", "TEXT", "DOOR", "WINDOW", "DIM", "FRAME"]) {
      expect(layers.has(layer), `missing layer ${layer}`).toBe(true);
    }
    // 双线墙：每个房间 4 边 × 2 条线起步（洞口会增加门垛短线）。
    const wallLines = spec.entities.filter(
      (entity) => entity.type === "line" && entity.layer === "WALL",
    );
    expect(wallLines.length).toBeGreaterThanOrEqual(
      plan.summary.blockCount * 8,
    );
    // 门：开启弧线 + 门扇线。
    const doorArcs = spec.entities.filter(
      (entity) => entity.type === "arc" && entity.layer === "DOOR",
    );
    expect(doorArcs.length).toBeGreaterThanOrEqual(3);
    // 窗：外墙三线符号。
    const windowLines = spec.entities.filter(
      (entity) => entity.layer === "WINDOW",
    );
    expect(windowLines.length).toBeGreaterThanOrEqual(3);
    // 尺寸标注：轴间距数字文本。
    const dimTexts = spec.entities.filter(
      (entity) => entity.type === "text" && entity.layer === "DIM",
    );
    expect(dimTexts.length).toBeGreaterThanOrEqual(4);
    // 图签：状态行声明需专业复核。
    const labels = spec.entities.filter((entity) => entity.type === "text");
    expect(
      labels.some(
        (entity) => entity.type === "text" && entity.value.includes("主卧"),
      ),
    ).toBe(true);
    expect(
      labels.some(
        (entity) =>
          entity.type === "text" && entity.value.includes("需专业复核"),
      ),
    ).toBe(true);
  });

  it("produces a parseable, ASCII-only DXF document", () => {
    const dxf = renderCadDrawingDxf(floorplanToDrawingSpec(samplePlan()));
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("ENTITIES");
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
    // 中文以 \U+XXXX 转义写出，文件保持纯 ASCII，外部 CAD 不再有码页歧义。
    expect([...dxf].every((ch) => (ch.codePointAt(0) ?? 0) < 128)).toBe(true);
    expect(dxf).toContain("\\U+4E3B"); // 主
  });

  it("lays out two-floor plans side by side", () => {
    const plan = samplePlan("生成140平四室两厅两层的户型");
    expect(plan.floors).toBe(2);
    const spec = floorplanToDrawingSpec(plan);
    const [envW] = plan.summary.envelope;
    const maxX = Math.max(
      ...spec.entities.flatMap((entity) =>
        entity.type === "line"
          ? [entity.start[0], entity.end[0]]
          : entity.type === "polyline"
            ? entity.points.map((point) => point[0])
            : [],
      ),
    );
    expect(maxX).toBeGreaterThan(envW);
  });
});

describe("renderFloorplanColorSvg", () => {
  it("renders colored rooms, furniture and a review footer", () => {
    const plan = samplePlan();
    const svg = renderFloorplanColorSvg(plan, buildFurniture(plan));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("主卧");
    expect(svg).toContain("㎡");
    expect(svg).toContain("需专业复核");
    expect(svg).toContain("床");
  });
});

describe("floorplanToBimSpec", () => {
  it("derives slabs and deduplicated walls with positive metric sizes", () => {
    const plan = samplePlan();
    const spec = floorplanToBimSpec(plan);
    const slabs = spec.elements.filter((element) => element.type === "Slab");
    const walls = spec.elements.filter((element) => element.type === "Wall");
    // 楼板按房间铺设：板数 = 房间数，板面积之和 = 房间面积之和（不虚增板量）。
    expect(slabs.length).toBe(plan.summary.blockCount);
    const slabArea = slabs.reduce(
      (sum, slab) => sum + (slab.size?.[0] ?? 0) * (slab.size?.[1] ?? 0),
      0,
    );
    const roomArea = plan.blocks.reduce((sum, block) => sum + block.areaSqm, 0);
    expect(Math.abs(slabArea - roomArea)).toBeLessThan(1);
    expect(walls.length).toBeGreaterThan(plan.summary.blockCount);
    for (const element of spec.elements) {
      expect(element.size).toBeDefined();
      for (const value of element.size ?? []) {
        expect(value).toBeGreaterThan(0);
      }
    }
    // round-trip through the wire-format validator used for the LLM path
    expect(validateTextToBimSpec(JSON.parse(JSON.stringify(spec)))).not.toBeNull();
  });

  it("attaches door and window openings to walls (shared with the drawing line)", () => {
    const spec = floorplanToBimSpec(samplePlan());
    const openings = spec.elements.flatMap((element) => element.openings ?? []);
    const doors = openings.filter((opening) => opening.kind === "door");
    const windows = openings.filter((opening) => opening.kind === "window");
    expect(doors.length).toBeGreaterThanOrEqual(5);
    expect(windows.length).toBeGreaterThanOrEqual(4);
    for (const opening of openings) {
      for (const value of opening.size) expect(value).toBeGreaterThan(0);
    }
    // 门高 2.1m、窗高 1.5m
    expect(new Set(doors.map((door) => door.size[2]))).toEqual(new Set([2.1]));
    expect(new Set(windows.map((win) => win.size[2]))).toEqual(new Set([1.5]));
  });
});

describe("L-shaped massing", () => {
  it("parses L形 prompts and produces a single-floor L plan with an outdoor notch", () => {
    const intent = parsePromptToIntent(
      "生成一个L形100平三室两厅的户型",
      initialIntent,
    );
    expect(intent.massing).toBe("l_shape");
    expect(intent.floors).toBe(1);
    const plan = createPlanCandidates(intent)[0]!.plan;
    expect(plan.intentLabel).toContain("L形");
    // 东北缺角：包络面积大于房间矩形并集（存在室外缺口）。
    const blockArea = plan.blocks.reduce((sum, block) => sum + block.areaSqm, 0);
    expect(plan.summary.envelopeSqm).toBeGreaterThan(blockArea + 2);
    // 缺角边上的房间仍能开窗（外墙判定基于无邻接而非包络盒）。
    const spec = floorplanToBimSpec(plan);
    const windows = spec.elements.flatMap((element) =>
      (element.openings ?? []).filter((opening) => opening.kind === "window"),
    );
    expect(windows.length).toBeGreaterThanOrEqual(4);
  });
});

describe("validateTextToBimSpec", () => {
  it("rejects malformed element vectors", () => {
    expect(
      validateTextToBimSpec({
        name: "bad",
        elements: [{ type: "Wall", size: [1, -1, 2] }],
      }),
    ).toBeNull();
    expect(
      validateTextToBimSpec({
        name: "bad",
        elements: [{ type: "Wall", position: [1, 2] }],
      }),
    ).toBeNull();
    expect(validateTextToBimSpec({ name: "empty", elements: [] })).toBeNull();
  });

  it("accepts minimal proxy elements without geometry", () => {
    const spec = validateTextToBimSpec({
      name: "占位",
      elements: [{ type: "GenericElement" }],
    });
    expect(spec?.elements[0]?.type).toBe("GenericElement");
  });
});

describe("PanAI intent routing for generation suite", () => {
  it("routes 户型 prompts to floorplan_suite", () => {
    expect(resolvePanAITaskType("生成120平三室两厅的户型")).toBe(
      "floorplan_suite",
    );
    expect(resolvePanAITaskType("出一张90平两室一厅的彩平图")).toBe(
      "floorplan_suite",
    );
    expect(isPanAIFloorplanSuiteIntent("帮我做个四室两厅的套型方案")).toBe(
      true,
    );
  });

  it("routes 模型生成 prompts to text_to_bim ahead of bim_collab and cad_model", () => {
    expect(resolvePanAITaskType("文字生成模型：一面9米长的墙")).toBe(
      "text_to_bim",
    );
    expect(resolvePanAITaskType("生成一个三室两厅的户型模型")).toBe(
      "text_to_bim",
    );
    expect(resolvePanAITaskType("帮我创建一个IFC模型")).toBe("text_to_bim");
    expect(isPanAITextToBimIntent("text to bim: simple wall")).toBe(true);
  });

  it("keeps existing routes intact", () => {
    expect(resolvePanAITaskType("画一个10米x6米的房间平面图")).toBe(
      "cad_drawing",
    );
    expect(resolvePanAITaskType("统计当前IFC模型的构件数量")).toBe(
      "bim_collab",
    );
    expect(resolvePanAITaskType("生成一根半径50毫米长3米的钢管")).toBe(
      "cad_model",
    );
  });
});
