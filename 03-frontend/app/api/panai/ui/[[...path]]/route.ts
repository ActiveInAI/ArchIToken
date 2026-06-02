// app/api/panai/ui/[[...path]]/route.ts - Same-origin proxy for PanAI Control UI
// License: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const defaultPanAIHttpBase = 'http://127.0.0.1:18789';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyPanAIUi(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return proxyPanAIUi(request, context, true);
}

async function proxyPanAIUi(
  request: Request,
  { params }: RouteContext,
  headOnly = false,
) {
  const { path = [] } = await params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(path.join('/') || '/', normalizedBaseUrl(panAIHttpBase()));
  upstreamUrl.search = requestUrl.search;

  const upstream = await fetch(upstreamUrl, {
    method: headOnly ? 'HEAD' : 'GET',
    headers: buildUpstreamRequestHeaders(request),
    cache: 'no-store',
  });

  if (headOnly) {
    return new NextResponse(null, {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, false),
    });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    return new NextResponse(injectPanAIControlContext(html, requestUrl), {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, true),
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: buildProxyHeaders(upstream.headers, false),
  });
}

function panAIHttpBase(): string {
  return process.env.PANAI_DASHBOARD_URL
    ?? process.env.PANAI_GATEWAY_HTTP_URL
    ?? process.env.OPENCLAW_DASHBOARD_URL
    ?? process.env.OPENCLAW_GATEWAY_HTTP_URL
    ?? defaultPanAIHttpBase;
}

function buildUpstreamRequestHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    Accept: request.headers.get('accept') ?? '*/*',
    'User-Agent': request.headers.get('user-agent') ?? 'ArchIToken host PanAI UI proxy',
  };
  const gatewayToken = (process.env.PANAI_GATEWAY_TOKEN ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? '').trim();
  if (gatewayToken) {
    headers.Authorization = `Bearer ${gatewayToken}`;
  }
  return headers;
}

function panAIWsUrl(requestUrl: URL): string {
  if (process.env.PANAI_GATEWAY_WS_URL) {
    return process.env.PANAI_GATEWAY_WS_URL;
  }
  if (process.env.OPENCLAW_GATEWAY_WS_URL) {
    return process.env.OPENCLAW_GATEWAY_WS_URL;
  }

  const baseUrl = new URL(panAIHttpBase());
  const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = baseUrl.host || requestUrl.host;
  return `${protocol}//${host}`;
}

