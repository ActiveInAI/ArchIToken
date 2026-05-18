import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createModuleFile,
  isBackendModuleFileId,
  listModuleFiles,
  mapBackendModuleFileNode,
  moveModuleFile,
  toBackendParentId,
  type BackendModuleFileNode,
} from './module-file-api-client';
import { getModuleRootId } from './module-file-system';

const backendFolder: BackendModuleFileNode = {
  id: '11111111-1111-4111-8111-111111111111',
  moduleId: 'marketing_service',
  parentId: null,
  name: '客户线索',
  kind: 'folder',
  status: 'active',
  metadata: {
    sizeBytes: 0,
    mimeType: null,
    checksum: null,
    version: 1,
    owner: '客户经理',
    tags: ['lead'],
    createdAt: '2026-05-16T01:00:00Z',
    updatedAt: '2026-05-16T01:00:00Z',
  },
};

const backendFile: BackendModuleFileNode = {
  id: '22222222-2222-4222-8222-222222222222',
  moduleId: 'marketing_service',
  parentId: backendFolder.id,
  name: '客户线索表.xlsx',
  kind: 'file',
  status: 'shared',
  metadata: {
    sizeBytes: 4096,
    mimeType: null,
    checksum: 'sha256:abc',
    version: 3,
    owner: '商务经理',
    tags: ['excel'],
    createdAt: '2026-05-16T01:01:00Z',
    updatedAt: '2026-05-16T01:02:00Z',
  },
};

describe('module file api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps backend CDE nodes into frontend module file nodes', () => {
    const folder = mapBackendModuleFileNode(backendFolder);
    const file = mapBackendModuleFileNode(backendFile);

    expect(folder.parentId).toBe(getModuleRootId('marketing_service'));
    expect(folder.mimeType).toBe('inode/directory');
    expect(folder.source).toBe('backend');
    expect(file.parentId).toBe(backendFolder.id);
    expect(file.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(file.status).toBe('shared');
    expect(file.version).toBe('v3.0');
    expect(file.permissions).toEqual(['read', 'share']);
    expect(file.checksum).toBe('sha256:abc');
  });

  it('lists module files through the backend API and maps the response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(
        JSON.stringify({
          files: [backendFolder, backendFile],
          total: 2,
          pageInfo: { hasNextPage: false },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await listModuleFiles('marketing_service', {
      parentId: getModuleRootId('marketing_service'),
      kind: 'file',
      limit: 10,
    });

    expect(response.total).toBe(2);
    expect(response.files.map((file) => file.id)).toEqual([
      backendFolder.id,
      backendFile.id,
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:8080/v1/modules/marketing_service/files?kind=file&limit=10',
    );
  });

  it('normalizes frontend root ids and rejects non-backend parents for writes', async () => {
    expect(isBackendModuleFileId(backendFolder.id)).toBe(true);
    expect(isBackendModuleFileId('marketing_service-root')).toBe(false);
    expect(toBackendParentId('marketing_service', getModuleRootId('marketing_service'))).toBeNull();
    expect(toBackendParentId('marketing_service', backendFolder.id)).toBe(
      backendFolder.id,
    );

    await expect(
      createModuleFile({
        moduleId: 'marketing_service',
        parentId: 'marketing_service-seeded-folder',
        name: '线索.md',
        kind: 'file',
      }),
    ).rejects.toThrow(/non-backend parent/u);
  });

  it('posts create and move operations with backend parent ids', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      const payload = url.includes('/move')
        ? { ...backendFile, parentId: null, metadata: { ...backendFile.metadata, version: 4 } }
        : backendFile;
      return new Response(JSON.stringify(payload), {
        status: url.includes('/modules/') ? 201 : 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await createModuleFile({
      moduleId: 'marketing_service',
      parentId: backendFolder.id,
      name: '客户线索表.xlsx',
      kind: 'file',
      owner: '商务经理',
      tags: ['excel'],
      checksum: 'sha256:upload',
    });
    await moveModuleFile(backendFile.id, {
      moduleId: 'marketing_service',
      targetParentId: getModuleRootId('marketing_service'),
      actor: 'tester',
    });

    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const moveBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(createBody).toMatchObject({
      name: '客户线索表.xlsx',
      kind: 'file',
      parentId: backendFolder.id,
      owner: '商务经理',
      tags: ['excel'],
      checksum: 'sha256:upload',
    });
    expect(createBody.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(moveBody).toEqual({
      targetParentId: null,
      actor: 'tester',
    });
  });
});
