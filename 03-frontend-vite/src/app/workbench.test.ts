import { describe, expect, it } from "vitest";
import { routePaths, workbenchRoutes } from "../data/navigation";
import { assetKinds, conversionOperations, viewerCommandKinds } from "../lib/runtimeIntegrations";

describe("Phase 7 workbench shell", () => {
  it("exposes the requested primary routes", () => {
    expect(routePaths).toEqual([
      "/assets",
      "/ai",
      "/openbim",
      "/cad",
      "/gis",
      "/documents",
      "/gantt",
      "/flow",
      "/runtime",
      "/admin",
    ]);
  });

  it("keeps route metadata explicit for navigation", () => {
    expect(workbenchRoutes.every((route) => route.label && route.summary)).toBe(true);
  });

  it("keeps universal asset and conversion contracts visible", () => {
    expect(assetKinds).toContain("ifc");
    expect(assetKinds).toContain("point_cloud");
    expect(assetKinds).toContain("panorama");
    expect(conversionOperations).toContain("ifc_to_3dtiles");
    expect(conversionOperations).toContain("media_transcode");
  });

  it("includes Phase 7 universal viewer commands", () => {
    expect(viewerCommandKinds).toContain("load_3d_tiles");
    expect(viewerCommandKinds).toContain("sync_panorama_camera");
  });
});
