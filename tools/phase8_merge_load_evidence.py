#!/usr/bin/env python3
"""Merge k6 summaries, Prometheus, live K8s, and build metadata into evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from phase8_load_evidence import validate_evidence


DEFAULT_THRESHOLDS = {
    "api_p95_ms": 300,
    "api_p99_ms": 800,
    "http_req_failed_max": 0.001,
    "ws_connection_stability_min": 0.999,
    "dropped_connections_max": 50,
    "gateway_restarts_max": 0,
    "db_pool_saturation_max": 0.8,
    "object_store_errors_max": 0,
    "nats_lag_max": 1000,
}


class MergeEvidenceError(ValueError):
    """Raised when evidence inputs cannot be merged."""


def load_json(path: Path) -> dict[str, Any]:
    """Load a JSON object from disk."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise MergeEvidenceError(f"{path} must contain a JSON object")
    return data


def sha256_file(path: Path) -> str:
    """Return sha256 digest for a file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def git_sha() -> str:
    """Return current git commit SHA."""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short=12", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError) as err:
        raise MergeEvidenceError("cannot determine git SHA") from err


def metric(summary: dict[str, Any], name: str, value_name: str, default: float = 0.0) -> float:
    """Read a k6 summary metric value."""
    values = summary.get("metrics", {}).get(name, {}).get("values", {})
    value = values.get(value_name)
    return float(default if value is None else value)


def parse_stage_spec(spec: str) -> tuple[str, Path]:
    """Parse `stage=/path/to/summary.json`."""
    if "=" not in spec:
        raise MergeEvidenceError(f"invalid stage spec: {spec}")
    stage, path = spec.split("=", 1)
    if not stage or not path:
        raise MergeEvidenceError(f"invalid stage spec: {spec}")
    return stage, Path(path)


def parse_stage_specs(specs: list[str]) -> dict[str, Path]:
    """Parse repeated stage specs."""
    parsed = dict(parse_stage_spec(spec) for spec in specs)
    return parsed


def build_stage_result(
    stage: str,
    summary: dict[str, Any],
    metadata: dict[str, Any],
    prometheus_snapshot: dict[str, Any],
) -> dict[str, Any]:
    """Build one Phase 8.2 stage result from k6 summary and metadata."""
    resource_metrics = dict(prometheus_snapshot.get("resource_metrics", {}))
    dependency_status = dict(prometheus_snapshot.get("dependency_status", {}))
    if not resource_metrics:
        raise MergeEvidenceError(f"stage {stage} missing Prometheus resource metrics")
    if not dependency_status:
        raise MergeEvidenceError(f"stage {stage} missing dependency status")
    return {
        "stage": stage,
        "start_time": str(metadata.get("start_time", "")).strip(),
        "end_time": str(metadata.get("end_time", "")).strip(),
        "vu": int(metadata.get("vu", metric(summary, "vus_max", "max", 0))),
        "rps": metric(summary, "http_reqs", "rate"),
        "p50": metric(summary, "http_req_duration", "p(50)"),
        "p95": metric(summary, "http_req_duration", "p(95)"),
        "p99": metric(summary, "http_req_duration", "p(99)"),
        "http_req_failed": metric(summary, "http_req_failed", "rate"),
        "throughput": metric(summary, "data_received", "rate")
        + metric(summary, "data_sent", "rate"),
        "resource_metrics": resource_metrics,
        "dependency_status": dependency_status,
    }


def parse_timestamp(value: str) -> datetime:
    """Parse an ISO-8601 UTC timestamp."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def duration_seconds(start_time: str, end_time: str) -> float:
    """Return duration in seconds for two ISO timestamps."""
    return max(0.0, (parse_timestamp(end_time) - parse_timestamp(start_time)).total_seconds())


