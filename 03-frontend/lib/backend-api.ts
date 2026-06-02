// Fetch-based ArchIToken backend API adapter.
// License: Apache-2.0

export interface BackendApiError {
  error: string;
  code: number;
}

export interface RuntimeRequestContext {
  tenantId: string;
  projectId: string;
  actor: string;
  roles: string[];
  requestId?: string;
  correlationId?: string;
}

export const DEFAULT_RUNTIME_TENANT_ID = "11111111-1111-4111-8111-111111111111";
export const DEFAULT_RUNTIME_PROJECT_ID =
  "22222222-2222-4222-8222-222222222222";
export const DEFAULT_RUNTIME_ACTOR = "frontend-api-lab";
export const DEFAULT_RUNTIME_ROLES = ["admin"];
const defaultRequestTimeoutMs = 15_000;

export function getArchitokenApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/architoken";
  }

  if (process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL;
  }

  return "http://localhost:18080";
}

export const ARCHITOKEN_API_BASE_URL = getArchitokenApiBaseUrl();

export interface AuthVerificationCodeRequest {
  channel: "email" | "phone";
  destination: string;
  purpose?: "register" | "login" | "reset_password";
}

export interface AuthVerificationCodeResponse {
  channel: string;
  destination: string;
  purpose: string;
  expiresInSeconds: number;
  deliveryStatus: string;
  debugCode?: string;
}

export interface AuthRegisterRequest {
  tenantName: string;
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  verificationChannel: "email" | "phone";
  verificationCode: string;
  jobTitle?: string;
}

export interface AuthLoginRequest {
  identifier: string;
  password: string;
  tenantId?: string;
}

export interface AuthCodeLoginRequest {
  channel: "email" | "phone";
  destination: string;
  verificationCode: string;
  tenantId?: string;
}

export interface AuthPasswordResetRequest {
  channel: "email" | "phone";
  destination: string;
  verificationCode: string;
  password: string;
}

export interface AuthResponse {
  accountId: string;
  tenantId: string;
  personId?: string;
  accessToken: string;
  expiresInSeconds: number;
  runtimeRoles: string[];
}

export interface AuthQrChallengeRequest {
  accountType?: "personal" | "enterprise";
  returnTo?: string;
}

export interface AuthQrChallengeResponse {
  challengeId: string;
  qrPayload: string;
  pollToken: string;
  status:
    | "pending"
    | "scanned"
    | "approved"
    | "consumed"
    | "canceled"
    | "expired";
  expiresInSeconds: number;
}

export interface AuthQrPollResponse {
  challengeId: string;
  status:
    | "pending"
    | "scanned"
    | "approved"
    | "consumed"
    | "canceled"
    | "expired";
  expiresInSeconds: number;
  auth?: AuthResponse;
}

export interface AuthQrStatusResponse {
  challengeId: string;
  status:
    | "pending"
    | "scanned"
    | "approved"
    | "consumed"
    | "canceled"
    | "expired";
  expiresInSeconds: number;
}

export interface AuthMeResponse {
  accountId: string;
  tenantId: string;
  personId?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  displayName?: string;
  runtimeRoles: string[];
  jobTitles: string[];
}

