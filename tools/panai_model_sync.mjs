#!/usr/bin/env node
// Sync local Ollama and Hugging Face cache models into the project-local PanAI config.
// License: Apache-2.0

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = resolve(rootDir, '.panai/panai.json');
const defaultPidPath = resolve(rootDir, '.panai/model-sync.pid');
const defaultLogPath = resolve(rootDir, '.panai/model-sync.log');

const defaultModelConfig = {
  input: ['text'],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: 128000,
  maxTokens: 8192,
};

const modelDefinitionFields = new Set([
  'id',
  'name',
  'api',
  'baseUrl',
  'reasoning',
  'input',
  'cost',
  'contextWindow',
  'contextTokens',
  'maxTokens',
  'params',
  'agentRuntime',
  'headers',
  'compat',
  'metadataSource',
]);

const preferredHuggingFaceModels = ['huggingface/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4'];

const retiredHuggingFaceModelIds = ['Qwen/Qwen2.5-0.5B-Instruct-GGUF'];

const preferredOllamaFallbacks = [
  'ollama/Insome:32B',
  'ollama/Insome:7B',
  'ollama/qwen3.6:35b-a3b',
  'ollama/granite4.1:30b-q8_0',
  'ollama/nemotron-3-nano:30b',
];

function parseArgs(argv) {
  const args = {
    command: 'once',
    config: process.env.PANAI_CONFIG_PATH || defaultConfigPath,
    ollamaUrl: process.env.PANAI_OLLAMA_URL || 'http://127.0.0.1:11434',
    hfBaseUrl: process.env.PANAI_HF_BASE_URL || 'http://127.0.0.1:7071/v1',
    intervalSeconds: Number(process.env.PANAI_MODEL_SYNC_INTERVAL || 60),
    pidFile: process.env.PANAI_MODEL_SYNC_PID || defaultPidPath,
    logFile: process.env.PANAI_MODEL_SYNC_LOG || defaultLogPath,
    dryRun: false,
    noHf: false,
    includeHfCacheWhenOffline: false,
    includeUnconfiguredHfEndpointModels: true,
    noOllama: false,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') args.command = 'once';
    else if (arg === '--watch') args.command = 'watch';
    else if (arg === '--daemon') args.command = 'daemon';
    else if (arg === '--status') args.command = 'status';
    else if (arg === '--stop') args.command = 'stop';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-hf') args.noHf = true;
    else if (arg === '--include-hf-cache-when-offline') args.includeHfCacheWhenOffline = true;
    else if (arg === '--include-unconfigured-hf-endpoint-models') args.includeUnconfiguredHfEndpointModels = true;
    else if (arg === '--no-ollama') args.noOllama = true;
    else if (arg === '--quiet') args.quiet = true;
    else if (arg === '--config') args.config = requiredValue(argv, ++index, arg);
    else if (arg === '--ollama-url') args.ollamaUrl = requiredValue(argv, ++index, arg);
    else if (arg === '--hf-base-url') args.hfBaseUrl = requiredValue(argv, ++index, arg);
    else if (arg === '--interval') args.intervalSeconds = Number(requiredValue(argv, ++index, arg));
    else if (arg === '--pid-file') args.pidFile = requiredValue(argv, ++index, arg);
    else if (arg === '--log-file') args.logFile = requiredValue(argv, ++index, arg);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.intervalSeconds) || args.intervalSeconds < 5) {
    throw new Error('--interval must be at least 5 seconds');
  }

  args.config = resolve(rootDir, args.config);
  args.pidFile = resolve(rootDir, args.pidFile);
  args.logFile = resolve(rootDir, args.logFile);
  return args;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: bun tools/panai_model_sync.mjs [--once|--watch|--daemon|--status|--stop]

Sync local model inventory into .panai/panai.json.

