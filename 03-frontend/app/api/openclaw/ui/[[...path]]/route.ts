// app/api/openclaw/ui/[[...path]]/route.ts - Same-origin proxy for OpenClaw Control UI
// License: Apache-2.0

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const defaultOpenClawHttpBase = 'http://127.0.0.1:18789';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyOpenClawUi(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return proxyOpenClawUi(request, context, true);
}

async function proxyOpenClawUi(
  request: Request,
  { params }: RouteContext,
  headOnly = false,
) {
  const { path = [] } = await params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(path.join('/') || '/', normalizedBaseUrl(openClawHttpBase()));
  upstreamUrl.search = requestUrl.search;

  const upstream = await fetch(upstreamUrl, {
    method: headOnly ? 'HEAD' : 'GET',
    headers: {
      Accept: request.headers.get('accept') ?? '*/*',
      'User-Agent': request.headers.get('user-agent') ?? 'ArchIToken OpenClaw UI proxy',
    },
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
    return new NextResponse(injectOpenClawControlContext(html, requestUrl), {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, true),
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: buildProxyHeaders(upstream.headers, false),
  });
}

function openClawHttpBase(): string {
  return process.env.OPENCLAW_DASHBOARD_URL
    ?? process.env.OPENCLAW_GATEWAY_HTTP_URL
    ?? defaultOpenClawHttpBase;
}

function openClawWsUrl(requestUrl: URL): string {
  if (process.env.OPENCLAW_GATEWAY_WS_URL) {
    return process.env.OPENCLAW_GATEWAY_WS_URL;
  }

  const baseUrl = new URL(openClawHttpBase());
  const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = baseUrl.host || requestUrl.host;
  return `${protocol}//${host}`;
}

function injectOpenClawControlContext(html: string, requestUrl: URL): string {
  const moduleId = requestUrl.searchParams.get('architokenModule') ?? 'construction_management';
  const moduleName = requestUrl.searchParams.get('architokenModuleName') ?? moduleId;
  const selectedFeature = requestUrl.searchParams.get('architokenFeature') ?? '';
  const locale = 'zh-CN';
  const safeModuleId = moduleId.replace(/[^a-z0-9_-]+/gi, '-');
  const sessionKey = `agent:dev:architoken-${safeModuleId}-main`;
  const settings = {
    gatewayUrl: openClawWsUrl(requestUrl),
    sessionKey,
    lastActiveSessionKey: sessionKey,
    theme: 'claw',
    themeMode: 'dark',
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
    locale,
  }).replace(/</g, '\\u003c');
  const bootstrap = `
    <base href="/api/openclaw/ui/" />
    <script>
      (function () {
        var state = ${injectedState};
        try {
          var existing = JSON.parse(localStorage.getItem('openclaw.control.settings.v1') || '{}');
          document.documentElement.lang = state.locale;
          localStorage.setItem('openclaw.i18n.locale', state.locale);
          localStorage.setItem('openclaw.control.settings.v1', JSON.stringify(Object.assign({}, existing, state.settings)));
          window.__ARCHITOKEN_OPENCLAW_CONTEXT__ = {
            moduleId: state.moduleId,
            moduleName: state.moduleName,
            selectedFeature: state.selectedFeature,
            locale: state.locale
          };
        } catch (error) {
          window.__ARCHITOKEN_OPENCLAW_CONTEXT__ = state;
        }
      })();
    </script>`;

  return html.replace('<head>', `<head>${bootstrap}`);
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
