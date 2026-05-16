// lib/api.ts — Frontend API client
// Wraps the generated API surface with auth, error handling, telemetry.
// License: Apache-2.0

import type { ModuleId } from './module-registry';
import { buildRuntimeContextHeaders } from './backend-api';

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
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  regulationCode: string;
  regulationClause: string;
  finding: string;
  recommendation: string;
  elementId: string | null;
  resolved: boolean;
}

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL;
  if (configured) return configured;
  if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:8080`;
  return 'http://localhost:8080';
}

function camelize(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.localStorage.getItem('architoken_token')
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    return camelizeKeys<T>(json);
  }

  return (await response.text()) as T;
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
        body: JSON.stringify(toProjectCreatePayload(body)),
      }),
    boq: (id: string) => request<BoqItem[]>(`/v1/projects/${id}/boq`),
    compliance: (id: string) =>
      request<ComplianceFinding[]>(`/v1/projects/${id}/compliance`),
  },

  agents: {
    invoke: (body: {
      projectId: string;
      tenantId: string;
      moduleId: ModuleId;
      userInput: string;
      attachments?: string[];
      locale?: 'zh-CN' | 'en-US' | 'es-ES' | 'ja-JP' | 'de-DE';
    }) =>
      request<{
        requestId: string;
        moduleId: ModuleId;
        verdict: 'approved' | 'revise' | 'rejected';
        finalOutput: unknown;
        revisionCount: number;
        trace: string[];
      }>('/v1/agents/invoke', {
        method: 'POST',
        body: JSON.stringify({
          project_id: body.projectId,
          tenant_id: body.tenantId,
          module_id: body.moduleId,
          user_input: body.userInput,
          attachments: body.attachments ?? [],
          locale: body.locale ?? 'zh-CN',
        }),
      }),
  },
};
