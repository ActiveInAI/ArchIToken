// Fetch-based ArchIToken backend API adapter.
// License: Apache-2.0

export interface BackendApiError {
  error: string;
  code: number;
}

export interface RuntimeRequestContext {
  tenantId: string;
  projectId: string;
  actor: string;
  roles: string[];
  requestId?: string;
  correlationId?: string;
}

export const DEFAULT_RUNTIME_TENANT_ID = '11111111-1111-4111-8111-111111111111';
export const DEFAULT_RUNTIME_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
export const DEFAULT_RUNTIME_ACTOR = 'frontend-api-lab';
export const DEFAULT_RUNTIME_ROLES = ['admin'];

export function getArchitokenApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  return 'http://localhost:8080';
}

export const ARCHITOKEN_API_BASE_URL = getArchitokenApiBaseUrl();

let activeRequestContext: RuntimeRequestContext = {
  tenantId: DEFAULT_RUNTIME_TENANT_ID,
  projectId: DEFAULT_RUNTIME_PROJECT_ID,
  actor: DEFAULT_RUNTIME_ACTOR,
  roles: [...DEFAULT_RUNTIME_ROLES],
  requestId: 'frontend-api-lab',
  correlationId: 'frontend-api-lab',
};

export function setBackendRequestContext(context: RuntimeRequestContext): void {
  activeRequestContext = {
    ...context,
    roles: context.roles.length > 0 ? [...context.roles] : [...DEFAULT_RUNTIME_ROLES],
  };
}

export function getBackendRequestContext(): RuntimeRequestContext {
  return activeRequestContext;
}

export function buildRuntimeContextHeaders(
  context: RuntimeRequestContext = activeRequestContext,
): Record<string, string> {
  return {
    'X-Tenant-Id': context.tenantId,
    'X-Project-Id': context.projectId,
    'X-Actor': context.actor,
    'X-Roles': context.roles.join(','),
    'X-Request-Id': context.requestId ?? context.actor,
    'X-Correlation-Id': context.correlationId ?? context.requestId ?? context.actor,
  };
}

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  for (const [key, value] of Object.entries(buildRuntimeContextHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(`${ARCHITOKEN_API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let apiError: BackendApiError;
    try {
      apiError = (await response.json()) as BackendApiError;
    } catch {
      apiError = { error: response.statusText, code: response.status };
    }
    throw apiError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}
