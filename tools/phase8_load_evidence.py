#!/usr/bin/env python3
"""Validate ArchIToken Phase 8.2 load-certification evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = {
    "run_id": str,
    "git_sha": str,
    "k8s_manifest_hash": str,
    "docker_image_digest": str,
    "k6_script_hash": str,
    "environment": str,
    "start_time": str,
    "end_time": str,
    "target_concurrency": int,
    "achieved_concurrency": int,
    "duration": (int, float),
    "checks_passed": bool,
    "thresholds": dict,
    "p50": (int, float),
    "p95": (int, float),
    "p99": (int, float),
    "http_req_failed": (int, float),
    "ws_connected": int,
    "dropped_connections": int,
    "gateway_restarts": int,
    "db_pool_saturation": (int, float),
    "object_store_errors": int,
    "nats_lag": (int, float),
    "qdrant_consistency": bool,
    "stage_results": list,
    "observability": dict,
    "runtime_cluster": dict,
    "verdict": str,
}

THRESHOLD_FIELDS = {
    "api_p95_ms": (int, float),
    "api_p99_ms": (int, float),
    "http_req_failed_max": (int, float),
    "ws_connection_stability_min": (int, float),
    "dropped_connections_max": int,
    "gateway_restarts_max": int,
    "db_pool_saturation_max": (int, float),
    "object_store_errors_max": int,
    "nats_lag_max": (int, float),
}

ALLOWED_VERDICTS = {"certified", "not_certified", "blocked"}
REQUIRED_STAGES = ("smoke", "1k", "10k", "25k", "50k", "100k")
STAGE_TARGET_VUS = {
    "smoke": 20,
    "1k": 1_000,
    "10k": 10_000,
    "25k": 25_000,
    "50k": 50_000,
    "100k": 100_000,
}
STAGE_FIELDS = {
    "stage": str,
    "start_time": str,
    "end_time": str,
    "vu": int,
    "rps": (int, float),
    "p50": (int, float),
    "p95": (int, float),
    "p99": (int, float),
    "http_req_failed": (int, float),
    "throughput": (int, float),
    "resource_metrics": dict,
    "dependency_status": dict,
}
OBSERVABILITY_FLAGS = (
    "prometheus_snapshot_present",
    "grafana_dashboard_snapshot_present",
    "otel_trace_snapshot_present",
)


class EvidenceError(ValueError):
    """Raised when evidence fails schema or gate validation."""


def load_evidence(path: Path) -> dict[str, Any]:
    """Load evidence JSON from disk."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as err:
        raise EvidenceError(f"cannot read evidence file: {err}") from err
    except json.JSONDecodeError as err:
        raise EvidenceError(f"invalid evidence JSON: {err}") from err
    if not isinstance(data, dict):
        raise EvidenceError("evidence root must be a JSON object")
    return data


def validate_evidence(
    evidence: dict[str, Any],
    *,
    required_target_concurrency: int | None = None,
    required_git_sha: str | None = None,
) -> list[str]:
    """Return a list of validation errors. An empty list means certified."""
    errors: list[str] = []
    for field, expected_type in REQUIRED_FIELDS.items():
        if field not in evidence:
            errors.append(f"missing required field: {field}")
            continue
        if not isinstance(evidence[field], expected_type):
            errors.append(f"field {field} has invalid type")
    if errors:
        return errors

    thresholds = evidence["thresholds"]
    for field, expected_type in THRESHOLD_FIELDS.items():
        if field not in thresholds:
            errors.append(f"missing threshold field: {field}")
            continue
        if not isinstance(thresholds[field], expected_type):
            errors.append(f"threshold {field} has invalid type")

    for field in [
        "run_id",
        "git_sha",
        "k8s_manifest_hash",
        "docker_image_digest",
        "k6_script_hash",
        "environment",
        "start_time",
        "end_time",
    ]:
        if not str(evidence[field]).strip():
            errors.append(f"field {field} must be non-empty")

    verdict = evidence["verdict"]
    if verdict not in ALLOWED_VERDICTS:
        errors.append(f"verdict must be one of {sorted(ALLOWED_VERDICTS)}")

    target = int(evidence["target_concurrency"])
    achieved = int(evidence["achieved_concurrency"])
    if required_target_concurrency is not None and target != required_target_concurrency:
        errors.append(
            f"target_concurrency {target} does not match required {required_target_concurrency}"
        )
    if required_git_sha and evidence["git_sha"] != required_git_sha:
        errors.append("git_sha does not match required build sha")
    if achieved < target:
        errors.append(f"achieved_concurrency {achieved} is below target {target}")
    if evidence["duration"] <= 0:
        errors.append("duration must be greater than zero")
    if not evidence["checks_passed"]:
        errors.append("checks_passed must be true")
    if verdict != "certified":
        errors.append(f"verdict is {verdict}, expected certified")

    if evidence["p95"] > thresholds["api_p95_ms"]:
        errors.append("p95 exceeds api_p95_ms threshold")
    if evidence["p99"] > thresholds["api_p99_ms"]:
        errors.append("p99 exceeds api_p99_ms threshold")
    if evidence["http_req_failed"] > thresholds["http_req_failed_max"]:
        errors.append("http_req_failed exceeds threshold")
    if evidence["gateway_restarts"] > thresholds["gateway_restarts_max"]:
        errors.append("gateway_restarts exceeds threshold")
    if evidence["db_pool_saturation"] > thresholds["db_pool_saturation_max"]:
        errors.append("db_pool_saturation exceeds threshold")
    if evidence["object_store_errors"] > thresholds["object_store_errors_max"]:
        errors.append("object_store_errors exceeds threshold")
    if evidence["nats_lag"] > thresholds["nats_lag_max"]:
        errors.append("nats_lag exceeds threshold")
    if evidence["dropped_connections"] > thresholds["dropped_connections_max"]:
        errors.append("dropped_connections exceeds threshold")
    if not evidence["qdrant_consistency"]:
        errors.append("qdrant_consistency must be true")

    errors.extend(validate_stage_results(evidence["stage_results"], thresholds))
    errors.extend(validate_observability(evidence["observability"]))
    errors.extend(validate_runtime_cluster(evidence["runtime_cluster"]))

    ws_connected = int(evidence["ws_connected"])
    dropped = int(evidence["dropped_connections"])
    if ws_connected <= 0:
        errors.append("ws_connected must be greater than zero for certification")
    else:
        stability = (ws_connected - dropped) / ws_connected
        if stability < thresholds["ws_connection_stability_min"]:
            errors.append("WebSocket/WebTransport connection stability below threshold")

    return errors


