// Generation API client.
// License: Apache-2.0

import { backendRequest, buildQuery } from './backend-api';
import type { Artifact } from './artifact-client';

export type GenerationReviewDecision = 'approved' | 'rejected' | 'needs_changes';

export interface GenerationInput {
  moduleId: string;
  mode: string;
  prompt: string;
  actor?: string;
  inputArtifacts?: Artifact[];
  constraints?: Record<string, unknown>;
}

export interface GenerationActionRequest {
  actor?: string;
  comment?: string;
}

export interface GenerationReviewRequest {
  reviewer: string;
  decision: GenerationReviewDecision;
  comment?: string;
}

export interface GenerationJob {
  id: string;
  moduleId: string;
  mode: string;
  status: string;
  artifacts: Artifact[];
  lifecycleTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationJobListResponse {
  jobs: GenerationJob[];
  total: number;
}

export interface GenerationArtifactsResponse {
  jobId: string;
  artifacts: Artifact[];
}

export const generationClient = {
  list: (params: { moduleId?: string; status?: string; mode?: string } = {}) =>
    backendRequest<GenerationJobListResponse>(
      `/v1/generation/jobs${buildQuery({
        module_id: params.moduleId,
        status: params.status,
        mode: params.mode,
      })}`,
      { cache: 'no-store' },
    ),
  create: (input: GenerationInput) =>
    backendRequest<GenerationJob>('/v1/generation/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  plan: (jobId: string, body: GenerationActionRequest) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/plan`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  run: (jobId: string, body: GenerationActionRequest) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  review: (jobId: string, body: GenerationReviewRequest) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  approve: (jobId: string, body: GenerationActionRequest) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reject: (jobId: string, body: GenerationActionRequest) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  artifacts: (jobId: string) =>
    backendRequest<GenerationArtifactsResponse>(
      `/v1/generation/jobs/${jobId}/artifacts`,
      { cache: 'no-store' },
    ),
};
