import { NextRequest } from "next/server";

export const runtime = "nodejs";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const forwardedRequestHeaders = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "origin",
  "x-actor",
  "x-correlation-id",
  "x-project-id",
  "x-request-id",
  "x-roles",
  "x-tenant-id",
];

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyArchitokenRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyArchitokenRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyArchitokenRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyArchitokenRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyArchitokenRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyArchitokenRequest(request, context);
}

type RouteContext = {
  readonly params: Promise<{
    readonly path?: string[];
  }>;
};

async function proxyArchitokenRequest(
  request: NextRequest,
  context: RouteContext,
) {
  const params = await context.params;
  const upstreamUrl = architokenUpstreamUrl(params.path ?? [], request);
  const headers = buildForwardHeaders(request);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const requestInit: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (hasBody) {
    requestInit.body = await request.arrayBuffer();
  }
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, requestInit);
  } catch (error) {
    return architokenGatewayUnavailableResponse(upstreamUrl, error);
  }

  return toClientResponse(upstreamResponse);
}

function architokenUpstreamUrl(path: string[], request: NextRequest): string {
  const base = (
    process.env.ARCHITOKEN_API_BASE_URL ??
    process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL ??
    "http://127.0.0.1:18080"
  ).replace(/\/+$/, "");
  const normalizedPath = path.map(encodeURIComponent).join("/");
  return `${base}/${normalizedPath}${request.nextUrl.search}`;
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const header of forwardedRequestHeaders) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  if (!headers.has("origin")) {
    headers.set("origin", frontendOrigin(request));
  }
  headers.set("x-forwarded-host", request.headers.get("host") ?? "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  return headers;
}

function frontendOrigin(request: NextRequest): string {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return `${request.nextUrl.protocol}//${host}`;
}

async function toClientResponse(upstreamResponse: Response): Promise<Response> {
  const headers = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (hopByHopHeaders.has(normalizedKey) || normalizedKey === "set-cookie") {
      return;
    }
    headers.set(key, value);
  });

  const setCookie = upstreamResponse.headers.get("set-cookie");
  if (setCookie) {
    for (const cookie of splitSetCookieHeader(setCookie)) {
      headers.append("set-cookie", cookie);
    }
  }

  const body =
    upstreamResponse.status === 204 || upstreamResponse.status === 304
      ? null
      : await upstreamResponse.arrayBuffer();
  return new Response(body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

function splitSetCookieHeader(value: string): string[] {
  return value
    .split(/,(?=\s*[-_A-Za-z0-9]+=)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean);
}

function architokenGatewayUnavailableResponse(
  upstreamUrl: string,
  error: unknown,
): Response {
  const upstream = new URL(upstreamUrl);
  return Response.json(
    {
      error:
        "ArchIToken gateway is unavailable. Check ARCHITOKEN_API_BASE_URL or start the local gateway.",
      code: 502,
      upstream: `${upstream.protocol}//${upstream.host}`,
      detail:
        error instanceof Error && error.message.trim()
          ? error.message
          : "upstream fetch failed",
    },
    { status: 502 },
  );
}
