// app/api/local-files/[fileId]/native-open/route.test.ts - Native open route contracts
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import { engineeringNativePublicOriginFromRequest } from "@/lib/engineering-native-session-server";
import { nativeExternalAppsFor, nativeRoutesFor } from "./route";

describe("native open routes", () => {
  const sourceUrl = "/api/local-files/local-format-smoke";

  it("opens STL through the STL mesh runtime instead of OCCT", () => {
    const routes = nativeRoutesFor(".stl", sourceUrl);

    expect(routes[0]?.id).toBe("stl-native-mesh-open");
    expect(routes[0]?.viewer).toBe("three-stl-source-mesh-property-editor");
    expect(routes[0]?.status).toBe("ready");
    expect(routes[0]?.id).not.toBe("occt-native-open");
  });

  it("declares source-bound OpenUSD/USDZ inspection plus worker boundary", () => {
    const routes = nativeRoutesFor(".usdz", sourceUrl);

    expect(routes[0]?.id).toBe("openusd-source-runtime");
    expect(routes[0]?.viewer).toBe("three-usd-source-runtime");
    expect(routes[0]?.status).toBe("ready");
    expect(routes[0]).toMatchObject({
      sourceUrl,
      outputs: ["openusd", "usdz", "glb", "properties-index"],
    });
  });

  it("declares source-bound OBJ and FBX mesh runtimes", () => {
    expect(nativeRoutesFor(".obj", sourceUrl)[0]).toMatchObject({
      id: "obj-source-mesh-open",
      status: "ready",
      viewer: "three-obj-source-mesh-property-editor",
      sourceUrl,
    });
    expect(nativeRoutesFor(".fbx", sourceUrl)[0]).toMatchObject({
      id: "fbx-source-mesh-open",
      status: "ready",
      viewer: "three-fbx-source-mesh-property-editor",
      sourceUrl,
    });
  });

  it("exposes embedded FreeCAD and Blender workbench routes for engineering formats", () => {
    expect(nativeExternalAppsFor(".step").map((route) => route.app)).toContain(
      "freecad",
    );
    expect(nativeExternalAppsFor(".blend").map((route) => route.app)).toContain(
      "blender",
    );
    expect(nativeExternalAppsFor(".glb").map((route) => route.app)).toContain(
      "blender",
    );
    expect(nativeExternalAppsFor(".ifc").map((route) => route.app)).toEqual([
      "freecad",
    ]);
    expect(nativeExternalAppsFor(".dwg")).toEqual([]);
    expect(nativeExternalAppsFor(".step")[0]).toMatchObject({
      mode: "embedded",
      launch: { body: { app: "freecad", mode: "embedded" } },
    });
  });

  it("prefers the configured LAN public base URL for native session callbacks", () => {
    const previous = process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://192.168.1.100:3000";
    try {
      expect(
        engineeringNativePublicOriginFromRequest(
          "http://127.0.0.1:3000/api/local-files/example/native-open",
        ),
      ).toBe("http://192.168.1.100:3000");
    } finally {
      if (previous === undefined) {
        delete process.env.ARCHITOKEN_PUBLIC_BASE_URL;
      } else {
        process.env.ARCHITOKEN_PUBLIC_BASE_URL = previous;
      }
    }
  });
});
