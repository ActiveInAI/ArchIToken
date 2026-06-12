import { describe, expect, it } from "vitest";

import { resolvePanAITaskType } from "../panai-workbench-chat";
import {
  buildFloorplanRenderPrompt,
  rasterizeFloorplanLineartPng,
  resolveRenderStyle,
} from "./floorplan-control-image";
import {
  createPlanCandidates,
  initialIntent,
  parsePromptToIntent,
} from "./floorplan-layout";

function samplePlan(prompt = "生成120平三室两厅的户型") {
  const intent = parsePromptToIntent(prompt, initialIntent);
  const candidate = createPlanCandidates(intent)[0];
  if (!candidate) throw new Error("no plan candidates generated");
  return candidate.plan;
}

describe("rasterizeFloorplanLineartPng", () => {
  it("emits a valid grayscale PNG with black walls on white background", () => {
    const png = rasterizeFloorplanLineartPng(samplePlan());
    expect(
      png.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    expect(width).toBeGreaterThanOrEqual(256);
    expect(width).toBeLessThanOrEqual(1024);
    expect(height).toBeGreaterThanOrEqual(256);
    expect(height).toBeLessThanOrEqual(1024);
    expect(png.readUInt8(25)).toBe(0); // grayscale color type
  });

  it("is deterministic for the same plan", () => {
    const plan = samplePlan();
    expect(
      rasterizeFloorplanLineartPng(plan).equals(
        rasterizeFloorplanLineartPng(plan),
      ),
    ).toBe(true);
  });

  it("rejects floors without blocks", () => {
    const plan = samplePlan("生成80平两室一厅一层的户型");
    expect(plan.floors).toBe(1);
    expect(() => rasterizeFloorplanLineartPng(plan, { floor: 2 })).toThrow(
      /floor 2/,
    );
  });
});

describe("buildFloorplanRenderPrompt", () => {
  it("pins layout fidelity and forwards the style request", () => {
    const prompt = buildFloorplanRenderPrompt(
      samplePlan(),
      "现代简约风格，木地板",
    );
    expect(prompt).toContain("保持墙体布局");
    expect(prompt).toContain("现代简约风格");
    expect(prompt).toContain("主卧");
  });

  it("expands style presets and falls back to a default style", () => {
    expect(resolveRenderStyle("做一个新中式的家")).toContain("水墨屏风");
    expect(resolveRenderStyle("奶油风三室两厅")).toContain("奶白色");
    expect(resolveRenderStyle("随便来一套")).toContain("现代简约");
  });
});

describe("工作台芯片合成指令路由", () => {
  it("候选切换芯片指令仍走 floorplan_suite", () => {
    expect(
      resolvePanAITaskType("生成一个L形100平三室两厅的户型，全套，候选B"),
    ).toBe("floorplan_suite");
  });

  it("风格芯片指令走 floorplan_render 且预设正确解析", () => {
    const prompt = "生成一个L形100平三室两厅的户型，全套，户型效果图，北欧风格";
    expect(resolvePanAITaskType(prompt)).toBe("floorplan_render");
    expect(resolveRenderStyle(prompt)).toContain("北欧");
  });
});

describe("floorplan_render intent routing", () => {
  it("routes 户型+效果图 prompts to floorplan_render", () => {
    expect(resolvePanAITaskType("生成120平三室两厅的户型效果图")).toBe(
      "floorplan_render",
    );
    expect(resolvePanAITaskType("把这个三室两厅户型渲染成现代风格")).toBe(
      "floorplan_render",
    );
  });

  it("keeps plain 户型 and plain 效果图 on their own routes", () => {
    expect(resolvePanAITaskType("生成120平三室两厅的户型")).toBe(
      "floorplan_suite",
    );
    expect(resolvePanAITaskType("生成一张厂房效果图")).toBe("text_to_image");
  });
});
