#!/usr/bin/env python3
"""Repository-level production readiness contract for ArchIToken.

This is the fast, deterministic gate that runs before environment-specific
smoke tests. It checks that the repository still matches the production
architecture contract: one module registry, no retired active identities, no
generated artifacts tracked by Git, and a complete production environment
template.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path


ACTIVE_MODULE_IDS = [
    "personal_center",
    "marketing_service",
    "planning_management",
    "concept_design",
    "standard_library",
    "detailed_design",
    "quantity_costing",
    "material_logistics",
    "production_manufacturing",
    "construction_management",
    "digital_twin",
    "digital_archive",
    "finance_management",
    "human_resources",
    "ai_center",
    "settings_center",
]

LEGACY_MODULE_IDS = {"finance_hr"}

REQUIRED_PRODUCTION_ENV = [
    "ARCHITOKEN_PROFILE",
    "DATABASE_URL",
    "ARCHITOKEN_DATABASE__URL",
    "NATS_URL",
    "TEMPORAL_ADDRESS",
    "S3_ENDPOINT",
    "S3_PUBLIC_ENDPOINT",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "S3_BUCKET",
    "ARCHITOKEN_OBSERVABILITY__OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "ARCHITOKEN_AUTH__JWT_SECRET",
    "ARCHITOKEN_AUTH__JWT_ISSUER",
    "ARCHITOKEN_GENERATION__PROVIDER",
    "ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL",
    "ARCHITOKEN_PHASE8_PGBOUNCER_REQUIRED",
    "ARCHITOKEN_PHASE8_OBJECT_STORE_REQUIRED",
    "ARCHITOKEN_PHASE8_OTEL_REQUIRED",
    "ARCHITOKEN_PHASE8_MAX_REQUEST_BODY_BYTES",
    "ARCHITOKEN_PHASE8_MAX_UPLOAD_BYTES",
    "ARCHITOKEN_PHASE8_API_RPS_LIMIT",
    "ARCHITOKEN_PHASE8_TENANT_RPS_LIMIT",
    "ARCHITOKEN_PHASE8_ACTOR_RPS_LIMIT",
    "ARCHITOKEN_PHASE8_MAX_CONCURRENT_UPLOADS_PER_TENANT",
    "ARCHITOKEN_PHASE8_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT",
    "ARCHITOKEN_PHASE8_DB_POOL_MAX_CONNECTIONS",
    "ARCHITOKEN_WORKER_SUBJECT",
    "ARCHITOKEN_WORKER_RESULT_SUBJECT",
    "ARCHITOKEN_WORKER_RESULT_TOKEN",
    "IFCDB_AGENT_URL",
    "IFCDB_AGENT_VERSION",
]

REQUIRED_FILE_EXTENSIONS = {
    "dxf",
    "dwg",
    "rvt",
    "stel",
    "stl",
    "iges",
    "igs",
    "ifc",
    "skp",
    "3dm",
    "usd",
    "usda",
    "usdc",
    "usdz",
    "b3dm",
    "i3dm",
    "pnts",
    "cmpt",
    "gltf",
    "glb",
    "docx",
    "doc",
    "xlsx",
    "xls",
    "pptx",
    "ppt",
    "mp3",
    "wav",
    "m4a",
    "flac",
    "mp4",
    "mkv",
    "mov",
    "avi",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "pdf",
}

RETIRED_TRACKED_PATHS = {
    "CLAUDE.md",
    "docs/ZED-CLAUDE-CODE-SETUP.md",
}

RETIRED_TRACKED_PREFIXES = (
    ".claude/",
)

FORBIDDEN_TRACKED_PARTS = (
    "/node_modules/",
    "/.next/",
    "/target/",
    "/coverage.xml",
    "/cache.db",
    "/test-results/",
    "/playwright-report/",
)

SHELL_SCRIPTS = [
    "04-backend/scripts/smoke-all.sh",
    "04-backend/scripts/smoke-data-services.sh",
    "04-backend/scripts/smoke-production-local.sh",
    "04-backend/scripts/smoke-production-readiness-all.sh",
    "04-backend/scripts/smoke-phase8-production-readiness.sh",
    "04-backend/scripts/smoke-phase8-scale.sh",
    "04-backend/scripts/smoke-phase8-realtime-readiness.sh",
    "04-backend/scripts/certify-phase8-100k.sh",
    "04-backend/scripts/validate-phase8-load-evidence.sh",
    "04-backend/scripts/guard-proprietary-runtime.sh",
]


@dataclass(frozen=True)
class CheckResult:
    name: str
    errors: list[str]


def run_git(root: Path, args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=root,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def tracked_files(root: Path) -> list[str]:
    result = run_git(root, ["ls-files"])
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git ls-files failed")
    return [line for line in result.stdout.splitlines() if line.strip()]


def read_text(root: Path, path: str) -> str:
    return (root / path).read_text(encoding="utf-8", errors="ignore")


def extract_string_list_after_marker(text: str, marker: str) -> list[str]:
    marker_index = text.find(marker)
    if marker_index < 0:
        return []
    assignment_index = text.find("=", marker_index)
    search_index = assignment_index if assignment_index >= 0 else marker_index
    start = min(
        index
        for index in [
            text.find("[", search_index),
            text.find("(", search_index),
        ]
        if index >= 0
    )
    opener = text[start]
    closer = "]" if opener == "[" else ")"
    depth = 0
    for index in range(start, len(text)):
        char = text[index]
        if char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                block = text[start : index + 1]
                return re.findall(r"[\"'](\.?[a-z0-9_]+)[\"']", block)
    return []


def extract_openapi_module_ids(text: str) -> list[str]:
    match = re.search(
        r"\n\s+ModuleId:\n(?:.*\n){0,8}?\s+enum:\n(?P<items>(?:\s+-\s+[a-z0-9_]+\n)+)",
        text,
    )
    if not match:
        return []
    return [line.split("-", 1)[1].strip() for line in match.group("items").splitlines()]


def extract_env_keys(text: str) -> dict[str, str]:
    keys: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        keys[key.strip()] = value.strip()
    return keys


def check_module_registries(root: Path) -> CheckResult:
    sources = {
        "frontend": extract_string_list_after_marker(
            read_text(root, "03-frontend/lib/module-registry.ts"),
            "export const activeModuleIds",
        ),
        "rust": extract_string_list_after_marker(
            read_text(root, "04-backend/harness-core/src/module_registry.rs"),
            "pub const ACTIVE_MODULE_IDS",
        ),
        "python": extract_string_list_after_marker(
            read_text(root, "04-backend/agent-orchestrator/src/architoken_agent/state.py"),
            "ACTIVE_MODULE_IDS",
        ),
        "openapi": extract_openapi_module_ids(read_text(root, "04-backend/openapi.yaml")),
    }
    errors: list[str] = []
    for source, ids in sources.items():
        if ids != ACTIVE_MODULE_IDS:
            errors.append(f"{source} module ids drifted: {ids}")

    shared_dir = root / "04-backend/shared/src/modules"
    shared_modules = sorted(
        path.stem for path in shared_dir.glob("*.rs") if path.stem != "mod"
    )
    if shared_modules != sorted(ACTIVE_MODULE_IDS):
        errors.append(f"shared module files drifted: {shared_modules}")

    prompt_dir = root / "04-backend/agent-orchestrator/prompts"
    prompt_modules = sorted(
        path.name
        for path in prompt_dir.iterdir()
        if path.is_dir() and path.name not in LEGACY_MODULE_IDS
    )
    if prompt_modules != sorted(ACTIVE_MODULE_IDS):
        errors.append(f"agent prompt dirs drifted: {prompt_modules}")

    return CheckResult("module registries", errors)


def check_retired_identity_files(files: list[str]) -> CheckResult:
    errors = [
        path
        for path in files
        if path in RETIRED_TRACKED_PATHS
        or any(path.startswith(prefix) for prefix in RETIRED_TRACKED_PREFIXES)
    ]
    return CheckResult("retired active identity files", errors)


def check_generated_artifacts(files: list[str]) -> CheckResult:
    normalized = [f"/{path}" for path in files]
    errors = [
        path[1:]
        for path in normalized
        if any(forbidden in path for forbidden in FORBIDDEN_TRACKED_PARTS)
    ]
    return CheckResult("generated artifacts not tracked", errors)


def check_production_env(root: Path) -> CheckResult:
    env = extract_env_keys(read_text(root, ".env.production.example"))
    errors = [f"missing {key}" for key in REQUIRED_PRODUCTION_ENV if key not in env]
    if env.get("ARCHITOKEN_PROFILE") != "production":
        errors.append("ARCHITOKEN_PROFILE must be production in .env.production.example")
    if env.get("IFCDB_AGENT_VERSION") not in {"v1.0.9", "1.0.9"}:
        errors.append("IFCDB_AGENT_VERSION must pin v1.0.9")
    for key in [
        "ARCHITOKEN_PHASE8_PGBOUNCER_REQUIRED",
        "ARCHITOKEN_PHASE8_OBJECT_STORE_REQUIRED",
        "ARCHITOKEN_PHASE8_OTEL_REQUIRED",
    ]:
        if env.get(key) != "true":
            errors.append(f"{key} must be true")
    return CheckResult("production environment template", errors)


def check_file_runtime_alignment(root: Path) -> CheckResult:
    frontend = {
        item.lstrip(".")
        for item in extract_string_list_after_marker(
            read_text(root, "03-frontend/lib/file-type-registry.ts"),
            "export const requestedFileTypeExtensions",
        )
    }
    backend = set(
        extract_string_list_after_marker(
            read_text(root, "04-backend/harness-core/src/file_runtime_registry.rs"),
            "pub const REQUESTED_ENGINE_EXTENSIONS",
        )
    )
    errors: list[str] = []
    missing_frontend = sorted(REQUIRED_FILE_EXTENSIONS - frontend)
    missing_backend = sorted(REQUIRED_FILE_EXTENSIONS - backend)
    if missing_frontend:
        errors.append(f"frontend requested extensions missing: {missing_frontend}")
    if missing_backend:
        errors.append(f"backend runtime extensions missing: {missing_backend}")
    if backend - frontend:
        errors.append(f"backend extensions absent from frontend registry request: {sorted(backend - frontend)}")
    return CheckResult("file runtime alignment", errors)


def check_frontend_backend_cde_bridge(root: Path) -> CheckResult:
    errors: list[str] = []
    required_sources = {
        "03-frontend/lib/module-file-api-client.ts": [
            "backendRequest",
            "mapBackendModuleFileNode",
            "listModuleFiles",
            "createModuleFile",
            "updateModuleFile",
            "moveModuleFile",
            "shareModuleFile",
            "trashModuleFile",
        ],
        "03-frontend/lib/module-backend-adapter.ts": [
            "replaceModuleFilesFromBackend",
            "upsertModuleFileFromBackend",
            "BackendModuleFileApiClient",
        ],
        "03-frontend/components/ModuleFileExplorer.tsx": [
            "moduleFileApiClient",
            "replaceModuleFilesFromBackend",
            "upsertModuleFileFromBackend",
        ],
        "03-frontend/lib/module-file-api-client.test.ts": [
            "maps backend CDE nodes",
            "posts create and move operations",
        ],
    }
    for path, markers in required_sources.items():
        source_path = root / path
        if not source_path.exists():
            errors.append(f"missing {path}")
            continue
        text = read_text(root, path)
        for marker in markers:
            if marker not in text:
                errors.append(f"{path}: missing {marker}")
    return CheckResult("frontend backend CDE bridge", errors)


def check_backend_cde_persistence(root: Path) -> CheckResult:
    errors: list[str] = []
    required_sources = {
        "04-backend/harness-core/src/postgres_runtime_store.rs": [
            "CREATE TABLE IF NOT EXISTS module_files",
            "pub async fn list_module_files",
            "pub async fn create_module_file",
            "pub async fn update_module_file",
            "pub async fn move_module_file",
            "pub async fn share_module_file",
            "pub async fn trash_module_file",
        ],
        "04-backend/harness-core/src/bin/gateway.rs": [
            "postgres_runtime_store::list_module_files",
            "postgres_runtime_store::create_module_file",
            "postgres_runtime_store::update_module_file",
            "postgres_runtime_store::move_module_file",
            "postgres_runtime_store::trash_module_file",
            "\"module_files\"",
        ],
        "04-backend/harness-core/src/durable_store.rs": ["\"module_files\""],
        "04-backend/migration/src/m20260501000001_phase7_durable_runtime.rs": [
            "20260501000001_phase7_durable_runtime.sql",
        ],
        "04-backend/migrations/20260501000001_phase7_durable_runtime.sql": [
            "CREATE TABLE IF NOT EXISTS module_files",
            "file_id",
        ],
    }
    for path, markers in required_sources.items():
        source_path = root / path
        if not source_path.exists():
            errors.append(f"missing {path}")
            continue
        text = read_text(root, path)
        for marker in markers:
            if marker not in text:
                errors.append(f"{path}: missing {marker}")
    return CheckResult("backend CDE persistence", errors)


def check_backend_lifecycle_persistence(root: Path) -> CheckResult:
    errors: list[str] = []
    required_sources = {
        "04-backend/harness-core/src/postgres_runtime_store.rs": [
            "CREATE TABLE IF NOT EXISTS module_transactions",
            "CREATE TABLE IF NOT EXISTS module_transaction_approvals",
            "pub async fn list_module_transactions",
            "pub async fn create_module_transaction",
            "pub async fn transition_module_transaction",
            "pub async fn approve_module_transaction",
            "pub async fn reject_module_transaction",
            "next_module_transaction_status",
        ],
        "04-backend/harness-core/src/bin/gateway.rs": [
            "postgres_runtime_store::list_module_transactions",
            "postgres_runtime_store::create_module_transaction",
            "postgres_runtime_store::transition_module_transaction",
            "postgres_runtime_store::approve_module_transaction",
            "postgres_runtime_store::reject_module_transaction",
            "\"module_transactions\"",
            "\"module_transaction_approvals\"",
        ],
        "04-backend/harness-core/src/durable_store.rs": [
            "\"module_transactions\"",
            "\"module_transaction_approvals\"",
        ],
        "04-backend/migration/src/m20260501000001_phase7_durable_runtime.rs": [
            "20260501000001_phase7_durable_runtime.sql",
        ],
        "04-backend/migrations/20260501000001_phase7_durable_runtime.sql": [
            "CREATE TABLE IF NOT EXISTS module_transactions",
            "CREATE TABLE IF NOT EXISTS module_transaction_approvals",
        ],
    }
    for path, markers in required_sources.items():
        source_path = root / path
        if not source_path.exists():
            errors.append(f"missing {path}")
            continue
        text = read_text(root, path)
        for marker in markers:
            if marker not in text:
                errors.append(f"{path}: missing {marker}")
    return CheckResult("backend lifecycle persistence", errors)


def check_shell_scripts(root: Path) -> CheckResult:
    errors: list[str] = []
    for script in SHELL_SCRIPTS:
        if not (root / script).exists():
            errors.append(f"missing script {script}")
            continue
        result = subprocess.run(
            ["bash", "-n", script],
            cwd=root,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode != 0:
            errors.append(f"{script}: {result.stderr.strip()}")
    return CheckResult("shell script syntax", errors)


def check_worktree(root: Path) -> CheckResult:
    result = run_git(root, ["status", "--porcelain"])
    if result.returncode != 0:
        return CheckResult("strict worktree", [result.stderr.strip()])
    errors = result.stdout.splitlines()
    return CheckResult("strict worktree", errors)


def run_checks(root: Path, *, strict_worktree: bool = False) -> list[CheckResult]:
    files = tracked_files(root)
    checks: list[Callable[[], CheckResult]] = [
        lambda: check_module_registries(root),
        lambda: check_retired_identity_files(files),
        lambda: check_generated_artifacts(files),
        lambda: check_production_env(root),
        lambda: check_file_runtime_alignment(root),
        lambda: check_frontend_backend_cde_bridge(root),
        lambda: check_backend_cde_persistence(root),
        lambda: check_backend_lifecycle_persistence(root),
        lambda: check_shell_scripts(root),
    ]
    if strict_worktree:
        checks.append(lambda: check_worktree(root))
    return [check() for check in checks]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Repository root. Defaults to the parent of tools/.",
    )
    parser.add_argument(
        "--strict-worktree",
        action="store_true",
        help="Also fail when Git has uncommitted changes.",
    )
    args = parser.parse_args(argv)
    root = args.repo_root.resolve()

    results = run_checks(root, strict_worktree=args.strict_worktree)
    failed = False
    for result in results:
        if result.errors:
            failed = True
            print(f"[fail] {result.name}", file=sys.stderr)
            for error in result.errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print(f"[ok] {result.name}")
    if failed:
        return 1
    print("ArchIToken production readiness contract passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
