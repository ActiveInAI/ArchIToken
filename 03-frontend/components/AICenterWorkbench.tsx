// components/AICenterWorkbench.tsx
// License: Apache-2.0
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Cpu, ExternalLink, Key, Network, Save, Server, Sparkles, CheckCircle2, Globe, Box } from 'lucide-react';
import { useLLMConfig, type ProviderId } from '@/lib/llm-provider';
import { getOllamaModels, getHfModels } from '@/lib/local-models-action';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import { createModuleAuditEvent } from '@/lib/module-actions';

const PROVIDERS: { id: ProviderId; name: string; icon: ReactNode; type: 'local' | 'cloud' }[] = [
  { id: 'ollama', name: 'Ollama', icon: <Box className="h-5 w-5" />, type: 'local' },
  { id: 'vllm', name: 'vLLM', icon: <Server className="h-5 w-5" />, type: 'local' },
  { id: 'huggingface', name: 'Hugging Face', icon: <Globe className="h-5 w-5" />, type: 'local' },
  { id: 'lmstudio', name: 'LM Studio', icon: <Cpu className="h-5 w-5" />, type: 'local' },
  { id: 'unsloth', name: 'Unsloth Studio', icon: <Sparkles className="h-5 w-5" />, type: 'local' },
  { id: 'openrouter', name: 'OpenRouter', icon: <Network className="h-5 w-5" />, type: 'cloud' },
  { id: 'google', name: 'Google', icon: <Globe className="h-5 w-5" />, type: 'cloud' },
  { id: 'deepseek', name: 'DeepSeek', icon: <Cpu className="h-5 w-5" />, type: 'cloud' },
  { id: 'openai', name: 'OpenAI', icon: <Network className="h-5 w-5" />, type: 'cloud' },
  { id: 'anthropic', name: 'Anthropic', icon: <Sparkles className="h-5 w-5" />, type: 'cloud' },
];

const ROLE_ALIAS_MODELS = [
  'architoken-planner',
  'architoken-generator',
  'architoken-evaluator',
];

const CLOUD_ALIAS_MODELS: Record<ProviderId, string[]> = {
  ollama: [],
  vllm: [],
  huggingface: [],
  lmstudio: [],
  unsloth: [],
  openrouter: ROLE_ALIAS_MODELS,
  google: ROLE_ALIAS_MODELS,
  openai: ROLE_ALIAS_MODELS,
  anthropic: ROLE_ALIAS_MODELS,
  deepseek: ROLE_ALIAS_MODELS,
};

const PROVIDER_ENDPOINTS: Record<ProviderId, { apiBaseUrl: string; consoleUrl?: string }> = {
  ollama: { apiBaseUrl: 'http://192.168.1.100:11434' },
  vllm: { apiBaseUrl: 'http://192.168.1.100:8000' },
  huggingface: { apiBaseUrl: 'https://api-inference.huggingface.co', consoleUrl: 'https://huggingface.co/models' },
  lmstudio: { apiBaseUrl: 'http://192.168.1.100:1234' },
  unsloth: { apiBaseUrl: 'http://192.168.1.100:8080', consoleUrl: 'https://unsloth.ai/' },
  openrouter: { apiBaseUrl: 'https://openrouter.ai/api/v1', consoleUrl: 'https://openrouter.ai/' },
  google: { apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', consoleUrl: 'https://aistudio.google.com/' },
  deepseek: { apiBaseUrl: 'https://api.deepseek.com/v1', consoleUrl: 'https://platform.deepseek.com/' },
  openai: { apiBaseUrl: 'https://api.openai.com/v1', consoleUrl: 'https://platform.openai.com/' },
  anthropic: { apiBaseUrl: 'https://api.anthropic.com/v1', consoleUrl: 'https://console.anthropic.com/' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (isRecord(entry) && typeof entry.id === 'string') return entry.id;
      return null;
    })
    .filter((id): id is string => Boolean(id));
}

