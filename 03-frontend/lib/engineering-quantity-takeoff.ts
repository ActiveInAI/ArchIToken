// lib/engineering-quantity-takeoff.ts - Engineering quantity takeoff routing contracts
// License: Apache-2.0

import { extensionOf } from "./file-type-registry";

export type QuantityTakeoffSourceFamily =
  | "cad_drawing"
  | "pdf_drawing"
  | "semantic_bim"
  | "licensed_bim"
  | "boundary_rep_geometry"
  | "mesh_geometry";

export type QuantityTakeoffMode =
  | "cad_entity_takeoff"
  | "pdf_vector_ocr_takeoff"
  | "ifc_semantic_quantity"
  | "licensed_authoring_quantity"
  | "brep_kernel_quantity"
  | "mesh_measurement";

export type QuantityTakeoffConfidence =
  | "source_semantic"
  | "adapter_verified"
  | "geometry_verified"
  | "drawing_assisted"
  | "manual_review_required";

export type QuantityTakeoffOutputStatus =
  | "worker_ready"
  | "adapter_required"
  | "licensed_adapter_required"
  | "manual_review_required";

export interface EngineeringQuantityTakeoffRoute {
  id: string;
  label: string;
  extensions: readonly string[];
  sourceFamily: QuantityTakeoffSourceFamily;
  mode: QuantityTakeoffMode;
  confidence: QuantityTakeoffConfidence;
  outputStatus: QuantityTakeoffOutputStatus;
  canAutoCalculate: boolean;
  professionalReviewRequired: boolean;
  requiredAdapters: readonly string[];
  requiredEvidence: readonly string[];
  blockedUses: readonly string[];
  notes: readonly string[];
}

const drawingCadEvidence = [
  "model/layout space and sheet scale",
  "layer and block mapping",
  "closed boundary or hatch geometry",
  "dimension/text extraction with source entity ids",
  "manual calibration and estimator review record",
] as const;

const semanticBimEvidence = [
  "stable source element id or GlobalId",
  "source unit assignment",
  "material/layer/property set mapping",
  "quantity expression with source element evidence",
  "Evaluator + RuleChecker + SchemaValidator + Approver record",
] as const;

const kernelGeometryEvidence = [
  "native unit assignment",
  "closed solid or validated surface topology",
  "kernel-computed length/area/volume/mass properties",
  "material/classification mapping before BOQ aggregation",
  "manual estimator review for cost item binding",
] as const;

