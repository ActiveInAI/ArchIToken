// lib/ai-native-renderer-registry.test.ts - AI Native renderer contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import {
  aiNativeRendererById,
  aiNativeRendererPackageNames,
  aiNativeRendererRoutes,
  disallowedLegacyRendererPackages,
  selectedAiNativeRendererIds,
} from "./ai-native-renderer-registry";

const packageEntries: Record<string, string | undefined> = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

describe("AI Native renderer registry", () => {
  it("selects the approved PanUI and open-source renderer stack", () => {
    expect(new Set(selectedAiNativeRendererIds)).toEqual(
      new Set([
        "pan-ui",
        "d3",
        "xyflow-react",
        "mermaid",
        "bpmn-js",
        "three-webgpu",
      ]),
    );
  });

  it("keeps the selected renderer packages installed in the frontend workspace", () => {
    for (const packageName of aiNativeRendererPackageNames) {
      expect(packageEntries[packageName], packageName).toBeTruthy();
    }
  });

  it("keeps legacy UI and graph runtime packages out of the frontend workspace", () => {
    for (const packageName of disallowedLegacyRendererPackages) {
      expect(packageEntries[packageName], packageName).toBeUndefined();
    }
  });

  it("keeps every route behind schema, audit, approval and renderer boundaries", () => {
    for (const route of aiNativeRendererRoutes) {
      expect(route.rendererBoundary, route.id).toBe("RendererRegistry");
      expect(route.structuredInputSchema.length, route.id).toBeGreaterThan(8);
      expect(route.generatedArtifactSchema.length, route.id).toBeGreaterThan(8);
      expect(route.aiNativeContract.schemaValidated, route.id).toBe(true);
      expect(route.aiNativeContract.auditLogged, route.id).toBe(true);
      expect(route.aiNativeContract.approvalAware, route.id).toBe(true);
      expect(route.aiNativeContract.businessLogicSeparated, route.id).toBe(true);
    }
  });

  it("records current GitHub adoption evidence without making stars the only criterion", () => {
    expect(aiNativeRendererById("d3").githubStarsSnapshot[0]?.stars).toBeGreaterThan(100000);
    expect(aiNativeRendererById("mermaid").githubStarsSnapshot[0]?.stars).toBeGreaterThan(80000);
    expect(aiNativeRendererById("three-webgpu").githubStarsSnapshot[0]?.stars).toBeGreaterThan(100000);
    expect(aiNativeRendererById("pan-ui").githubStarsSnapshot[0]?.stars).toBe(0);
    expect(aiNativeRendererById("pan-ui").decision).toContain("owned");
  });
});
