// lib/bom-chain.ts - Typed client for the multi-stage BOM derivation chain API.
// Backs material_logistics / construction_management BOM-chain panels.
// License: Apache-2.0

import {
  type BackendApiError,
  backendRequest,
  buildQuery,
  getBackendRequestContext,
} from "@/lib/backend-api";

/** Per-stage counts and gate readiness for a project's BOM chain. */
export interface BomChainSummary {
  demandBoms: number;
  conceptBoms: number;
  planningBoms: number;
  componentBomVersions: number;
  materialTakeoffs: number;
  procurementBoms: number;
  manufacturingBoms: number;
  shipmentBoms: number;
  installationBoms: number;
  archivePackages: number;
  purchasableLines: number;
  releasableLines: number;
  installableLines: number;
  archivableLines: number;
}

export type BomDeriveOperation =
  | "concept"
  | "planning"
  | "material_takeoff"
  | "procurement"
  | "manufacturing"
  | "shipment"
  | "installation"
  | "archive";

export interface BomDeriveResult {
  id: string;
  operation: string;
}

/**
 * Convert a backendRequest failure (structured BackendApiError or anything
 * else) into a plain Error so callers keep receiving Error instances.
 */
function toReadableError(cause: unknown, prefix: string): Error {
  if (cause instanceof Error) {
    return new Error(`${prefix}: ${cause.message}`);
  }
  if (
    typeof cause === "object" &&
    cause !== null &&
    "error" in cause &&
    typeof (cause as BackendApiError).error === "string"
  ) {
    const apiError = cause as BackendApiError;
    const code = apiError.code ? ` (${apiError.code})` : "";
    return new Error(`${prefix}: ${apiError.error}${code}`);
  }
  return new Error(`${prefix}: ${String(cause)}`);
}

/** Fetch the per-stage BOM chain summary for a project. */
export async function fetchBomChainSummary(
  projectId?: string,
): Promise<BomChainSummary> {
  const context = getBackendRequestContext();
  const query = buildQuery({
    tenant_id: context.tenantId,
    project_id: projectId ?? context.projectId,
  });
  try {
    return await backendRequest<BomChainSummary>(
      `/v1/bom/chain-summary${query}`,
    );
  } catch (cause) {
    throw toReadableError(cause, "BOM chain summary request failed");
  }
}

/** Run one BOM derivation step (e.g. material_takeoff from an approved version). */
export async function deriveBom(
  operation: BomDeriveOperation,
  sourceId: string,
  options: { wasteFactor?: number; variantName?: string; projectId?: string } = {},
): Promise<BomDeriveResult> {
  const context = getBackendRequestContext();
  const body: Record<string, unknown> = {
    operation,
    sourceId,
    tenantId: context.tenantId,
    projectId: options.projectId ?? context.projectId,
  };
  if (options.wasteFactor !== undefined) {
    body.wasteFactor = options.wasteFactor;
  }
  if (options.variantName !== undefined) {
    body.variantName = options.variantName;
  }
  try {
    return await backendRequest<BomDeriveResult>("/v1/bom/derive", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw toReadableError(cause, `BOM derive (${operation}) failed`);
  }
}

/** Display metadata for one BOM chain stage. */
export interface BomStageMeta {
  key: keyof BomChainSummary;
  zh: string;
  en: string;
  /** Optional readiness-gate count field for this stage. */
  gate?: { field: keyof BomChainSummary; zh: string };
}

/** The 9-stage BOM chain in business order, with each stage's readiness gate. */
export const BOM_CHAIN_STAGES: BomStageMeta[] = [
  { key: "demandBoms", zh: "客服报价 / 需求 (RBOM)", en: "Demand" },
  { key: "conceptBoms", zh: "方案设计 (CBOM)", en: "Concept" },
  { key: "planningBoms", zh: "项目管理 (Planning)", en: "Planning" },
  { key: "componentBomVersions", zh: "深化设计 / 构件 (EBOM)", en: "Component" },
  {
    key: "procurementBoms",
    zh: "材料采购 (MTO→PBOM)",
    en: "Procurement",
    gate: { field: "purchasableLines", zh: "可采购行" },
  },
  {
    key: "manufacturingBoms",
    zh: "生产制造 (MBOM)",
    en: "Manufacturing",
    gate: { field: "releasableLines", zh: "可排产行" },
  },
  {
    key: "shipmentBoms",
    zh: "物流运输 (Shipment)",
    en: "Shipment",
    gate: { field: "installableLines", zh: "可安装行" },
  },
  {
    key: "installationBoms",
    zh: "施工管理 (IBOM)",
    en: "Installation",
    gate: { field: "archivableLines", zh: "可归档行" },
  },
  { key: "archivePackages", zh: "数字档案 (Archive)", en: "Archive" },
];
