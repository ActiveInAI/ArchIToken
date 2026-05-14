// components/AICenterWorkbench.tsx
// License: Apache-2.0
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Cpu, Key, Network, Save, Server, Sparkles, CheckCircle2, Globe, Box } from 'lucide-react';
import { useLLMConfig, type ProviderId } from '@/lib/llm-provider';
import { getOllamaModels, getHfModels } from '@/lib/local-models-action';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import { createMockAuditEvent } from '@/lib/module-actions';

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

const CLOUD_MODELS: Record<string, string[]> = {
  openrouter: ['Nano Banana 2', 'Claude Opus 4.7', 'Gemini 3.1 Pro', 'DeepSeek-V4-Pro', 'GPT-5.5 Instant'],
  google: ['Gemini 3.1 Pro', 'Gemini 3.1 Flash-Lite', 'Gemini 3.1 Flash Live', 'Nano Banana 2'],
  openai: ['GPT-5.5 Instant', 'GPT-5.4 mini', 'GPT-5.4 nano', 'ChatGPT Images 2.0'],
  anthropic: ['Claude Opus 4.7', 'Claude Opus 4.6', 'Claude Sonnet 4.6'],
  deepseek: ['DeepSeek-V4-Pro', 'DeepSeek-V4-Flash'],
};


const DEFAULT_BASE_URLS: Record<string, string> = {
  ollama: 'http://192.168.1.100:11434',
  vllm: 'http://192.168.1.100:8000',
  huggingface: 'https://api-inference.huggingface.co',
  lmstudio: 'http://192.168.1.100:1234',
  unsloth: 'http://192.168.1.100:8080',
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
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

export function AICenterWorkbench({ onAudit }: { onAudit?: (event: ModuleAuditEvent) => void }) {
  const { config, saveConfig, mounted } = useLLMConfig();
  const localConfig = config;
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentProvider = PROVIDERS.find(p => p.id === localConfig.provider);
  const isLocal = currentProvider?.type === 'local';
  const dynamicModels = isLocal ? localModels : (CLOUD_MODELS[localConfig.provider] || []);

  // 动态同步模型逻辑
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        let models: string[] = [];
        if (localConfig.provider === 'ollama') {
          models = await getOllamaModels();
        } else if (localConfig.provider === 'huggingface') {
          models = await getHfModels();
        } else if (['vllm', 'lmstudio', 'unsloth'].includes(localConfig.provider)) {
          // 对于提供 API 的本地服务，尝试请求 /v1/models
          if (localConfig.baseUrl) {
            const res = await fetch(`${localConfig.baseUrl}/v1/models`).catch(() => null);
            if (res && res.ok) {
              const data: unknown = await res.json();
              models = extractModelIds(data);
            }
          }
        }

        setLocalModels(models);
        if (models.length > 0 && !models.includes(localConfig.model)) {
          const firstModel = models[0];
          if (firstModel) {
            saveConfig({ ...localConfig, model: firstModel });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    if (isLocal) {
      void fetchModels();
    }
  }, [isLocal, localConfig, saveConfig]);

  if (!mounted) return null;

  const handleSave = () => {
    saveConfig(localConfig);
    onAudit?.(createMockAuditEvent('ai-config-update', 'AICenterWorkbench', `已切换大模型网关路由: ${localConfig.provider} -> ${localConfig.model}`));
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
                onClick={() => saveConfig({
                  ...localConfig,
                  provider: p.id,
                  model: '',
                  baseUrl: DEFAULT_BASE_URLS[p.id] || ''
                })}
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
            </label>

            {isLocal ? (
              <label className="block">
                <span className="arch-muted text-xs font-bold mb-1 block">API Base URL</span>
                <input
                  type="text"
                  value={localConfig.baseUrl || ''}
                  onChange={(e) => saveConfig({ ...localConfig, baseUrl: e.target.value })}
                  placeholder="http://192.168.1.100:8081"
                  className="arch-input w-full rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                />
              </label>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