export interface BackendPageInfo {
  limit: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface AssetRecord {
  metadata: {
    id: string;
    tenantId: string;
    projectId?: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
  };
  assetId: string;
  kind: string;
  name: string;
  status: string;
  sourceFormat?: string;
  canonicalFormat?: string;
  payload: unknown;
}

export interface AssetListResponse {
  total: number;
  assets: AssetRecord[];
  pageInfo: BackendPageInfo;
}

export interface BimSemanticEvidenceItem {
  status: string;
  artifact: string;
  required: boolean;
  reason?: string | null;
  jobId?: string;
  operation?: string;
  conversionStatus?: string;
  passed?: boolean | null;
  workerArtifact?: unknown;
}

export interface BimSemanticReadinessResponse {
  assetId: string;
  sourceAssetId?: string | null;
  sourceFileId?: string | null;
  ingestJobId?: string | null;
  conversionStatus?: string | null;
  readinessStatus: string;
  semantics: unknown;
  semanticLayers: unknown;
  requiredEvidence: Record<string, BimSemanticEvidenceItem>;
  openBimClaim: {
    status: string;
    mayEnterBuildingSmartOpenBimReview?: boolean;
    mayClaimBuildingSmartOpenBim: boolean;
    claimAuthority?: string;
    missingEvidence?: string[];
    failedEvidence?: string[];
    rule?: string;
  };
  missingEvidence: string[];
  failedEvidence: string[];
  artifacts: unknown[];
}

let activeRequestContext: RuntimeRequestContext = {
  tenantId: DEFAULT_RUNTIME_TENANT_ID,
  projectId: DEFAULT_RUNTIME_PROJECT_ID,
  actor: DEFAULT_RUNTIME_ACTOR,
  roles: [...DEFAULT_RUNTIME_ROLES],
  requestId: "frontend-api-lab",
  correlationId: "frontend-api-lab",
};
let activeAccessToken: string | null = null;
const backendAccessCookieName = "architoken_access";

export function setBackendRequestContext(context: RuntimeRequestContext): void {
  activeRequestContext = {
    ...context,
    roles:
      context.roles.length > 0
        ? [...context.roles]
        : [...DEFAULT_RUNTIME_ROLES],
  };
}

export function getBackendRequestContext(): RuntimeRequestContext {
  return activeRequestContext;
}

export function setBackendAccessToken(token: string | null): void {
  activeAccessToken = token && token.trim() ? token : null;
}

export function getBackendAccessToken(): string | null {
  return activeAccessToken;
}

export function shouldAttemptBackendSync(): boolean {
  if (activeAccessToken) {
    return true;
  }
  if (typeof document === "undefined") {
    return true;
  }

  const visibleAccessCookie = readDocumentCookie(backendAccessCookieName);
  if (!visibleAccessCookie) {
    // Real gateway cookies are HttpOnly, so the browser cannot inspect them.
    // In that case still attempt backend sync and let the gateway decide.
    return true;
  }

  return isLikelyBackendAccessToken(visibleAccessCookie);
}

function readDocumentCookie(name: string): string | null {
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

function isLikelyBackendAccessToken(token: string): boolean {
  const decoded = decodeURIComponent(token).trim();
  if (!decoded) {
    return false;
  }
  if (decoded.split(".").length === 3) {
    return true;
  }
  return decoded.length >= 32;
}

export function buildRuntimeContextHeaders(
  context: RuntimeRequestContext = activeRequestContext,
): Record<string, string> {
  if (activeAccessToken) {
    return {
      Authorization: `Bearer ${activeAccessToken}`,
      "X-Project-Id": context.projectId,
      "X-Request-Id": context.requestId ?? context.actor,
      "X-Correlation-Id":
        context.correlationId ?? context.requestId ?? context.actor,
    };
  }

  return {
    "X-Tenant-Id": context.tenantId,
    "X-Project-Id": context.projectId,
    "X-Actor": context.actor,
    "X-Roles": context.roles.join(","),
    "X-Request-Id": context.requestId ?? context.actor,
    "X-Correlation-Id":
      context.correlationId ?? context.requestId ?? context.actor,
  };
}

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }
  for (const [key, value] of Object.entries(buildRuntimeContextHeaders())) {
    headers.set(key, value);
  }

  const controller = init.signal ? null : new AbortController();
  const timeout =
    controller === null
      ? null
      : globalThis.setTimeout(
          () => controller.abort(),
          defaultRequestTimeoutMs,
        );
  let response: Response;
  try {
    const requestInit: RequestInit = {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    };
    if (!init.signal && controller) {
      requestInit.signal = controller.signal;
    }
    response = await fetch(`${ARCHITOKEN_API_BASE_URL}${path}`, requestInit);
  } catch (error) {
    throw normalizeNetworkError(error);
  } finally {
    if (timeout !== null) {
      globalThis.clearTimeout(timeout);
    }
  }

