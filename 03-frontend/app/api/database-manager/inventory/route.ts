import type { DatabaseManagerInventorySnapshot } from "@/lib/database-manager-inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestTimeoutMs = 4500;

export async function GET() {
  const upstreamUrl = `${databaseManagerBaseUrl()}/api/database-manager/inventory`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await upstreamResponse.json()) as
      | DatabaseManagerInventorySnapshot
      | Record<string, unknown>;
    return Response.json(payload, {
      status: upstreamResponse.status,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          "ArchIToken Database Manager is unavailable. Start architoken-db-manager or set ARCHITOKEN_DB_MANAGER_BASE_URL.",
        detail: errorMessage(error),
        upstream: upstreamUrl,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function databaseManagerBaseUrl(): string {
  return (
    process.env.ARCHITOKEN_DB_MANAGER_BASE_URL ??
    process.env.ARCHITOKEN_DATABASE_MANAGER_URL ??
    "http://127.0.0.1:8751"
  ).replace(/\/+$/, "");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
