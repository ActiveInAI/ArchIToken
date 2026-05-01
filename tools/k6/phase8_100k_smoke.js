import http from "k6/http";
import ws from "k6/ws";
import { check, group, sleep } from "k6";

const apiBase = __ENV.ARCHITOKEN_API_BASE_URL || "http://localhost:8080";
const frontendBase = __ENV.ARCHITOKEN_FRONTEND_BASE_URL || "http://localhost:5173";
const wsBase = __ENV.ARCHITOKEN_WS_BASE_URL || "ws://localhost:8082";
const tenantId = __ENV.ARCHITOKEN_TENANT_ID || "phase8-load-tenant";
const projectId = __ENV.ARCHITOKEN_PROJECT_ID || "phase8-load-project";
const actor = __ENV.ARCHITOKEN_ACTOR || "phase8-k6";
const roles = __ENV.ARCHITOKEN_ROLES || "admin";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.001"],
    "http_req_duration{scenario:anonymous_browser}": ["p(95)<300", "p(99)<1000"],
    "http_req_duration{scenario:authenticated_api}": ["p(95)<300", "p(99)<1000"],
    "http_req_duration{scenario:viewer_manifest}": ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{scenario:object_presign}": ["p(95)<800", "p(99)<2000"],
    "http_req_duration{scenario:conversion_enqueue}": ["p(95)<800", "p(99)<2000"],
  },
  scenarios: {
    anonymous_browser: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
      exec: "anonymousBrowser",
    },
    authenticated_api: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
      exec: "authenticatedApi",
    },
    viewer_manifest: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
      exec: "viewerManifest",
    },
    object_presign: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      exec: "objectPresign",
    },
    conversion_enqueue: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      exec: "conversionEnqueue",
    },
    realtime_presence: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      exec: "realtimePresence",
    },
  },
};

function contextHeaders() {
  return {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Tenant-Id": tenantId,
    "X-Project-Id": projectId,
    "X-Actor": actor,
    "X-Roles": roles,
    "X-Request-Id": `k6-${actor}-${__VU}-${__ITER}`,
    "X-Correlation-Id": "phase8-100k-smoke",
  };
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${__VU}-${__ITER}-${Math.floor(Math.random() * 100000)}`;
}

function createAsset(kind = "ifc") {
  const body = JSON.stringify({
    kind,
    name: `${randomId("phase8")}.${kind}`,
    sourceFormat: kind,
    canonicalFormat: kind === "ifc" ? "ifc4x3" : kind,
    metadata: { loadTest: true, scenario: __ENV.K6_SCENARIO || "phase8" },
  });
  const res = http.post(`${apiBase}/v1/assets`, body, { headers: contextHeaders(), tags: { route: "create_asset" } });
  check(res, { "asset created": (r) => r.status === 200 || r.status === 201 });
  if (res.status < 200 || res.status >= 300) {
    return null;
  }
  return res.json();
}

function presignAndComplete(asset) {
  if (!asset || !asset.assetId) {
    return;
  }
  const fileName = `${randomId("phase8-upload")}.ifc`;
  const presignBody = JSON.stringify({
    fileName,
    contentType: "model/ifc",
    sizeBytes: 128,
  });
  const presign = http.post(`${apiBase}/v1/assets/${asset.assetId}/files/presign-upload`, presignBody, {
    headers: contextHeaders(),
    tags: { route: "presign_upload" },
  });
  check(presign, { "presign accepted": (r) => r.status === 200 || r.status === 201 });
  if (presign.status < 200 || presign.status >= 300) {
    return;
  }
  const fileId = presign.json("fileId");
  const completeBody = JSON.stringify({
    fileId,
    key: `${tenantId}/${projectId}/${asset.assetId}/${fileId}/${fileName}`,
    sizeBytes: 128,
    contentType: "model/ifc",
    checksumSha256: randomId("sha"),
    role: "source",
    format: "ifc",
  });
  const complete = http.post(`${apiBase}/v1/assets/${asset.assetId}/files/complete-upload`, completeBody, {
    headers: contextHeaders(),
    tags: { route: "complete_upload" },
  });
  check(complete, { "complete accepted": (r) => r.status === 200 || r.status === 201 });
  return { fileId };
}

export function anonymousBrowser() {
  group("anonymous_browser", () => {
    check(http.get(`${frontendBase}/`, { tags: { route: "static_app" } }), {
      "static app reachable": (r) => r.status < 500,
    });
    check(http.get(`${apiBase}/healthz`, { tags: { route: "healthz" } }), {
      "health reachable": (r) => r.status === 200,
    });
    check(http.get(`${apiBase}/v1/runtime/capabilities`, { headers: contextHeaders(), tags: { route: "runtime_capabilities" } }), {
      "capabilities reachable": (r) => r.status === 200,
    });
    sleep(1);
  });
}

export function authenticatedApi() {
  group("authenticated_api", () => {
    check(http.get(`${apiBase}/v1/assets?limit=20`, { headers: contextHeaders(), tags: { route: "asset_list" } }), {
      "asset list ok": (r) => r.status === 200,
    });
    createAsset("ifc");
    check(http.get(`${apiBase}/v1/runtime/executions`, { headers: contextHeaders(), tags: { route: "runtime_execution_list" } }), {
      "runtime execution list ok": (r) => r.status === 200,
    });
    sleep(1);
  });
}

export function viewerManifest() {
  group("viewer_manifest", () => {
    check(http.get(`${apiBase}/v1/assets?kind=ifc&limit=20`, { headers: contextHeaders(), tags: { route: "viewer_asset_manifest" } }), {
      "viewer manifest metadata ok": (r) => r.status === 200,
    });
    check(http.get(`${apiBase}/v1/viewer/commands?limit=20`, { headers: contextHeaders(), tags: { route: "viewer_command_list" } }), {
      "viewer command list ok": (r) => r.status === 200,
    });
    sleep(1);
  });
}

export function objectPresign() {
  group("object_presign", () => {
    const asset = createAsset("ifc");
    presignAndComplete(asset);
    sleep(1);
  });
}

export function conversionEnqueue() {
  group("conversion_enqueue", () => {
    const asset = createAsset("ifc");
    const file = presignAndComplete(asset);
    if (asset && file) {
      const body = JSON.stringify({
        operation: "ifc_ingest",
        sourceAssetId: asset.assetId,
        sourceFileId: file.fileId,
        input: { loadTest: true },
      });
      const res = http.post(`${apiBase}/v1/conversion-jobs`, body, {
        headers: contextHeaders(),
        tags: { route: "conversion_enqueue" },
      });
      check(res, { "conversion enqueued": (r) => r.status === 200 || r.status === 201 || r.status === 202 });
    }
    sleep(1);
  });
}

export function realtimePresence() {
  group("realtime_presence", () => {
    if (__ENV.ARCHITOKEN_ENABLE_REALTIME_WS !== "1") {
      sleep(1);
      return;
    }
    const url = `${wsBase}/v1/realtime?tenantId=${encodeURIComponent(tenantId)}&projectId=${encodeURIComponent(projectId)}`;
    const response = ws.connect(url, { headers: contextHeaders(), tags: { route: "realtime_handshake" } }, (socket) => {
      socket.on("open", () => socket.close());
    });
    check(response, { "realtime handshake accepted": (r) => r && r.status === 101 });
    sleep(1);
  });
}
