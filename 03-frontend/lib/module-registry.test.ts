// lib/module-registry.test.ts
// License: Apache-2.0
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { moduleSpecs, normalizeModuleId } from "./module-registry";

// The published module contract (schemas/module.schema.json) is the source of
// truth for module identity/routing (#4). Every registered module must satisfy
// it, so a registry change that breaks the contract fails here, not in prod.
const moduleSchema = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../schemas/module.schema.json",
    ),
    "utf8",
  ),
) as {
  required: string[];
  properties: {
    id: { pattern: string };
    routeHref: { pattern: string };
    schemaRef: { pattern: string };
  };
};

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

describe("moduleSpecs conform to schemas/module.schema.json (#4)", () => {
  const idPattern = new RegExp(moduleSchema.properties.id.pattern);
  const routePattern = new RegExp(moduleSchema.properties.routeHref.pattern);
  const schemaRefPattern = new RegExp(
    moduleSchema.properties.schemaRef.pattern,
  );

  it("declares the same module count as routes derived from ids", () => {
    expect(moduleSpecs.length).toBeGreaterThan(0);
  });

  for (const spec of moduleSpecs) {
    it(`module ${spec.id} satisfies the published module schema`, () => {
      for (const key of moduleSchema.required) {
        expect(
          spec[key as keyof typeof spec],
          `${spec.id} missing required field "${key}"`,
        ).toBeDefined();
      }
      expect(spec.id).toMatch(idPattern);
      expect(Number.isInteger(spec.order)).toBe(true);
      expect(spec.routeHref).toMatch(routePattern);
      expect(spec.schemaRef).toMatch(schemaRefPattern);
      // Routing/schema references must be derived from the canonical id.
      expect(spec.routeHref).toBe(`/app/modules/${spec.id}`);
      expect(spec.schemaRef.startsWith(`module.schema/${spec.id}.v`)).toBe(true);
    });
  }
});
