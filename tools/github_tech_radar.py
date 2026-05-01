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
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class RadarEntry:
    repo: str
    category: str
    integration_mode: str


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


def github_request(repo: str, token: str | None) -> tuple[dict[str, object] | None, str | None]:
    url = f"https://api.github.com/repos/{repo}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "architoken-tech-radar",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8")), None
    except urllib.error.HTTPError as err:
        return None, f"fetch_failed:HTTPError:{err.code}"
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        return None, f"fetch_failed:{type(err).__name__}"


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


def build_rows(entries: Iterable[RadarEntry], token: str | None, delay_seconds: float) -> list[list[str]]:
    rows: list[list[str]] = []
    for entry in entries:
        payload, error = github_request(entry.repo, token)
        license_id = normalize_license(payload)
        risk = license_risk(license_id)
        notes = error or "ok"
        rows.append(
            [
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
        )
        if delay_seconds > 0:
            time.sleep(delay_seconds)
    return rows


def rows_have_fetch_failures(rows: Iterable[list[str]]) -> bool:
    """Return true when any row contains a fetch failure note."""
    return any(len(row) >= 12 and row[11].startswith("fetch_failed:") for row in rows)


def strict_exit_code(rows: Iterable[list[str]], strict: bool) -> int:
    """Return the process exit code for strict/non-strict verification."""
    if strict and rows_have_fetch_failures(rows):
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", required=True, type=Path, help="Path to tech-radar.seed.yaml")
    parser.add_argument("--out", required=True, type=Path, help="Markdown output path")
    parser.add_argument("--delay", type=float, default=0.0, help="Optional delay between GitHub calls")
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

    token = discover_token()
    rows = build_rows(entries, token, args.delay)
    args.out.write_text(markdown_table(rows), encoding="utf-8")
    if args.strict and rows_have_fetch_failures(rows):
        print(
            "strict tech radar verification failed: one or more repositories have fetch_failed notes",
            file=sys.stderr,
        )
    return strict_exit_code(rows, args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
