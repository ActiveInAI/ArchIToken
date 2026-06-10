// lib/theme-registry.test.ts - ArchIToken appearance registry contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";

import {
  archThemes,
  defaultArchThemeId,
  getArchTheme,
  normalizeArchThemeId,
} from "./theme-registry";
import {
  archFonts,
  defaultArchFontId,
  getArchFont,
  normalizeArchFontId,
} from "./font-registry";

describe("appearance registry contract", () => {
  it("keeps wechat_light as the default white/gray/green theme", () => {
    expect(defaultArchThemeId).toBe("wechat_light");
    expect(getArchTheme(defaultArchThemeId)).toMatchObject({
      id: "wechat_light",
      description: expect.stringContaining("白色业务界面"),
    });
    expect(normalizeArchThemeId("industrial_dark")).toBe("huly_dark");
    expect(normalizeArchThemeId("unknown_theme")).toBe("wechat_light");
    expect(archThemes.map((theme) => theme.id)).toEqual([
      "wechat_light",
      "huly_light",
      "huly_dark",
      "huly_system",
    ]);
  });

  it("keeps font density separate from theme identity", () => {
    expect(defaultArchFontId).toBe("huly_spacious");
    expect(archFonts.map((font) => font.id)).toEqual([
      "huly_spacious",
      "huly_compact",
    ]);
    expect(getArchFont("huly_compact")).toMatchObject({
      hulyClass: "small-font",
      baseFontSize: 13,
    });
    expect(normalizeArchFontId("harmonyos_sans")).toBe("huly_spacious");
    expect(normalizeArchFontId("unknown_font")).toBe("huly_spacious");
  });
});
