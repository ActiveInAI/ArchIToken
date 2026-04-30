// Standalone artifact API client.
// License: Apache-2.0

import { backendRequest, buildQuery } from './backend-api';

export interface ArtifactRef {
  artifactId: string;
  artifactKind: string;
  moduleId: string;
  status: string;
  name: string;
}

export interface ArtifactStorageBinding {
  artifactRole: string;
  provider: string;
  objectKey: string;
  objectUri: string;
  moduleFileId: string | null;
  fileReference: string;
}

export interface ArtifactMetadata {
  artifactRole: string;
  geometryFormat: string | null;
  propertyIndexFormat: string | null;
  elementIdNamespace: string | null;
  viewerAdapterHint: string | null;
  sourceModelId: string | null;
  schemaRef: string;
  checksum: string | null;
  mimeType: string;
  sizeBytes: number;
  owner: string;
  tenantId: string;
  projectId: string;
  version: number;
  requestId: string;
  correlationId: string;
  sourceJobId: string | null;
  createdByJobId: string | null;
  approvalStatus: string;
  auditEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  status: string;
  storage: ArtifactStorageBinding;
  metadata: ArtifactMetadata;
}

export interface Artifact {
  id: string;
  kind: string;
  status: string;
  objectUri: string | null;
  fileReference: string;
  schemaRef: string;
  version: number;
  hash: string | null;
  metadata: Record<string, unknown>;
  reference: ArtifactRef;
  storageBinding: ArtifactStorageBinding;
  artifactMetadata: ArtifactMetadata;
  versions: ArtifactVersion[];
}

export interface ArtifactListResponse {
  artifacts: Artifact[];
  total: number;
}

export const artifactClient = {
  list: (
    params: {
      moduleId?: string;
      kind?: string;
      status?: string;
      sourceJobId?: string;
    } = {},
  ) =>
    backendRequest<ArtifactListResponse>(
      `/v1/artifacts${buildQuery({
        module_id: params.moduleId,
        kind: params.kind,
        status: params.status,
        source_job_id: params.sourceJobId,
      })}`,
      { cache: 'no-store' },
    ),
  get: (artifactId: string) =>
    backendRequest<Artifact>(`/v1/artifacts/${artifactId}`, { cache: 'no-store' }),
  versions: (artifactId: string) =>
    backendRequest<ArtifactVersion[]>(`/v1/artifacts/${artifactId}/versions`, {
      cache: 'no-store',
    }),
  metadata: (artifactId: string) =>
    backendRequest<ArtifactMetadata>(`/v1/artifacts/${artifactId}/metadata`, {
      cache: 'no-store',
    }),
  storageBinding: (artifactId: string) =>
    backendRequest<ArtifactStorageBinding>(
      `/v1/artifacts/${artifactId}/storage-binding`,
      { cache: 'no-store' },
    ),
};