export const engineeringQuantityTakeoffRoutes = [
  {
    id: "cad-drawing-entity-takeoff",
    label: "DWG/DXF CAD 图纸工程量草稿",
    extensions: [".dwg", ".dxf"],
    sourceFamily: "cad_drawing",
    mode: "cad_entity_takeoff",
    confidence: "drawing_assisted",
    outputStatus: "manual_review_required",
    canAutoCalculate: false,
    professionalReviewRequired: true,
    requiredAdapters: [
      "MLightCAD CAD entity parser",
      "CAD layer/block rule mapper",
      "drawing scale calibrator",
    ],
    requiredEvidence: drawingCadEvidence,
    blockedUses: [
      "Do not calculate final quantities from screenshot/PDF preview pixels.",
      "Do not treat linework length/area as BOQ without scale, layer, closure and review evidence.",
    ],
    notes: [
      "DWG/DXF can produce auditable draft takeoff from source entities, blocks, hatches and dimensions.",
      "Final BOQ quantities require estimator review because 2D drawings do not always contain BIM semantics.",
    ],
  },
  {
    id: "pdf-drawing-assisted-takeoff",
    label: "PDF CAD 图纸工程量草稿",
    extensions: [".pdf"],
    sourceFamily: "pdf_drawing",
    mode: "pdf_vector_ocr_takeoff",
    confidence: "manual_review_required",
    outputStatus: "manual_review_required",
    canAutoCalculate: false,
    professionalReviewRequired: true,
    requiredAdapters: [
      "PDF.js vector extractor",
      "OCR/table extractor",
      "drawing scale calibrator",
    ],
    requiredEvidence: [
      "page scale and viewport calibration",
      "vector path/text/OCR extraction evidence",
      "sheet discipline and drawing title block",
      "manual estimator review record",
    ],
    blockedUses: [
      "Do not infer final quantities from rasterized PDF pages.",
      "Do not accept OCR-only text as a measured quantity without source geometry or reviewer confirmation.",
    ],
    notes: [
      "PDF is a delivery/print format, so output stays a review-required takeoff draft unless a richer source model is linked.",
    ],
  },
  {
    id: "ifc-semantic-quantity-takeoff",
    label: "IFC 语义模型工程量",
    extensions: [".ifc", ".ifczip"],
    sourceFamily: "semantic_bim",
    mode: "ifc_semantic_quantity",
    confidence: "source_semantic",
    outputStatus: "worker_ready",
    canAutoCalculate: true,
    professionalReviewRequired: true,
    requiredAdapters: ["IfcOpenShell", "IFCDB-Agent quantity service"],
    requiredEvidence: semanticBimEvidence,
    blockedUses: [
      "Do not replace IFC quantities with GLB/Three.js mesh bounds.",
      "Do not mark output as compliant without standard, rule and approver evidence.",
    ],
    notes: [
      "Use IFC quantity sets, BaseQuantities and geometry fallback only when source semantic quantities are missing or contradicted.",
    ],
  },
  {
    id: "licensed-bim-authoring-takeoff",
    label: "RVT/SKP 原生授权模型工程量",
    extensions: [".rvt", ".rfa", ".skp"],
    sourceFamily: "licensed_bim",
    mode: "licensed_authoring_quantity",
    confidence: "adapter_verified",
    outputStatus: "licensed_adapter_required",
    canAutoCalculate: false,
    professionalReviewRequired: true,
    requiredAdapters: [
      "Revit/APS/Revit MCP schedule adapter or verified IFC export",
      "SketchUp licensed API/Speckle/IFC command adapter",
    ],
    requiredEvidence: [
      "native element ids and category mapping",
      "source schedule or verified IFC export",
      "unit and material mapping",
      "adapter version/license audit record",
      "Estimator approval record",
    ],
    blockedUses: [
      "Do not calculate final quantities from RVT/SKP preview derivatives.",
      "Do not use GLB fallback as native BIM quantity evidence.",
    ],
    notes: [
      "Private authoring formats require an authorized native adapter or verified semantic export before quantity extraction.",
    ],
  },
  {
    id: "open-brep-kernel-takeoff",
    label: "3DM/STEP/IGS B-Rep 几何工程量",
    extensions: [".3dm", ".step", ".stp", ".iges", ".igs"],
    sourceFamily: "boundary_rep_geometry",
    mode: "brep_kernel_quantity",
    confidence: "geometry_verified",
    outputStatus: "adapter_required",
    canAutoCalculate: true,
    professionalReviewRequired: true,
    requiredAdapters: ["OpenNURBS/rhino3dm", "OCCT/OCP kernel"],
    requiredEvidence: kernelGeometryEvidence,
    blockedUses: [
      "Do not bind B-Rep volume/area directly to BOQ items without classification/material mapping.",
      "Do not use tessellated viewer mesh when native B-Rep topology is available.",
    ],
    notes: [
      "These formats can support accurate geometry measures, but cost item classification still requires rule mapping and review.",
    ],
  },
  {
    id: "stl-mesh-measurement-takeoff",
    label: "STL Mesh 几何测量",
    extensions: [".stl"],
    sourceFamily: "mesh_geometry",
    mode: "mesh_measurement",
    confidence: "manual_review_required",
    outputStatus: "manual_review_required",
    canAutoCalculate: false,
    professionalReviewRequired: true,
    requiredAdapters: [
      "mesh watertightness validator",
      "mesh repair/measurement worker",
    ],
    requiredEvidence: [
      "unit assignment",
      "watertightness and normal orientation check",
      "mesh repair log if repaired",
      "material/classification mapping",
      "manual estimator review record",
    ],
    blockedUses: [
      "Do not treat non-watertight mesh volume as accurate quantity.",
      "Do not infer BIM categories from STL geometry alone.",
    ],
    notes: [
      "STL can support measured geometry only after topology validation; it is not a semantic BIM source.",
    ],
  },
] as const satisfies readonly EngineeringQuantityTakeoffRoute[];

export const requestedEngineeringQuantityExtensions = [
  ".dwg",
  ".dxf",
  ".pdf",
  ".ifc",
  ".rvt",
  ".3dm",
  ".step",
  ".stp",
  ".stl",
  ".igs",
  ".iges",
  ".skp",
] as const;

export function quantityTakeoffRouteForExtension(
  extension: string,
): EngineeringQuantityTakeoffRoute | null {
  const normalized = extension.trim().toLowerCase();
  return (
    engineeringQuantityTakeoffRoutes.find((route) =>
      route.extensions.some((routeExtension) => routeExtension === normalized),
    ) ?? null
  );
}

export function quantityTakeoffRouteForFileName(
  fileName: string,
): EngineeringQuantityTakeoffRoute | null {
  return quantityTakeoffRouteForExtension(extensionOf(fileName));
}

export function quantityTakeoffCanIssueUnreviewedFinal(
  route: EngineeringQuantityTakeoffRoute,
): boolean {
  return route.professionalReviewRequired === false;
}
