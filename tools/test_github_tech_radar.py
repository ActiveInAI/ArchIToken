#!/usr/bin/env python3
"""Unit tests for the GitHub tech radar helper."""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import github_tech_radar


class StrictModeTests(unittest.TestCase):
    def test_non_strict_allows_fetch_failures(self) -> None:
        rows = [["repo", "category", "core", "unknown", "main", "0", "0", "now", "false", "70", "review", "fetch_failed:HTTPError:403"]]

        self.assertTrue(github_tech_radar.rows_have_fetch_failures(rows))
        self.assertEqual(github_tech_radar.strict_exit_code(rows, strict=False), 0)

    def test_strict_rejects_fetch_failures(self) -> None:
        rows = [["repo", "category", "core", "unknown", "main", "0", "0", "now", "false", "70", "review", "fetch_failed:HTTPError:403"]]

        self.assertEqual(github_tech_radar.strict_exit_code(rows, strict=True), 1)

    def test_strict_accepts_successful_rows(self) -> None:
        rows = [["repo", "category", "core", "MIT", "main", "1", "1", "now", "false", "80", "low", "ok"]]

        self.assertFalse(github_tech_radar.rows_have_fetch_failures(rows))
        self.assertEqual(github_tech_radar.strict_exit_code(rows, strict=True), 0)

    def test_strict_rejects_invalid_snapshot_rows(self) -> None:
        rows = [["repo", "category", "core", "MIT", "main", "1", "1", "now", "false", "80", "low", "snapshot_missing:repo"]]

        self.assertEqual(github_tech_radar.strict_exit_code(rows, strict=True), 1)

    def test_snapshot_preflight_only_covers_transient_metadata_failures(self) -> None:
        self.assertTrue(
            github_tech_radar.should_use_snapshot_for_preflight_error("fetch_failed:URLError")
        )
        self.assertTrue(
            github_tech_radar.should_use_snapshot_for_preflight_error("fetch_failed:HTTPError:503")
        )
        self.assertTrue(
            github_tech_radar.should_use_snapshot_for_preflight_error("fetch_failed:HTTPError:403")
        )
        self.assertFalse(
            github_tech_radar.should_use_snapshot_for_preflight_error("fetch_failed:HTTPError:404")
        )

    def test_snapshot_rows_preserve_metadata_without_fetch_failure(self) -> None:
        entries = [github_tech_radar.RadarEntry("owner/repo", "category", "core")]
        snapshot = github_tech_radar.RadarSnapshot(
            generated_at="2026-06-01T00:00:00Z",
            repositories={
                "owner/repo": {
                    "license": {"spdx_id": "MIT"},
                    "default_branch": "main",
                    "stargazers_count": 7,
                    "forks_count": 1,
                    "updated_at": "2026-06-01T00:00:00Z",
                    "archived": False,
                }
            },
        )

        rows = github_tech_radar.build_rows_from_snapshot(
            entries, snapshot, "github_preflight_unavailable:fetch_failed:URLError"
        )

        self.assertEqual(rows[0][3], "MIT")
        self.assertTrue(rows[0][11].startswith("snapshot:2026-06-01T00:00:00Z"))
        self.assertEqual(github_tech_radar.strict_exit_code(rows, strict=True), 0)


if __name__ == "__main__":
    unittest.main()
