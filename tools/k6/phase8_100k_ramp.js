import {
  anonymousBrowser,
  authenticatedApi,
  viewerManifest,
  objectPresign,
  conversionEnqueue,
  realtimePresence,
} from "./phase8_100k_smoke.js";

const loadProfile = (__ENV.ARCHITOKEN_LOAD_PROFILE || "smoke").toLowerCase();
const rateScale = Number(__ENV.PHASE8_RATE_SCALE || "1");

const profiles = {
  smoke: { maxVus: 20, browser: 2, api: 2, viewer: 2, presign: 1, conversion: 1, realtime: 1, peak: "30s" },
  "1k": { maxVus: 1000, browser: 20, api: 10, viewer: 8, presign: 3, conversion: 1, realtime: 3, peak: "10m" },
  "10k": { maxVus: 10000, browser: 200, api: 100, viewer: 80, presign: 25, conversion: 8, realtime: 30, peak: "20m" },
  "25k": { maxVus: 25000, browser: 500, api: 250, viewer: 200, presign: 60, conversion: 15, realtime: 75, peak: "30m" },
  "50k": { maxVus: 50000, browser: 1000, api: 500, viewer: 400, presign: 125, conversion: 35, realtime: 150, peak: "45m" },
  "100k": { maxVus: 100000, browser: 2000, api: 1200, viewer: 800, presign: 250, conversion: 75, realtime: 300, peak: "60m" },
};

const profile = profiles[loadProfile] || profiles.smoke;
const maxVusOverride = Number(__ENV.PHASE8_RAMP_MAX_VUS || profile.maxVus);

function scaled(value) {
  return Math.max(1, Math.floor(value * rateScale));
}

function stages(target) {
  if (loadProfile === "smoke") {
    return [
      { duration: "10s", target: scaled(target) },
      { duration: profile.peak, target: scaled(target) },
      { duration: "10s", target: 0 },
    ];
  }
  return [
    { duration: "5m", target: scaled(Math.max(1, Math.floor(target * 0.1))) },
    { duration: "10m", target: scaled(Math.max(1, Math.floor(target * 0.25))) },
    { duration: "10m", target: scaled(Math.max(1, Math.floor(target * 0.5))) },
    { duration: profile.peak, target: scaled(target) },
    { duration: "10m", target: 0 },
  ];
}

function scenario(exec, target, vuShare) {
  return {
    executor: "ramping-arrival-rate",
    exec,
    preAllocatedVUs: Math.max(10, Math.floor(maxVusOverride * vuShare * 0.50)),
    maxVUs: Math.max(20, Math.floor(maxVusOverride * vuShare)),
    timeUnit: "1s",
    stages: stages(target),
  };
}

export const options = {
  thresholds: {
    checks: ["rate>0.999"],
    http_req_failed: ["rate<0.001"],
    "http_req_duration{route:healthz}": ["p(95)<100", "p(99)<300"],
    "http_req_duration{route:readyz}": ["p(95)<100", "p(99)<300"],
    "http_req_duration{scenario:anonymous_browser}": ["p(95)<300", "p(99)<800"],
    "http_req_duration{scenario:authenticated_api}": ["p(95)<300", "p(99)<800"],
    "http_req_duration{scenario:viewer_manifest}": ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{scenario:object_presign}": ["p(95)<800", "p(99)<2000"],
    "http_req_duration{scenario:conversion_enqueue}": ["p(95)<800", "p(99)<2000"],
  },
  scenarios: {
    anonymous_browser: scenario("anonymousBrowser", profile.browser, 0.25),
    authenticated_api: scenario("authenticatedApi", profile.api, 0.35),
    viewer_manifest: scenario("viewerManifest", profile.viewer, 0.20),
    object_presign: scenario("objectPresign", profile.presign, 0.10),
    conversion_enqueue: scenario("conversionEnqueue", profile.conversion, 0.05),
    realtime_presence: scenario("realtimePresence", profile.realtime, 0.05),
  },
  ext: {
    architoken: {
      loadProfile,
      targetConcurrency: profile.maxVus,
      note: "100k profile is intended for external/distributed k6 execution, not a developer laptop.",
    },
  },
};

export {
  anonymousBrowser,
  authenticatedApi,
  viewerManifest,
  objectPresign,
  conversionEnqueue,
  realtimePresence,
};
