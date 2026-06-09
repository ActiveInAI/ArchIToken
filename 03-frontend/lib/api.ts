// lib/api.ts — Frontend API client
// Wraps the generated API surface with auth, error handling, telemetry.
// License: Apache-2.0

import type { ModuleId } from "./module-registry";
import { buildRuntimeContextHeaders } from "./backend-api";

export type { ModuleId };

export interface ApiError {
  error: string;
  code: number;
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  currentModuleId: ModuleId;
  areaSqm: number | null;
  location: string | null;
  budgetCny: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoqItem {
  id: string;
  projectId: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceCny: number;
  totalCny: number;
  category: string;
}

export interface ComplianceFinding {
  id: string;
  projectId: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  regulationCode: string;
  regulationClause: string;
  finding: string;
  recommendation: string;
  elementId: string | null;
  resolved: boolean;
}

export interface QuantityCostingOverview {
  projectId: string;
  costProjectCount: number;
  reviewVersionCount: number;
  boqItemCount: number;
  measureItemCount: number;
  otherItemCount: number;
  feeItemCount: number;
  reportCount: number;
  boqSubmittedTotal: number;
  boqApprovedTotal: number;
  boqAmountDelta: number;
  measureSubmittedTotal: number;
  measureApprovedTotal: number;
  measureAmountDelta: number;
  otherSubmittedTotal: number;
  otherApprovedTotal: number;
  otherAmountDelta: number;
  feeSubmittedTotal: number;
  feeApprovedTotal: number;
  feeAmountDelta: number;
  increaseAmount: number;
  decreaseAmount: number;
  sourceReviewRequiredCount: number;
  latestReviewStatus: string | null;
  latestReviewOutputState: string | null;
  latestReviewUpdatedAt: string | null;
}

export interface QuantityCostingSnapshotTreeNodePayload {
  nodeId: string;
  parentId: string | null;
  nodeType: string;
  name: string;
  specialty: string;
  sortOrder: number;
  standardProfileId: string;
  quotaLibraryId: string;
  auditState: string;
}

export interface QuantityCostingSnapshotBoqItemPayload {
  itemId: string;
  nodeId: string;
  submittedCode: string;
  approvedCode: string;
  submittedName: string;
  approvedName: string;
  submittedFeature: string;
  approvedFeature: string;
  unit: string;
  submittedQty: number;
  approvedQty: number;
  qtyDelta: number;
  submittedUnitPrice: number;
  approvedUnitPrice: number;
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  increaseAmount: number;
  decreaseAmount: number;
  changeMark: string;
  changeReason: string;
  sourceRef: string;
  ruleId: string;
  elementId?: string | null;
  sourceReviewRequired: boolean;
}

export interface QuantityCostingSnapshotMeasureItemPayload {
  itemId: string;
  name: string;
  measureType: string;
  submittedBaseAmount: number;
  approvedBaseAmount: number;
  submittedRate: number;
  approvedRate: number;
  submittedAmount: number;
  approvedAmount: number;
  amountDelta: number;
  changeMark: string;
  sourceRuleId: string;
  sourceRef: string;
  sourceReviewRequired: boolean;
}

export interface QuantityCostingSnapshotOtherItemPayload {
  itemId: string;
  name: string;
  otherType: string;
  submittedAmount: number;
  approvedAmount: number;
  amountDelta: number;
  changeMark: string;
  sourceRuleId: string;
  sourceRef: string;
  sourceReviewRequired: boolean;
}

export interface QuantityCostingSnapshotFeeSummaryPayload {
  feeId: string;
  name: string;
  submittedBaseAmount: number;
  approvedBaseAmount: number;
  submittedRate: number;
  approvedRate: number;
  submittedAmount: number;
  approvedAmount: number;
  amountDelta: number;
  changeMark: string;
  sourceRuleId: string;
  sourceRef: string;
  sourceReviewRequired: boolean;
}

export interface QuantityCostingSnapshotPayload {
  costingProjectKey: string;
  name: string;
  jurisdiction: string;
  standardProfileId: string;
  quotaLibraryId: string;
  reviewKey: string;
  reviewRound: number;
  reviewDescription: string;
  treeNodes: QuantityCostingSnapshotTreeNodePayload[];
  boqItems: QuantityCostingSnapshotBoqItemPayload[];
  measureItems: QuantityCostingSnapshotMeasureItemPayload[];
  otherItems: QuantityCostingSnapshotOtherItemPayload[];
  feeSummaryItems: QuantityCostingSnapshotFeeSummaryPayload[];
}

export interface QuantityCostingSnapshotSaveResponse {
  costProjectId: string;
  reviewVersionId: string;
  treeNodeCount: number;
  boqItemCount: number;
  measureItemCount: number;
  otherItemCount: number;
  feeItemCount: number;
}

export interface QuantityCostingSnapshotResponse extends QuantityCostingSnapshotPayload {
  costProjectId: string;
  reviewVersionId: string | null;
}

export interface SemanticDictionaryStandard {
  id: string;
  standardCode: string;
  titleZh: string;
  titleEn: string;
  jurisdiction: string;
  sourceAuthority: string;
  publishedOn: string;
  effectiveOn: string;
  digitalRepresentation: string;
  namespacePrefix: string;
  namespaceUri: string;
  sourceFileName: string;
  sourceSha256: string | null;
  ingestionStatus:
    | "metadata_registered"
    | "categories_imported"
    | "verified"
    | "blocked";
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface SemanticDictionaryCategory {
  code: string;
  tableCode: "10" | "12" | "16" | "30";
  objectGroup: "building" | "space" | "element" | "system";
  levelNum: number;
  levelName: string;
  parentCode: string | null;
  parentNameZh: string | null;
  nameZh: string;
  rdfIdentifier: string;
  rdfUri: string;
  ifcEntity: string | null;
  ifcMappingRaw: string | null;
  terminologyRaw: string | null;
  remark: string | null;
  sourceLine: number | null;
}

export interface SemanticCategoryListResponse {
  standard: SemanticDictionaryStandard;
  items: SemanticDictionaryCategory[];
  total: number;
  limit: number;
  offset: number;
}

export type AgentVerdict = "approved" | "revise" | "rejected";
export type AgentGateStatus = "passed" | "needs_review" | "blocked";
export type AgentOutputStatus = "draft_assist" | "professional_review_required";

export interface AgentGateResult {
  name:
    | "ToolRouter"
    | "Planner"
    | "Generator"
    | "Evaluator"
    | "RuleChecker"
    | "SchemaValidator"
    | "Approver";
  status: AgentGateStatus;
  verdict?: AgentVerdict | null;
  notes: string;
  model?: string | null;
}

export interface AgentToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentToolResult {
  name: string;
  ok: boolean;
  output: unknown;
  error?: string | null;
}

export interface AgentRagChunk {
  source: string;
  sourceKind:
    | "module_registry"
    | "module_compliance_profile"
    | "knowledge_source"
    | "rag_chunk"
    | "cde_file"
    | "audit_event"
    | "attachment_reference";
  retrievalStatus:
    | "local_registry"
    | "local_registry_fallback"
    | "gateway_http"
    | "gateway_http_partial"
    | "gateway_matched"
    | "unresolved_reference";
  title: string;
  content: string;
  citationRequired: boolean;
  score?: number | null;
  metadata?: Record<string, unknown>;
}

export interface AgentInvokeResponse {
  requestId: string;
  moduleId: ModuleId;
  verdict: AgentVerdict;
  finalOutput: unknown;
  revisionCount: number;
  trace: string[];
  outputStatus: AgentOutputStatus;
  gates: AgentGateResult[];
  toolCalls: AgentToolCall[];
  toolResults: AgentToolResult[];
  ragChunks: AgentRagChunk[];
  toolRouterNotes: string;
}

export type AiCenterManagementStatus =
  | "draft"
  | "configured"
  | "review"
  | "approved"
  | "disabled";

export interface AiCenterInterfaceContract {
  id: string;
  tenantId: string;
  moduleId: "ai_center";
  contractKey: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  boundary: string;
  authPolicy: string;
  dataObject: string;
  ownerRole: string;
  status: AiCenterManagementStatus;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface AiCenterDatabaseBinding {
  id: string;
  tenantId: string;
  moduleId: "ai_center";
  bindingKey: string;
  name: string;
  objectName: string;
  storageAdapter: string;
  lifecyclePolicy: string;
  rlsPolicy: string;
  ownerRole: string;
  status: AiCenterManagementStatus;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface AiCenterVisualizationPanel {
  id: string;
  tenantId: string;
  moduleId: "ai_center";
  panelKey: string;
  name: string;
  dataset: string;
  viewMode: string;
  refreshPolicy: string;
  readiness: number;
  ownerRole: string;
  status: AiCenterManagementStatus;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface AiCenterManagementResponse {
  interfaceContracts: AiCenterInterfaceContract[];
  databaseBindings: AiCenterDatabaseBinding[];
  visualizationPanels: AiCenterVisualizationPanel[];
}

export interface IamOrgUnit {
  id: string;
  tenantId: string;
  parentId: string | null;
  unitCode: string | null;
  name: string;
  unitType: string;
  status: string;
  sortOrder: number;
}

export interface IamPersonProfile {
  id: string;
  tenantId: string;
  accountId: string | null;
  orgUnitId: string | null;
  fullName: string;
  displayName: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  employmentStatus: string;
  credentialSummary: Record<string, unknown>;
}

export interface IamJobTitle {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  category: string;
  defaultScope: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface IamPermission {
  id: string;
  category: string;
  action: string;
  resourceType: string;
  description: string;
  riskLevel: "low" | "normal" | "high" | "critical";
}

export interface IamRole {
  id: string;
  tenantId: string;
  roleKey: string;
  name: string;
  description: string | null;
  runtimeRole: "admin" | "engineer" | "reviewer" | "auditor";
  roleType: "tenant" | "project" | "system";
  permissionIds: string[];
}

export interface IamRoleBinding {
  id: string;
  tenantId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  runtimeRole: "admin" | "engineer" | "reviewer" | "auditor";
  principalType: "account" | "person" | "org_unit";
  principalId: string;
  principalName: string;
  resourceType: string;
  resourceId: string | null;
  startsAt: string;
  expiresAt: string | null;
  grantedBy: string | null;
  createdAt: string;
}

export interface IamSummaryResponse {
  tenantId: string;
  orgUnits: IamOrgUnit[];
  people: IamPersonProfile[];
  jobTitles: IamJobTitle[];
  permissions: IamPermission[];
  roles: IamRole[];
  roleBindings: IamRoleBinding[];
}

export interface IamCreateRoleBindingRequest {
  roleId?: string;
  roleKey?: string;
  principalType: "account" | "person" | "org_unit";
  principalId: string;
  resourceType?: string;
  resourceId?: string | null;
  expiresAt?: string | null;
}

export interface IamPermissionDecisionRequest {
  principalType?: "account" | "person" | "org_unit";
  principalId: string;
  permissionId: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

export interface IamPermissionDecisionResponse {
  allowed: boolean;
  permissionId: string;
  principalType: "account" | "person" | "org_unit";
  principalId: string;
  resourceType: string | null;
  resourceId: string | null;
  matchedRoles: string[];
  reason: string;
}

function getApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL;
  if (configured) return configured;
  if (typeof window !== "undefined")
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  return "http://localhost:8080";
}

function camelize(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function camelizeKeys<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeKeys(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        camelize(key),
        camelizeKeys(nestedValue),
      ]),
    ) as T;
  }

  return value as T;
}

export function toProjectCreatePayload(body: Partial<Project>) {
  return {
    name: body.name,
    description: body.description,
    current_module_id: body.currentModuleId,
    area_sqm: body.areaSqm,
    location: body.location,
    budget_cny: body.budgetCny,
  };
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("architoken_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...buildRuntimeContextHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let err: ApiError;
    try {
      err = (await response.json()) as ApiError;
    } catch {
      err = { error: response.statusText, code: response.status };
    }
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await response.json();
    return camelizeKeys<T>(json);
  }

  return (await response.text()) as T;
}

export const api = {
  health: () => request<string>("/healthz"),

  projects: {
    list: (params: { page?: number; pageSize?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.pageSize) q.set("page_size", String(params.pageSize));
      return request<{ items: Project[]; total: number }>(`/v1/projects?${q}`);
    },
    get: (id: string) => request<Project>(`/v1/projects/${id}`),
    create: (body: Partial<Project>) =>
      request<Project>("/v1/projects", {
        method: "POST",
        body: JSON.stringify(toProjectCreatePayload(body)),
      }),
    boq: (id: string) => request<BoqItem[]>(`/v1/projects/${id}/boq`),
    compliance: (id: string) =>
      request<ComplianceFinding[]>(`/v1/projects/${id}/compliance`),
  },

  quantityCosting: {
    overview: (projectId: string) =>
      request<QuantityCostingOverview>(
        `/v1/projects/${encodeURIComponent(projectId)}/quantity-costing/overview`,
      ),
    latestSnapshot: (projectId: string) =>
      request<QuantityCostingSnapshotResponse | null>(
        `/v1/projects/${encodeURIComponent(projectId)}/quantity-costing/snapshots/latest`,
      ),
    saveSnapshot: (projectId: string, body: QuantityCostingSnapshotPayload) =>
      request<QuantityCostingSnapshotSaveResponse>(
        `/v1/projects/${encodeURIComponent(projectId)}/quantity-costing/snapshots`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      ),
  },

  agents: {
    invoke: (body: {
      projectId: string;
      tenantId: string;
      moduleId: ModuleId;
      userInput: string;
      attachments?: string[];
      locale?: "zh-CN" | "en-US" | "es-ES" | "ja-JP" | "de-DE";
    }) =>
      request<AgentInvokeResponse>("/v1/agents/invoke", {
        method: "POST",
        body: JSON.stringify({
          project_id: body.projectId,
          tenant_id: body.tenantId,
          module_id: body.moduleId,
          user_input: body.userInput,
          attachments: body.attachments ?? [],
          locale: body.locale ?? "zh-CN",
        }),
      }),
  },

  aiCenter: {
    management: () =>
      request<AiCenterManagementResponse>("/v1/ai-center/management"),
    updateInterfaceContract: (
      contractKey: string,
      body: {
        status?: AiCenterManagementStatus;
        metadata?: Record<string, unknown>;
      },
    ) =>
      request<AiCenterInterfaceContract>(
        `/v1/ai-center/interface-contracts/${encodeURIComponent(contractKey)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    updateDatabaseBinding: (
      bindingKey: string,
      body: {
        status?: AiCenterManagementStatus;
        metadata?: Record<string, unknown>;
      },
    ) =>
      request<AiCenterDatabaseBinding>(
        `/v1/ai-center/database-bindings/${encodeURIComponent(bindingKey)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    updateVisualizationPanel: (
      panelKey: string,
      body: {
        status?: AiCenterManagementStatus;
        metadata?: Record<string, unknown>;
      },
    ) =>
      request<AiCenterVisualizationPanel>(
        `/v1/ai-center/visualization-panels/${encodeURIComponent(panelKey)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
  },

  iam: {
    summary: () => request<IamSummaryResponse>("/v1/iam/summary"),
    createRoleBinding: (body: IamCreateRoleBindingRequest) =>
      request<IamRoleBinding>("/v1/iam/role-bindings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deleteRoleBinding: (bindingId: string) =>
      request<void>(`/v1/iam/role-bindings/${encodeURIComponent(bindingId)}`, {
        method: "DELETE",
      }),
    decidePermission: (body: IamPermissionDecisionRequest) =>
      request<IamPermissionDecisionResponse>("/v1/iam/permission-decisions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  semanticDictionaries: {
    sjg157: {
      get: () =>
        request<SemanticDictionaryStandard>("/v1/semantic-dictionaries/sjg157"),
      categories: (
        params: {
          q?: string;
          objectGroup?: SemanticDictionaryCategory["objectGroup"];
          tableCode?: SemanticDictionaryCategory["tableCode"];
          ifcEntity?: string;
          level?: number;
          limit?: number;
          offset?: number;
        } = {},
      ) => {
        const q = new URLSearchParams();
        if (params.q) q.set("q", params.q);
        if (params.objectGroup) q.set("objectGroup", params.objectGroup);
        if (params.tableCode) q.set("tableCode", params.tableCode);
        if (params.ifcEntity) q.set("ifcEntity", params.ifcEntity);
        if (params.level) q.set("level", String(params.level));
        if (params.limit) q.set("limit", String(params.limit));
        if (params.offset) q.set("offset", String(params.offset));
        return request<SemanticCategoryListResponse>(
          `/v1/semantic-dictionaries/sjg157/categories?${q}`,
        );
      },
      category: (code: string) =>
        request<SemanticDictionaryCategory>(
          `/v1/semantic-dictionaries/sjg157/categories/${encodeURIComponent(code)}`,
        ),
    },
  },
};
