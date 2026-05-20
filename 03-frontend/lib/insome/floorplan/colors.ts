import type { FloorplanScheme, FloorplanTheme, SchemeColors } from "./schema";

/**
 * Phase 4.0 fix: standard scheme inverts based on theme so the floorplan
 * stays legible against its canvas background:
 *   - Studio canvas bg = #1F1F1F (dark)  → strokes / rooms / furniture in light tones
 *   - Home   canvas bg = #FAFAFA (light) → strokes / rooms / furniture in dark tones
 *
 * `pastel` and `contrast` are explicit warm/yellow palettes and intentionally
 * ignore the theme (designer choice, not auto-inverted).
 */
export function resolveSchemeColors(
  scheme: FloorplanScheme,
  theme: FloorplanTheme,
): SchemeColors {
  const accent = theme === "studio" ? "#D4FF3A" : "#FF4B1F";
  if (scheme === "pastel") {
    return {
      bg: "#FFF4E6",
      stroke: "#0A0A0A",
      room: "rgba(255, 212, 176, 0.35)",
      selected: accent,
      furniture: "rgba(10, 10, 10, 0.35)",
    };
  }
  if (scheme === "contrast") {
    return {
      bg: "#FFB800",
      stroke: "#0A0A0A",
      room: "rgba(255, 75, 31, 0.25)",
      selected: accent,
      furniture: "rgba(10, 10, 10, 0.5)",
    };
  }
  if (theme === "studio") {
    return {
      bg: "rgba(255, 255, 255, 0.03)",
      stroke: "#F5F5F0",
      room: "rgba(245, 245, 240, 0.06)",
      selected: accent,
      furniture: "rgba(245, 245, 240, 0.55)",
    };
  }
  return {
    bg: "rgba(10, 10, 10, 0.02)",
    stroke: "#0A0A0A",
    room: "rgba(10, 10, 10, 0.04)",
    selected: accent,
    furniture: "rgba(10, 10, 10, 0.35)",
  };
}