Options:
  --once                 Run one sync pass. Default.
  --watch                Poll continuously and sync changes.
  --daemon               Start --watch in the background.
  --status               Show daemon status.
  --stop                 Stop the daemon started with --daemon.
  --interval <seconds>   Watch polling interval. Default: 60.
  --config <path>        PanAI config path. Default: .panai/panai.json.
  --ollama-url <url>     Ollama base URL. Default: http://127.0.0.1:11434.
  --hf-base-url <url>    Hugging Face-compatible local endpoint. Default: http://127.0.0.1:7071/v1.
  --no-ollama            Skip Ollama discovery.
  --no-hf                Skip Hugging Face cache discovery.
  --include-hf-cache-when-offline
                         Keep HF cache models in PanAI even when --hf-base-url is offline.
  --include-unconfigured-hf-endpoint-models
                         Include HF models from --hf-base-url even when their runtime is not marked configured. Default: true.
  --dry-run              Print changes without writing config.
  --quiet                Reduce logs.
`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tempPath, path);
}

function hashValue(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function modelDisplayName(id) {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

function inferInput(repoId) {
  const id = repoId.toLowerCase();
  if (/(image|vision|vl|ocr|radio|flux|ernie-image|lyra|hy-world|asset)/.test(id)) {
    return ['text', 'image'];
  }
  return ['text'];
}

function inferReasoning(repoId) {
  return /(reasoning|thinking|coder|qwen|nemotron|granite|gemma|industrialcoder)/i.test(repoId);
}

function normalizeExistingModel(model) {
  if (!model || typeof model !== 'object') return {};
  const copy = {};
  for (const [key, value] of Object.entries(model)) {
    if (modelDefinitionFields.has(key)) copy[key] = value;
  }
  if (!Array.isArray(copy.input)) delete copy.input;
  return copy;
}

function mergeModel(existing, next) {
  const previous = normalizeExistingModel(existing);
  return {
    ...defaultModelConfig,
    ...previous,
    ...next,
    cost: {
      ...defaultModelConfig.cost,
      ...(previous.cost && typeof previous.cost === 'object' ? previous.cost : {}),
      ...(next.cost && typeof next.cost === 'object' ? next.cost : {}),
    },
  };
}

async function readOllamaModels(args, existingModels) {
  if (args.noOllama) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(new URL('/api/tags', args.ollamaUrl), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Ollama tags request failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    const ids = [...new Set((payload.models ?? []).map((model) => model.name || model.model).filter(Boolean))].sort(
      modelSort,
    );
    return ids.map((id) => mergeModel(existingModels.get(id), { id, name: id, input: ['text'] }));
  } catch (error) {
    throw new Error(`Failed to read Ollama models from ${args.ollamaUrl}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function readHuggingFaceModels(args, existingModels) {
  if (args.noHf) return null;

  const ids = readHuggingFaceCacheModelIds(args);
  const excludedIds = excludedHuggingFaceModelIds();
  return ids
    .map((id) =>
      mergeModel(existingModels.get(id), {
        id,
        name: modelDisplayName(id),
        reasoning: inferReasoning(id),
        input: inferInput(id),
        params: {
          ...(existingModels.get(id)?.params && typeof existingModels.get(id)?.params === 'object'
            ? existingModels.get(id).params
            : {}),
          architokenHfTaskType: inferHuggingFaceTaskType(id),
          architokenHfCapability: inferHuggingFaceCapability(id),
          architokenRuntimeConfigured: Boolean(existingModels.get(id)?.params?.architokenRuntimeConfigured),
          architokenSource: 'hf_cache',
        },
      }),
    )
    .filter((model) => !excludedIds.has(normalizeHuggingFaceModelId(model.id)));
}

