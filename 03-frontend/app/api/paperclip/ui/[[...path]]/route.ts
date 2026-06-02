// app/api/paperclip/ui/[[...path]]/route.ts - Same-origin proxy for Paperclip UI
// License: Apache-2.0

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const defaultPaperclipHttpBase = 'http://127.0.0.1:3111';
const paperclipProxyBase = '/api/paperclip/ui';
const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
]);

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyPaperclipUi(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return proxyPaperclipUi(request, context, true);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyPaperclipUi(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyPaperclipUi(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyPaperclipUi(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyPaperclipUi(request, context);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(),
  });
}

async function proxyPaperclipUi(
  request: Request,
  { params }: RouteContext,
  headOnly = false,
) {
  const { path = [] } = await params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(path.join('/') || '/', normalizedBaseUrl(paperclipHttpBase()));
  upstreamUrl.search = requestUrl.search;

  let upstream: Response;
  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: headOnly ? 'HEAD' : request.method,
      headers: buildUpstreamHeaders(request),
      cache: 'no-store',
      redirect: 'manual',
    };
    if (!headOnly && !['GET', 'HEAD'].includes(request.method)) {
      init.body = await request.arrayBuffer();
      init.duplex = 'half';
    }
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    return paperclipUnavailableResponse(formatError(error));
  }

  if (headOnly) {
    return new NextResponse(null, {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, false, false),
    });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    return new NextResponse(injectPaperclipContext(rewritePaperclipHtml(html), requestUrl), {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, true, true),
    });
  }

  if (isJavaScriptContent(contentType)) {
    return new NextResponse(rewritePaperclipJavaScript(await upstream.text()), {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, false, true),
    });
  }

  if (contentType.includes('text/css')) {
    return new NextResponse(rewritePaperclipCss(await upstream.text()), {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, false, true),
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: buildProxyHeaders(upstream.headers, false, false),
  });
}

function paperclipHttpBase(): string {
  return process.env.PAPERCLIP_DASHBOARD_URL
    ?? process.env.PAPERCLIP_HTTP_URL
    ?? defaultPaperclipHttpBase;
}

function rewritePaperclipHtml(html: string): string {
  return html
    .replaceAll('src="/assets/', `src="${paperclipProxyBase}/assets/`)
    .replaceAll('href="/assets/', `href="${paperclipProxyBase}/assets/`)
    .replaceAll('href="/favicon', `href="${paperclipProxyBase}/favicon`)
    .replaceAll('href="/apple-touch-icon', `href="${paperclipProxyBase}/apple-touch-icon`)
    .replaceAll('href="/site.webmanifest"', `href="${paperclipProxyBase}/site.webmanifest"`);
}

function rewritePaperclipJavaScript(source: string): string {
  return source
    .replaceAll('"/api/', `"${paperclipProxyBase}/api/`)
    .replaceAll("'/api/", `'${paperclipProxyBase}/api/`)
    .replaceAll('`/api/', `\`${paperclipProxyBase}/api/`)
    .replaceAll('"/assets/', `"${paperclipProxyBase}/assets/`)
    .replaceAll("'/assets/", `'${paperclipProxyBase}/assets/`)
    .replaceAll('`/assets/', `\`${paperclipProxyBase}/assets/`)
    .replaceAll('"assets/', `"${paperclipProxyBase}/assets/`)
    .replaceAll("'assets/", `'${paperclipProxyBase}/assets/`)
    .replaceAll('`assets/', `\`${paperclipProxyBase}/assets/`)
    .replaceAll('("/sw.js")', `("${paperclipProxyBase}/sw.js")`)
    .replaceAll("('/sw.js')", `('${paperclipProxyBase}/sw.js')`)
    .replaceAll('(`/sw.js`)', `(\`${paperclipProxyBase}/sw.js\`)`);
}

