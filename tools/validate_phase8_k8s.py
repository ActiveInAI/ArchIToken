#!/usr/bin/env python3
"""Validate Phase 8 Kubernetes production-readiness invariants."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml


class K8sValidationError(ValueError):
    """Raised when Phase 8 Kubernetes manifests fail validation."""


def load_documents(path: Path) -> list[dict[str, Any]]:
    """Load all Kubernetes YAML documents below a directory or from a file."""
    files = sorted(path.glob("*.yaml")) if path.is_dir() else [path]
    documents: list[dict[str, Any]] = []
    for file_path in files:
        for document in yaml.safe_load_all(file_path.read_text(encoding="utf-8")):
            if isinstance(document, dict):
                document["_source"] = str(file_path)
                documents.append(document)
    return documents


def validate_documents(documents: list[dict[str, Any]]) -> list[str]:
    """Return validation errors for Phase 8 Kubernetes manifests."""
    errors: list[str] = []
    by_kind_name = {
        (doc.get("kind"), doc.get("metadata", {}).get("name")): doc for doc in documents
    }
    workloads = [
        doc
        for doc in documents
        if doc.get("kind") in {"Deployment", "StatefulSet"}
    ]
    services = [doc for doc in documents if doc.get("kind") == "Service"]

    for workload in workloads:
        validate_workload(workload, errors)
    for service in services:
        validate_service(service, workloads, errors)

    require_resource(by_kind_name, ("HorizontalPodAutoscaler", "architoken-gateway"), errors)
    require_resource(by_kind_name, ("PodDisruptionBudget", "architoken-gateway"), errors)
    require_resource(by_kind_name, ("HorizontalPodAutoscaler", "architoken-realtime-gateway"), errors)
    require_resource(by_kind_name, ("PodDisruptionBudget", "architoken-realtime-gateway"), errors)

    gateway = by_kind_name.get(("Deployment", "architoken-gateway"))
    if gateway:
        validate_gateway_env(gateway, errors)
    realtime = by_kind_name.get(("Deployment", "architoken-realtime-gateway"))
    if realtime:
        validate_realtime_env(realtime, errors)

    nats = by_kind_name.get(("StatefulSet", "nats"))
    if nats:
        validate_nats_cluster(nats, by_kind_name, errors)
    qdrant = by_kind_name.get(("StatefulSet", "qdrant"))
    if qdrant:
        validate_qdrant_cluster(qdrant, by_kind_name, errors)

    return errors


def validate_workload(workload: dict[str, Any], errors: list[str]) -> None:
    """Validate probes and resources for a workload."""
    name = workload["metadata"]["name"]
    containers = workload.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    if not containers:
        errors.append(f"{name}: workload has no containers")
        return
    for container in containers:
        cname = container.get("name", "unknown")
        if "readinessProbe" not in container:
            errors.append(f"{name}/{cname}: missing readinessProbe")
        if "livenessProbe" not in container:
            errors.append(f"{name}/{cname}: missing livenessProbe")
        resources = container.get("resources", {})
        if not resources.get("requests") or not resources.get("limits"):
            errors.append(f"{name}/{cname}: missing resource requests/limits")


def validate_service(
    service: dict[str, Any],
    workloads: list[dict[str, Any]],
    errors: list[str],
) -> None:
    """Validate service selector and targetPort match a workload."""
    name = service["metadata"]["name"]
    selector = service.get("spec", {}).get("selector", {})
    if not selector:
        errors.append(f"service/{name}: missing selector")
        return
    matched = [workload for workload in workloads if selector_matches(workload, selector)]
    if not matched:
        errors.append(f"service/{name}: selector matches no workload")
        return
    workload_ports = {port.get("name") for workload in matched for port in container_ports(workload)}
    for port in service.get("spec", {}).get("ports", []):
        target = port.get("targetPort")
        if isinstance(target, str) and target not in workload_ports:
            errors.append(f"service/{name}: targetPort {target} not present on selected workload")


def selector_matches(workload: dict[str, Any], selector: dict[str, str]) -> bool:
    labels = workload.get("spec", {}).get("template", {}).get("metadata", {}).get("labels", {})
    return all(labels.get(key) == value for key, value in selector.items())


def container_ports(workload: dict[str, Any]) -> list[dict[str, Any]]:
    containers = workload.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    ports: list[dict[str, Any]] = []
    for container in containers:
        ports.extend(container.get("ports", []))
    return ports


def require_resource(
    by_kind_name: dict[tuple[Any, Any], dict[str, Any]],
    key: tuple[str, str],
    errors: list[str],
) -> None:
    if key not in by_kind_name:
        errors.append(f"missing {key[0]}/{key[1]}")


def validate_gateway_env(workload: dict[str, Any], errors: list[str]) -> None:
    required = {
        "INSOMEOS_PROFILE",
        "INSOMEOS_PHASE8_MAX_REQUEST_BODY_BYTES",
        "INSOMEOS_PHASE8_MAX_UPLOAD_BYTES",
        "INSOMEOS_PHASE8_API_RPS_LIMIT",
        "INSOMEOS_PHASE8_TENANT_RPS_LIMIT",
        "INSOMEOS_PHASE8_ACTOR_RPS_LIMIT",
        "INSOMEOS_PHASE8_MAX_CONCURRENT_UPLOADS_PER_TENANT",
        "INSOMEOS_PHASE8_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT",
        "INSOMEOS_PHASE8_DB_POOL_MAX_CONNECTIONS",
        "INSOMEOS_PHASE8_PGBOUNCER_REQUIRED",
        "INSOMEOS_PHASE8_OBJECT_STORE_REQUIRED",
        "INSOMEOS_PHASE8_OTEL_REQUIRED",
        "DATABASE_URL",
        "S3_ENDPOINT",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
        "S3_BUCKET",
        "NATS_URL",
        "VALKEY_URL",
        "TEMPORAL_ADDRESS",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
    }
    env = workload_env(workload)
    missing = sorted(required - set(env))
    if missing:
        errors.append(f"architoken-gateway: missing production envs {', '.join(missing)}")
    if env.get("INSOMEOS_PROFILE", {}).get("value") != "production":
        errors.append("architoken-gateway: INSOMEOS_PROFILE must be production")


def validate_realtime_env(workload: dict[str, Any], errors: list[str]) -> None:
    required = {"INSOMEOS_PROFILE", "NATS_URL", "VALKEY_URL", "OTEL_EXPORTER_OTLP_ENDPOINT"}
    env = workload_env(workload)
    missing = sorted(required - set(env))
    if missing:
        errors.append(f"architoken-realtime-gateway: missing envs {', '.join(missing)}")
    if env.get("INSOMEOS_PROFILE", {}).get("value") != "production":
        errors.append("architoken-realtime-gateway: INSOMEOS_PROFILE must be production")


def workload_env(workload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    containers = workload.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    env: dict[str, dict[str, Any]] = {}
    for item in containers[0].get("env", []) if containers else []:
        if "name" in item:
            env[item["name"]] = item
    return env


def validate_nats_cluster(
    workload: dict[str, Any],
    by_kind_name: dict[tuple[Any, Any], dict[str, Any]],
    errors: list[str],
) -> None:
    replicas = int(workload.get("spec", {}).get("replicas", 1))
    args = workload_container(workload).get("args", [])
    ports = {port.get("containerPort") for port in container_ports(workload)}
    if replicas > 1:
        if workload.get("spec", {}).get("serviceName") != "nats-headless":
            errors.append("nats: multi-replica StatefulSet must use nats-headless serviceName")
        if ("Service", "nats-headless") not in by_kind_name:
            errors.append("nats: missing nats-headless Service")
        if "--cluster_name" not in args or "--routes" not in args:
            errors.append("nats: multi-replica StatefulSet missing cluster routes")
        if 6222 not in ports:
            errors.append("nats: multi-replica StatefulSet missing cluster port 6222")


def validate_qdrant_cluster(
    workload: dict[str, Any],
    by_kind_name: dict[tuple[Any, Any], dict[str, Any]],
    errors: list[str],
) -> None:
    replicas = int(workload.get("spec", {}).get("replicas", 1))
    container = workload_container(workload)
    env = {item.get("name"): item.get("value") for item in container.get("env", [])}
    ports = {port.get("containerPort") for port in container_ports(workload)}
    command_text = "\n".join(str(item) for item in container.get("command", []))
    if replicas > 1:
        if workload.get("spec", {}).get("serviceName") != "qdrant-headless":
            errors.append("qdrant: multi-replica StatefulSet must use qdrant-headless serviceName")
        if ("Service", "qdrant-headless") not in by_kind_name:
            errors.append("qdrant: missing qdrant-headless Service")
        if env.get("QDRANT__CLUSTER__ENABLED") != "true":
            errors.append("qdrant: cluster mode must be enabled")
        if 6335 not in ports:
            errors.append("qdrant: missing p2p port 6335")
        if "--bootstrap" not in command_text:
            errors.append("qdrant: missing bootstrap command for non-zero replicas")


def workload_container(workload: dict[str, Any]) -> dict[str, Any]:
    containers = workload.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    return containers[0] if containers else {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", type=Path, default=Path("infra/k8s/phase8"))
    args = parser.parse_args()

    documents = load_documents(args.path)
    errors = validate_documents(documents)
    if errors:
        for error in errors:
            print(f"k8s_error={error}", file=sys.stderr)
        return 1
    print(f"phase8 k8s validation passed documents={len(documents)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
