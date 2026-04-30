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

export const ARCHITOKEN_API_BASE_URL =
  process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL ?? 'http://localhost:8080';

let activeRequestContext: RuntimeRequestContext = {
  tenantId: 'dev-tenant',
  projectId: 'dev-project',
  actor: 'frontend-api-lab',
  roles: ['admin'],
  requestId: 'frontend-api-lab',
  correlationId: 'frontend-api-lab',
};

export function setBackendRequestContext(context: RuntimeRequestContext): void {
  activeRequestContext = {
    ...context,
    roles: context.roles.length > 0 ? context.roles : ['admin'],
  };
}

export function getBackendRequestContext(): RuntimeRequestContext {
  return activeRequestContext;
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
  headers.set('X-Tenant-Id', activeRequestContext.tenantId);
  headers.set('X-Project-Id', activeRequestContext.projectId);
  headers.set('X-Actor', activeRequestContext.actor);
  headers.set('X-Roles', activeRequestContext.roles.join(','));
  headers.set('X-Request-Id', activeRequestContext.requestId ?? activeRequestContext.actor);
  headers.set(
    'X-Correlation-Id',
    activeRequestContext.correlationId ?? activeRequestContext.requestId ?? activeRequestContext.actor,
  );

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