function rewritePaperclipCss(source: string): string {
  return source
    .replaceAll('url(/assets/', `url(${paperclipProxyBase}/assets/`)
    .replaceAll('url("/assets/', `url("${paperclipProxyBase}/assets/`)
    .replaceAll("url('/assets/", `url('${paperclipProxyBase}/assets/`);
}

function isJavaScriptContent(contentType: string): boolean {
  return contentType.includes('javascript')
    || contentType.includes('ecmascript')
    || contentType.includes('application/x-javascript');
}

function injectPaperclipContext(html: string, requestUrl: URL): string {
  const moduleId = requestUrl.searchParams.get('architokenModule') ?? 'production_manufacturing';
  const moduleName = requestUrl.searchParams.get('architokenModuleName') ?? '生产制造';
  const release = requestUrl.searchParams.get('architokenRelease') ?? 'v2026.517.0';
  const injectedState = JSON.stringify({
    moduleId,
    moduleName,
    release,
    locale: 'zh-CN',
    boundaries: [
      'Paperclip controls this production module surface.',
      'ArchIToken remains source of truth for CDE files, CNC/QC/MES/ERP evidence and professional approvals.',
    ],
  }).replace(/</g, '\\u003c');
  const bootstrap = `
    <base href="${paperclipProxyBase}/" />
    <script>
      (function () {
        var state = ${injectedState};
        document.documentElement.lang = state.locale;
        window.__ARCHITOKEN_PAPERCLIP_CONTEXT__ = state;
        try {
          localStorage.setItem('paperclip.architoken.context.v1', JSON.stringify(state));
        } catch (error) {}
      })();
    </script>`;

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${bootstrap}`);
  }
  return `${bootstrap}${html}`;
}

function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  const requestUrl = new URL(request.url);
  const host = request.headers.get('host') ?? requestUrl.host;
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  const cookie = request.headers.get('cookie');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (cookie) headers.set('cookie', cookie);
  if (origin) headers.set('origin', origin);
  if (referer) headers.set('referer', referer);
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''));
  headers.set('user-agent', request.headers.get('user-agent') ?? 'ArchIToken Paperclip UI proxy');
  return headers;
}

function buildProxyHeaders(upstreamHeaders: Headers, html: boolean, transformed: boolean): Headers {
  const headers = buildCorsHeaders();
  upstreamHeaders.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  if (transformed) {
    headers.delete('etag');
    headers.delete('last-modified');
    headers.set('cache-control', 'no-store');
  } else {
    headers.set('cache-control', upstreamHeaders.get('cache-control') ?? 'no-store');
  }
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  if (html) {
    headers.set(
      'content-security-policy',
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http: https: ws: wss:",
    );
  }
  return headers;
}

function buildCorsHeaders(): Headers {
  const headers = new Headers();
  headers.set('access-control-allow-methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type,authorization');
  return headers;
}

function paperclipUnavailableResponse(detail: string): NextResponse {
  const body = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Paperclip 未连接</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1020; color: #e5edf8; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px; box-sizing: border-box; }
      section { width: min(720px, 100%); border: 1px solid rgba(148, 163, 184, .25); border-radius: 10px; background: rgba(15, 23, 42, .86); padding: 24px; box-shadow: 0 24px 80px rgba(0, 0, 0, .28); }
      h1 { margin: 0 0 8px; font-size: 22px; }
      p { margin: 0; color: #9fb0c7; line-height: 1.8; }
      code { color: #93c5fd; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Paperclip v2026.517.0 未连接</h1>
        <p>生产制造模块已完整切换为 Paperclip 控制台。请启动 Paperclip 服务或设置 <code>PAPERCLIP_DASHBOARD_URL</code> / <code>PAPERCLIP_HTTP_URL</code>。默认地址为 <code>${escapeHtml(defaultPaperclipHttpBase)}</code>。</p>
        <p>连接错误: ${escapeHtml(detail)}</p>
      </section>
    </main>
  </body>
</html>`;
  return new NextResponse(body, {
    status: 502,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