function injectPanAIControlContext(html: string, requestUrl: URL): string {
  const moduleId = requestUrl.searchParams.get('hostModule')
    ?? requestUrl.searchParams.get('architokenModule')
    ?? 'construction_management';
  const moduleName = requestUrl.searchParams.get('hostModuleName')
    ?? requestUrl.searchParams.get('architokenModuleName')
    ?? moduleId;
  const selectedFeature = requestUrl.searchParams.get('hostFeature')
    ?? requestUrl.searchParams.get('architokenFeature')
    ?? '';
  const surface = requestUrl.searchParams.get('hostSurface')
    ?? requestUrl.searchParams.get('architokenSurface')
    ?? 'module_workbench';
  const assistant = requestUrl.searchParams.get('hostAssistant')
    ?? requestUrl.searchParams.get('architokenAssistant')
    ?? 'architoken';
  const sourcePath = requestUrl.searchParams.get('hostSourcePath')
    ?? requestUrl.searchParams.get('architokenSourcePath')
    ?? '';
  const auditEventCount = parseSearchInteger(
    requestUrl.searchParams.get('hostAuditCount') ?? requestUrl.searchParams.get('architokenAuditCount'),
  );
  const requestedModel = (
    requestUrl.searchParams.get('hostModel')
    ?? requestUrl.searchParams.get('architokenModel')
    ?? ''
  ).trim();
  const environmentDefaultModel = (process.env.PANAI_DEFAULT_MODEL ?? process.env.OPENCLAW_DEFAULT_MODEL ?? '').trim();
  const defaultModel = requestedModel || environmentDefaultModel || 'ollama/Insome:12B';
  const forceModel = Boolean(requestedModel)
    || process.env.PANAI_FORCE_DEFAULT_MODEL === '1'
    || process.env.OPENCLAW_FORCE_DEFAULT_MODEL === '1';
  const gatewayToken = process.env.PANAI_GATEWAY_TOKEN ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? '';
  const defaultProvider = defaultModel.startsWith('ollama/') ? 'ollama' : 'huggingface';
  const locale = 'zh-CN';
  const safeModuleId = moduleId.replace(/[^a-z0-9_-]+/gi, '-');
  const sessionKey = `agent:main:host-architoken-${safeModuleId}-panai`;
  const settings = {
    gatewayUrl: panAIWsUrl(requestUrl),
    ...(gatewayToken ? { token: gatewayToken } : {}),
    sessionKey,
    lastActiveSessionKey: sessionKey,
    model: defaultModel,
    modelId: defaultModel,
    selectedModel: defaultModel,
    activeModel: defaultModel,
    defaultModel,
    provider: defaultProvider,
    selectedProvider: defaultProvider,
    productName: 'PanAI',
    theme: 'wechat_light',
    themeMode: 'light',
    chatFocusMode: true,
    chatShowThinking: true,
    chatShowToolCalls: true,
    splitRatio: 0.6,
    navCollapsed: false,
  };
  const injectedState = JSON.stringify({
    settings,
    moduleId,
    moduleName,
    selectedFeature,
    surface,
    assistant,
    sourcePath,
    auditEventCount,
    defaultModel,
    defaultProvider,
    forceModel,
    gatewayToken,
    huggingFaceModelAliases: readHuggingFaceModelAliases(),
    locale,
  }).replace(/</g, '\\u003c');
  const bootstrap = `
    <base href="/api/panai/ui/" />
    <script>
      (function () {
        var state = ${injectedState};
        try {
          function gatewayStorageKey(value) {
            var raw = typeof value === 'string' ? value.trim() : '';
            if (!raw) return 'default';
            try {
              var base = location.protocol + '//' + location.host + (location.pathname || '/');
              var parsed = new URL(raw, base);
              var path = parsed.pathname === '/' ? '' : (parsed.pathname.replace(/\\/+$/, '') || parsed.pathname);
              return parsed.protocol + '//' + parsed.host + path;
            } catch (error) {
              return raw;
            }
          }
          function parseObject(raw) {
            if (typeof raw !== 'string' || !raw.trim()) return null;
            try {
              var parsed = JSON.parse(raw);
              return parsed && typeof parsed === 'object' ? parsed : null;
            } catch (error) {
              return null;
            }
          }
          var gatewayKey = gatewayStorageKey(state.settings.gatewayUrl);
          var settingsKey = 'panai.control.settings.v1:' + gatewayKey;
          var legacySettingsKey = 'openclaw.control.settings.v1:' + gatewayKey;
          var existing = parseObject(localStorage.getItem(settingsKey))
            || parseObject(localStorage.getItem('panai.control.settings.v1'))
            || parseObject(localStorage.getItem(legacySettingsKey))
            || parseObject(localStorage.getItem('openclaw.control.settings.v1'))
            || {};
          function firstString() {
            for (var index = 0; index < arguments.length; index += 1) {
              var value = arguments[index];
              if (typeof value === 'string' && value.trim()) return value.trim();
            }
            return '';
          }
          function providerForModel(model, fallback) {
            if (typeof model === 'string') {
              var lowered = model.toLowerCase();
              if (model.indexOf('ollama/') === 0) return 'ollama';
              if (model.indexOf('huggingface/') === 0) return 'huggingface';
              if (lowered.indexOf('ernie-image') >= 0 || lowered.indexOf('nvfp4') >= 0 || lowered.indexOf('gguf') >= 0) {
                return 'huggingface';
              }
              if (model.indexOf('/') >= 0 && model.indexOf(':') < 0) return 'huggingface';
              if (model.indexOf(':') >= 0) return 'ollama';
            }
            return fallback || state.defaultProvider;
          }
          function canonicalModel(model) {
            var raw = firstString(model);
            if (!raw) return '';
            var aliases = state.huggingFaceModelAliases || {};
            return aliases[raw] || aliases[raw.toLowerCase()] || raw;
          }
          var previousModel = firstString(
            existing.model,
            existing.modelId,
            existing.selectedModel,
            existing.activeModel,
            existing.defaultModel,
            localStorage.getItem('panai.control.model'),
            localStorage.getItem('panai.model'),
            localStorage.getItem('panai.selectedModel'),
            localStorage.getItem('panai.defaultModel'),
            localStorage.getItem('openclaw.control.model'),
            localStorage.getItem('openclaw.model'),
            localStorage.getItem('openclaw.selectedModel'),
            localStorage.getItem('openclaw.defaultModel')
          );
          var previousProvider = firstString(
            existing.provider,
            existing.selectedProvider,
            localStorage.getItem('panai.control.provider'),
            localStorage.getItem('openclaw.control.provider')
          );
          var effectiveModel = state.forceModel
            ? canonicalModel(state.defaultModel)
            : (canonicalModel(previousModel) || canonicalModel(state.defaultModel));
          var effectiveProvider = state.forceModel
            ? state.defaultProvider
            : providerForModel(effectiveModel, previousProvider || state.defaultProvider);
          var contextualSettings = Object.assign({}, state.settings, {
            model: effectiveModel,
            modelId: effectiveModel,
            selectedModel: effectiveModel,
            activeModel: effectiveModel,
            defaultModel: effectiveModel,
            provider: effectiveProvider,
            selectedProvider: effectiveProvider
          });
          var mergedSettings = Object.assign({}, existing, contextualSettings);
          var context = {
            moduleId: state.moduleId,
            moduleName: state.moduleName,
            selectedFeature: state.selectedFeature,
            auditEventCount: state.auditEventCount,
            surface: state.surface,
            assistant: state.assistant,
            sourcePath: state.sourcePath
          };
          document.documentElement.lang = state.locale;
          localStorage.setItem('panai.i18n.locale', state.locale);
          localStorage.setItem('openclaw.i18n.locale', state.locale);
          localStorage.setItem('panai.control.settings.v1', JSON.stringify(mergedSettings));
          localStorage.setItem(settingsKey, JSON.stringify(mergedSettings));
          localStorage.setItem('openclaw.control.settings.v1', JSON.stringify(mergedSettings));
          localStorage.setItem(legacySettingsKey, JSON.stringify(mergedSettings));
          [
            'panai.control.model',
            'panai.control.defaultModel',
            'panai.defaultModel',
            'panai.model',
            'panai.selectedModel',
            'openclaw.control.model',
            'openclaw.control.defaultModel',
            'openclaw.defaultModel',
            'openclaw.model',
            'openclaw.selectedModel'
          ].forEach(function (key) {
            localStorage.setItem(key, effectiveModel);
          });
          localStorage.setItem('panai.host.context', JSON.stringify(context));
          localStorage.setItem('architoken.openclaw.context', JSON.stringify(context));
          localStorage.setItem('panai.control.provider', effectiveProvider);
          localStorage.setItem('openclaw.control.provider', effectiveProvider);
          localStorage.setItem('panai.control.sessionKey', state.settings.sessionKey);
          localStorage.setItem('openclaw.control.sessionKey', state.settings.sessionKey);
          if (state.gatewayToken) {
            localStorage.setItem('panai.control.gatewayToken', state.gatewayToken);
            localStorage.setItem('panai.control.token', state.gatewayToken);
            sessionStorage.setItem('panai.control.token.v1:' + gatewayKey, state.gatewayToken);
            sessionStorage.setItem('panai.control.token.v1', state.gatewayToken);
            localStorage.setItem('openclaw.control.gatewayToken', state.gatewayToken);
            localStorage.setItem('openclaw.control.token', state.gatewayToken);
            sessionStorage.setItem('openclaw.control.token.v1:' + gatewayKey, state.gatewayToken);
            sessionStorage.setItem('openclaw.control.token.v1', state.gatewayToken);
          }
          window.__PANAI_HOST_CONTEXT__ = {
            moduleId: state.moduleId,
            moduleName: state.moduleName,
            selectedFeature: state.selectedFeature,
            auditEventCount: state.auditEventCount,
            defaultModel: effectiveModel,
            defaultProvider: effectiveProvider,
            selectedModel: effectiveModel,
            selectedProvider: effectiveProvider,
            locale: state.locale,
            surface: state.surface,
            assistant: state.assistant,
            sourcePath: state.sourcePath
          };
          window.__ARCHITOKEN_OPENCLAW_CONTEXT__ = window.__PANAI_HOST_CONTEXT__;
        } catch (error) {
          window.__PANAI_HOST_CONTEXT__ = state;
          window.__ARCHITOKEN_OPENCLAW_CONTEXT__ = state;
        }
      })();
    </script>`;

  return html.replace('<head>', `<head>${bootstrap}`);
}

