#!/usr/bin/env python3
"""Tests for live Phase 8 runtime cluster validation."""

from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase8_validate_runtime_cluster import (  # noqa: E402
    RuntimeClusterError,
    compact_kubectl_error,
    kubectl_snapshot,
    parse_kubectl_json,
    validate_snapshot,
)


def deployment(name: str, replicas: int = 2, ready: int = 2) -> dict[str, object]:
    return {
        "kind": "Deployment",
        "metadata": {"name": name},
        "spec": {"replicas": replicas},
        "status": {"readyReplicas": ready},
    }


def statefulset(name: str, replicas: int = 3, ready: int = 3) -> dict[str, object]:
    return {
        "kind": "StatefulSet",
        "metadata": {"name": name},
        "spec": {"replicas": replicas},
        "status": {"readyReplicas": ready},
    }


def endpoint(name: str, count: int = 1) -> dict[str, object]:
    return {
        "kind": "Endpoints",
        "metadata": {"name": name},
        "subsets": [{"addresses": [{"ip": f"10.0.0.{index}"} for index in range(count)]}],
    }


def pod(
    name: str,
    ready: bool = True,
    *,
    phase: str | None = None,
    owner_kind: str | None = None,
) -> dict[str, object]:
    metadata: dict[str, object] = {"name": name}
    if owner_kind:
        metadata["ownerReferences"] = [{"kind": owner_kind, "name": f"{name}-owner"}]
    return {
        "kind": "Pod",
        "metadata": metadata,
        "status": {
            "phase": phase or ("Running" if ready else "Pending"),
            "containerStatuses": [{"ready": ready}],
        },
    }


def resource(kind: str, name: str) -> dict[str, object]:
    return {"kind": kind, "metadata": {"name": name}}


def valid_snapshot() -> dict[str, object]:
    items: list[dict[str, object]] = [
        deployment("architoken-gateway"),
        deployment("architoken-realtime-gateway"),
        deployment("pgbouncer"),
        statefulset("nats"),
        statefulset("qdrant"),
        statefulset("valkey", replicas=1, ready=1),
        resource("HorizontalPodAutoscaler", "architoken-gateway"),
        resource("HorizontalPodAutoscaler", "architoken-realtime-gateway"),
        resource("PodDisruptionBudget", "architoken-gateway"),
        resource("PodDisruptionBudget", "architoken-realtime-gateway"),
        pod("gateway-0"),
        pod("realtime-0"),
        pod("nats-0"),
        pod("qdrant-0"),
        pod("valkey-0"),
    ]
    for name in [
        "architoken-gateway",
        "architoken-realtime-gateway",
        "pgbouncer",
        "nats",
        "qdrant",
        "valkey",
    ]:
        items.append(endpoint(name, 1))
    items.append(endpoint("nats-headless", 3))
    items.append(endpoint("qdrant-headless", 3))
    return {"items": items}


class Phase8RuntimeClusterValidationTests(unittest.TestCase):
    def test_kubectl_error_is_compacted(self) -> None:
        error = compact_kubectl_error(
            "\n".join(
                [
                    "old line",
                    "E0601 memcache.go: api unavailable",
                    "Unable to connect to the server: no route to host",
                ]
            )
        )

        self.assertEqual(
            error,
            "old line | E0601 memcache.go: api unavailable | Unable to connect to the server: no route to host",
        )

    def test_kubectl_non_json_output_is_actionable(self) -> None:
        with patch(
            "phase8_validate_runtime_cluster.subprocess.check_output",
            return_value="No resources found in architoken-phase8 namespace.\n",
        ):
            with self.assertRaises(RuntimeClusterError) as context:
                kubectl_snapshot("architoken-phase8")

        self.assertIn("returned non-JSON output", str(context.exception))
        self.assertIn("No resources found", str(context.exception))

    def test_kubectl_json_with_informational_prefix_is_parsed(self) -> None:
        data = parse_kubectl_json(
            "\n".join(
                [
                    "No resources found in architoken-phase8 namespace.",
                    '{"kind":"List","items":[]}',
                ]
            )
        )

        self.assertEqual(data, {"kind": "List", "items": []})

    def test_valid_runtime_cluster_snapshot_passes(self) -> None:
        result = validate_snapshot(valid_snapshot(), namespace="architoken-phase8")

        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"], [])

    def test_missing_service_endpoint_fails(self) -> None:
        snapshot = copy.deepcopy(valid_snapshot())
        snapshot["items"] = [
            item
            for item in snapshot["items"]
            if not (item.get("kind") == "Endpoints" and item["metadata"]["name"] == "pgbouncer")
        ]

        result = validate_snapshot(snapshot, namespace="architoken-phase8")

        self.assertFalse(result["valid"])
        self.assertIn("missing Endpoints/pgbouncer", result["errors"])

    def test_non_clustered_nats_runtime_fails(self) -> None:
        snapshot = copy.deepcopy(valid_snapshot())
        for item in snapshot["items"]:
            if item.get("kind") == "Endpoints" and item["metadata"]["name"] == "nats-headless":
                item["subsets"] = [{"addresses": [{"ip": "10.0.0.1"}]}]

        result = validate_snapshot(snapshot, namespace="architoken-phase8")

        self.assertFalse(result["valid"])
        self.assertIn("NATS cluster endpoint count is below StatefulSet replicas", result["errors"])

    def test_completed_job_pod_is_ignored(self) -> None:
        snapshot = copy.deepcopy(valid_snapshot())
        snapshot["items"].append(
            pod("phase8-migration-complete", ready=False, phase="Succeeded", owner_kind="Job")
        )

        result = validate_snapshot(snapshot, namespace="architoken-phase8")

        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"], [])

    def test_not_ready_gateway_pod_fails(self) -> None:
        snapshot = copy.deepcopy(valid_snapshot())
        snapshot["items"].append(pod("architoken-gateway-bad", ready=False))

        result = validate_snapshot(snapshot, namespace="architoken-phase8")

        self.assertFalse(result["valid"])
        self.assertIn("Pod/architoken-gateway-bad is not ready", result["errors"])

    def test_not_ready_nats_and_qdrant_pods_fail(self) -> None:
        snapshot = copy.deepcopy(valid_snapshot())
        snapshot["items"].append(pod("nats-bad", ready=False))
        snapshot["items"].append(pod("qdrant-bad", ready=False))

        result = validate_snapshot(snapshot, namespace="architoken-phase8")

        self.assertFalse(result["valid"])
        self.assertIn("Pod/nats-bad is not ready", result["errors"])
        self.assertIn("Pod/qdrant-bad is not ready", result["errors"])


if __name__ == "__main__":
    unittest.main()
