#!/usr/bin/env python3
"""Collect Phase 8.2 Prometheus metrics into an evidence-compatible fragment."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode
from urllib.request import urlopen


PROMETHEUS_QUERIES: dict[str, str] = {
    "gateway.request_rate": "sum(rate(architoken_phase8_request_count[5m]))",
    "gateway.error_rate": "sum(rate(architoken_phase8_error_count[5m])) / clamp_min(sum(rate(architoken_phase8_request_count[5m])), 1)",
    "gateway.active_requests": "sum(architoken_phase8_active_requests)",
    "gateway.restarts": "sum(increase(kube_pod_container_status_restarts_total{pod=~\".*gateway.*\"}[5m]))",
    "realtime.ws_connected": "sum(architoken_realtime_active_connections)",
    "realtime.dropped_connections": "sum(increase(architoken_realtime_dropped_connections_total[5m]))",
    "db.pool_saturation": "max(pgbouncer_pools_cl_active / clamp_min(pgbouncer_pools_cl_active + pgbouncer_pools_cl_waiting + pgbouncer_pools_sv_idle + pgbouncer_pools_sv_active, 1))",
    "object_store.errors": "sum(rate(seaweedfs_s3_request_errors_total[5m]))",
    "nats.lag": "max(nats_stream_consumer_num_pending)",
    "qdrant.consistency": "min(qdrant_cluster_enabled)",
    "valkey.up": "max(redis_up)",
}


class PrometheusSnapshotError(RuntimeError):
    """Raised when a required Prometheus query fails."""


UrlOpen = Callable[[str, float], Any]


def utc_now() -> str:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def query_prometheus(
    prometheus_url: str,
    query: str,
    *,
    timeout: float = 10.0,
    opener: UrlOpen = urlopen,
) -> float:
    """Execute one instant Prometheus query and return its numeric value."""
    endpoint = prometheus_url.rstrip("/") + "/api/v1/query?" + urlencode({"query": query})
    with opener(endpoint, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("status") != "success":
        raise PrometheusSnapshotError(f"Prometheus query failed: {query}")
    return parse_prometheus_value(payload)


def parse_prometheus_value(payload: dict[str, Any]) -> float:
    """Extract a numeric value from a Prometheus query response."""
    result = payload.get("data", {}).get("result", [])
    if not result:
        raise PrometheusSnapshotError("Prometheus query returned no series")
    first = result[0]
    value = first.get("value")
    if not isinstance(value, list) or len(value) < 2:
        raise PrometheusSnapshotError("Prometheus query result has no value")
    return float(value[1])


def collect_snapshot(
    prometheus_url: str,
    *,
    timeout: float = 10.0,
    opener: UrlOpen = urlopen,
    queried_at: str | None = None,
) -> dict[str, Any]:
    """Collect the Phase 8.2 required Prometheus snapshot."""
    metrics: dict[str, float] = {}
    queries: dict[str, dict[str, Any]] = {}
    errors: list[str] = []
    for name, query in PROMETHEUS_QUERIES.items():
        try:
            value = query_prometheus(prometheus_url, query, timeout=timeout, opener=opener)
            metrics[name] = value
            queries[name] = {"query": query, "value": value, "status": "success"}
        except Exception as err:  # noqa: BLE001 - evidence must report every query failure.
            errors.append(f"{name}: {err}")
            queries[name] = {"query": query, "status": "failed", "error": str(err)}

    return {
        "prometheus_snapshot_present": not errors,
        "prometheus": {
            "queried_at": queried_at or utc_now(),
            "metrics": metrics,
            "queries": queries,
            "errors": errors,
        },
        "resource_metrics": {
            "gateway_request_rate": metrics.get("gateway.request_rate"),
            "gateway_error_rate": metrics.get("gateway.error_rate"),
            "gateway_active_requests": metrics.get("gateway.active_requests"),
            "db_pool_saturation": metrics.get("db.pool_saturation"),
        },
        "dependency_status": {
            "gateway": "ready" if "gateway.request_rate" in metrics else "missing",
            "realtime": "ready" if "realtime.ws_connected" in metrics else "missing",
            "postgres": "ready" if "db.pool_saturation" in metrics else "missing",
            "object_store": "ready" if "object_store.errors" in metrics else "missing",
            "nats": "ready" if "nats.lag" in metrics else "missing",
            "qdrant": "ready" if metrics.get("qdrant.consistency", 0) >= 1 else "missing",
            "valkey": "ready" if metrics.get("valkey.up", 0) >= 1 else "missing",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prometheus-url", required=True)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--allow-missing", action="store_true")
    args = parser.parse_args()

    snapshot = collect_snapshot(args.prometheus_url, timeout=args.timeout)
    errors = snapshot["prometheus"]["errors"]
    if errors and not args.allow_missing:
        for error in errors:
            print(f"prometheus_error={error}", file=sys.stderr)
        return 1

    output = json.dumps(snapshot, indent=2, sort_keys=True)
    if args.out:
        args.out.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
