// lib/panai-native-url.test.ts
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import { resolvePanAINativeUrl } from "./panai-native-url";

describe("resolvePanAINativeUrl", () => {
  it("uses the current ArchIToken host for the native PanAI WebUI by default", () => {
    expect(
      resolvePanAINativeUrl({
        location: { protocol: "http:", hostname: "192.168.1.100" },
      }),
    ).toBe(
      "http://192.168.1.100:25808/#/guid?architokenHost=1&preselectAgentKey=aionrs",
    );
  });

  it("falls back to localhost when no browser location is available", () => {
    expect(resolvePanAINativeUrl()).toBe(
      "http://127.0.0.1:25808/#/guid?architokenHost=1&preselectAgentKey=aionrs",
    );
  });

  it("adds the ArchIToken native context to configured native PanAI routes", () => {
    expect(
      resolvePanAINativeUrl({
        configuredUrl: "http://127.0.0.1:25808/#/guid",
      }),
    ).toBe(
      "http://127.0.0.1:25808/#/guid?architokenHost=1&preselectAgentKey=aionrs",
    );
  });

  it("adds the PanAI guide route to configured base urls", () => {
    expect(
      resolvePanAINativeUrl({
        configuredUrl: "http://127.0.0.1:25808/",
      }),
    ).toBe(
      "http://127.0.0.1:25808/#/guid?architokenHost=1&preselectAgentKey=aionrs",
    );
  });

  it("does not overwrite explicit native route agent selection", () => {
    expect(
      resolvePanAINativeUrl({
        configuredUrl:
          "http://127.0.0.1:25808/#/guid?preselectAgentKey=custom",
      }),
    ).toBe(
      "http://127.0.0.1:25808/#/guid?preselectAgentKey=custom&architokenHost=1",
    );
  });
});
