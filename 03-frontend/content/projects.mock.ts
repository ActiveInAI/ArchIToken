import type { Project } from "@/lib/insome/types";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * TODO(phase-4): replace with GET /api/projects once the backend is wired.
 * Timestamps are computed relative to module load so the "updated X ago" labels
 * stay fresh between dev restarts. Replace with server-authoritative timestamps.
 */
const now = Date.now();

export const mockHomeProjects: ReadonlyArray<Project> = [
  {
    id: "p_001",
    name: "三亚海景别墅 · 145㎡",
    thumbnail: "/assets/projects/thumb-coastal.svg",
    status: "ready",
    updatedAt: now - 3 * HOUR,
    area: 145,
    unit: "m",
    bedrooms: 4,
  },
  {
    id: "p_002",
    name: "上海 120㎡ 三居",
    thumbnail: "/assets/projects/thumb-urban.svg",
    status: "ready",
    updatedAt: now - DAY,
    area: 120,
    unit: "m",
    bedrooms: 3,
  },
  {
    id: "p_003",
    name: "北京朝阳 · 学区小两居",
    thumbnail: "/assets/projects/thumb-compact.svg",
    status: "generating",
    updatedAt: now - 2 * HOUR,
    area: 78,
    unit: "m",
    bedrooms: 2,
  },
  {
    id: "p_004",
    name: "成都高新 · 双子户型",
    thumbnail: "/assets/projects/thumb-urban.svg",
    status: "ready",
    updatedAt: now - 4 * DAY,
    area: 96,
    unit: "m",
    bedrooms: 2,
  },
  {
    id: "p_005",
    name: "杭州滨江 · 亲子四居",
    thumbnail: "/assets/projects/thumb-family.svg",
    status: "draft",
    updatedAt: now - 7 * DAY,
    area: 142,
    unit: "m",
    bedrooms: 4,
  },
  {
    id: "p_006",
    name: "苏州工业园 · 开放式 LOFT",
    thumbnail: "/assets/projects/thumb-loft.svg",
    status: "ready",
    updatedAt: now - 12 * DAY,
    area: 88,
    unit: "m",
    bedrooms: 1,
  },
  {
    id: "p_007",
    name: "深圳湾 · 三代同堂",
    thumbnail: "/assets/projects/thumb-family.svg",
    status: "ready",
    updatedAt: now - 30 * DAY,
    area: 168,
    unit: "m",
    bedrooms: 5,
  },
  {
    id: "p_008",
    name: "广州天河 · 单身公寓",
    thumbnail: "/assets/projects/thumb-compact.svg",
    status: "archived",
    updatedAt: now - 60 * DAY,
    area: 52,
    unit: "m",
    bedrooms: 1,
  },
];