def validate_stage_results(
    stage_results: list[Any],
    thresholds: dict[str, Any],
) -> list[str]:
    """Validate per-stage load evidence for smoke/1k/10k/25k/50k/100k."""
    errors: list[str] = []
    by_stage: dict[str, dict[str, Any]] = {}
    for index, stage in enumerate(stage_results):
        stage_errors: list[str] = []
        if not isinstance(stage, dict):
            errors.append(f"stage_results[{index}] must be an object")
            continue
        for field, expected_type in STAGE_FIELDS.items():
            if field not in stage:
                stage_errors.append(f"stage {stage.get('stage', index)} missing field: {field}")
                continue
            if not isinstance(stage[field], expected_type):
                stage_errors.append(
                    f"stage {stage.get('stage', index)} field {field} has invalid type"
                )
        if stage_errors:
            errors.extend(stage_errors)
            continue
        name = stage["stage"].strip()
        by_stage[name] = stage
        for field in ["start_time", "end_time"]:
            if not stage[field].strip():
                errors.append(f"stage {name} field {field} must be non-empty")
        if stage["vu"] <= 0:
            errors.append(f"stage {name} vu must be greater than zero")
        required_vu = STAGE_TARGET_VUS.get(name)
        if required_vu is None:
            errors.append(f"stage {name} is not a required certification stage")
        elif stage["vu"] < required_vu:
            errors.append(
                f"stage {name} observed vu {stage['vu']} is below required target {required_vu}"
            )
        if stage["rps"] < 0:
            errors.append(f"stage {name} rps must be non-negative")
        if stage["throughput"] < 0:
            errors.append(f"stage {name} throughput must be non-negative")
        if stage["p95"] > thresholds["api_p95_ms"]:
            errors.append(f"stage {name} p95 exceeds api_p95_ms threshold")
        if stage["p99"] > thresholds["api_p99_ms"]:
            errors.append(f"stage {name} p99 exceeds api_p99_ms threshold")
        if stage["http_req_failed"] > thresholds["http_req_failed_max"]:
            errors.append(f"stage {name} http_req_failed exceeds threshold")
        if not stage["resource_metrics"]:
            errors.append(f"stage {name} resource_metrics must be non-empty")
        if not stage["dependency_status"]:
            errors.append(f"stage {name} dependency_status must be non-empty")

    missing = [stage for stage in REQUIRED_STAGES if stage not in by_stage]
    if missing:
        errors.append(f"missing required stage_results: {', '.join(missing)}")
    return errors


def validate_observability(observability: dict[str, Any]) -> list[str]:
    """Validate Prometheus/Grafana/OTel evidence presence."""
    errors: list[str] = []
    for flag in OBSERVABILITY_FLAGS:
        if observability.get(flag) is not True:
            errors.append(f"observability {flag} must be true")
    prometheus = observability.get("prometheus")
    if not isinstance(prometheus, dict) or not prometheus:
        errors.append("observability prometheus snapshot must be present")
    return errors


def validate_runtime_cluster(runtime_cluster: dict[str, Any]) -> list[str]:
    """Validate merged live-cluster evidence status."""
    errors: list[str] = []
    if runtime_cluster.get("valid") is not True:
        errors.append("runtime_cluster valid must be true")
    if runtime_cluster.get("errors"):
        errors.append("runtime_cluster errors must be empty")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--target-concurrency", type=int, default=None)
    parser.add_argument("--git-sha", default=None)
    args = parser.parse_args()

    try:
        evidence = load_evidence(args.evidence)
        errors = validate_evidence(
            evidence,
            required_target_concurrency=args.target_concurrency,
            required_git_sha=args.git_sha,
        )
    except EvidenceError as err:
        print(f"verdict=blocked reason={err}", file=sys.stderr)
        return 2

    if errors:
        for error in errors:
            print(f"evidence_error={error}", file=sys.stderr)
        print("verdict=not_certified", file=sys.stderr)
        return 1

    print(
        "verdict=certified "
        f"run_id={evidence['run_id']} "
        f"target_concurrency={evidence['target_concurrency']} "
        f"achieved_concurrency={evidence['achieved_concurrency']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
