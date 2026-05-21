// lib/llm-provider.ts
// License: Apache-2.0
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ProviderId =
  | 'openclaw' | 'ollama' | 'vllm' | 'huggingface' | 'lmstudio' | 'unsloth'
  | 'openrouter' | 'google' | 'deepseek' | 'openai' | 'anthropic';

export interface LLMConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

const STORAGE_KEY = 'architoken.llm_config';
const DEFAULT_ROUTER_MODEL = 'architoken-generator';

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'ollama',
  model: '',
  baseUrl: 'http://192.168.1.100:11434',
  apiKey: '',
};

const PROVIDER_IDS = new Set<ProviderId>([
  'openclaw',
  'ollama',
  'vllm',
  'huggingface',
  'lmstudio',
  'unsloth',
  'openrouter',
  'google',
  'deepseek',
  'openai',
  'anthropic',
]);

const CLOUD_PROVIDER_IDS = new Set<ProviderId>([
  'openrouter',
  'google',
  'deepseek',
  'openai',
  'anthropic',
]);

const ROUTER_ALIAS_MODELS = new Set([
  'architoken-planner',
  'architoken-generator',
  'architoken-evaluator',
]);

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedConfig: LLMConfig = DEFAULT_CONFIG;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeModel(provider: ProviderId, model: string): string {
  if (!CLOUD_PROVIDER_IDS.has(provider)) return model;
  if (!model || ROUTER_ALIAS_MODELS.has(model) || model.includes('/')) return model;

  const oldStaticVendorLabel = /^(Claude|GPT|ChatGPT|Gemini|Nano Banana|Qwen|GLM|DeepSeek|Gemma|Kimi|Llama)\b/i;
  return oldStaticVendorLabel.test(model) ? DEFAULT_ROUTER_MODEL : model;
}

function normalizeConfig(value: unknown): LLMConfig {
  if (!isRecord(value)) return DEFAULT_CONFIG;

  const provider = typeof value.provider === 'string' && PROVIDER_IDS.has(value.provider as ProviderId)
    ? value.provider as ProviderId
    : DEFAULT_CONFIG.provider;

  const normalized: LLMConfig = {
    provider,
    model: normalizeModel(provider, typeof value.model === 'string' ? value.model : DEFAULT_CONFIG.model),
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : DEFAULT_CONFIG.apiKey,
  };

  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl : DEFAULT_CONFIG.baseUrl;
  if (baseUrl) {
    normalized.baseUrl = baseUrl;
  }

  return normalized;
}

function readClientSnapshot(): LLMConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedConfig;

  cachedRaw = raw;
  if (!raw) {
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    cachedConfig = normalizeConfig(JSON.parse(raw));
  } catch {
    cachedConfig = DEFAULT_CONFIG;
  }

  return cachedConfig;
}

function readServerSnapshot(): LLMConfig {
  return DEFAULT_CONFIG;
}

function emitStorageChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = undefined;
      listener();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

export function useLLMConfig() {
  const config = useSyncExternalStore(subscribe, readClientSnapshot, readServerSnapshot);

  const saveConfig = useCallback((newConfig: LLMConfig) => {
    const normalized = normalizeConfig(newConfig);
    const raw = JSON.stringify(normalized);

    cachedRaw = raw;
    cachedConfig = normalized;

    window.localStorage.setItem(STORAGE_KEY, raw);
    emitStorageChange();
  }, []);

  return { config, saveConfig, mounted: true };
}
