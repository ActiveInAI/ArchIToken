// lib/module-registry.test.ts
// License: Apache-2.0
import { describe, expect, it } from "vitest";

import { normalizeModuleId } from "./module-registry";

describe("normalizeModuleId — module baseline rename (#3)", () => {
  it("keeps production_manufacturing as the canonical module id", () => {
    expect(normalizeModuleId("production_manufacturing")).toBe(
      "production_manufacturing",
    );
  });

  it("aliases retired manufacturing/fabrication ids to production_manufacturing", () => {
    for (const legacy of [
      "manufacturing",
      "fabrication",
      "Fabrication",
      "MANUFACTURING",
    ]) {
      expect(normalizeModuleId(legacy)).toBe("production_manufacturing");
    }
  });

  it("still resolves the existing finance_hr alias", () => {
    expect(normalizeModuleId("finance_hr")).toBe("finance_management");
  });

  it("returns null for unknown ids", () => {
    expect(normalizeModuleId("not_a_module")).toBeNull();
  });
});
