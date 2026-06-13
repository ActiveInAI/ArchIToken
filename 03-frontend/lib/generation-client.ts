// lib/generation-client.ts
// License: Apache-2.0

import { ARCHITOKEN_API_BASE_URL, backendRequest, buildQuery } from "./backend-api";
import type { Artifact } from "./artifact-client";

function defaultApiBase(): string {
  if (process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  return "http://localhost:8080";
}

const FALLBACK_MODELS = [
  "architoken-planner",
  "architoken-generator",
  "architoken-evaluator",
  "architoken-rule-checker",
  "architoken-schema-validator",
  "architoken-approver",
];

interface StoredLLMConfig {
  provider?: string;
  model?: string;
  baseUrl?: string;
}

interface ModelEntry {
  id?: unknown;
}

interface ModelListEnvelope {
  data?: unknown;
  models?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getConfig(): StoredLLMConfig | null {
  if (typeof window === "undefined") return null;

  const saved = localStorage.getItem("architoken.llm_config");
  if (!saved) return null;

  try {
    const parsed: unknown = JSON.parse(saved);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function modelIdFromEntry(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (!isRecord(entry)) return null;

  const id = entry.id;
  return typeof id === "string" ? id : null;
}

function extractModelIds(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map(modelIdFromEntry)
      .filter((id): id is string => Boolean(id));
  }

  if (!isRecord(payload)) return [];

  const envelope = payload as ModelListEnvelope;

  if (Array.isArray(envelope.data)) {
    return envelope.data
      .map((entry: ModelEntry | unknown) => modelIdFromEntry(entry))
      .filter((id): id is string => Boolean(id));
  }

  if (Array.isArray(envelope.models)) {
    return envelope.models
      .map(modelIdFromEntry)
      .filter((id): id is string => Boolean(id));
  }

  return [];
}

function resolveBaseUrl(config: StoredLLMConfig | null): string {
  void config;
  return defaultApiBase();
}

export async function fetchAvailableModels(): Promise<string[]> {
  try {
    const config = getConfig();
    const baseUrl = resolveBaseUrl(config);

    const res = await fetch(`${baseUrl}/v1/models`);
    if (!res.ok) return FALLBACK_MODELS;

    const data: unknown = await res.json();
    const models = extractModelIds(data);

    return models.length > 0 ? models : FALLBACK_MODELS;
  } catch (e) {
    console.error("Failed to fetch models, using fallback", e);
    return FALLBACK_MODELS;
  }
}

export async function generateBimModel(
  prompt: string,
  modelId?: string,
): Promise<string> {
  const config = getConfig();
  const baseUrl = resolveBaseUrl(config);
  const targetModel = modelId || config?.model || "architoken-generator";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${baseUrl}/v1/generate/text-to-bim`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, model: targetModel }),
  });

  if (!res.ok) throw new Error("Generation failed");

  const data: unknown = await res.json();

  if (isRecord(data) && typeof data.download_url === "string")
    return data.download_url;
  if (isRecord(data) && typeof data.ifc_content === "string")
    return data.ifc_content;
  return typeof data === "string" ? data : JSON.stringify(data);
}

export type GenerationJobStatus =
  | "draft"
  | "created"
  | "planned"
  | "running"
  | "completed"
  | "reviewed"
  | "approved"
  | "rejected"
  | "failed"
  | string;

export interface GenerationJob {
  id: string;
  moduleId?: string;
  module_id?: string;
  mode?: string;
  prompt?: string;
  status: GenerationJobStatus;
  actor?: string;
  reviewer?: string;
  decision?: string;
  comment?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GenerationJobListResponse {
  jobs: GenerationJob[];
  total: number;
}

export interface GenerationJobCreateRequest {
  moduleId: string;
  mode: string;
  prompt: string;
  actor?: string;
  inputArtifacts?: Artifact[];
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GenerationJobActionRequest {
  actor?: string;
  reviewer?: string;
  decision?: "approved" | "rejected" | string;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationArtifactsResponse {
  jobId: string;
  artifacts: Artifact[];
}

export const generationClient = {
  list: (
    params: {
      moduleId?: string;
      status?: string;
      mode?: string;
      actor?: string;
    } = {},
  ) =>
    backendRequest<GenerationJobListResponse>(
      `/v1/generation/jobs${buildQuery({
        module_id: params.moduleId,
        status: params.status,
        mode: params.mode,
        actor: params.actor,
      })}`,
      { cache: "no-store" },
    ),

  create: (body: GenerationJobCreateRequest) =>
    backendRequest<GenerationJob>("/v1/generation/jobs", {
      method: "POST",
      timeoutMs: 60_000,
      body: JSON.stringify({
        moduleId: body.moduleId,
        mode: body.mode,
        prompt: body.prompt,
        actor: body.actor,
        inputArtifacts: body.inputArtifacts,
        constraints: body.constraints ?? body.metadata,
      }),
    }),

  get: (jobId: string) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}`, {
      cache: "no-store",
    }),

  plan: (jobId: string, body: GenerationJobActionRequest = {}) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/plan`, {
      method: "POST",
      timeoutMs: 60_000,
      body: JSON.stringify(body),
    }),

  run: (
    jobId: string,
    body: GenerationJobActionRequest = {},
    options: { timeoutMs?: number } = {},
  ) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/run`, {
      method: "POST",
      timeoutMs: options.timeoutMs ?? 10 * 60_000,
      body: JSON.stringify(body),
    }),

  review: (jobId: string, body: GenerationJobActionRequest = {}) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  approve: (jobId: string, body: GenerationJobActionRequest = {}) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  reject: (jobId: string, body: GenerationJobActionRequest = {}) =>
    backendRequest<GenerationJob>(`/v1/generation/jobs/${jobId}/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  artifacts: (jobId: string) =>
    backendRequest<GenerationArtifactsResponse>(
      `/v1/generation/jobs/${jobId}/artifacts`,
      {
        cache: "no-store",
        timeoutMs: 60_000,
      },
    ),

  artifactContentUrl: (artifactId: string) =>
    `${ARCHITOKEN_API_BASE_URL}/v1/artifacts/${artifactId}/content`,
};
