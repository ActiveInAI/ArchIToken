#!/usr/bin/env python3
"""Tests for Phase 8.2 load evidence merger."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase8_merge_load_evidence import MergeEvidenceError, merge_evidence  # noqa: E402


STAGE_TARGETS = {
    "smoke": 20,
    "1k": 1_000,
    "10k": 10_000,
    "25k": 25_000,
    "50k": 50_000,
    "100k": 100_000,
}


def k6_summary(
    p50: float = 50,
    p95: float = 120,
    p99: float = 300,
    *,
    vus_max: int | None = 1_000,
    vus_max_value: int | None = None,
    vus_fallback: int | None = None,
) -> dict[str, object]:
    metrics: dict[str, object] = {
        "http_req_duration": {"values": {"p(50)": p50, "p(95)": p95, "p(99)": p99}},
        "http_req_failed": {"values": {"rate": 0.0001}},
        "http_reqs": {"values": {"rate": 1000}},
        "data_received": {"values": {"rate": 100000}},
        "data_sent": {"values": {"rate": 20000}},
    }
    if vus_max is not None:
        metrics["vus_max"] = {"values": {"max": vus_max}}
    elif vus_max_value is not None:
        metrics["vus_max"] = {"values": {"value": vus_max_value}}
    if vus_fallback is not None:
        metrics["vus"] = {"values": {"max": vus_fallback}}
    return {
        "metrics": metrics
    }


def prometheus_snapshot(**metric_overrides: float) -> dict[str, object]:
    metrics = {
        "realtime.ws_connected": 100000,
        "realtime.dropped_connections": 0,
        "gateway.restarts": 0,
        "db.pool_saturation": 0.4,
        "object_store.errors": 0,
        "nats.lag": 20,
        "qdrant.consistency": 1,
    }
    metrics.update(metric_overrides)
    return {
        "prometheus_snapshot_present": True,
        "prometheus": {
            "queried_at": "2026-05-01T00:00:00Z",
            "metrics": metrics,
        },
        "resource_metrics": {"gateway_cpu": 0.2, "db_pool_saturation": 0.4},
        "dependency_status": {"gateway": "ready", "postgres": "ready", "nats": "ready"},
    }


def write_complete_inputs(
    root: Path,
    *,
    summary_overrides: dict[str, dict[str, object]] | None = None,
    prometheus: dict[str, object] | None = None,
) -> tuple[dict[str, Path], dict[str, Path], Path, Path, Path, Path]:
    stages = {}
    metas = {}
    for index, stage in enumerate(["smoke", "1k", "10k", "25k", "50k", "100k"]):
        summary_path = root / f"{stage}.json"
        summary = summary_overrides.get(stage) if summary_overrides else None
        summary_path.write_text(
            json.dumps(summary or k6_summary(vus_max=STAGE_TARGETS[stage])),
            encoding="utf-8",
        )
        meta_path = root / f"{stage}.meta.json"
        meta_path.write_text(
            json.dumps(
                {
                    "start_time": f"2026-05-01T00:{index:02d}:00Z",
                    "end_time": f"2026-05-01T00:{index + 1:02d}:00Z",
                    "target_vus": STAGE_TARGETS[stage],
                }
            ),
            encoding="utf-8",
        )
        stages[stage] = summary_path
        metas[stage] = meta_path
    prom = root / "prom.json"
    prom.write_text(json.dumps(prometheus or prometheus_snapshot()), encoding="utf-8")
    cluster = root / "cluster.json"
    cluster.write_text(json.dumps({"valid": True, "errors": []}), encoding="utf-8")
    grafana = root / "grafana.json"
    grafana.write_text("{}", encoding="utf-8")
    otel = root / "otel.json"
    otel.write_text("{}", encoding="utf-8")
    return stages, metas, prom, cluster, grafana, otel


class Phase8MergeLoadEvidenceTests(unittest.TestCase):
    def test_merge_produces_certified_evidence_when_inputs_are_complete(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(root)

            evidence = merge_evidence(
                run_id="run-1",
                environment="staging",
                stage_summaries=stages,
                stage_metadata=metas,
                prometheus_snapshot_path=prom,
                runtime_cluster_path=cluster,
                docker_image_digest="sha256:" + "a" * 64,
                k8s_manifest_hash="sha256:" + "b" * 64,
                k6_script_hash="sha256:" + "c" * 64,
                git_commit="bada262",
                grafana_snapshot_path=grafana,
                otel_snapshot_path=otel,
            )

            self.assertEqual(evidence["verdict"], "certified")
            self.assertEqual(evidence["achieved_concurrency"], 100000)
            self.assertEqual(evidence["stage_results"][-1]["vu"], 100000)
            self.assertEqual(len(evidence["stage_results"]), 6)

    def test_missing_grafana_and_otel_blocks_certification(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stages, metas, prom, cluster, _, _ = write_complete_inputs(root)

            evidence = merge_evidence(
                run_id="run-1",
                environment="staging",
                stage_summaries=stages,
                stage_metadata=metas,
                prometheus_snapshot_path=prom,
                runtime_cluster_path=cluster,
                docker_image_digest="sha256:" + "a" * 64,
                k8s_manifest_hash="sha256:" + "b" * 64,
                k6_script_hash="sha256:" + "c" * 64,
                git_commit="bada262",
                grafana_snapshot_path=None,
                otel_snapshot_path=None,
            )

            self.assertEqual(evidence["verdict"], "not_certified")
            self.assertIn(
                "observability grafana_dashboard_snapshot_present must be true",
                evidence["validation_errors"],
            )
            self.assertIn(
                "observability otel_trace_snapshot_present must be true",
                evidence["validation_errors"],
            )

    def test_metadata_cannot_fake_achieved_concurrency(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            summaries = {
                stage: k6_summary(vus_max=STAGE_TARGETS[stage])
                for stage in ["smoke", "1k", "10k", "25k", "50k"]
            }
            summaries["100k"] = k6_summary(vus_max=1)
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(
                root,
                summary_overrides=summaries,
            )
            metas["100k"].write_text(
                json.dumps(
                    {
                        "start_time": "2026-05-01T00:05:00Z",
                        "end_time": "2026-05-01T00:06:00Z",
                        "target_vus": 100000,
                        "vu": 100000,
                    }
                ),
                encoding="utf-8",
            )

            evidence = merge_evidence(
                run_id="run-1",
                environment="staging",
                stage_summaries=stages,
                stage_metadata=metas,
                prometheus_snapshot_path=prom,
                runtime_cluster_path=cluster,
                docker_image_digest="sha256:" + "a" * 64,
                k8s_manifest_hash="sha256:" + "b" * 64,
                k6_script_hash="sha256:" + "c" * 64,
                git_commit="bada262",
                grafana_snapshot_path=grafana,
                otel_snapshot_path=otel,
            )

            self.assertEqual(evidence["achieved_concurrency"], 50000)
            self.assertEqual(evidence["verdict"], "not_certified")
            self.assertIn(
                "stage 100k observed vu 1 is below required target 100000",
                evidence["validation_errors"],
            )

    def test_missing_observed_vu_metric_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            summaries = {
                stage: k6_summary(vus_max=STAGE_TARGETS[stage])
                for stage in ["smoke", "1k", "10k", "25k", "50k", "100k"]
            }
            summaries["100k"] = k6_summary(vus_max=None)
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(
                root,
                summary_overrides=summaries,
            )

            with self.assertRaises(MergeEvidenceError):
                merge_evidence(
                    run_id="run-1",
                    environment="staging",
                    stage_summaries=stages,
                    stage_metadata=metas,
                    prometheus_snapshot_path=prom,
                    runtime_cluster_path=cluster,
                    docker_image_digest="sha256:" + "a" * 64,
                    k8s_manifest_hash="sha256:" + "b" * 64,
                    k6_script_hash="sha256:" + "c" * 64,
                    git_commit="bada262",
                    grafana_snapshot_path=grafana,
                    otel_snapshot_path=otel,
                )

    def test_observed_vus_max_value_fallback_controls_achieved_concurrency(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            summaries = {
                stage: k6_summary(vus_max=STAGE_TARGETS[stage])
                for stage in ["smoke", "1k", "10k", "25k", "50k"]
            }
            summaries["100k"] = k6_summary(vus_max=None, vus_max_value=100000)
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(
                root,
                summary_overrides=summaries,
            )

            evidence = merge_evidence(
                run_id="run-1",
                environment="staging",
                stage_summaries=stages,
                stage_metadata=metas,
                prometheus_snapshot_path=prom,
                runtime_cluster_path=cluster,
                docker_image_digest="sha256:" + "a" * 64,
                k8s_manifest_hash="sha256:" + "b" * 64,
                k6_script_hash="sha256:" + "c" * 64,
                git_commit="bada262",
                grafana_snapshot_path=grafana,
                otel_snapshot_path=otel,
            )

            self.assertEqual(evidence["achieved_concurrency"], 100000)
            self.assertEqual(evidence["stage_results"][-1]["vu"], 100000)
            self.assertEqual(evidence["verdict"], "certified")

    def test_missing_critical_prometheus_metric_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            missing = prometheus_snapshot()
            missing["prometheus"]["metrics"].pop("realtime.dropped_connections")
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(
                root,
                prometheus=missing,
            )

            with self.assertRaises(MergeEvidenceError):
                merge_evidence(
                    run_id="run-1",
                    environment="staging",
                    stage_summaries=stages,
                    stage_metadata=metas,
                    prometheus_snapshot_path=prom,
                    runtime_cluster_path=cluster,
                    docker_image_digest="sha256:" + "a" * 64,
                    k8s_manifest_hash="sha256:" + "b" * 64,
                    k6_script_hash="sha256:" + "c" * 64,
                    git_commit="bada262",
                    grafana_snapshot_path=grafana,
                    otel_snapshot_path=otel,
                )

    def test_missing_gateway_restarts_metric_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            missing = prometheus_snapshot()
            missing["prometheus"]["metrics"].pop("gateway.restarts")
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(
                root,
                prometheus=missing,
            )

            with self.assertRaises(MergeEvidenceError):
                merge_evidence(
                    run_id="run-1",
                    environment="staging",
                    stage_summaries=stages,
                    stage_metadata=metas,
                    prometheus_snapshot_path=prom,
                    runtime_cluster_path=cluster,
                    docker_image_digest="sha256:" + "a" * 64,
                    k8s_manifest_hash="sha256:" + "b" * 64,
                    k6_script_hash="sha256:" + "c" * 64,
                    git_commit="bada262",
                    grafana_snapshot_path=grafana,
                    otel_snapshot_path=otel,
                )

    def test_non_zero_critical_prometheus_metrics_are_evaluated(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stages, metas, prom, cluster, grafana, otel = write_complete_inputs(
                root,
                prometheus=prometheus_snapshot(
                    **{"gateway.restarts": 1, "realtime.dropped_connections": 80}
                ),
            )

            evidence = merge_evidence(
                run_id="run-1",
                environment="staging",
                stage_summaries=stages,
                stage_metadata=metas,
                prometheus_snapshot_path=prom,
                runtime_cluster_path=cluster,
                docker_image_digest="sha256:" + "a" * 64,
                k8s_manifest_hash="sha256:" + "b" * 64,
                k6_script_hash="sha256:" + "c" * 64,
                git_commit="bada262",
                grafana_snapshot_path=grafana,
                otel_snapshot_path=otel,
            )

            self.assertEqual(evidence["verdict"], "not_certified")
            self.assertIn("gateway_restarts exceeds threshold", evidence["validation_errors"])
            self.assertIn("dropped_connections exceeds threshold", evidence["validation_errors"])


if __name__ == "__main__":
    unittest.main()
