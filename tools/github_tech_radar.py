#!/usr/bin/env python3
"""Build a best-effort GitHub technology radar from a small seed YAML file."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


SNAPSHOT_SCHEMA = "architoken.github_tech_radar.snapshot.v1"
STRICT_FAILURE_PREFIXES = (
    "fetch_failed:",
    "snapshot_invalid:",
    "snapshot_missing:",
    "snapshot_stale:",
)


@dataclass(frozen=True)
class RadarEntry:
    repo: str
    category: str
    integration_mode: str


@dataclass(frozen=True)
class RadarSnapshot:
    generated_at: str
    repositories: dict[str, dict[str, object]]


def parse_seed(path: Path) -> list[RadarEntry]:
    """Parse the constrained seed YAML shape without requiring PyYAML."""
    entries: list[RadarEntry] = []
    category: str | None = None
    mode: str | None = None

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if not raw_line.startswith(" "):
            category = line.removesuffix(":")
            mode = None
            continue
        if raw_line.startswith("  ") and not raw_line.startswith("    "):
            mode = line.strip().removesuffix(":")
            continue
        stripped = line.strip()
        if stripped.startswith("- "):
            if category is None or mode is None:
                raise ValueError(f"repo entry outside category/mode: {raw_line}")
            entries.append(RadarEntry(stripped[2:].strip(), category, mode))

    if not entries:
        raise ValueError(f"no repositories found in {path}")
    return entries


def github_url_request(
    api_path: str,
    token: str | None,
    timeout_seconds: float,
) -> tuple[dict[str, object] | None, str | None]:
    url = f"https://api.github.com/{api_path.lstrip('/')}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "architoken-tech-radar",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8")), None
    except urllib.error.HTTPError as err:
        return None, f"fetch_failed:HTTPError:{err.code}"
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        return None, f"fetch_failed:{type(err).__name__}"


def github_cli_request(
    api_path: str,
    timeout_seconds: float,
) -> tuple[dict[str, object] | None, str | None]:
    if shutil.which("gh") is None:
        return None, "fetch_failed:gh_unavailable"
    try:
        result = subprocess.run(
            ["gh", "api", api_path.lstrip("/")],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=max(10, int(timeout_seconds) + 5),
        )
    except subprocess.TimeoutExpired:
        return None, "fetch_failed:gh_timeout"
    except (OSError, subprocess.SubprocessError):
        return None, "fetch_failed:gh_error"
    if result.returncode != 0:
        return None, f"fetch_failed:gh:{result.returncode}"
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None, "fetch_failed:gh_JSONDecodeError"
    if not isinstance(payload, dict):
        return None, "fetch_failed:gh_unexpected_payload"
    return payload, None


def github_api_request(
    api_path: str,
    token: str | None,
    timeout_seconds: float,
) -> tuple[dict[str, object] | None, str | None]:
    payload, error = github_url_request(api_path, token, timeout_seconds)
    if payload is not None:
        return payload, None
    cli_payload, cli_error = github_cli_request(api_path, timeout_seconds)
    if cli_payload is not None:
        return cli_payload, None
    return None, error or cli_error


def github_request(
    repo: str,
    token: str | None,
    timeout_seconds: float,
) -> tuple[dict[str, object] | None, str | None]:
    return github_api_request(f"repos/{repo}", token, timeout_seconds)


def discover_token() -> str | None:
    """Return a GitHub token from env or the local gh CLI, when available."""
    for name in ("GITHUB_TOKEN", "GH_TOKEN"):
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip()
    if shutil.which("gh") is None:
        return None
    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    token = result.stdout.strip()
    return token or None


def compact_payload(payload: dict[str, object]) -> dict[str, object]:
    license_info = payload.get("license")
    if not isinstance(license_info, dict):
        license_info = None
    return {
        "license": license_info,
        "default_branch": payload.get("default_branch", "unknown"),
        "stargazers_count": payload.get("stargazers_count", "unknown"),
        "forks_count": payload.get("forks_count", "unknown"),
        "updated_at": payload.get("updated_at", "unknown"),
        "archived": payload.get("archived", "unknown"),
    }


def parse_snapshot_time(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_snapshot(path: Path, max_age_days: int) -> tuple[RadarSnapshot | None, str | None]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        return None, f"snapshot_invalid:{type(err).__name__}"
    if not isinstance(raw, dict):
        return None, "snapshot_invalid:root"
    if raw.get("schema") != SNAPSHOT_SCHEMA:
        return None, "snapshot_invalid:schema"
    generated_at = raw.get("generated_at")
    repositories = raw.get("repositories")
    if not isinstance(generated_at, str) or not isinstance(repositories, dict):
        return None, "snapshot_invalid:shape"
    generated_time = parse_snapshot_time(generated_at)
    if generated_time is None:
        return None, "snapshot_invalid:generated_at"
    age = datetime.now(timezone.utc) - generated_time
    if age > timedelta(days=max_age_days):
        return None, f"snapshot_stale:{generated_at}"
    normalized: dict[str, dict[str, object]] = {}
    for repo, payload in repositories.items():
        if isinstance(repo, str) and isinstance(payload, dict):
            normalized[repo] = payload
    return RadarSnapshot(generated_at=generated_at, repositories=normalized), None


def write_snapshot(path: Path, payloads: dict[str, dict[str, object]]) -> None:
    snapshot = {
        "schema": SNAPSHOT_SCHEMA,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
            "+00:00", "Z"
        ),
        "source": "GitHub REST API v2022-11-28",
        "repositories": {
            repo: compact_payload(payload) for repo, payload in sorted(payloads.items())
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def normalize_license(payload: dict[str, object] | None) -> str:
    if not payload:
        return "unknown"
    license_info = payload.get("license")
    if isinstance(license_info, dict):
        spdx = license_info.get("spdx_id")
        if isinstance(spdx, str) and spdx and spdx != "NOASSERTION":
            return spdx
        key = license_info.get("key")
        if isinstance(key, str) and key:
            return key
    return "unknown"


def license_risk(license_id: str) -> str:
    normalized = license_id.lower()
    if normalized in {"agpl-3.0", "gpl-2.0", "gpl-3.0", "lgpl-2.1", "lgpl-3.0"}:
        return "restricted"
    if normalized in {"unknown", "noassertion", "other"}:
        return "review"
    return "low"


def fit_score(entry: RadarEntry, payload: dict[str, object] | None, risk: str) -> int:
    score = {
        "core": 80,
        "adapters": 70,
        "reference": 55,
        "watch": 40,
    }.get(entry.integration_mode, 50)
    if payload and payload.get("archived") is True:
        score -= 25
    if risk == "restricted":
        score -= 25
    elif risk == "review":
        score -= 10
    stars = payload.get("stargazers_count", 0) if payload else 0
    if isinstance(stars, int):
        score += min(stars // 5000, 10)
    return max(0, min(score, 100))


def markdown_table(rows: Iterable[list[str]]) -> str:
    headers = [
        "repo",
        "category",
        "integration_mode",
        "license",
        "default_branch",
        "stars",
        "forks",
        "updated_at",
        "archived",
        "fit_score",
        "license_risk",
        "notes",
    ]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(cell.replace("|", "\\|") for cell in row) + " |")
    return "\n".join(lines) + "\n"


def row_for_entry(entry: RadarEntry, payload: dict[str, object] | None, notes: str) -> list[str]:
    license_id = normalize_license(payload)
    risk = license_risk(license_id)
    return [
        entry.repo,
        entry.category,
        entry.integration_mode,
        license_id,
        str(payload.get("default_branch", "unknown") if payload else "unknown"),
        str(payload.get("stargazers_count", "unknown") if payload else "unknown"),
        str(payload.get("forks_count", "unknown") if payload else "unknown"),
        str(payload.get("updated_at", "unknown") if payload else "unknown"),
        str(payload.get("archived", "unknown") if payload else "unknown").lower(),
        str(fit_score(entry, payload, risk)),
        risk,
        notes,
    ]


def build_rows(
    entries: Iterable[RadarEntry],
    token: str | None,
    delay_seconds: float,
    timeout_seconds: float,
    snapshot: RadarSnapshot | None,
) -> tuple[list[list[str]], dict[str, dict[str, object]]]:
    rows: list[list[str]] = []
    payloads: dict[str, dict[str, object]] = {}
    for entry in entries:
        payload, error = github_request(entry.repo, token, timeout_seconds)
        notes = error or "ok"
        if payload is not None:
            payloads[entry.repo] = payload
        elif snapshot is not None and should_use_snapshot_for_preflight_error(error):
            snapshot_payload = snapshot.repositories.get(entry.repo)
            if snapshot_payload is not None:
                payload = snapshot_payload
                notes = f"snapshot:{snapshot.generated_at};live_unavailable:{error}"
            else:
                notes = f"snapshot_missing:{entry.repo};live_unavailable:{error}"
        rows.append(row_for_entry(entry, payload, notes))
        if delay_seconds > 0:
            time.sleep(delay_seconds)
    return rows, payloads


def build_rows_from_snapshot(
    entries: Iterable[RadarEntry],
    snapshot: RadarSnapshot,
    reason: str,
) -> list[list[str]]:
    rows: list[list[str]] = []
    for entry in entries:
        payload = snapshot.repositories.get(entry.repo)
        if payload is None:
            rows.append(row_for_entry(entry, None, f"snapshot_missing:{entry.repo};{reason}"))
            continue
        rows.append(row_for_entry(entry, payload, f"snapshot:{snapshot.generated_at};{reason}"))
    return rows


def should_use_snapshot_for_preflight_error(error: str | None) -> bool:
    if error is None:
        return False
    if error in {
        "fetch_failed:URLError",
        "fetch_failed:TimeoutError",
        "fetch_failed:gh_timeout",
        "fetch_failed:gh_error",
        "fetch_failed:gh_unavailable",
    }:
        return True
    if error.startswith("fetch_failed:HTTPError:"):
        code = error.rsplit(":", 1)[-1]
        return code in {"403", "429", "500", "502", "503", "504"}
    return error.startswith("fetch_failed:gh:")


def rows_have_fetch_failures(rows: Iterable[list[str]]) -> bool:
    """Return true when any row contains a fetch failure note."""
    return any(len(row) >= 12 and row[11].startswith("fetch_failed:") for row in rows)


def rows_have_strict_failures(rows: Iterable[list[str]]) -> bool:
    return any(
        len(row) >= 12 and row[11].startswith(STRICT_FAILURE_PREFIXES) for row in rows
    )


def strict_exit_code(rows: Iterable[list[str]], strict: bool) -> int:
    """Return the process exit code for strict/non-strict verification."""
    if strict and rows_have_strict_failures(rows):
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", required=True, type=Path, help="Path to tech-radar.seed.yaml")
    parser.add_argument("--out", required=True, type=Path, help="Markdown output path")
    parser.add_argument("--delay", type=float, default=0.0, help="Optional delay between GitHub calls")
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="Per GitHub API request timeout in seconds",
    )
    parser.add_argument(
        "--fallback-snapshot",
        type=Path,
        help="Use a fresh local metadata snapshot when live GitHub metadata is unavailable",
    )
    parser.add_argument(
        "--prefer-snapshot",
        action="store_true",
        help="Use the fallback snapshot without live GitHub preflight or repository fetches",
    )
    parser.add_argument(
        "--write-snapshot",
        type=Path,
        help="Write a compact snapshot from successful live GitHub metadata",
    )
    parser.add_argument(
        "--max-snapshot-age-days",
        type=int,
        default=14,
        help="Maximum age for fallback snapshots",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero if any repository fetch fails",
    )
    args = parser.parse_args()

    try:
        entries = parse_seed(args.seed)
    except (OSError, ValueError) as err:
        print(f"failed to read seed: {err}", file=sys.stderr)
        return 2

    snapshot: RadarSnapshot | None = None
    if args.fallback_snapshot is not None:
        snapshot, snapshot_error = load_snapshot(args.fallback_snapshot, args.max_snapshot_age_days)
        if snapshot_error is not None:
            print(f"metadata snapshot unavailable: {snapshot_error}", file=sys.stderr)
    if args.prefer_snapshot:
        if snapshot is None:
            return 2
        rows = build_rows_from_snapshot(entries, snapshot, "preferred_snapshot")
        args.out.write_text(markdown_table(rows), encoding="utf-8")
        return strict_exit_code(rows, args.strict)

    token = discover_token()
    if snapshot is not None:
        _, preflight_error = github_api_request("rate_limit", token, args.timeout)
        if should_use_snapshot_for_preflight_error(preflight_error):
            rows = build_rows_from_snapshot(
                entries,
                snapshot,
                f"github_preflight_unavailable:{preflight_error}",
            )
            args.out.write_text(markdown_table(rows), encoding="utf-8")
            return strict_exit_code(rows, args.strict)

    rows, payloads = build_rows(entries, token, args.delay, args.timeout, snapshot)
    args.out.write_text(markdown_table(rows), encoding="utf-8")
    if args.write_snapshot is not None and (
        rows_have_strict_failures(rows) or any(len(row) >= 12 and row[11] != "ok" for row in rows)
    ):
        print("refusing to write snapshot from incomplete metadata", file=sys.stderr)
        return 1
    if args.write_snapshot is not None:
        write_snapshot(args.write_snapshot, payloads)
    if args.strict and rows_have_strict_failures(rows):
        print(
            "strict tech radar verification failed: one or more repositories have invalid metadata notes",
            file=sys.stderr,
        )
    return strict_exit_code(rows, args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