def merge_evidence(
    *,
    run_id: str,
    environment: str,
    stage_summaries: dict[str, Path],
    stage_metadata: dict[str, Path],
    prometheus_snapshot_path: Path,
    runtime_cluster_path: Path,
    docker_image_digest: str,
    k8s_manifest_hash: str,
    k6_script_hash: str,
    git_commit: str,
    grafana_snapshot_path: Path | None,
    otel_snapshot_path: Path | None,
) -> dict[str, Any]:
    """Merge all certification inputs into final evidence JSON."""
    prometheus_snapshot = load_json(prometheus_snapshot_path)
    runtime_cluster = load_json(runtime_cluster_path)
    stage_results = []
    for stage in ["smoke", "1k", "10k", "25k", "50k", "100k"]:
        if stage not in stage_summaries:
            raise MergeEvidenceError(f"missing k6 summary for stage {stage}")
        if stage not in stage_metadata:
            raise MergeEvidenceError(f"missing stage metadata for stage {stage}")
        stage_results.append(
            build_stage_result(
                stage,
                load_json(stage_summaries[stage]),
                load_json(stage_metadata[stage]),
                prometheus_snapshot,
            )
        )

    start_time = min(stage["start_time"] for stage in stage_results)
    end_time = max(stage["end_time"] for stage in stage_results)
    target_concurrency = 100000
    achieved_concurrency = max(stage["vu"] for stage in stage_results)
    p50 = max(stage["p50"] for stage in stage_results)
    p95 = max(stage["p95"] for stage in stage_results)
    p99 = max(stage["p99"] for stage in stage_results)
    http_req_failed = max(stage["http_req_failed"] for stage in stage_results)
    metrics = prometheus_snapshot.get("prometheus", {}).get("metrics", {})

    evidence = {
        "run_id": run_id,
        "git_sha": git_commit,
        "k8s_manifest_hash": k8s_manifest_hash,
        "docker_image_digest": docker_image_digest,
        "k6_script_hash": k6_script_hash,
        "environment": environment,
        "start_time": start_time,
        "end_time": end_time,
        "target_concurrency": target_concurrency,
        "achieved_concurrency": achieved_concurrency,
        "duration": duration_seconds(start_time, end_time),
        "checks_passed": True,
        "thresholds": DEFAULT_THRESHOLDS,
        "p50": p50,
        "p95": p95,
        "p99": p99,
        "http_req_failed": http_req_failed,
        "ws_connected": int(metrics.get("realtime.ws_connected", 0)),
        "dropped_connections": int(metrics.get("realtime.dropped_connections", 0)),
        "gateway_restarts": int(metrics.get("gateway.restarts", 0)),
        "db_pool_saturation": float(metrics.get("db.pool_saturation", 1)),
        "object_store_errors": int(metrics.get("object_store.errors", 1)),
        "nats_lag": float(metrics.get("nats.lag", DEFAULT_THRESHOLDS["nats_lag_max"] + 1)),
        "qdrant_consistency": float(metrics.get("qdrant.consistency", 0)) >= 1,
        "stage_results": stage_results,
        "observability": {
            "prometheus_snapshot_present": prometheus_snapshot.get("prometheus_snapshot_present")
            is True,
            "grafana_dashboard_snapshot_present": grafana_snapshot_path is not None
            and grafana_snapshot_path.exists(),
            "otel_trace_snapshot_present": otel_snapshot_path is not None and otel_snapshot_path.exists(),
            "prometheus": prometheus_snapshot.get("prometheus", {}),
        },
        "runtime_cluster": runtime_cluster,
        "verdict": "certified",
    }
    errors = validate_evidence(evidence, required_target_concurrency=target_concurrency)
    if errors:
        evidence["checks_passed"] = False
        evidence["verdict"] = "not_certified"
        evidence["validation_errors"] = errors
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--environment", required=True)
    parser.add_argument("--stage", action="append", default=[])
    parser.add_argument("--stage-meta", action="append", default=[])
    parser.add_argument("--prometheus-snapshot", type=Path, required=True)
    parser.add_argument("--runtime-cluster", type=Path, required=True)
    parser.add_argument("--docker-image-digest", required=True)
    parser.add_argument("--k8s-manifest", type=Path, default=None)
    parser.add_argument("--k8s-manifest-hash", default=None)
    parser.add_argument("--k6-script", type=Path, default=Path("tools/k6/phase8_100k_ramp.js"))
    parser.add_argument("--k6-script-hash", default=None)
    parser.add_argument("--git-sha", default=None)
    parser.add_argument("--grafana-snapshot", type=Path, default=None)
    parser.add_argument("--otel-snapshot", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    if not args.k8s_manifest_hash and not args.k8s_manifest:
        print("merge_error=k8s manifest hash or file is required", file=sys.stderr)
        return 2

    try:
        evidence = merge_evidence(
            run_id=args.run_id,
            environment=args.environment,
            stage_summaries=parse_stage_specs(args.stage),
            stage_metadata=parse_stage_specs(args.stage_meta),
            prometheus_snapshot_path=args.prometheus_snapshot,
            runtime_cluster_path=args.runtime_cluster,
            docker_image_digest=args.docker_image_digest,
            k8s_manifest_hash=args.k8s_manifest_hash
            or sha256_file(args.k8s_manifest),  # type: ignore[arg-type]
            k6_script_hash=args.k6_script_hash or sha256_file(args.k6_script),
            git_commit=args.git_sha or git_sha(),
            grafana_snapshot_path=args.grafana_snapshot,
            otel_snapshot_path=args.otel_snapshot,
        )
    except (OSError, json.JSONDecodeError, MergeEvidenceError) as err:
        print(f"merge_error={err}", file=sys.stderr)
        return 2

    args.out.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if evidence["verdict"] != "certified":
        for error in evidence.get("validation_errors", []):
            print(f"evidence_error={error}", file=sys.stderr)
        return 1
    print(f"verdict=certified evidence={args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
