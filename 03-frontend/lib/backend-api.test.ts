import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RUNTIME_ACTOR,
  DEFAULT_RUNTIME_PROJECT_ID,
  DEFAULT_RUNTIME_ROLES,
  DEFAULT_RUNTIME_TENANT_ID,
  backendRequest,
  buildRuntimeContextHeaders,
  fetchBimSemanticReadiness,
  listAssets,
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

  it('requests IFC assets and BIM semantic readiness through backend routes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.includes('/v1/assets')) {
        return new Response(
          JSON.stringify({
            total: 1,
            assets: [
              {
                metadata: {
                  id: 'asset-1',
                  tenantId: DEFAULT_RUNTIME_TENANT_ID,
                  projectId: DEFAULT_RUNTIME_PROJECT_ID,
                  createdAt: '2026-05-27T00:00:00Z',
                  updatedAt: '2026-05-27T00:00:00Z',
                },
                assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                kind: 'ifc',
                name: 'model.ifc',
                status: 'ready',
                payload: {},
              },
            ],
            pageInfo: { limit: 1, nextCursor: null, hasMore: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          readinessStatus: 'ready_for_openbim_review',
          semantics: {},
          semanticLayers: {},
          requiredEvidence: {},
          openBimClaim: {
            status: 'ready_for_openbim_review',
            mayClaimBuildingSmartOpenBim: false,
          },
          missingEvidence: [],
          failedEvidence: [],
          artifacts: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const assets = await listAssets({ kind: 'ifc', limit: 1 });
    const readiness = await fetchBimSemanticReadiness(assets.assets[0]!.assetId);

    expect(assets.assets[0]!.name).toBe('model.ifc');
    expect(readiness.readinessStatus).toBe('ready_for_openbim_review');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v1/assets?kind=ifc&limit=1');
    expect(String(fetchMock.mock.calls[1]![0])).toContain(
      '/v1/bim/models/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/openbim-readiness',
    );
  });
});
