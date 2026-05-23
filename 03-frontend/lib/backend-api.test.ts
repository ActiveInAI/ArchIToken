import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RUNTIME_ACTOR,
  DEFAULT_RUNTIME_PROJECT_ID,
  DEFAULT_RUNTIME_ROLES,
  DEFAULT_RUNTIME_TENANT_ID,
  backendRequest,
  buildRuntimeContextHeaders,
  setBackendRequestContext,
} from './backend-api';

function resetRuntimeContext() {
  setBackendRequestContext({
    tenantId: DEFAULT_RUNTIME_TENANT_ID,
    projectId: DEFAULT_RUNTIME_PROJECT_ID,
    actor: DEFAULT_RUNTIME_ACTOR,
    roles: DEFAULT_RUNTIME_ROLES,
    requestId: DEFAULT_RUNTIME_ACTOR,
    correlationId: DEFAULT_RUNTIME_ACTOR,
  });
}

describe('backend runtime context headers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetRuntimeContext();
  });

  it('uses UUID-safe default tenant and project headers', () => {
    const headers = buildRuntimeContextHeaders();

    expect(headers['X-Tenant-Id']).toBe(DEFAULT_RUNTIME_TENANT_ID);
    expect(headers['X-Project-Id']).toBe(DEFAULT_RUNTIME_PROJECT_ID);
    expect(headers['X-Tenant-Id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(headers['X-Project-Id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it('sends runtime context headers on backend requests', async () => {
    setBackendRequestContext({
      tenantId: '33333333-3333-4333-8333-333333333333',
      projectId: '44444444-4444-4444-8444-444444444444',
      actor: 'module-sync-test',
      roles: [],
      requestId: 'req-1',
      correlationId: 'corr-1',
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    await backendRequest<{ ok: boolean }>('/v1/projects');

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const init = firstCall![1];
    const headers = init?.headers as Headers;
    expect(headers.get('X-Tenant-Id')).toBe('33333333-3333-4333-8333-333333333333');
    expect(headers.get('X-Project-Id')).toBe('44444444-4444-4444-8444-444444444444');
    expect(headers.get('X-Actor')).toBe('module-sync-test');
    expect(headers.get('X-Roles')).toBe('admin');
    expect(headers.get('X-Request-Id')).toBe('req-1');
    expect(headers.get('X-Correlation-Id')).toBe('corr-1');
  });
});
