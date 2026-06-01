// Backend data-plane API client for progressive StorageRouter capability stores.
// License: Apache-2.0

import { backendRequest, buildQuery } from "./backend-api";
import type { ModuleId } from "./module-registry";

export interface DataPlaneBindingRecord {
  capability: string;
  currentProvider: string;
  fallbackProvider: string;
  splitPhase: string;
  externalUrlEnv: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataPlaneBindingListResponse {
  bindings: DataPlaneBindingRecord[];
  total: number;
}

export interface DataGraphEdgeInput {
  moduleId?: ModuleId | string | null;
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relationshipType: string;
  properties?: Record<string, unknown> | null;
  source?: string | null;
}

export interface DataGraphEdgeQuery {
  moduleId?: ModuleId | string | null;
  fromEntityType?: string | null;
  fromEntityId?: string | null;
  relationshipType?: string | null;
  limit?: number | null;
}

export interface DataGraphEdgeRecord extends DataGraphEdgeInput {
  id: string;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  properties: Record<string, unknown>;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataGraphEdgeListResponse {
  edges: DataGraphEdgeRecord[];
  total: number;
  query: DataGraphEdgeQuery;
}

export interface DataTimeSeriesPointInput {
  moduleId?: ModuleId | string | null;
  seriesKey: string;
  observedAt?: string | null;
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  quality?: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface DataTimeSeriesPointQuery {
  moduleId?: ModuleId | string | null;
  seriesKey?: string | null;
  limit?: number | null;
}

export interface DataTimeSeriesPointRecord extends DataTimeSeriesPointInput {
  id: string;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  observedAt: string;
  quality: string;
  attributes: Record<string, unknown>;
  ingestedAt: string;
}

export interface DataTimeSeriesPointListResponse {
  points: DataTimeSeriesPointRecord[];
  total: number;
  query: DataTimeSeriesPointQuery;
}

export interface DataEventOutboxInput {
  moduleId?: ModuleId | string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  payload?: Record<string, unknown> | null;
}

export interface DataEventOutboxQuery {
  status?: string | null;
  moduleId?: ModuleId | string | null;
  limit?: number | null;
}

export interface DataEventOutboxRecord extends DataEventOutboxInput {
  id: string;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  payload: Record<string, unknown>;
  status: string;
  attemptCount: number;
  occurredAt: string;
  publishedAt: string | null;
  lastError: string | null;
}

export interface DataEventOutboxListResponse {
  events: DataEventOutboxRecord[];
  total: number;
  query: DataEventOutboxQuery;
}

export interface DataAnalyticsEventInput {
  moduleId?: ModuleId | string | null;
  metricName: string;
  metricValue?: number | null;
  dimensions?: Record<string, unknown> | null;
  occurredAt?: string | null;
}

export interface DataAnalyticsEventQuery {
  metricName?: string | null;
  moduleId?: ModuleId | string | null;
  limit?: number | null;
}

export interface DataAnalyticsEventRecord extends DataAnalyticsEventInput {
  id: string;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  dimensions: Record<string, unknown>;
  occurredAt: string;
  ingestedAt: string;
}

export interface DataAnalyticsEventListResponse {
  events: DataAnalyticsEventRecord[];
  total: number;
  query: DataAnalyticsEventQuery;
}

function toQueryParams(
  query:
    | DataGraphEdgeQuery
    | DataTimeSeriesPointQuery
    | DataEventOutboxQuery
    | DataAnalyticsEventQuery,
): Record<string, string | number | boolean | null | undefined> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null | undefined>;
}

export async function listDataPlaneBindings(): Promise<DataPlaneBindingListResponse> {
  return backendRequest<DataPlaneBindingListResponse>(
    "/v1/data-plane/bindings",
    {
      cache: "no-store",
    },
  );
}

export async function listDataGraphEdges(
  query: DataGraphEdgeQuery = {},
): Promise<DataGraphEdgeListResponse> {
  return backendRequest<DataGraphEdgeListResponse>(
    `/v1/data-plane/graph-edges${buildQuery(toQueryParams(query))}`,
    { cache: "no-store" },
  );
}

export async function upsertDataGraphEdge(
  input: DataGraphEdgeInput,
): Promise<DataGraphEdgeRecord> {
  return backendRequest<DataGraphEdgeRecord>("/v1/data-plane/graph-edges", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listDataTimeSeriesPoints(
  query: DataTimeSeriesPointQuery = {},
): Promise<DataTimeSeriesPointListResponse> {
  return backendRequest<DataTimeSeriesPointListResponse>(
    `/v1/data-plane/time-series/points${buildQuery(toQueryParams(query))}`,
    { cache: "no-store" },
  );
}

export async function writeDataTimeSeriesPoint(
  input: DataTimeSeriesPointInput,
): Promise<DataTimeSeriesPointRecord> {
  return backendRequest<DataTimeSeriesPointRecord>(
    "/v1/data-plane/time-series/points",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listDataEventOutbox(
  query: DataEventOutboxQuery = {},
): Promise<DataEventOutboxListResponse> {
  return backendRequest<DataEventOutboxListResponse>(
    `/v1/data-plane/event-outbox${buildQuery(toQueryParams(query))}`,
    { cache: "no-store" },
  );
}

export async function appendDataEventOutbox(
  input: DataEventOutboxInput,
): Promise<DataEventOutboxRecord> {
  return backendRequest<DataEventOutboxRecord>("/v1/data-plane/event-outbox", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listDataAnalyticsEvents(
  query: DataAnalyticsEventQuery = {},
): Promise<DataAnalyticsEventListResponse> {
  return backendRequest<DataAnalyticsEventListResponse>(
    `/v1/data-plane/analytics-events${buildQuery(toQueryParams(query))}`,
    { cache: "no-store" },
  );
}

export async function recordDataAnalyticsEvent(
  input: DataAnalyticsEventInput,
): Promise<DataAnalyticsEventRecord> {
  return backendRequest<DataAnalyticsEventRecord>(
    "/v1/data-plane/analytics-events",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
