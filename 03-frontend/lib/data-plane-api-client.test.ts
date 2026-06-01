import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendDataEventOutbox,
  listDataGraphEdges,
  listDataPlaneBindings,
  recordDataAnalyticsEvent,
  upsertDataGraphEdge,
  writeDataTimeSeriesPoint,
} from "./data-plane-api-client";

describe("data plane api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists data-plane bindings through the backend API", async () => {
    const fetchMock = vi.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return new Response(
          JSON.stringify({
            bindings: [
              {
                capability: "vector_store",
                currentProvider: "postgres_pgvector",
                fallbackProvider: "postgres_pgvector",
                splitPhase: "phase_2_vector_split",
                externalUrlEnv: ["ARCHITOKEN_VECTOR__URL", "QDRANT_URL"],
                enabled: true,
                metadata: {},
                createdAt: "2026-06-01T01:00:00Z",
                updatedAt: "2026-06-01T01:00:00Z",
              },
            ],
            total: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(
      fetchMock as unknown as typeof fetch,
    );

    const response = await listDataPlaneBindings();

    expect(response.total).toBe(1);
    expect(response.bindings[0]?.capability).toBe("vector_store");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:18080/v1/data-plane/bindings",
    );
  });

  it("lists graph edges with camelCase query parameters", async () => {
    const fetchMock = vi.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return new Response(
          JSON.stringify({
            edges: [],
            total: 0,
            query: {
              moduleId: "digital_twin",
              relationshipType: "feeds",
              limit: 20,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(
      fetchMock as unknown as typeof fetch,
    );

    const response = await listDataGraphEdges({
      moduleId: "digital_twin",
      relationshipType: "feeds",
      limit: 20,
    });

    expect(response.total).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:18080/v1/data-plane/graph-edges?moduleId=digital_twin&relationshipType=feeds&limit=20",
    );
  });

  it("posts graph, time-series, event and analytics writes", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const now = "2026-06-01T01:00:00Z";
        if (url.endsWith("/graph-edges")) {
          return new Response(
            JSON.stringify({
              id: "11111111-1111-4111-8111-111111111111",
              tenantId: "11111111-1111-4111-8111-111111111111",
              projectId: "22222222-2222-4222-8222-222222222222",
              createdAt: now,
              updatedAt: now,
              source: "test",
              properties: {},
              ...body,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/time-series/points")) {
          return new Response(
            JSON.stringify({
              id: "22222222-2222-4222-8222-222222222222",
              tenantId: "11111111-1111-4111-8111-111111111111",
              projectId: "22222222-2222-4222-8222-222222222222",
              observedAt: now,
              quality: "raw",
              attributes: {},
              ingestedAt: now,
              ...body,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/event-outbox")) {
          return new Response(
            JSON.stringify({
              id: "33333333-3333-4333-8333-333333333333",
              tenantId: "11111111-1111-4111-8111-111111111111",
              projectId: "22222222-2222-4222-8222-222222222222",
              payload: {},
              status: "pending",
              attemptCount: 0,
              occurredAt: now,
              publishedAt: null,
              lastError: null,
              ...body,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            id: "44444444-4444-4444-8444-444444444444",
            tenantId: "11111111-1111-4111-8111-111111111111",
            projectId: "22222222-2222-4222-8222-222222222222",
            dimensions: {},
            occurredAt: now,
            ingestedAt: now,
            ...body,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(
      fetchMock as unknown as typeof fetch,
    );

    const edge = await upsertDataGraphEdge({
      moduleId: "digital_twin",
      fromEntityType: "sensor",
      fromEntityId: "sensor-01",
      toEntityType: "space",
      toEntityId: "room-01",
      relationshipType: "observes",
    });
    const point = await writeDataTimeSeriesPoint({
      moduleId: "digital_twin",
      seriesKey: "sensor-01.temperature",
      valueNumeric: 26.5,
      unit: "celsius",
    });
    const event = await appendDataEventOutbox({
      moduleId: "construction_management",
      eventType: "inspection.created",
      targetType: "inspection",
      targetId: "inspection-01",
    });
    const analytics = await recordDataAnalyticsEvent({
      moduleId: "quantity_costing",
      metricName: "boq.item.reviewed",
      metricValue: 1,
    });

    expect(edge.relationshipType).toBe("observes");
    expect(point.seriesKey).toBe("sensor-01.temperature");
    expect(event.status).toBe("pending");
    expect(analytics.metricName).toBe("boq.item.reviewed");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      seriesKey: "sensor-01.temperature",
      valueNumeric: 26.5,
    });
  });
});
