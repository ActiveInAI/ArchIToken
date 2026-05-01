#!/usr/bin/env python3
"""Validate ArchIToken Phase 8.1 load-certification evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = {
    "run_id": str,
    "git_sha": str,
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

    for field in ["run_id", "git_sha", "environment", "start_time", "end_time"]:
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

    ws_connected = int(evidence["ws_connected"])
    dropped = int(evidence["dropped_connections"])
    if ws_connected <= 0:
        errors.append("ws_connected must be greater than zero for certification")
    else:
        stability = (ws_connected - dropped) / ws_connected
        if stability < thresholds["ws_connection_stability_min"]:
            errors.append("WebSocket/WebTransport connection stability below threshold")

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
