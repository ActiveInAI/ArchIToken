// Fetch-based ArchIToken backend API adapter.
// License: Apache-2.0

export interface BackendApiError {
  error: string;
  code: number;
}

export const ARCHITOKEN_API_BASE_URL =
  process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL ?? 'http://localhost:8080';

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
  const response = await fetch(`${ARCHITOKEN_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
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
