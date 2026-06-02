// lib/code-as-room.test.ts - Code-as-Room detailed design contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  buildCodeAsRoomRunManifest,
  codeAsRoomArtifacts,
  codeAsRoomScenes,
  codeAsRoomStages,
  generateCodeAsRoomDesignCandidates,
} from "./code-as-room";

describe("code-as-room detailed design fixtures", () => {
  it("models the released Stage0-12 pipeline and render artifact", () => {
    expect(codeAsRoomStages).toHaveLength(13);
    expect(codeAsRoomStages[0]?.index).toBe(0);
    expect(codeAsRoomStages.at(-1)?.output).toBe(
      "stage12_render/render_output.py",
    );
    expect(codeAsRoomStages.map((stage) => stage.index)).toEqual(
      Array.from({ length: 13 }, (_, index) => index),
    );
    expect(codeAsRoomArtifacts.map((artifact) => artifact.name)).toContain(
      "render_output.py",
    );
  });

  it("builds a professional-review run manifest for detailed design", () => {
    const manifest = buildCodeAsRoomRunManifest("living-room");

    expect(manifest.schema).toBe("architoken.code_as_room_run.v1");
    expect(manifest.moduleId).toBe("detailed_design");
    expect(manifest.reviewState).toBe("professional_review_required");
    expect(manifest.upstream.repository).toBe(
      "https://github.com/YxuanAr/Code-as-Room",
    );
    expect(manifest.finalBlenderScript).toContain("IncrementalLayoutEngine");
    expect(manifest.memory.map((entry) => entry.stage)).toContain("stage12");
  });

  it("keeps scenes connected to input images, objects, and walkthrough videos", () => {
    for (const scene of codeAsRoomScenes) {
      expect(scene.inputImageUrl).toMatch(/^https?:\/\//);
      expect(scene.videoUrl).toMatch(/\.mp4$/);
      expect(scene.objects.length).toBeGreaterThanOrEqual(7);
      expect(scene.sceneGraph.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("generates AI design candidates with router and Blender code evidence", () => {
    const candidates = generateCodeAsRoomDesignCandidates({
      prompt: "现代卧室，保留俯视图布局，补齐书桌、衣柜、绿植和灯光",
      mode: "render",
      sourceImageName: "bedroom-plan.png",
    });

    expect(candidates).toHaveLength(3);
    expect(candidates[0]?.route).toContain("ModelRouter");
    expect(candidates[0]?.manifest.finalBlenderScript).toContain(
      "setup_camera_and_lighting",
    );
    expect(candidates[0]?.manifest.scene.roomType).toContain("bedroom");
    expect(candidates[0]?.designNotes.join(" ")).toContain("bedroom-plan.png");
  });
});
