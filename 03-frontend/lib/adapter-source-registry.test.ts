// lib/adapter-source-registry.test.ts - Adapter source registry contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  adapterRequirementForExtension,
  adapterSourceById,
  adapterSourceByUrl,
  adapterSourceRegistry,
  adapterSourcesForFileName,
  formatAdapterRequirements,
  requestedAdapterSourceUrls,
  requiredAdaptersForFileName,
} from "./adapter-source-registry";

describe("adapter source registry", () => {
  it("keeps every requested upstream URL registered exactly once", () => {
    const registeredUrls = new Set(
      adapterSourceRegistry.map((source) => source.url),
    );

    for (const url of requestedAdapterSourceUrls) {
      expect(registeredUrls.has(url), url).toBe(true);
    }

    expect(registeredUrls.size).toBe(adapterSourceRegistry.length);
  });

  it("keeps proprietary desktop ecosystems license gated", () => {
    expect(adapterSourceByUrl("https://github.com/Autodesk")?.decision).toBe(
      "licensed_gated",
    );
    expect(
      adapterSourceByUrl("https://github.com/TrimbleSolutionsCorporation")
        ?.decision,
    ).toBe("licensed_gated");
    expect(adapterSourceByUrl("https://github.com/mcneel")?.decision).toBe(
      "licensed_gated",
    );
    expect(
      adapterSourceByUrl(
        "https://developer.tekla.com/documentation/get-started-tekla-structures-open-api",
      )?.decision,
    ).toBe("licensed_gated");
  });

  it("keeps copyleft applications behind an external process boundary", () => {
    expect(adapterSourceById("blender")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("erpnext")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("cadam")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("triplit")?.decision).toBe(
      "selected_external_process",
    );
  });

  it("uses capability-first decisions and isolation instead of license-first demotion", () => {
    expect(adapterSourceById("forgecad")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("speckle-server")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("unstructured")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("marker")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("onlyoffice-documentserver")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("libredwg")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("mlightcad-cad-viewer")?.decision).toBe(
      "selected",
    );
    expect(adapterSourceById("mlightcad-libredwg-web")?.decision).toBe(
      "blocked_pending_license",
    );
    expect(adapterSourceById("impertio-studio-openaec")?.decision).toBe(
      "selected_external_process",
    );
    expect(
      adapterSourceById("impertio-studio-repository-index")?.decision,
    ).toBe("selected_external_process");
    expect(adapterSourceById("openai-symphony")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("openai-organization")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("opencsg-cimd")?.decision).toBe("licensed_gated");
    expect(adapterSourceById("opencsg-cimd")?.category).toBe("dataset");
    expect(adapterSourceById("sketchup-ifc-manager")?.decision).toBe(
      "selected_external_process",
    );
    expect(adapterSourceById("sketchup-ifc-manager")?.license).toContain(
      "GPL",
    );
    expect(adapterSourceById("yulio-sketchup-gltf-exporter")?.license).toBe(
      "MIT",
    );
    expect(adapterSourceById("sketchup-ruby-model-api")?.decision).toBe(
      "licensed_gated",
    );
  });

  it("selects AntV and Univer for diagram and Office editing routes", () => {
    expect(adapterSourceByUrl("https://github.com/antvis")?.decision).toBe(
      "selected",
    );
    expect(
      adapterSourceByUrl(
        "https://github.com/dream-num/univer/blob/dev/docs/readme/zh-CN.md",
      )?.license,
    ).toBe("Apache-2.0");
    expect(
      adapterSourcesForFileName("sheet.xlsx").map((source) => source.id),
    ).toContain("dream-num-univer");
    expect(
      adapterSourcesForFileName("flow.mmd").map((source) => source.id),
    ).toContain("antvis");
  });

  it("routes core file formats to concrete adapter requirements", () => {
    expect(requiredAdaptersForFileName("model.ifc")).toContain(
      "IfcOpenShell worker",
    );
    expect(requiredAdaptersForFileName("sheet.xlsx")).toContain(
      "Excelize sidecar",
    );
    expect(requiredAdaptersForFileName("sheet.xlsx")).toContain(
      "Univer Sheets editing service",
    );
    expect(requiredAdaptersForFileName("part.step")).toContain("OCCT worker");
    expect(requiredAdaptersForFileName("drawing.dwg")).toContain(
      "MLightCAD cad-simple-viewer",
    );
    expect(requiredAdaptersForFileName("drawing.dwg")).toContain(
      "MLightCAD LibreDWG Web GPL-3.0 WASM boundary",
    );
    expect(requiredAdaptersForFileName("model.rvt")).toContain(
      "Autodesk APS/Revit adapter",
    );
    expect(requiredAdaptersForFileName("scene.glb")).toContain(
      "Three.js viewer",
    );
    expect(requiredAdaptersForFileName("scene.blend")).toContain(
      "Blender external process",
    );
    expect(requiredAdaptersForFileName("script.dyn")).toContain(
      "Dynamo licensed runtime",
    );
    expect(requiredAdaptersForFileName("issue.bcfzip")).toContain(
      "buildingSMART contract",
    );
    expect(requiredAdaptersForFileName("handover.idm")).toContain(
      "IDM exchange requirement manifest",
    );
    expect(requiredAdaptersForFileName("audio.wav")).toContain(
      "ASR/TTS provider",
    );
  });

  it("covers import, online edit, AI generation, and export routes for each format family", () => {
    expect(formatAdapterRequirements.length).toBeGreaterThan(10);

    for (const requirement of formatAdapterRequirements) {
      expect(requirement.extensions.length, requirement.family).toBeGreaterThan(
        0,
      );
      expect(requirement.adapters.length, requirement.family).toBeGreaterThan(
        0,
      );
      expect(requirement.sourceIds.length, requirement.family).toBeGreaterThan(
        0,
      );
      expect(requirement.importRoute, requirement.family).toBeTruthy();
      expect(requirement.onlineEditRoute, requirement.family).toBeTruthy();
      expect(requirement.aiGenerationRoute, requirement.family).toBeTruthy();
      expect(requirement.exportRoute, requirement.family).toBeTruthy();
    }
  });

  it("links extension routes back to registered source records", () => {
    expect(
      adapterSourcesForFileName("model.ifc").map((source) => source.id),
    ).toContain("ifcopenshell");
    expect(
      adapterSourcesForFileName("handover.idm").map((source) => source.id),
    ).toContain("buildingsmart-idm");
    expect(
      adapterSourcesForFileName("part.step").map((source) => source.id),
    ).toContain("occt");
    expect(
      adapterSourcesForFileName("sheet.xlsx").map((source) => source.id),
    ).toContain("excelize");
    expect(
      adapterSourcesForFileName("model.skp").map((source) => source.id),
    ).toEqual(
      expect.arrayContaining([
        "sketchup-ifc-manager",
        "yulio-sketchup-gltf-exporter",
        "sketchup-ruby-model-api",
        "speckle-sketchup",
      ]),
    );
    expect(adapterRequirementForExtension(".rvt")?.status).toBe(
      "licensed_adapter_required",
    );
  });
});
