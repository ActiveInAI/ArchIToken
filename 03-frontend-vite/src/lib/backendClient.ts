import { useWorkbenchStore } from "../state/workbenchStore";

export const backendBaseUrl =
  import.meta.env.VITE_ARCHITOKEN_API_BASE_URL ?? "http://localhost:8080";

export function buildContextHeaders(): Record<string, string> {
  const context = useWorkbenchStore.getState().context;
  return {
    "X-Tenant-Id": context.tenantId,
    "X-Project-Id": context.projectId,
    "X-Actor": context.actor,
    "X-Roles": context.roles,
  };
}

export type RuntimeRequestPreview = {
  baseUrl: string;
  headers: Record<string, string>;
};

export function previewRuntimeRequest(): RuntimeRequestPreview {
  return {
    baseUrl: backendBaseUrl,
    headers: buildContextHeaders(),
  };
}
