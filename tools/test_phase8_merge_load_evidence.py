#!/usr/bin/env python3
"""Tests for Phase 8.2 load evidence merger."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase8_merge_load_evidence import merge_evidence  # noqa: E402


def k6_summary(p50: float = 50, p95: float = 120, p99: float = 300) -> dict[str, object]:
    return {
        "metrics": {
            "http_req_duration": {"values": {"p(50)": p50, "p(95)": p95, "p(99)": p99}},
            "http_req_failed": {"values": {"rate": 0.0001}},
            "http_reqs": {"values": {"rate": 1000}},
            "data_received": {"values": {"rate": 100000}},
            "data_sent": {"values": {"rate": 20000}},
            "vus_max": {"values": {"max": 1000}},
        }
    }


def prometheus_snapshot() -> dict[str, object]:
    return {
        "prometheus_snapshot_present": True,
        "prometheus": {
            "queried_at": "2026-05-01T00:00:00Z",
            "metrics": {
                "realtime.ws_connected": 100000,
                "db.pool_saturation": 0.4,
                "object_store.errors": 0,
                "nats.lag": 20,
                "qdrant.consistency": 1,
            },
        },
        "resource_metrics": {"gateway_cpu": 0.2, "db_pool_saturation": 0.4},
        "dependency_status": {"gateway": "ready", "postgres": "ready", "nats": "ready"},
    }


class Phase8MergeLoadEvidenceTests(unittest.TestCase):
    def test_merge_produces_certified_evidence_when_inputs_are_complete(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stages = {}
            metas = {}
            for index, stage in enumerate(["smoke", "1k", "10k", "25k", "50k", "100k"]):
                summary_path = root / f"{stage}.json"
                summary_path.write_text(json.dumps(k6_summary()), encoding="utf-8")
                meta_path = root / f"{stage}.meta.json"
                meta_path.write_text(
                    json.dumps(
                        {
                            "start_time": f"2026-05-01T00:{index:02d}:00Z",
                            "end_time": f"2026-05-01T00:{index + 1:02d}:00Z",
                            "vu": 100000 if stage == "100k" else max(1, index * 1000),
                        }
                    ),
                    encoding="utf-8",
                )
                stages[stage] = summary_path
                metas[stage] = meta_path
            prom = root / "prom.json"
            prom.write_text(json.dumps(prometheus_snapshot()), encoding="utf-8")
            cluster = root / "cluster.json"
            cluster.write_text(json.dumps({"valid": True, "errors": []}), encoding="utf-8")
            grafana = root / "grafana.json"
            grafana.write_text("{}", encoding="utf-8")
            otel = root / "otel.json"
            otel.write_text("{}", encoding="utf-8")

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
            self.assertEqual(len(evidence["stage_results"]), 6)

    def test_missing_grafana_and_otel_blocks_certification(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stages = {}
            metas = {}
            for stage in ["smoke", "1k", "10k", "25k", "50k", "100k"]:
                summary_path = root / f"{stage}.json"
                summary_path.write_text(json.dumps(k6_summary()), encoding="utf-8")
                meta_path = root / f"{stage}.meta.json"
                meta_path.write_text(
                    json.dumps(
                        {
                            "start_time": "2026-05-01T00:00:00Z",
                            "end_time": "2026-05-01T00:01:00Z",
                            "vu": 100000 if stage == "100k" else 1000,
                        }
                    ),
                    encoding="utf-8",
                )
                stages[stage] = summary_path
                metas[stage] = meta_path
            prom = root / "prom.json"
            prom.write_text(json.dumps(prometheus_snapshot()), encoding="utf-8")
            cluster = root / "cluster.json"
            cluster.write_text(json.dumps({"valid": True, "errors": []}), encoding="utf-8")

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


if __name__ == "__main__":
    unittest.main()