  if (!response.ok) {
    let apiError: BackendApiError;
    try {
      apiError = (await response.json()) as BackendApiError;
    } catch {
      apiError = { error: response.statusText, code: response.status };
    }
    throw apiError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function normalizeNetworkError(error: unknown): BackendApiError | unknown {
  const errorName =
    typeof error === "object" && error && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  if (errorName === "AbortError") {
    return {
      error: "网络请求超时，请确认手机和电脑在同一网络后刷新重试。",
      code: 0,
    };
  }
  if (error instanceof TypeError) {
    return {
      error: "网络连接失败，请确认服务已启动且手机能访问当前地址。",
      code: 0,
    };
  }
  return error;
}

export function applyAuthResponse(auth: AuthResponse): void {
  setBackendAccessToken(auth.accessToken);
  const nextContext: RuntimeRequestContext = {
    tenantId: auth.tenantId,
    projectId: activeRequestContext.projectId,
    actor: auth.accountId,
    roles: auth.runtimeRoles,
  };
  if (activeRequestContext.requestId) {
    nextContext.requestId = activeRequestContext.requestId;
  }
  if (activeRequestContext.correlationId) {
    nextContext.correlationId = activeRequestContext.correlationId;
  }
  setBackendRequestContext(nextContext);
}

export async function requestAuthVerificationCode(
  body: AuthVerificationCodeRequest,
): Promise<AuthVerificationCodeResponse> {
  return backendRequest<AuthVerificationCodeResponse>(
    "/v1/auth/verification-codes",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function registerAuthAccount(
  body: AuthRegisterRequest,
): Promise<AuthResponse> {
  const auth = await backendRequest<AuthResponse>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  applyAuthResponse(auth);
  return auth;
}

export async function loginAuthAccount(
  body: AuthLoginRequest,
): Promise<AuthResponse> {
  const auth = await backendRequest<AuthResponse>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  applyAuthResponse(auth);
  return auth;
}

export async function loginAuthAccountWithCode(
  body: AuthCodeLoginRequest,
): Promise<AuthResponse> {
  const auth = await backendRequest<AuthResponse>("/v1/auth/login/code", {
    method: "POST",
    body: JSON.stringify(body),
  });
  applyAuthResponse(auth);
  return auth;
}

export async function resetAuthPassword(
  body: AuthPasswordResetRequest,
): Promise<void> {
  await backendRequest<void>("/v1/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createAuthQrChallenge(
  body: AuthQrChallengeRequest,
): Promise<AuthQrChallengeResponse> {
  return backendRequest<AuthQrChallengeResponse>("/v1/auth/qr/challenges", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pollAuthQrChallenge(
  challengeId: string,
  pollToken: string,
): Promise<AuthQrPollResponse> {
  const response = await backendRequest<AuthQrPollResponse>(
    `/v1/auth/qr/challenges/${encodeURIComponent(challengeId)}${buildQuery({
      pollToken,
    })}`,
  );
  if (response.auth) {
    applyAuthResponse(response.auth);
  }
  return response;
}

export async function scanAuthQrChallenge(
  challengeId: string,
  scanToken: string,
): Promise<AuthQrStatusResponse> {
  return backendRequest<AuthQrStatusResponse>(
    `/v1/auth/qr/challenges/${encodeURIComponent(challengeId)}/scan`,
    {
      method: "POST",
      body: JSON.stringify({ scanToken }),
    },
  );
}

export async function approveAuthQrChallenge(
  challengeId: string,
  scanToken: string,
): Promise<AuthQrStatusResponse> {
  return backendRequest<AuthQrStatusResponse>(
    `/v1/auth/qr/challenges/${encodeURIComponent(challengeId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ scanToken }),
    },
  );
}

export type AuthOAuthProvider =
  | "wechat"
  | "douyin"
  | "alipay"
  | "microsoft"
  | "google";

export function getAuthOAuthStartUrl(
  provider: AuthOAuthProvider,
  accountType: "personal" | "enterprise",
  returnTo = "/app/modules",
): string {
  const params = new URLSearchParams({
    accountType,
    returnTo,
  });
  return `${ARCHITOKEN_API_BASE_URL}/v1/auth/oauth/${provider}/start?${params.toString()}`;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return backendRequest<AuthMeResponse>("/v1/auth/me");
}

export async function logoutAuthAccount(): Promise<void> {
  await backendRequest<{ loggedOut: boolean }>("/v1/auth/logout", {
    method: "POST",
  });
  setBackendAccessToken(null);
}

export async function listAssets(query: {
  kind?: string;
  status?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<AssetListResponse> {
  return backendRequest<AssetListResponse>(
    `/v1/assets${buildQuery({
      kind: query.kind,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    })}`,
  );
}

export async function fetchBimSemanticReadiness(
  assetId: string,
): Promise<BimSemanticReadinessResponse> {
  return backendRequest<BimSemanticReadinessResponse>(
    `/v1/bim/models/${encodeURIComponent(assetId)}/openbim-readiness`,
  );
}
