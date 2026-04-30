export type WorkbenchRoute = {
  path: string;
  label: string;
  domain: string;
  summary: string;
};

export const workbenchRoutes: WorkbenchRoute[] = [
  {
    path: "/assets",
    label: "Assets",
    domain: "universal registry",
    summary: "IFC, CAD, PDF, office, media, GIS, point cloud, panorama, and model assets.",
  },
  {
    path: "/ai",
    label: "AI",
    domain: "approval gated runtime",
    summary: "Draft AI commands, query plans, action plans, and audit-visible execution traces.",
  },
  {
    path: "/openbim",
    label: "openBIM",
    domain: "IFC / IDS / bSDD",
    summary: "IFC4x3 ingestion, IDS validation, bSDD enrichment, BCF and COBie boundaries.",
  },
  {
    path: "/cad",
    label: "CAD",
    domain: "geometry adapters",
    summary: "OCCT, FreeCAD, CadQuery, DXF, STEP, IGES, STL, OBJ, 3MF, glTF contracts.",
  },
  {
    path: "/gis",
    label: "GIS",
    domain: "reality capture",
    summary: "PostGIS, GDAL, PROJ, PDAL, EPT, 3D Tiles, panorama graph, and WebXR boundaries.",
  },
  {
    path: "/documents",
    label: "Documents",
    domain: "PDF / Office / OCR",
    summary: "PDFium, MuPDF, MinerU, PaddleOCR, MarkItDown, LibreOffice, and Stirling-PDF adapters.",
  },
  {
    path: "/gantt",
    label: "Gantt",
    domain: "planning",
    summary: "Schedule assets, dependencies, progress overlays, and runtime generated timeline drafts.",
  },
  {
    path: "/flow",
    label: "Flow",
    domain: "process graph",
    summary: "Procedure diagrams, approval paths, asset lineage, and conversion dependency graphs.",
  },
  {
    path: "/runtime",
    label: "Runtime",
    domain: "execution trace",
    summary: "Conversion jobs, viewer commands, AI drafts, audit events, and provider boundaries.",
  },
  {
    path: "/admin",
    label: "Admin",
    domain: "tenant guard",
    summary: "Runtime context, RBAC roles, tenant/project isolation, and integration capability posture.",
  },
];

export const routePaths = workbenchRoutes.map((route) => route.path);
