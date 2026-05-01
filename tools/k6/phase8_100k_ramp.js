import {
  anonymousBrowser,
  authenticatedApi,
  viewerManifest,
  objectPresign,
  conversionEnqueue,
  realtimePresence,
} from "./phase8_100k_smoke.js";

const maxVus = Number(__ENV.PHASE8_RAMP_MAX_VUS || "1000");
const rateScale = Number(__ENV.PHASE8_RATE_SCALE || "1");

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.001"],
    "http_req_duration{route:healthz}": ["p(95)<100", "p(99)<300"],
    "http_req_duration{route:readyz}": ["p(95)<100", "p(99)<300"],
    "http_req_duration{scenario:anonymous_browser}": ["p(95)<300", "p(99)<1000"],
    "http_req_duration{scenario:authenticated_api}": ["p(95)<300", "p(99)<1000"],
    "http_req_duration{scenario:viewer_manifest}": ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{scenario:object_presign}": ["p(95)<800", "p(99)<2000"],
    "http_req_duration{scenario:conversion_enqueue}": ["p(95)<800", "p(99)<2000"],
  },
  scenarios: {
    anonymous_browser: {
      executor: "ramping-arrival-rate",
      exec: "anonymousBrowser",
      preAllocatedVUs: Math.max(10, Math.floor(maxVus * 0.10)),
      maxVUs: Math.max(20, Math.floor(maxVus * 0.25)),
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: Math.floor(200 * rateScale) },
        { duration: "5m", target: Math.floor(1000 * rateScale) },
        { duration: "10m", target: Math.floor(2000 * rateScale) },
        { duration: "5m", target: 0 },
      ],
    },
    authenticated_api: {
      executor: "ramping-arrival-rate",
      exec: "authenticatedApi",
      preAllocatedVUs: Math.max(10, Math.floor(maxVus * 0.20)),
      maxVUs: Math.max(20, Math.floor(maxVus * 0.35)),
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: Math.floor(100 * rateScale) },
        { duration: "5m", target: Math.floor(500 * rateScale) },
        { duration: "10m", target: Math.floor(1200 * rateScale) },
        { duration: "5m", target: 0 },
      ],
    },
    viewer_manifest: {
      executor: "ramping-arrival-rate",
      exec: "viewerManifest",
      preAllocatedVUs: Math.max(10, Math.floor(maxVus * 0.20)),
      maxVUs: Math.max(20, Math.floor(maxVus * 0.30)),
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: Math.floor(50 * rateScale) },
        { duration: "5m", target: Math.floor(300 * rateScale) },
        { duration: "10m", target: Math.floor(800 * rateScale) },
        { duration: "5m", target: 0 },
      ],
    },
    object_presign: {
      executor: "ramping-arrival-rate",
      exec: "objectPresign",
      preAllocatedVUs: Math.max(10, Math.floor(maxVus * 0.10)),
      maxVUs: Math.max(20, Math.floor(maxVus * 0.15)),
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: Math.floor(20 * rateScale) },
        { duration: "5m", target: Math.floor(100 * rateScale) },
        { duration: "10m", target: Math.floor(250 * rateScale) },
        { duration: "5m", target: 0 },
      ],
    },
    conversion_enqueue: {
      executor: "ramping-arrival-rate",
      exec: "conversionEnqueue",
      preAllocatedVUs: Math.max(10, Math.floor(maxVus * 0.05)),
      maxVUs: Math.max(20, Math.floor(maxVus * 0.10)),
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: Math.floor(5 * rateScale) },
        { duration: "5m", target: Math.floor(25 * rateScale) },
        { duration: "10m", target: Math.floor(75 * rateScale) },
        { duration: "5m", target: 0 },
      ],
    },
    realtime_presence: {
      executor: "ramping-arrival-rate",
      exec: "realtimePresence",
      preAllocatedVUs: Math.max(10, Math.floor(maxVus * 0.10)),
      maxVUs: Math.max(20, Math.floor(maxVus * 0.20)),
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: Math.floor(20 * rateScale) },
        { duration: "5m", target: Math.floor(100 * rateScale) },
        { duration: "10m", target: Math.floor(300 * rateScale) },
        { duration: "5m", target: 0 },
      ],
    },
  },
};

export { anonymousBrowser, authenticatedApi, viewerManifest, objectPresign, conversionEnqueue, realtimePresence };
