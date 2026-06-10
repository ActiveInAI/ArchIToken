// lib/local-models-action.ts
// License: Apache-2.0
"use server";

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface LocalModelCatalogEntry {
  id: string;
  taskType: string;
  capability: string;
  capabilities?: string[];
  availableTaskTypes?: string[];
  availableCapabilities?: string[];
  configured?: boolean;
  runtimeConfigured?: boolean;
  repositoryAvailable?: boolean;
  cached?: boolean;
  source?: string;
  runtime?: string;
  requiresRuntime?: string | null;
}

export type ProviderModelCatalogId =
  | "vllm"
  | "lmstudio"
  | "qwen"
  | "gemini"
  | "zhipu"
  | "kimi"
  | "minimax";

export interface ProviderSecretStatus {
  configured: boolean;
  mode: "server_secret" | "not_required";
  tokenEnv?: string;
}

// 过滤终端输出的 ANSI 颜色和样式代码
function stripAnsi(str: string) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

export async function getOllamaModels(): Promise<string[]> {
  const models: Set<string> = new Set();
  try {
    const { stdout } = await execAsync("ollama ls");
    const lines = stripAnsi(stdout).split("\n").slice(1);
    for (const line of lines) {
      if (!line.trim() || line.includes("NAME")) continue;
      const parts = line.trim().split(/\s+/);
      if (parts[0]) models.add(parts[0]);
    }
  } catch (e) {
    console.error("Ollama fetch error:", e);
  }
  return Array.from(models).sort();
}

export async function getHfModels(): Promise<string[]> {
  return (await getHfModelCatalog()).map((model) => model.id);
}

export async function getProviderModelCatalog({
  provider,
  baseUrl,
}: {
  provider: ProviderModelCatalogId;
  baseUrl?: string;
}): Promise<string[]> {
  const url = providerModelCatalogUrl(provider, baseUrl);
  if (!url) return [];

  const headers = providerAuthorizationHeaders(provider);

  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) return [];
    return extractModelIds(await response.json());
  } catch (e) {
    console.error("Provider model catalog fetch error:", e);
    return [];
  }
}

export async function getProviderSecretStatus(
  provider: string,
): Promise<ProviderSecretStatus> {
  const tokenEnv = providerTokenEnv(provider);
  if (!tokenEnv) return { configured: true, mode: "not_required" };
  return {
    configured: Boolean(process.env[tokenEnv]),
    mode: "server_secret",
    tokenEnv,
  };
}

export async function getHfModelCatalog(): Promise<LocalModelCatalogEntry[]> {
  const models: string[] = [];
  const seen = new Set<string>();
  const addModel = (id: string) => {
    const normalized = id.trim().replace(/^model\//, "");
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    models.push(normalized);
  };
  const endpoint =
    process.env.ARCHITOKEN_HF_MODELS_URL ??
    process.env.ARCHITOKEN_HF_ENDPOINT_MODELS_URL ??
    "http://127.0.0.1:7071/v1/models";
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (response.ok) {
      const payload: unknown = await response.json();
      const catalog = extractHfModelCatalog(payload);
      if (catalog.length > 0) {
        return catalog;
      }
    }
  } catch (e) {
    console.error("HF endpoint fetch error:", e);
  }

  try {
    const { stdout } = await execAsync("hf cache list --no-truncate");
    const lines = stripAnsi(stdout).split("\n").slice(2);
    for (const line of lines) {
      if (!line.trim() || line.startsWith("Found") || line.startsWith("---"))
        continue;
      const parts = line.trim().split(/\s+/);
      if (parts[0]) {
        addModel(parts[0]);
      }
    }
  } catch (e) {
    console.error("HF fetch error:", e);
  }
  return models.map((id) => inferHfModelCatalogEntry(id));
}

function providerModelCatalogUrl(
  provider: ProviderModelCatalogId,
  baseUrl?: string,
): string | null {
  const apiBaseUrl = providerApiBaseUrl(provider, baseUrl);

  return /\/(v1|v4|openai)$/.test(apiBaseUrl)
    ? `${apiBaseUrl}/models`
    : `${apiBaseUrl}/v1/models`;
}

function providerApiBaseUrl(
  provider: ProviderModelCatalogId,
  baseUrl?: string,
): string {
  const baseUrls: Record<ProviderModelCatalogId, string> = {
    vllm: "http://127.0.0.1:8000/v1",
    lmstudio: "http://127.0.0.1:1234/v1",
    qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    zhipu: "https://open.bigmodel.cn/api/paas/v4",
    kimi: "https://api.moonshot.cn/v1",
    minimax: "https://api.minimax.io/v1",
  };
  return (baseUrl || baseUrls[provider]).replace(/\/+$/, "");
}

