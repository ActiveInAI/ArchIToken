// app/api/mlightcad/cad-fonts-20260527/fonts/[...fontPath]/route.ts
// Versioned MLightCAD CAD font endpoint. It intentionally busts earlier
// browser caches that contained non-CAD fallback font manifests.
// Keep runtime declared locally because Next.js cannot statically parse it
// through a re-export.

export const runtime = "nodejs";

export { GET } from "../../../fonts/[...fontPath]/route";
