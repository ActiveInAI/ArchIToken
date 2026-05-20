export interface Partner {
  readonly name: string;
  readonly logoUrl: string;
}

/**
 * Curated to 8 entries — the previously-included `prefeb`, `hzgg`, `qut`,
 * `jinpai` SVGs all reference external `.png` files that were not migrated
 * with them, so they rendered as blank black tiles in the marquee. They are
 * removed until self-contained vector replacements are sourced. The eight
 * remaining logos all use inline paths or embedded base64 images and render
 * correctly on both dark and light marquee backgrounds.
 */
export const PARTNERS: ReadonlyArray<Partner> = [
  { name: "China Energy", logoUrl: "/partners/china-energy.svg" },
  { name: "JR HOME", logoUrl: "/partners/jr-home.svg" },
  { name: "MEL", logoUrl: "/partners/mel.svg" },
  { name: "Meng Architects", logoUrl: "/partners/meng-architects.svg" },
  { name: "DesignJia", logoUrl: "/partners/designjia.svg" },
  { name: "Biennale", logoUrl: "/partners/biennale.svg" },
  { name: "Ao-Hao", logoUrl: "/partners/ao-hao.svg" },
  { name: "HKZZ", logoUrl: "/partners/hkzz.svg" },
];