function providerAuthorizationHeaders(
  provider: ProviderModelCatalogId,
): HeadersInit {
  const tokenEnv = providerTokenEnv(provider);
  if (!tokenEnv) return {};
  const token = process.env[tokenEnv];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function providerTokenEnv(provider: string): string | undefined {
  if (provider === "huggingface") return "HF_TOKEN";
  if (provider === "qwen") return "DASHSCOPE_API_KEY";
  if (provider === "gemini") return "GEMINI_API_KEY";
  if (provider === "zhipu") return "ZHIPUAI_API_KEY";
  if (provider === "kimi") return "MOONSHOT_API_KEY";
  if (provider === "minimax") return "MINIMAX_API_KEY";
  return undefined;
}

function extractHfModelCatalog(payload: unknown): LocalModelCatalogEntry[] {
  if (!isRecord(payload)) return [];

  const candidates = [payload.data, payload.models, payload.repositoryModelIds];

  const catalog: LocalModelCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const entry of candidate) {
      let model: LocalModelCatalogEntry | null = null;
      if (typeof entry === "string") {
        model = inferHfModelCatalogEntry(entry);
      } else if (isRecord(entry) && typeof entry.id === "string") {
        model = normalizeHfModelCatalogEntry(entry);
      }
      if (!model?.id || seen.has(model.id)) continue;
      seen.add(model.id);
      catalog.push(model);
    }
    if (catalog.length > 0) break;
  }

  return catalog;
}

function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (isRecord(entry) && typeof entry.id === "string") return entry.id;
      return null;
    })
    .filter((id): id is string => Boolean(id));
}

function normalizeHfModelCatalogEntry(
  entry: Record<string, unknown>,
): LocalModelCatalogEntry {
  const id = entry.id as string;
  const inferred = inferHfModelCatalogEntry(id);
  const capabilities = toStringArray(entry.capabilities);
  const availableTaskTypes = toStringArray(entry.availableTaskTypes);
  const availableCapabilities = toStringArray(entry.availableCapabilities);
  return {
    ...inferred,
    id,
    taskType:
      typeof entry.taskType === "string" ? entry.taskType : inferred.taskType,
    capability:
      typeof entry.capability === "string"
        ? entry.capability
        : inferred.capability,
    ...(capabilities.length > 0 ? { capabilities } : {}),
    ...(availableTaskTypes.length > 0 ? { availableTaskTypes } : {}),
    ...(availableCapabilities.length > 0 ? { availableCapabilities } : {}),
    ...(typeof entry.configured === "boolean"
      ? { configured: entry.configured }
      : {}),
    ...(typeof entry.runtimeConfigured === "boolean"
      ? { runtimeConfigured: entry.runtimeConfigured }
      : {}),
    ...(typeof entry.repositoryAvailable === "boolean"
      ? { repositoryAvailable: entry.repositoryAvailable }
      : {}),
    ...(typeof entry.cached === "boolean" ? { cached: entry.cached } : {}),
    ...(typeof entry.source === "string" ? { source: entry.source } : {}),
    ...(typeof entry.runtime === "string" ? { runtime: entry.runtime } : {}),
    ...(typeof entry.requiresRuntime === "string" ||
    entry.requiresRuntime === null
      ? { requiresRuntime: entry.requiresRuntime }
      : {}),
  };
}

function inferHfModelCatalogEntry(id: string): LocalModelCatalogEntry {
  const normalized = id.trim().replace(/^model\//, "");
  const lowered = normalized.toLowerCase();
  if (lowered.includes("paddleocr")) {
    return { id: normalized, taskType: "ocr", capability: "document.ocr" };
  }
  if (lowered.includes("ernie-image")) {
    return {
      id: normalized,
      taskType: "text_to_image",
      capability: "image.generate",
    };
  }
  if (lowered.includes("flux")) {
    return {
      id: normalized,
      taskType: "image_to_image",
      capability: "image.transform",
    };
  }
  if (lowered.includes("ltx")) {
    return {
      id: normalized,
      taskType: "text_to_video",
      capability: "video.text_to_video",
    };
  }
  if (lowered.includes("hy-world")) {
    return {
      id: normalized,
      taskType: "image_to_3d",
      capability: "world.image_to_3d",
    };
  }
  if (lowered.includes("asset-harvester")) {
    return {
      id: normalized,
      taskType: "object_to_3d_asset",
      capability: "asset.object_to_3d",
    };
  }
  if (lowered.includes("lyra")) {
    return {
      id: normalized,
      taskType: "world_3d_research",
      capability: "world.research_3d",
    };
  }
  if (lowered.includes("c-radiov2")) {
    return {
      id: normalized,
      taskType: "vision_embedding",
      capability: "vision.embedding",
    };
  }
  if (lowered.includes("industrialcoder")) {
    return { id: normalized, taskType: "code", capability: "model.code" };
  }
  return { id: normalized, taskType: "chat", capability: "model.chat" };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
