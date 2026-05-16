#!/usr/bin/env python3
"""Tests for Phase 8 Kubernetes manifest validation."""

from __future__ import annotations

import copy
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from validate_phase8_k8s import load_documents, validate_documents


class Phase8K8sValidatorTests(unittest.TestCase):
    def test_current_phase8_manifests_pass(self) -> None:
        documents = load_documents(Path("05-infra/phase8/k8s"))

        errors = validate_documents(documents)

        self.assertEqual(errors, [])

    def test_catches_non_clustered_nats_statefulset(self) -> None:
        documents = load_documents(Path("05-infra/phase8/k8s"))
        mutated = copy.deepcopy(documents)
        for document in mutated:
            if document.get("kind") == "StatefulSet" and document["metadata"]["name"] == "nats":
                document["spec"]["serviceName"] = "nats"
                container = document["spec"]["template"]["spec"]["containers"][0]
                container["args"] = ["-js", "-sd", "/data"]

        errors = validate_documents(mutated)

        self.assertTrue(any("nats" in error and "cluster" in error for error in errors))

    def test_catches_non_clustered_qdrant_statefulset(self) -> None:
        documents = load_documents(Path("05-infra/phase8/k8s"))
        mutated = copy.deepcopy(documents)
        for document in mutated:
            if document.get("kind") == "StatefulSet" and document["metadata"]["name"] == "qdrant":
                document["spec"]["serviceName"] = "qdrant"
                container = document["spec"]["template"]["spec"]["containers"][0]
                container["env"] = [
                    item
                    for item in container["env"]
                    if item.get("name") != "QDRANT__CLUSTER__ENABLED"
                ]
                container["command"] = ["./qdrant"]

        errors = validate_documents(mutated)

        self.assertTrue(any("qdrant" in error and "cluster" in error for error in errors))

    def test_catches_missing_gateway_hpa(self) -> None:
        documents = [
            document
            for document in load_documents(Path("05-infra/phase8/k8s"))
            if not (
                document.get("kind") == "HorizontalPodAutoscaler"
                and document["metadata"]["name"] == "architoken-gateway"
            )
        ]

        errors = validate_documents(documents)

        self.assertIn("missing HorizontalPodAutoscaler/architoken-gateway", errors)

    def test_catches_missing_workload_probe(self) -> None:
        documents = load_documents(Path("05-infra/phase8/k8s"))
        mutated = copy.deepcopy(documents)
        for document in mutated:
            if document.get("kind") == "Deployment" and document["metadata"]["name"] == "architoken-gateway":
                container = document["spec"]["template"]["spec"]["containers"][0]
                container.pop("readinessProbe", None)

        errors = validate_documents(mutated)

        self.assertIn("architoken-gateway/gateway: missing readinessProbe", errors)


if __name__ == "__main__":
    unittest.main()
