// lib/api.ts — Frontend API client
// Wraps @insomeos/sdk with auth, error handling, telemetry.
// License: Apache-2.0

export interface ApiError {
  error: string;
  code: number;
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  phase: BusinessPhase;
  areaSqm: number | null;
  location: string | null;
  budgetCny: number | null;
  createdAt: string;
  updatedAt: string;
}

export type BusinessPhase =
  | 'pre_sales'
  | 'concept'
  | 'develop'
  | 'costing'
  | 'fabrication'
  | 'logistics'
  | 'construction'
  | 'acceptance'
  | 'operations';

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
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  regulationCode: string;
  regulationClause: string;
  finding: string;
  recommendation: string;
  elementId: string | null;
  resolved: boolean;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('insomeos_token') : null;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  return (await response.json()) as T;
}

export const api = {
  health: () => request<string>('/healthz'),

  projects: {
    list: (params: { page?: number; pageSize?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('page_size', String(params.pageSize));
      return request<{ items: Project[]; total: number }>(`/v1/projects?${q}`);
    },
    get: (id: string) => request<Project>(`/v1/projects/${id}`),
    create: (body: Partial<Project>) =>
      request<Project>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    boq: (id: string) => request<BoqItem[]>(`/v1/projects/${id}/boq`),
    compliance: (id: string) =>
      request<ComplianceFinding[]>(`/v1/projects/${id}/compliance`),
  },

  agents: {
    invoke: (body: {
      projectId: string;
      tenantId: string;
      phase: BusinessPhase;
      userInput: string;
      attachments?: string[];
      locale?: 'zh-CN' | 'en-US' | 'es-ES' | 'ja-JP' | 'de-DE';
    }) =>
      request<{
        requestId: string;
        phase: BusinessPhase;
        verdict: 'approved' | 'revise' | 'rejected';
        finalOutput: unknown;
        revisionCount: number;
        trace: string[];
      }>('/v1/agents/invoke', {
        method: 'POST',
        body: JSON.stringify({
          project_id: body.projectId,
          tenant_id: body.tenantId,
          phase: body.phase,
          user_input: body.userInput,
          attachments: body.attachments ?? [],
          locale: body.locale ?? 'zh-CN',
        }),
      }),
  },
};
