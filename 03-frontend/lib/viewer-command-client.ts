// Viewer command API client.
// License: Apache-2.0

import { backendRequest, buildQuery } from './backend-api';

export type ViewerCommandStatus = 'queued' | 'executed' | 'skipped';

export interface ViewerAdapterCommand {
  id: string;
  adapter: string;
  command: string;
  artifactId: string | null;
  elementIds: string[];
  arguments: Record<string, unknown>;
  status: ViewerCommandStatus;
  auditEventId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewerCommandCreateRequest {
  adapter: string;
  command: string;
  moduleId?: string;
  artifactId?: string;
  elementIds?: string[];
  arguments?: Record<string, unknown>;
  actor?: string;
}

export interface ViewerCommandAckRequest {
  actor: string;
  status: Exclude<ViewerCommandStatus, 'queued'>;
  comment?: string;
  result?: Record<string, unknown>;
}

export interface ViewerCommandListResponse {
  commands: ViewerAdapterCommand[];
  total: number;
}

export const viewerCommandClient = {
  list: (
    params: {
      status?: ViewerCommandStatus;
      artifactId?: string;
      adapter?: string;
      command?: string;
    } = {},
  ) =>
    backendRequest<ViewerCommandListResponse>(
      `/v1/viewer/commands${buildQuery({
        status: params.status,
        artifact_id: params.artifactId,
        adapter: params.adapter,
        command: params.command,
      })}`,
      { cache: 'no-store' },
    ),
  create: (body: ViewerCommandCreateRequest) =>
    backendRequest<ViewerAdapterCommand>('/v1/viewer/commands', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  get: (commandId: string) =>
    backendRequest<ViewerAdapterCommand>(`/v1/viewer/commands/${commandId}`, {
      cache: 'no-store',
    }),
  ack: (commandId: string, body: ViewerCommandAckRequest) =>
    backendRequest<ViewerAdapterCommand>(`/v1/viewer/commands/${commandId}/ack`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
