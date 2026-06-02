#!/usr/bin/env python3
"""Tests for the repository-level production readiness contract."""

from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from production_readiness_contract import (  # noqa: E402
    ACTIVE_MODULE_IDS,
    REQUIRED_FILE_EXTENSIONS,
    check_backend_cde_persistence,
    check_file_runtime_alignment,
    check_frontend_backend_cde_bridge,
    check_module_registries,
    check_production_env,
)


REPO_ROOT = Path(__file__).resolve().parents[1]


class ProductionReadinessContractTests(unittest.TestCase):
    def test_module_registries_match_active_contract(self) -> None:
        result = check_module_registries(REPO_ROOT)

        self.assertEqual(result.errors, [])
        self.assertEqual(len(ACTIVE_MODULE_IDS), 14)

    def test_production_env_template_contains_required_gates(self) -> None:
        result = check_production_env(REPO_ROOT)

        self.assertEqual(result.errors, [])

    def test_file_runtime_alignment_covers_requested_formats(self) -> None:
        result = check_file_runtime_alignment(REPO_ROOT)

        self.assertEqual(result.errors, [])
        self.assertIn("usd", REQUIRED_FILE_EXTENSIONS)
        self.assertIn("usdz", REQUIRED_FILE_EXTENSIONS)
        self.assertIn("b3dm", REQUIRED_FILE_EXTENSIONS)
        self.assertIn("glb", REQUIRED_FILE_EXTENSIONS)
        self.assertIn("jpeg", REQUIRED_FILE_EXTENSIONS)
        self.assertNotIn("obj", REQUIRED_FILE_EXTENSIONS)
        self.assertNotIn("fbx", REQUIRED_FILE_EXTENSIONS)

    def test_frontend_backend_cde_bridge_is_enforced(self) -> None:
        result = check_frontend_backend_cde_bridge(REPO_ROOT)

        self.assertEqual(result.errors, [])

    def test_backend_cde_persistence_is_enforced(self) -> None:
        result = check_backend_cde_persistence(REPO_ROOT)

        self.assertEqual(result.errors, [])


if __name__ == "__main__":
    unittest.main()
