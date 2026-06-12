// lib/component-naming-rules.ts - Typed client for the prefabricated steel
// component naming-rule registry (source-of-record for the naming allow-list).
// License: Apache-2.0

import {
  type BackendApiError,
  backendRequest,
  buildQuery,
  getBackendRequestContext,
} from "@/lib/backend-api";

export type ComponentNamingRuleType = "general" | "component" | "version";

/** One imported naming rule row (tenant/project-scoped source evidence). */
export interface ComponentNamingRule {
  ruleKey: string;
  ruleType: ComponentNamingRuleType;
  ruleCategory: string;
  componentGroup: string;
  componentType: string;
  prefix: string;
  namingFormula: string;
  standardExample: string;
  fieldNotes: string;
  versionCode: string;
  sourceSheet: string;
  sourceRow: number;
  status: string;
}

export interface ComponentNamingRulesResponse {
  standardName: string;
  ruleCount: number;
  /** Distinct construct prefixes — the source-of-record naming allow-list. */
  prefixes: string[];
  rules: ComponentNamingRule[];
}

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

/** Fetch the imported component naming rules for a project. */
export async function fetchComponentNamingRules(
  projectId?: string,
): Promise<ComponentNamingRulesResponse> {
  const context = getBackendRequestContext();
  const query = buildQuery({
    tenant_id: context.tenantId,
    project_id: projectId ?? context.projectId,
  });
  try {
    return await backendRequest<ComponentNamingRulesResponse>(
      `/v1/component-bom/naming-rules${query}`,
    );
  } catch (cause) {
    throw toReadableError(cause, "组件命名规则请求失败");
  }
}