function parseSearchInteger(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readHuggingFaceModelAliases(): Record<string, string> {
  for (const configPath of panAIConfigPaths()) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
        models?: { providers?: { huggingface?: { models?: unknown[] } } };
      };
      const models = config.models?.providers?.huggingface?.models ?? [];
      const aliases: Record<string, string> = {};
      for (const model of models) {
        if (!model || typeof model !== 'object') continue;
        const entry = model as { id?: unknown; name?: unknown };
        const rawId = typeof entry.id === 'string' ? entry.id.replace(/^huggingface\//, '').trim() : '';
        if (!rawId) continue;
        const canonical = `huggingface/${rawId}`;
        addModelAlias(aliases, rawId, canonical);
        addModelAlias(aliases, canonical, canonical);
        addModelAlias(aliases, rawId.split('/').pop() ?? rawId, canonical);
        if (typeof entry.name === 'string') {
          addModelAlias(aliases, entry.name, canonical);
        }
      }
      return aliases;
    } catch {
      // Try the next configured compatibility path.
    }
  }
  return {};
}

function addModelAlias(aliases: Record<string, string>, key: string, value: string): void {
  const normalized = key.trim();
  if (!normalized) return;
  aliases[normalized] ??= value;
  aliases[normalized.toLowerCase()] ??= value;
}

function panAIConfigPaths(): string[] {
  const explicit = process.env.PANAI_CONFIG_PATH ?? process.env.ARCLAW_CONFIG_PATH ?? process.env.OPENCLAW_CONFIG_PATH;
  if (explicit) return [explicit];
  const cwd = process.cwd();
  const root = cwd.endsWith('/03-frontend') ? resolve(cwd, '..') : cwd;
  return [
    resolve(root, '.panai', 'panai.json'),
    resolve(root, '.openclaw-arclaw', 'openclaw.json'),
  ];
}

function buildProxyHeaders(upstreamHeaders: Headers, html: boolean): Headers {
  const headers = new Headers();
  const contentType = upstreamHeaders.get('content-type');
  const cacheControl = upstreamHeaders.get('cache-control');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl ?? 'no-store');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  if (html) {
    headers.set(
      'content-security-policy',
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:",
    );
  }
  return headers;
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
