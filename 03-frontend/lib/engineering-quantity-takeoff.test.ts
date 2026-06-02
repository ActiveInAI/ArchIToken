// lib/engineering-quantity-takeoff.test.ts - Quantity takeoff route contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  engineeringQuantityTakeoffRoutes,
  quantityTakeoffCanIssueUnreviewedFinal,
  quantityTakeoffRouteForExtension,
  quantityTakeoffRouteForFileName,
  requestedEngineeringQuantityExtensions,
} from "./engineering-quantity-takeoff";

describe("engineering quantity takeoff routes", () => {
  it("covers every requested CAD drawing and BIM model format", () => {
    for (const extension of requestedEngineeringQuantityExtensions) {
      expect(
        quantityTakeoffRouteForExtension(extension),
        extension,
      ).toBeTruthy();
    }
  });

  it("keeps 2D CAD and PDF takeoff as review-required drafts", () => {
    for (const extension of [".dwg", ".dxf", ".pdf"]) {
      const route = quantityTakeoffRouteForExtension(extension);

      expect(route?.canAutoCalculate, extension).toBe(false);
      expect(route?.outputStatus, extension).toBe("manual_review_required");
      expect(route?.requiredEvidence.join(" "), extension).toMatch(
        /scale|比例|calibration/i,
      );
      expect(route?.blockedUses.join(" "), extension).toMatch(
        /screenshot|raster|pixel|OCR/i,
      );
    }
  });

  it("requires semantic or licensed adapters for BIM quantity takeoff", () => {
    expect(quantityTakeoffRouteForExtension(".ifc")?.canAutoCalculate).toBe(
      true,
    );
    expect(
      quantityTakeoffRouteForExtension(".ifc")?.requiredAdapters,
    ).toContain("IFCDB-Agent quantity service");

    for (const extension of [".rvt", ".skp"]) {
      const route = quantityTakeoffRouteForExtension(extension);

      expect(route?.outputStatus, extension).toBe("licensed_adapter_required");
      expect(route?.blockedUses.join(" "), extension).toContain("GLB fallback");
    }
  });

  it("separates B-Rep geometry measures from STL mesh measurement", () => {
    for (const extension of [".3dm", ".step", ".igs"]) {
      const route = quantityTakeoffRouteForExtension(extension);

      expect(route?.mode, extension).toBe("brep_kernel_quantity");
      expect(route?.requiredAdapters.join(" "), extension).toMatch(
        /OCCT|OpenNURBS/,
      );
      expect(route?.blockedUses.join(" "), extension).toContain("viewer mesh");
    }

    const stl = quantityTakeoffRouteForFileName("part.stl");
    expect(stl?.mode).toBe("mesh_measurement");
    expect(stl?.outputStatus).toBe("manual_review_required");
    expect(stl?.requiredEvidence.join(" ")).toContain("watertightness");
  });

  it("never emits unreviewed final quantities from the registry", () => {
    for (const route of engineeringQuantityTakeoffRoutes) {
      expect(quantityTakeoffCanIssueUnreviewedFinal(route), route.id).toBe(
        false,
      );
    }
  });
});
