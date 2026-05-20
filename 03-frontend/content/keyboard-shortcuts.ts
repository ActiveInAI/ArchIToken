export type ShortcutCategory = "edit" | "tools" | "view" | "selection" | "help";

export interface ShortcutDef {
  readonly keys: ReadonlyArray<string>;
  readonly labelKey: string;
  readonly category: ShortcutCategory;
  readonly platform?: "all" | "mac" | "windows";
}

/**
 * Authoritative source. Help Panel + Ctrl+/ Dialog both consume this.
 * Adding a new shortcut? Append here — two display surfaces stay in sync.
 */
export const SHORTCUTS: ReadonlyArray<ShortcutDef> = [
  { keys: ["Ctrl", "Z"], labelKey: "studio.shortcuts.edit.undo", category: "edit" },
  { keys: ["Ctrl", "Shift", "Z"], labelKey: "studio.shortcuts.edit.redo", category: "edit" },
  { keys: ["Ctrl", "Y"], labelKey: "studio.shortcuts.edit.redoAlt", category: "edit", platform: "windows" },

  { keys: ["V"], labelKey: "studio.shortcuts.tools.select", category: "tools" },
  { keys: ["W"], labelKey: "studio.shortcuts.tools.drawWall", category: "tools" },
  { keys: ["R"], labelKey: "studio.shortcuts.tools.drawRoom", category: "tools" },
  { keys: ["D"], labelKey: "studio.shortcuts.tools.placeDoor", category: "tools" },
  { keys: ["E"], labelKey: "studio.shortcuts.tools.placeWindow", category: "tools" },
  { keys: ["O"], labelKey: "studio.shortcuts.tools.placeOpening", category: "tools" },
  { keys: ["M"], labelKey: "studio.shortcuts.tools.move", category: "tools" },

  { keys: ["1"], labelKey: "studio.shortcuts.view.cameraIso", category: "view" },
  { keys: ["2"], labelKey: "studio.shortcuts.view.cameraTop", category: "view" },
  { keys: ["3"], labelKey: "studio.shortcuts.view.cameraPerspective", category: "view" },
  { keys: ["F"], labelKey: "studio.shortcuts.view.fitView", category: "view" },

  { keys: ["Esc"], labelKey: "studio.shortcuts.selection.escape", category: "selection" },
  { keys: ["Ctrl", "D"], labelKey: "studio.shortcuts.selection.clear", category: "selection" },

  { keys: ["Ctrl", "/"], labelKey: "studio.shortcuts.help.openDialog", category: "help" },
];

export function groupByCategory(
  defs: ReadonlyArray<ShortcutDef> = SHORTCUTS,
): ReadonlyArray<{ category: ShortcutCategory; entries: ShortcutDef[] }> {
  const groups = new Map<ShortcutCategory, ShortcutDef[]>();
  for (const s of defs) {
    const list = groups.get(s.category) ?? [];
    list.push({ ...s });
    groups.set(s.category, list);
  }
  const order: ShortcutCategory[] = ["tools", "selection", "edit", "view", "help"];
  return order
    .filter((c) => groups.has(c))
    .map((c) => ({ category: c, entries: groups.get(c)! }));
}

export const FAQ = [
  { qKey: "studio.help.q1", aKey: "studio.help.a1" },
  { qKey: "studio.help.q2", aKey: "studio.help.a2" },
  { qKey: "studio.help.q3", aKey: "studio.help.a3" },
] as const;