function apiBaseUrlFor(provider: ProviderId, baseUrl?: string): string {
  return (baseUrl || PROVIDER_ENDPOINTS[provider].apiBaseUrl).replace(/\/+$/, '');
}

function modelCatalogUrl(provider: ProviderId, baseUrl?: string): string | null {
  const apiBaseUrl = apiBaseUrlFor(provider, baseUrl);

  if (provider === 'openrouter') {
    return `${apiBaseUrl}/models?output_modalities=all`;
  }

  if (['vllm', 'lmstudio', 'unsloth'].includes(provider)) {
    return apiBaseUrl.endsWith('/v1') ? `${apiBaseUrl}/models` : `${apiBaseUrl}/v1/models`;
  }

  return null;
}

function defaultModelFor(provider: ProviderId): string {
  return CLOUD_ALIAS_MODELS[provider][1] || CLOUD_ALIAS_MODELS[provider][0] || '';
}

export function AICenterWorkbench({ onAudit }: { onAudit?: (event: ModuleAuditEvent) => void }) {
  const { config, saveConfig, mounted } = useLLMConfig();
  const localConfig = config;
  const [syncedModels, setSyncedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentProvider = PROVIDERS.find(p => p.id === localConfig.provider);
  const providerEndpoint = PROVIDER_ENDPOINTS[localConfig.provider];
  const isLocal = currentProvider?.type === 'local';
  const dynamicModels = syncedModels.length > 0 ? syncedModels : CLOUD_ALIAS_MODELS[localConfig.provider];
  const modelSourceLabel = syncedModels.length > 0
    ? `${currentProvider?.name || localConfig.provider} catalog`
    : isLocal ? 'local runtime' : 'architoken router aliases';

  useEffect(() => {
    let cancelled = false;

    const fetchModels = async () => {
      setIsLoading(true);
      try {
        let models: string[] = [];
        if (localConfig.provider === 'ollama') {
          models = await getOllamaModels();
        } else if (localConfig.provider === 'huggingface') {
          models = await getHfModels();
        } else if (['vllm', 'lmstudio', 'unsloth'].includes(localConfig.provider)) {
          const url = modelCatalogUrl(localConfig.provider, localConfig.baseUrl);
          if (url) {
            const res = await fetch(url).catch(() => null);
            if (res && res.ok) {
              const data: unknown = await res.json();
              models = extractModelIds(data);
            }
          }
        } else if (localConfig.provider === 'openrouter') {
          const url = modelCatalogUrl(localConfig.provider, localConfig.baseUrl);
          if (url) {
            const headers: HeadersInit = localConfig.apiKey
              ? { Authorization: `Bearer ${localConfig.apiKey}` }
              : {};
            const res = await fetch(url, { headers }).catch(() => null);
            if (res && res.ok) {
              const data: unknown = await res.json();
              models = extractModelIds(data);
            }
          }
        }

        if (cancelled) {
          return;
        }

        const nextModels = models.length > 0 ? models : CLOUD_ALIAS_MODELS[localConfig.provider];
        setSyncedModels(models);
        if (nextModels.length > 0 && !nextModels.includes(localConfig.model)) {
          const fallbackModel = defaultModelFor(localConfig.provider) || nextModels[0];
          if (fallbackModel) saveConfig({ ...localConfig, model: fallbackModel });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchModels();

    return () => {
      cancelled = true;
    };
  }, [localConfig, saveConfig]);

  if (!mounted) return null;

  const handleSave = () => {
    saveConfig(localConfig);
    onAudit?.(createModuleAuditEvent('ai-config-update', 'AICenterWorkbench', `已切换大模型网关路由: ${localConfig.provider} -> ${localConfig.model}`));
  };

  return (
    <section className="arch-surface overflow-hidden rounded-[1.5rem] border mb-3">
      <header className="arch-surface-muted flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.28em]">
            AI Model Gateway & Routing
          </p>
          <h2 className="arch-text mt-1 text-xl font-black">大模型服务商与路由配置</h2>
          <p className="arch-muted mt-1 text-sm">
            统一管理本地推理引擎与云端大模型 API，支持动态同步与网关路由。
          </p>
        </div>
        <button
          onClick={handleSave}
          className="arch-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition"
        >
          <Save className="h-4 w-4" />
          保存路由配置
        </button>
      </header>

      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Network className="h-4 w-4 arch-primary-text" />
            选择服务商 (Provider)
          </h3>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSyncedModels([]);
                  saveConfig({
                    provider: p.id,
                    model: defaultModelFor(p.id),
                    apiKey: p.type === 'cloud' ? localConfig.apiKey : '',
                    baseUrl: PROVIDER_ENDPOINTS[p.id].apiBaseUrl,
                  });
                }}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  localConfig.provider === p.id
                    ? 'arch-card-selected'
                    : 'arch-card hover:border-[var(--arch-primary)]'
                }`}
              >
                <span className={localConfig.provider === p.id ? 'text-[var(--arch-primary)]' : 'arch-muted'}>
                  {p.icon}
                </span>
                <span className="font-bold text-sm">{p.name}</span>
                {localConfig.provider === p.id && <CheckCircle2 className="h-4 w-4 ml-auto text-[var(--arch-primary)]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 arch-card-muted rounded-2xl p-4 border self-start">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Key className="h-4 w-4 arch-primary-text" />
            {isLocal ? '本地推理服务配置' : '云端 API 鉴权配置'}
          </h3>

          <div className="space-y-3">
            <label className="block">
              <span className="arch-muted text-xs font-bold mb-1 block">选择模型 (Model)</span>
              <select
                value={localConfig.model}
                onChange={(e) => saveConfig({ ...localConfig, model: e.target.value })}
                disabled={isLoading}
                className="arch-input w-full rounded-xl px-3 py-2 text-sm bg-transparent border outline-none disabled:opacity-50"
              >
                {isLoading ? (
                  <option>同步环境中...</option>
                ) : dynamicModels.length > 0 ? (
                  dynamicModels.map(m => (
                    <option key={m} value={m} className="bg-[var(--arch-surface)] text-[var(--arch-text)]">{m}</option>
                  ))
                ) : (
                  <option value="">未检测到模型 (可手动输入)</option>
                )}
              </select>
              <span className="arch-muted mt-1 block text-[11px] font-bold">
                Source: {modelSourceLabel}
              </span>
            </label>

            {isLocal ? (
              <label className="block">
                <span className="arch-muted text-xs font-bold mb-1 block">API Base URL</span>
                <input
                  type="text"
                  value={localConfig.baseUrl || ''}
                  onChange={(e) => saveConfig({ ...localConfig, baseUrl: e.target.value })}
                  placeholder="http://192.168.1.100:8080"
                  className="arch-input w-full rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="arch-muted text-xs font-bold mb-1 block">API Base URL</span>
                  <input
                    type="text"
                    value={localConfig.baseUrl || providerEndpoint.apiBaseUrl}
                    onChange={(e) => saveConfig({ ...localConfig, baseUrl: e.target.value })}
                    className="arch-input w-full rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                  />
                </label>
                {providerEndpoint.consoleUrl && (
                  <a
                    href={providerEndpoint.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="arch-muted inline-flex items-center gap-1 text-xs font-bold hover:text-[var(--arch-primary)]"
                  >
                    Provider Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <label className="block">
                  <span className="arch-muted text-xs font-bold mb-1 block">API Key (Bearer Token)</span>
                  <input
                    type="password"
                    value={localConfig.apiKey}
                    onChange={(e) => saveConfig({ ...localConfig, apiKey: e.target.value })}
                    placeholder={`输入 ${currentProvider?.name} API Key`}
                    className="arch-input w-full rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
