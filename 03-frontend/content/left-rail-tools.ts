import type { LeftRailTool } from "@/stores/studio-editor.store";

export interface LeftRailToolDef {
  readonly id: LeftRailTool;
  readonly symbol: string;
  readonly labelKey: string;
}

/** Symbol glyphs mirror the prototype's 48px sidebar visually. Swap to
 *  Lucide icons later if lucide-react catches up with these shapes. */
export const LEFT_RAIL_TOOLS: ReadonlyArray<LeftRailToolDef> = [
  { id: "build", symbol: "▢", labelKey: "studio.tools.build" },
  { id: "info", symbol: "ⓘ", labelKey: "studio.tools.info" },
  { id: "objects", symbol: "⬚", labelKey: "studio.tools.objects" },
  { id: "appearance", symbol: "◐", labelKey: "studio.tools.appearance" },
  { id: "customization", symbol: "⚙", labelKey: "studio.tools.customization" },
  { id: "help", symbol: "?", labelKey: "studio.tools.help" },
];
