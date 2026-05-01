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


if __name__ == "__main__":
    unittest.main()
