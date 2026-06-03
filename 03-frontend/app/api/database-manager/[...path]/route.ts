import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyDatabaseManagerRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyDatabaseManagerRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyDatabaseManagerRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyDatabaseManagerRequest(request, context);
}

type RouteContext = {
  readonly params: Promise<{
    readonly path?: string[];
  }>;
};

async function proxyDatabaseManagerRequest(
  request: NextRequest,
  context: RouteContext,
) {
  const params = await context.params;
  const upstreamUrl = databaseManagerUpstreamUrl(params.path ?? [], request);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
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
    return databaseManagerUnavailableResponse(upstreamUrl, error);
  }

  return toClientResponse(upstreamResponse);
}

function databaseManagerUpstreamUrl(
  path: string[],
  request: NextRequest,
): string {
  const base = (
    process.env.ARCHITOKEN_DB_MANAGER_BASE_URL ??
    process.env.ARCHITOKEN_DATABASE_MANAGER_URL ??
    "http://127.0.0.1:8751"
  ).replace(/\/+$/, "");
  const normalizedPath = path.map(encodeURIComponent).join("/");
  return `${base}/api/database-manager/${normalizedPath}${request.nextUrl.search}`;
}

async function toClientResponse(upstreamResponse: Response): Promise<Response> {
  const headers = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("cache-control", "no-store");
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

function databaseManagerUnavailableResponse(
  upstreamUrl: string,
  error: unknown,
): Response {
  return Response.json(
    {
      error:
        "ArchIToken Database Manager is unavailable. Start architoken-db-manager or set ARCHITOKEN_DB_MANAGER_BASE_URL.",
      detail: error instanceof Error ? error.message : String(error),
      upstream: upstreamUrl,
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
