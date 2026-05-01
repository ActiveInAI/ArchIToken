#!/usr/bin/env python3
"""Validate live Phase 8 Kubernetes runtime state through kubectl."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_DEPLOYMENTS = ("architoken-gateway", "architoken-realtime-gateway", "pgbouncer")
REQUIRED_STATEFULSETS = ("nats", "qdrant", "valkey")
REQUIRED_HPAS = ("architoken-gateway", "architoken-realtime-gateway")
REQUIRED_PDBS = ("architoken-gateway", "architoken-realtime-gateway")
REQUIRED_ENDPOINTS = (
    "architoken-gateway",
    "architoken-realtime-gateway",
    "pgbouncer",
    "nats",
    "nats-headless",
    "qdrant",
    "qdrant-headless",
    "valkey",
)
CERTIFICATION_WORKLOAD_NAMES = {
    "architoken-gateway",
    "architoken-realtime-gateway",
    "pgbouncer",
    "nats",
    "qdrant",
    "valkey",
}
CERTIFICATION_WORKLOAD_PREFIXES = (
    "architoken-gateway",
    "architoken-realtime-gateway",
    "pgbouncer",
    "nats",
    "qdrant",
    "valkey",
    "phase8-worker",
    "architoken-worker",
)


class RuntimeClusterError(RuntimeError):
    """Raised when live cluster state cannot be collected."""


def utc_now() -> str:
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def kubectl_snapshot(namespace: str) -> dict[str, Any]:
    """Collect live cluster resources through kubectl."""
    command = [
        "kubectl",
        "get",
        "pods,hpa,pdb,svc,endpoints,statefulset,deployment",
        "-n",
        namespace,
        "-o",
        "json",
    ]
    try:
        output = subprocess.check_output(command, text=True, stderr=subprocess.STDOUT)
    except (OSError, subprocess.CalledProcessError) as err:
        raise RuntimeClusterError(f"kubectl live state query failed: {err}") from err
    data = json.loads(output)
    if not isinstance(data, dict):
        raise RuntimeClusterError("kubectl returned non-object JSON")
    return data


def items_by_kind_name(snapshot: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    """Index Kubernetes list items by kind/name."""
    indexed: dict[tuple[str, str], dict[str, Any]] = {}
    for item in snapshot.get("items", []):
        kind = item.get("kind")
        name = item.get("metadata", {}).get("name")
        if kind and name:
            indexed[(kind, name)] = item
    return indexed


def validate_snapshot(snapshot: dict[str, Any], *, namespace: str) -> dict[str, Any]:
    """Validate the live cluster snapshot and return evidence-compatible status."""
    errors: list[str] = []
    indexed = items_by_kind_name(snapshot)

    for name in REQUIRED_DEPLOYMENTS:
        deployment = indexed.get(("Deployment", name))
        if not deployment:
            errors.append(f"missing Deployment/{name}")
            continue
        replicas = int(deployment.get("spec", {}).get("replicas", 1))
        ready = int(deployment.get("status", {}).get("readyReplicas", 0))
        if ready < replicas:
            errors.append(f"Deployment/{name} readyReplicas {ready} below replicas {replicas}")

    for name in REQUIRED_STATEFULSETS:
        statefulset = indexed.get(("StatefulSet", name))
        if not statefulset:
            errors.append(f"missing StatefulSet/{name}")
            continue
        replicas = int(statefulset.get("spec", {}).get("replicas", 1))
        ready = int(statefulset.get("status", {}).get("readyReplicas", 0))
        if ready < replicas:
            errors.append(f"StatefulSet/{name} readyReplicas {ready} below replicas {replicas}")

    for name in REQUIRED_HPAS:
        if ("HorizontalPodAutoscaler", name) not in indexed:
            errors.append(f"missing HorizontalPodAutoscaler/{name}")

    for name in REQUIRED_PDBS:
        if ("PodDisruptionBudget", name) not in indexed:
            errors.append(f"missing PodDisruptionBudget/{name}")

    for name in REQUIRED_ENDPOINTS:
        endpoint = indexed.get(("Endpoints", name))
        if not endpoint:
            errors.append(f"missing Endpoints/{name}")
            continue
        if endpoint_address_count(endpoint) <= 0:
            errors.append(f"Endpoints/{name} has no ready addresses")

    nats = indexed.get(("StatefulSet", "nats"))
    if nats:
        replicas = int(nats.get("spec", {}).get("replicas", 1))
        nats_addresses = endpoint_address_count(indexed.get(("Endpoints", "nats-headless"), {}))
        if replicas > 1 and nats_addresses < replicas:
            errors.append("NATS cluster endpoint count is below StatefulSet replicas")

    qdrant = indexed.get(("StatefulSet", "qdrant"))
    if qdrant:
        replicas = int(qdrant.get("spec", {}).get("replicas", 1))
        qdrant_addresses = endpoint_address_count(indexed.get(("Endpoints", "qdrant-headless"), {}))
        if replicas > 1 and qdrant_addresses < replicas:
            errors.append("Qdrant cluster endpoint count is below StatefulSet replicas")

    pods = [item for item in snapshot.get("items", []) if item.get("kind") == "Pod"]
    certification_pods = [pod for pod in pods if pod_in_certification_scope(pod)]
    for pod in certification_pods:
        if not pod_ready(pod):
            errors.append(f"Pod/{pod.get('metadata', {}).get('name', 'unknown')} is not ready")

    return {
        "valid": not errors,
        "errors": errors,
        "namespace": namespace,
        "checked_at": utc_now(),
        "summary": {
            "pods": len(pods),
            "certification_pods": len(certification_pods),
            "deployments": len([item for item in snapshot.get("items", []) if item.get("kind") == "Deployment"]),
            "statefulsets": len([item for item in snapshot.get("items", []) if item.get("kind") == "StatefulSet"]),
        },
    }


def endpoint_address_count(endpoint: dict[str, Any]) -> int:
    """Count ready endpoint addresses."""
    count = 0
    for subset in endpoint.get("subsets", []) or []:
        count += len(subset.get("addresses", []) or [])
    return count


def pod_ready(pod: dict[str, Any]) -> bool:
    """Return whether a pod is running and all containers are ready."""
    if pod.get("status", {}).get("phase") != "Running":
        return False
    statuses = pod.get("status", {}).get("containerStatuses", []) or []
    return bool(statuses) and all(status.get("ready") is True for status in statuses)


def pod_in_certification_scope(pod: dict[str, Any]) -> bool:
    """Return whether pod readiness is relevant to Phase 8 certification."""
    if pod.get("status", {}).get("phase") == "Succeeded" and pod_owned_by_job(pod):
        return False
    metadata = pod.get("metadata", {})
    pod_name = metadata.get("name", "")
    labels = metadata.get("labels", {}) or {}
    label_values = {
        str(labels.get(key, ""))
        for key in (
            "app",
            "app.kubernetes.io/name",
            "app.kubernetes.io/component",
            "component",
            "workload",
        )
    }
    candidates = {pod_name, *label_values}
    if candidates & CERTIFICATION_WORKLOAD_NAMES:
        return True
    return any(
        candidate.startswith(prefix)
        for candidate in candidates
        for prefix in CERTIFICATION_WORKLOAD_PREFIXES
    )


def pod_owned_by_job(pod: dict[str, Any]) -> bool:
    """Return whether the pod is owned by a Job/CronJob chain."""
    owners = pod.get("metadata", {}).get("ownerReferences", []) or []
    return any(owner.get("kind") in {"Job", "CronJob"} for owner in owners)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--namespace", default="architoken-phase8")
    parser.add_argument("--snapshot", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    try:
        snapshot = (
            json.loads(args.snapshot.read_text(encoding="utf-8"))
            if args.snapshot
            else kubectl_snapshot(args.namespace)
        )
        result = validate_snapshot(snapshot, namespace=args.namespace)
    except (OSError, json.JSONDecodeError, RuntimeClusterError) as err:
        print(f"runtime_cluster_error={err}", file=sys.stderr)
        return 2

    output = json.dumps(result, indent=2, sort_keys=True)
    if args.out:
        args.out.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)
    if not result["valid"]:
        for error in result["errors"]:
            print(f"runtime_cluster_error={error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
