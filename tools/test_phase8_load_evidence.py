#!/usr/bin/env python3
"""Tests for Phase 8.1 load evidence validation."""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from phase8_load_evidence import EvidenceError, load_evidence, validate_evidence


FIXTURE_DIR = Path(__file__).resolve().parent / "k6" / "fixtures"


class Phase8LoadEvidenceTests(unittest.TestCase):
    def test_passing_fixture_is_certified(self) -> None:
        evidence = load_evidence(FIXTURE_DIR / "phase8_load_evidence_passing.json")

        errors = validate_evidence(evidence, required_target_concurrency=100000)

        self.assertEqual(errors, [])

    def test_failed_fixture_is_rejected(self) -> None:
        evidence = load_evidence(FIXTURE_DIR / "phase8_load_evidence_failing.json")

        errors = validate_evidence(evidence, required_target_concurrency=100000)

        self.assertTrue(errors)
        self.assertIn("verdict is blocked, expected certified", errors)

    def test_missing_field_is_rejected(self) -> None:
        evidence = load_evidence(FIXTURE_DIR / "phase8_load_evidence_passing.json")
        evidence.pop("run_id")

        errors = validate_evidence(evidence)

        self.assertIn("missing required field: run_id", errors)

    def test_missing_evidence_file_is_blocked(self) -> None:
        with self.assertRaises(EvidenceError):
            load_evidence(FIXTURE_DIR / "missing-evidence.json")


if __name__ == "__main__":
    unittest.main()
