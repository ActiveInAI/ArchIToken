#!/usr/bin/env python3
"""Tests for Phase 8.2 Prometheus snapshot collection."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase8_collect_prometheus_snapshot import (  # noqa: E402
    PROMETHEUS_QUERIES,
    PrometheusSnapshotError,
    collect_snapshot,
    parse_prometheus_value,
)


class FakeResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def success_payload(value: float) -> dict[str, Any]:
    return {
        "status": "success",
        "data": {"resultType": "vector", "result": [{"value": [1, str(value)]}]},
    }


class Phase8PrometheusSnapshotTests(unittest.TestCase):
    def test_collect_snapshot_contains_required_components(self) -> None:
        values = iter(float(index + 1) for index in range(len(PROMETHEUS_QUERIES)))

        def opener(_url: str, timeout: float = 10.0) -> FakeResponse:
            self.assertGreater(timeout, 0)
            return FakeResponse(success_payload(next(values)))

        snapshot = collect_snapshot(
            "http://prometheus:9090",
            opener=opener,
            queried_at="2026-05-01T00:00:00Z",
        )

        self.assertTrue(snapshot["prometheus_snapshot_present"])
        self.assertEqual(snapshot["prometheus"]["queried_at"], "2026-05-01T00:00:00Z")
        self.assertEqual(set(snapshot["prometheus"]["metrics"]), set(PROMETHEUS_QUERIES))
        self.assertEqual(snapshot["dependency_status"]["valkey"], "ready")

    def test_failed_query_is_not_silent(self) -> None:
        def opener(_url: str, timeout: float = 10.0) -> FakeResponse:
            return FakeResponse({"status": "error", "error": "boom"})

        snapshot = collect_snapshot("http://prometheus:9090", opener=opener)

        self.assertFalse(snapshot["prometheus_snapshot_present"])
        self.assertTrue(snapshot["prometheus"]["errors"])

    def test_empty_query_result_raises(self) -> None:
        with self.assertRaises(PrometheusSnapshotError):
            parse_prometheus_value({"status": "success", "data": {"result": []}})


if __name__ == "__main__":
    unittest.main()
