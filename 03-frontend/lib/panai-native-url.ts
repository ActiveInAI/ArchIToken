// lib/panai-native-url.ts - Resolve the real PanAI native web surface
// License: Apache-2.0

const defaultPanAINativeBaseUrl = "http://127.0.0.1:25808";
const defaultPanAINativePort = "25808";
const defaultPanAINativeRoute = "/#/guid";
const defaultPanAINativeAgentKey = "aionrs";
const architokenNativeQuery = {
  architokenHost: "1",
  preselectAgentKey: defaultPanAINativeAgentKey,
};

export function resolvePanAINativeUrl({
  configuredUrl,
  location,
}: {
  configuredUrl?: string | undefined;
  location?: { protocol?: string; hostname?: string } | undefined;
} = {}): string {
  const configured = configuredUrl?.trim();
  if (configured) {
    return withArchITokenNativeQuery(normalizePanAINativeRoute(configured));
  }

  return withArchITokenNativeQuery(
    normalizePanAINativeRoute(resolveDefaultPanAIBaseUrl(location)),
  );
}

function resolveDefaultPanAIBaseUrl(
  location?: { protocol?: string; hostname?: string } | undefined,
): string {
  const hostname = normalizeHostname(location?.hostname);
  if (!hostname) {
    return defaultPanAINativeBaseUrl;
  }

  return `http://${formatHostnameForUrl(hostname)}:${defaultPanAINativePort}`;
}

function normalizeHostname(hostname?: string): string | null {
  const normalized = hostname?.trim().replace(/^\[|\]$/g, "");
  return normalized ? normalized : null;
}

function formatHostnameForUrl(hostname: string): string {
  return hostname.includes(":") ? `[${hostname}]` : hostname;
}

function normalizePanAINativeRoute(value: string): string {
  if (value.includes("#")) {
    return value;
  }
  return `${value.replace(/\/+$/, "")}${defaultPanAINativeRoute}`;
}

function withArchITokenNativeQuery(value: string): string {
  const hashIndex = value.indexOf("#");
  const route = hashIndex >= 0 ? value.slice(hashIndex + 1) : "";
  const hasQuery = route.includes("?");
  const separator = hasQuery ? "&" : "?";
  const existingKeys = new Set(
    new URLSearchParams(route.split("?")[1] ?? "").keys(),
  );
  const params = Object.entries(architokenNativeQuery)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, queryValue]) => `${key}=${encodeURIComponent(queryValue)}`);

  if (params.length === 0) {
    return value;
  }

  return `${value}${separator}${params.join("&")}`;
}
