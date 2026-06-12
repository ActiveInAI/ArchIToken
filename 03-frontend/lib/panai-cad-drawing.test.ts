// lib/panai-cad-drawing.test.ts
// License: Apache-2.0

import { describe, expect, it } from "vitest";

import {
  parseCadDrawingSpec,
  renderCadDrawingDxf,
  validateCadDrawingEntities,
} from "./panai-cad-drawing";
import {
  resolvePanAITaskType,
} from "./panai-workbench-chat";
import { extractIssueTitle, resolveBimCollabAction } from "./panai-bim-collab";

describe("parseCadDrawingSpec", () => {
  it("parses a room plan with double-line walls and a size label", () => {
    const spec = parseCadDrawingSpec("画一个10米x6米的房间平面图");
    expect(spec).not.toBeNull();
    expect(spec!.metadata.parser).toBe("heuristic");
    const polylines = spec!.entities.filter((e) => e.type === "polyline");
    expect(polylines).toHaveLength(2);
    expect(polylines[0]).toMatchObject({ closed: true, layer: "WALL" });
    expect(spec!.entities.some((e) => e.type === "text")).toBe(true);
  });

  it("parses a circle by radius in millimetres", () => {
    const spec = parseCadDrawingSpec("画一个半径500mm的圆");
    expect(spec).not.toBeNull();
    const circle = spec!.entities.find((e) => e.type === "circle");
    expect(circle).toMatchObject({ radius: 500 });
  });

  it("parses an axis grid with span count and spacing", () => {
    const spec = parseCadDrawingSpec("画一个4x3跨轴网，跨距8米");
    expect(spec).not.toBeNull();
    const lines = spec!.entities.filter((e) => e.type === "line");
    expect(lines).toHaveLength(4 + 1 + (3 + 1));
  });

  it("rejects prompts that are not drawing instructions", () => {
    expect(parseCadDrawingSpec("帮我总结一下本周施工进度")).toBeNull();
  });
});

describe("renderCadDrawingDxf", () => {
  it("emits a complete R12 DXF document", () => {
    const spec = parseCadDrawingSpec("画一个10米x6米的房间平面图")!;
    const dxf = renderCadDrawingDxf(spec);
    expect(dxf).toContain("AC1009");
    expect(dxf).toContain("ENTITIES");
    expect(dxf).toContain("POLYLINE");
    expect(dxf).toContain("SEQEND");
    expect(dxf.trim().endsWith("EOF")).toBe(true);
  });
});

describe("validateCadDrawingEntities", () => {
  it("accepts well-formed entities", () => {
    const entities = validateCadDrawingEntities([
      { type: "line", start: [0, 0], end: [100, 0] },
      { type: "circle", center: [0, 0], radius: 50 },
    ]);
    expect(entities).toHaveLength(2);
  });

  it("rejects malformed and oversized payloads", () => {
    expect(validateCadDrawingEntities([{ type: "circle", radius: -1 }])).toBeNull();
    expect(validateCadDrawingEntities([])).toBeNull();
    expect(validateCadDrawingEntities("not-an-array")).toBeNull();
  });
});

describe("PanAI task routing for the new assistants", () => {
  it("routes drawing prompts to cad_drawing", () => {
    expect(resolvePanAITaskType("画一个10米x6米的房间平面图")).toBe(
      "cad_drawing",
    );
    expect(resolvePanAITaskType("随便聊聊", "panai:cad-drawing")).toBe(
      "cad_drawing",
    );
  });

  it("routes BIM prompts to bim_collab", () => {
    expect(resolvePanAITaskType("统计IFC模型的构件数量")).toBe("bim_collab");
    expect(resolvePanAITaskType("创建议题：三层管线碰撞需复核")).toBe(
      "bim_collab",
    );
  });

  it("keeps existing routes intact", () => {
    expect(resolvePanAITaskType("生成一个长2米直径50mm的钢管")).toBe(
      "cad_model",
    );
    expect(resolvePanAITaskType("画一张小狗的图片")).toBe("text_to_image");
    expect(resolvePanAITaskType("今天天气怎么样")).toBe("chat");
  });
});

describe("BIM collab helpers", () => {
  it("resolves issue actions", () => {
    expect(resolveBimCollabAction("创建议题：管线碰撞")).toBe("create_issue");
    expect(resolveBimCollabAction("列出所有议题")).toBe("list_issues");
    expect(resolveBimCollabAction("分析模型楼层信息")).toBe("model_summary");
  });

  it("extracts issue titles", () => {
    expect(extractIssueTitle("创建议题：三层管线碰撞需复核")).toBe(
      "三层管线碰撞需复核",
    );
    expect(extractIssueTitle("新建议题「幕墙节点缺审批」")).toBe(
      "幕墙节点缺审批",
    );
  });
});