function readHuggingFaceCacheModelIds(args) {
  if (args.noHf) return [];

  const hfCli = huggingFaceCliPath();
  if (!hfCli) return [];

  const result = spawnSync(hfCli, ['cache', 'list', '--json', '--filter', 'type=model', '--no-truncate'], {
    encoding: 'utf8',
    cwd: rootDir,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    return [];
  }
  if (result.status !== 0) {
    return [];
  }

  const entries = JSON.parse(result.stdout || '[]');
  const seen = new Set();
  const ids = [];
  for (const entry of entries) {
    if (entry.repo_type !== 'model' && !String(entry.id ?? '').startsWith('model/')) continue;
    const id = entry.repo_id || String(entry.id).replace(/^model\//, '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function huggingFaceCliPath() {
  const home = process.env.HOME;
  const candidates = [
    process.env.ARCHITOKEN_HF_CLI_PATH,
    process.env.HF_CLI_PATH,
    home ? `${home}/.local/bin/hf` : null,
    home ? `${home}/.huggingface/bin/hf` : null,
    'hf',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === 'hf' || existsSync(candidate)) return candidate;
  }
  return null;
}

async function readHuggingFaceEndpointModels(args, existingModels) {
  if (args.noHf) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const baseUrl = args.hfBaseUrl.endsWith('/') ? args.hfBaseUrl : `${args.hfBaseUrl}/`;
    const response = await fetch(new URL('models', baseUrl), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HF endpoint models request failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    const models = Array.isArray(payload.data) ? payload.data : [];
    const endpointModelsById = mergeHuggingFaceEndpointModels(models);
    const cacheIds = readHuggingFaceCacheModelIds(args);
    const ids = cacheIds.length > 0 ? cacheIds : [...endpointModelsById.keys()].sort(modelSort);
    const excludedIds = excludedHuggingFaceModelIds();
    return ids
      .map((id) => {
        const model = endpointModelsById.get(id);
        const contextWindow = endpointContextWindow(model);
        const taskTypes = endpointTaskTypes(model);
        const capabilities = endpointCapabilities(model);
        const primaryTaskType = taskTypes[0] || inferHuggingFaceTaskType(id);
        const primaryCapability =
          capabilities.find((capability) => capability.includes('.')) || capabilities[0] || inferHuggingFaceCapability(id);
        return mergeModel(existingModels.get(id), {
          id,
          name: String(model?.name || modelDisplayName(id)),
          reasoning: model?.reasoning ?? inferReasoning(id),
          input: inferInput(id),
          ...(contextWindow ? { contextWindow, maxTokens: Math.min(8192, contextWindow) } : {}),
          params: {
            ...(existingModels.get(id)?.params && typeof existingModels.get(id)?.params === 'object'
              ? existingModels.get(id).params
              : {}),
            architokenHfTaskType: primaryTaskType,
            architokenHfTaskTypes: taskTypes,
            architokenHfCapability: primaryCapability,
            architokenHfCapabilities: capabilities,
            architokenRuntimeConfigured: Boolean(model?.runtimeConfigured),
            architokenSource: model?.source || 'hf_cache',
          },
        });
      })
      .filter((model) => !excludedIds.has(normalizeHuggingFaceModelId(model.id)))
      .filter((model) => args.includeUnconfiguredHfEndpointModels || isHuggingFaceChatSelectable(model, args));
  } finally {
    clearTimeout(timeout);
  }
}

function mergeHuggingFaceEndpointModels(models) {
  const merged = new Map();
  for (const model of models) {
    if (!isHuggingFaceEndpointModel(model)) continue;
    const id = String(model.id || '').replace(/^huggingface\//, '').trim();
    const previous = merged.get(id);
    if (!previous) {
      merged.set(id, {
        ...model,
        id,
        taskTypes: endpointTaskTypes(model),
        capabilities: endpointCapabilities(model),
      });
      continue;
    }
    merged.set(id, {
      ...previous,
      ...model,
      id,
      runtimeConfigured: Boolean(previous.runtimeConfigured || model.runtimeConfigured),
      taskTypes: unique([...endpointTaskTypes(previous), ...endpointTaskTypes(model)]),
      capabilities: unique([...endpointCapabilities(previous), ...endpointCapabilities(model)]),
    });
  }
  return merged;
}

function isHuggingFaceEndpointModel(model) {
  if (!model || typeof model !== 'object') return false;
  const id = String(model.id || '').trim();
  if (!id) return false;
  return String(model.provider || '').toLowerCase() === 'huggingface';
}

function isHuggingFaceChatSelectable(model, args) {
  if (!isHuggingFaceEndpointModel({ ...model, provider: 'huggingface' })) return false;
  const taskTypes = endpointTaskTypes(model);
  const capabilities = endpointCapabilities(model);
  const isChatLike =
    taskTypes.some((taskType) => taskType === 'chat' || taskType === 'code') ||
    capabilities.some((capability) => capability === 'model.chat' || capability === 'model.code');
  if (!isChatLike) return false;
  return args.includeUnconfiguredHfEndpointModels || huggingFaceRuntimeConfigured(model);
}

function endpointTaskTypes(model) {
  const params = model?.params && typeof model.params === 'object' ? model.params : {};
  return unique(
    [
      ...(Array.isArray(model?.taskTypes) ? model.taskTypes : []),
      ...(Array.isArray(params.architokenHfTaskTypes) ? params.architokenHfTaskTypes : []),
      model?.taskType,
      params.architokenHfTaskType,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

function endpointCapabilities(model) {
  const params = model?.params && typeof model.params === 'object' ? model.params : {};
  return unique(
    [
      ...(Array.isArray(model?.capabilities) ? model.capabilities : []),
      ...(Array.isArray(params.architokenHfCapabilities) ? params.architokenHfCapabilities : []),
      model?.capability,
      params.architokenHfCapability,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

function huggingFaceRuntimeConfigured(model) {
  const params = model?.params && typeof model.params === 'object' ? model.params : {};
  return model?.runtimeConfigured === true || params.architokenRuntimeConfigured === true;
}

function inferHuggingFaceTaskType(id) {
  const normalized = String(id || '').toLowerCase();
  if (/(flux|ernie-image)/.test(normalized)) return 'text_to_image';
  if (/(ltx|video|world)/.test(normalized)) return 'text_to_video';
  if (/(ocr|radio|vision|vl)/.test(normalized)) return 'ocr';
  if (/(asset|3d|hy-world|lyra)/.test(normalized)) return 'image_to_3d';
  if (/(coder|industrialcoder)/.test(normalized)) return 'code';
  return 'chat';
}

function inferHuggingFaceCapability(id) {
  const taskType = inferHuggingFaceTaskType(id);
  if (taskType === 'code') return 'model.code';
  if (taskType === 'ocr') return 'document.ocr';
  if (taskType === 'text_to_image') return 'image.generate';
  if (taskType === 'text_to_video') return 'video.generate';
  if (taskType === 'image_to_3d') return '3d.generate';
  return 'model.chat';
}

function endpointContextWindow(model) {
  const raw = model?.endpointModel?.meta?.n_ctx ?? model?.endpointModel?.meta?.n_ctx_train;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

async function isHuggingFaceEndpointAvailable(args) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const baseUrl = args.hfBaseUrl.endsWith('/') ? args.hfBaseUrl : `${args.hfBaseUrl}/`;
    const response = await fetch(new URL('models', baseUrl), {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok || response.status === 401 || response.status === 403;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function modelSort(left, right) {
  const priority = ['Insome:12B', 'Insome:32B', 'Insome:7B'];
  const leftPriority = priority.indexOf(left);
  const rightPriority = priority.indexOf(right);
  if (leftPriority !== -1 || rightPriority !== -1) {
    return (leftPriority === -1 ? 999 : leftPriority) - (rightPriority === -1 ? 999 : rightPriority);
  }
  return left.localeCompare(right, 'en');
}

function providerModelMap(provider) {
  const map = new Map();
  for (const model of provider?.models ?? []) {
    if (model?.id) map.set(model.id, model);
  }
  return map;
}

function updateAgentModelWhitelist(config, providerModels) {
  const existing = config.agents?.defaults?.models ?? {};
  const next = {};

  for (const [key, value] of Object.entries(existing)) {
    if (!key.startsWith('ollama/') && !key.startsWith('huggingface/')) {
      next[key] = value;
    }
  }

  for (const [providerId, models] of Object.entries(providerModels)) {
    for (const model of models ?? []) {
      if (providerId === 'huggingface' && !isHuggingFaceAllowedChatModel(model)) {
        continue;
      }
      next[`${providerId}/${model.id}`] = {};
    }
  }

  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.models = next;
}

function isHuggingFaceAllowedChatModel(model) {
  if (!model?.id) return false;
  const taskTypes = endpointTaskTypes(model);
  const capabilities = endpointCapabilities(model);
  const isChatLike =
    taskTypes.some((taskType) => taskType === 'chat' || taskType === 'code') ||
    capabilities.some((capability) => capability === 'model.chat' || capability === 'model.code');
  return isChatLike && huggingFaceRuntimeConfigured(model);
}

async function syncOnce(args) {
  const config = readJson(args.config);
  const beforeManagedHash = hashValue(managedSnapshot(config, args));

  config.plugins ??= {};
  config.plugins.entries ??= {};
  config.models ??= {};
  config.models.mode = config.models.mode ?? 'merge';
  config.models.providers ??= {};

  const nextProviderModels = {};

  if (!args.noOllama) {
    const existing = providerModelMap(config.models.providers.ollama);
    const ollamaModels = await readOllamaModels(args, existing);
    config.plugins.entries.ollama ??= { enabled: true, config: { discovery: { enabled: true } } };
    config.plugins.entries.ollama.enabled = true;
    config.plugins.entries.ollama.config ??= {};
    config.plugins.entries.ollama.config.discovery ??= {};
    config.plugins.entries.ollama.config.discovery.enabled = true;
    config.models.providers.ollama = {
      ...(config.models.providers.ollama ?? {}),
      baseUrl: args.ollamaUrl,
      api: 'ollama',
      apiKey: config.models.providers.ollama?.apiKey ?? 'ollama-local',
      models: ollamaModels,
    };
    nextProviderModels.ollama = ollamaModels;
  }

  if (!args.noHf) {
    const hfEndpointAvailable = await isHuggingFaceEndpointAvailable(args);
    const existing = providerModelMap(config.models.providers.huggingface);
    if (hfEndpointAvailable || args.includeHfCacheWhenOffline) {
      const hfModels = hfEndpointAvailable
        ? await readHuggingFaceEndpointModels(args, existing)
        : readHuggingFaceModels(args, existing);
      if (hfModels.length > 0) {
        config.plugins.entries.huggingface ??= { enabled: true };
        config.plugins.entries.huggingface.enabled = true;
        config.models.providers.huggingface = {
          ...(config.models.providers.huggingface ?? {}),
          baseUrl: args.hfBaseUrl,
          api: config.models.providers.huggingface?.api ?? 'openai-completions',
          apiKey: config.models.providers.huggingface?.apiKey ?? 'huggingface-local',
          models: hfModels,
        };
        nextProviderModels.huggingface = hfModels;
      } else {
        delete config.models.providers.huggingface;
        if (config.plugins.entries.huggingface) {
          config.plugins.entries.huggingface.enabled = false;
        }
        nextProviderModels.huggingface = [];
      }
    } else if (existing.size > 0) {
      const excludedIds = excludedHuggingFaceModelIds();
      const hfModels = [...existing.values()]
        .filter((model) => !excludedIds.has(normalizeHuggingFaceModelId(model.id)))
        .sort((left, right) => modelSort(left.id, right.id));
      config.plugins.entries.huggingface ??= { enabled: true };
      config.plugins.entries.huggingface.enabled = true;
      nextProviderModels.huggingface = hfModels;
    } else {
      delete config.models.providers.huggingface;
      if (config.plugins.entries.huggingface) {
        config.plugins.entries.huggingface.enabled = false;
      }
      nextProviderModels.huggingface = [];
    }
  }

  if (config.models.providers.huggingface) {
    delete config.models.providers.huggingface.model_enabled;
  }

  updateAgentModelWhitelist(config, nextProviderModels);
  updateDefaultModelSelection(config);

  const afterManagedHash = hashValue(managedSnapshot(config, args));
  const changed = beforeManagedHash !== afterManagedHash;

  if (changed) {
    config.meta ??= {};
    config.meta.lastTouchedVersion ??= '2026.5.22';
    config.meta.lastTouchedAt = new Date().toISOString();
  }

  if (changed && !args.dryRun) {
    writeJsonAtomic(args.config, config);
  }

  return {
    changed,
    dryRun: args.dryRun,
    config: args.config,
    ollamaCount: config.models.providers.ollama?.models?.length ?? 0,
    huggingfaceCount: config.models.providers.huggingface?.models?.length ?? 0,
    totalManagedCount:
      (config.models.providers.ollama?.models?.length ?? 0) + (config.models.providers.huggingface?.models?.length ?? 0),
  };
}

function updateDefaultModelSelection(config) {
  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.model ??= {};

  const availableKeys = new Set(Object.keys(config.agents.defaults.models ?? {}));
  const current = config.agents.defaults.model.primary;
  const configuredHuggingFaceKeys = runtimeConfiguredHuggingFaceKeys(config);
  const primary = selectPrimaryModel(current, availableKeys, configuredHuggingFaceKeys);
  if (primary) {
    config.agents.defaults.model.primary = primary;
  }

  const fallbackCandidates = unique([
    ...configuredHuggingFaceKeys,
    ...preferredHuggingFacePrimaryKeys(),
    ...[...availableKeys].filter((key) => key.startsWith('huggingface/')).sort(),
    ...preferredOllamaFallbacks,
    ...[...availableKeys].filter((key) => key.startsWith('ollama/')).sort(),
  ]);
  config.agents.defaults.model.fallbacks = fallbackCandidates.filter(
    (key) => availableKeys.has(key) && key !== config.agents.defaults.model.primary,
  );
}

function selectPrimaryModel(current, availableKeys, configuredHuggingFaceKeys) {
  const configuredSet = new Set(configuredHuggingFaceKeys);
  if (current?.startsWith('huggingface/') && configuredSet.has(current)) return current;
  for (const key of preferredHuggingFacePrimaryKeys()) {
    if (configuredSet.has(key)) return key;
  }
  if (configuredHuggingFaceKeys[0]) return configuredHuggingFaceKeys[0];
  if (current?.startsWith('huggingface/') && availableKeys.has(current)) return current;
  for (const key of preferredHuggingFacePrimaryKeys()) {
    if (availableKeys.has(key)) return key;
  }
  const firstHuggingFace = [...availableKeys].filter((key) => key.startsWith('huggingface/')).sort()[0];
  if (firstHuggingFace) return firstHuggingFace;
  if (current && availableKeys.has(current)) return current;
  if (availableKeys.has('ollama/Insome:12B')) return 'ollama/Insome:12B';
  return [...availableKeys].sort()[0] ?? current ?? null;
}

function runtimeConfiguredHuggingFaceKeys(config) {
  const models = config.models?.providers?.huggingface?.models ?? [];
  return models
    .filter((model) => {
      const params = model?.params && typeof model.params === 'object' ? model.params : {};
      const taskType = String(params.architokenHfTaskType || model?.taskType || '').toLowerCase();
      const capability = String(params.architokenHfCapability || model?.capability || '').toLowerCase();
      const isChatLike =
        taskType === 'chat' ||
        taskType === 'code' ||
        capability === 'model.chat' ||
        capability === 'model.code';
      return model?.id && params.architokenRuntimeConfigured === true && isChatLike;
    })
    .map((model) => `huggingface/${model.id}`)
    .filter((key) => config.agents?.defaults?.models?.[key] !== undefined)
    .sort();
}

function preferredHuggingFacePrimaryKeys() {
  return unique(
    [
      process.env.PANAI_DEFAULT_MODEL,
      process.env.ARCHITOKEN_HF_CHAT_MODEL,
      process.env.HUGGINGFACE_CHAT_MODEL,
      ...preferredHuggingFaceModels,
    ]
      .map((value) => normalizeHuggingFaceModelKey(value))
      .filter(Boolean),
  );
}

function excludedHuggingFaceModelIds() {
  const configured = String(process.env.PANAI_EXCLUDED_HF_MODELS || process.env.PANAI_EXCLUDED_HF_MODELS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...retiredHuggingFaceModelIds, ...configured].map(normalizeHuggingFaceModelId).filter(Boolean));
}

function normalizeHuggingFaceModelId(value) {
  if (!value || typeof value !== 'string') return null;
  return value.trim().replace(/^huggingface\//, '');
}

function normalizeHuggingFaceModelKey(value) {
  if (!value || typeof value !== 'string') return null;
  const model = value.trim();
  if (!model) return null;
  if (model.startsWith('huggingface/')) return model;
  if (model.startsWith('ollama/')) return null;
  return `huggingface/${model}`;
}

function unique(values) {
  return [...new Set(values)];
}

function managedSnapshot(config, args) {
  const providers = {};
  const plugins = {};
  const managedModelKeys = {};

  if (!args.noOllama) {
    providers.ollama = config.models?.providers?.ollama ?? null;
    plugins.ollama = config.plugins?.entries?.ollama ?? null;
  }
  if (!args.noHf) {
    providers.huggingface = config.models?.providers?.huggingface ?? null;
    plugins.huggingface = config.plugins?.entries?.huggingface ?? null;
  }

  for (const [key, value] of Object.entries(config.agents?.defaults?.models ?? {})) {
    if ((!args.noOllama && key.startsWith('ollama/')) || (!args.noHf && key.startsWith('huggingface/'))) {
      managedModelKeys[key] = value;
    }
  }

  return {
    providers,
    plugins,
    agentsDefaultsModel: config.agents?.defaults?.model ?? null,
    managedModelKeys,
  };
}

function log(args, message) {
  if (!args.quiet) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

async function watch(args) {
  writePid(args);
  log(args, `watching local models every ${args.intervalSeconds}s`);
  let previousError = '';

  const run = async () => {
    try {
      const result = await syncOnce(args);
      previousError = '';
      if (result.changed) {
        log(
          args,
          `synced ${result.totalManagedCount} models (${result.ollamaCount} ollama, ${result.huggingfaceCount} huggingface)`,
        );
      }
    } catch (error) {
      const message = error?.stack || error?.message || String(error);
      if (message !== previousError) {
        console.error(`[${new Date().toISOString()}] ${message}`);
        previousError = message;
      }
    }
  };

  await run();
  const timer = setInterval(run, args.intervalSeconds * 1000);

  const stop = () => {
    clearInterval(timer);
    removePid(args);
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

function writePid(args) {
  mkdirSync(dirname(args.pidFile), { recursive: true });
  writeFileSync(args.pidFile, `${process.pid}\n`);
}

function removePid(args) {
  try {
    if (existsSync(args.pidFile) && Number(readFileSync(args.pidFile, 'utf8').trim()) === process.pid) {
      unlinkSync(args.pidFile);
    }
  } catch {
    // Ignore stale pid cleanup failures.
  }
}

function readPid(args) {
  if (!existsSync(args.pidFile)) return null;
  const pid = Number(readFileSync(args.pidFile, 'utf8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function daemon(args) {
  const existingPid = readPid(args);
  if (isRunning(existingPid)) {
    console.log(`PanAI model sync daemon already running: pid ${existingPid}`);
    return;
  }

  mkdirSync(dirname(args.logFile), { recursive: true });
  const out = openSync(args.logFile, 'a');
  const scriptPath = fileURLToPath(import.meta.url);
  const childArgs = [
    scriptPath,
    '--watch',
    '--config',
    args.config,
    '--ollama-url',
    args.ollamaUrl,
    '--hf-base-url',
    args.hfBaseUrl,
    '--interval',
    String(args.intervalSeconds),
    '--pid-file',
    args.pidFile,
    '--log-file',
    args.logFile,
  ];
  if (args.noHf) childArgs.push('--no-hf');
  if (args.noOllama) childArgs.push('--no-ollama');
  if (args.quiet) childArgs.push('--quiet');

  const child = spawn(process.execPath, childArgs, {
    cwd: rootDir,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();

  console.log(`PanAI model sync daemon started: pid ${child.pid}`);
  console.log(`PID: ${args.pidFile}`);
  console.log(`Log: ${args.logFile}`);
}

function status(args) {
  const pid = readPid(args);
  if (isRunning(pid)) {
    console.log(`running pid=${pid}`);
    return;
  }
  if (pid) {
    console.log(`stale pid=${pid}`);
    return;
  }
  console.log('stopped');
}

function stop(args) {
  const pid = readPid(args);
  if (!pid) {
    console.log('PanAI model sync daemon is not running');
    return;
  }
  if (!isRunning(pid)) {
    removePid(args);
    console.log(`Removed stale pid file: ${args.pidFile}`);
    return;
  }
  process.kill(pid, 'SIGTERM');
  console.log(`Stopped PanAI model sync daemon: pid ${pid}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'daemon') {
    daemon(args);
    return;
  }
  if (args.command === 'status') {
    status(args);
    return;
  }
  if (args.command === 'stop') {
    stop(args);
    return;
  }
  if (args.command === 'watch') {
    await watch(args);
    return;
  }

  const result = await syncOnce(args);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
