// lib/engineering-viewer-capabilities.test.ts - Viewer capability contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  engineeringViewerCanClaimCompleteImplementation,
  engineeringViewerCapabilityForContract,
  engineeringViewerCapabilityRowsForFileName,
  engineeringViewerContractForExtension,
  engineeringViewerContractForFileName,
  engineeringViewerFormatContracts,
  requestedEngineeringViewerExtensions,
  requiredEngineeringViewerCapabilityIds,
  summarizeEngineeringViewerCapabilities,
} from "./engineering-viewer-capabilities";

describe("engineering viewer capability contracts", () => {
  it("covers every requested CAD drawing and BIM model format", () => {
    for (const extension of requestedEngineeringViewerExtensions) {
      expect(
        engineeringViewerContractForExtension(extension),
        extension,
      ).toBeTruthy();
    }
  });

  it("declares every required capability for each format contract", () => {
    for (const contract of engineeringViewerFormatContracts) {
      for (const capabilityId of requiredEngineeringViewerCapabilityIds) {
        const declared = contract.capabilities.find(
          (item) => item.id === capabilityId,
        );

        expect(declared, `${contract.id}:${capabilityId}`).toBeTruthy();
      }
    }
  });

  it("keeps DWG/DXF on the MLightCAD runtime and does not claim full CAD semantics", () => {
    const contract = engineeringViewerContractForExtension(".dwg");

    expect(contract?.runtime).toBe("mlightcad");
    expect(
      engineeringViewerCapabilityForContract(contract!, "source_fidelity")
        .status,
    ).toBe("implemented");
    expect(
      engineeringViewerCapabilityForContract(contract!, "source_axis_grid")
        .status,
    ).toBe("partial");
    expect(
      engineeringViewerCapabilityForContract(contract!, "quantity_takeoff")
        .status,
    ).toBe("partial");
    expect(engineeringViewerCanClaimCompleteImplementation(contract!)).toBe(
      false,
    );
  });

  it("separates semantic BIM, licensed BIM, B-Rep, mesh, and OpenUSD routes", () => {
    expect(engineeringViewerContractForExtension(".ifc")?.runtime).toBe(
      "web_ifc",
    );
    expect(engineeringViewerContractForExtension(".rvt")?.runtime).toBe(
      "licensed_adapter",
    );
    expect(engineeringViewerContractForExtension(".step")?.runtime).toBe(
      "occt",
    );
    expect(engineeringViewerContractForExtension(".stl")?.family).toBe(
      "mesh_model",
    );
    expect(engineeringViewerContractForExtension(".usdz")?.runtime).toBe(
      "three_usd",
    );
    expect(engineeringViewerContractForExtension(".fbx")?.id).toBe(
      "legacy-obj-fbx-mesh",
    );
    expect(engineeringViewerContractForExtension(".obj")?.runtime).toBe(
      "three_exchange",
    );
  });

  it("routes tileset.json through the 3D Tiles contract", () => {
    const contract = engineeringViewerContractForFileName("tileset.json");

    expect(contract?.id).toBe("3d-tiles-scene");
  });

  it("exposes property rows for the unified attribute panel", () => {
    const rows = engineeringViewerCapabilityRowsForFileName("sample.ifc");
    const labels = rows.map((row) => row.label);

    expect(labels).toContain("统一能力契约");
    expect(labels).toContain("单位");
    expect(labels).toContain("方向/网格");
    expect(labels).toContain("工程量解析");
  });

  it("does not falsely claim complete implementation while adapters remain required", () => {
    for (const contract of engineeringViewerFormatContracts) {
      const summary = summarizeEngineeringViewerCapabilities(contract);

      expect(summary.totalApplicable, contract.id).toBeGreaterThan(0);
      expect(
        engineeringViewerCanClaimCompleteImplementation(contract),
        contract.id,
      ).toBe(false);
    }
  });
});
