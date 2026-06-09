"""Prompt loader.

Constitution §13: ``AGENTS.md`` < 100 lines (index only); detailed
instructions live in ``prompts/*.md`` and are loaded on demand.
"""

from __future__ import annotations

import functools
from importlib.resources import files
from pathlib import Path

LEGACY_PROMPT_NAMESPACES = {
    "finance_hr": "finance_management",
}


def _normalize_prompt_name(prompt_name: str) -> str:
    """Normalize prompt names before filesystem/resource lookup."""

    cleaned = prompt_name.strip().replace("\\", "/")
    parts = tuple(part for part in cleaned.split("/") if part)
    if not parts or any(part in {".", ".."} for part in parts):
        raise FileNotFoundError(f"prompt {prompt_name!r} not found")

    namespace = LEGACY_PROMPT_NAMESPACES.get(parts[0], parts[0])
    return "/".join((namespace, *parts[1:]))


@functools.lru_cache(maxsize=64)
def load(prompt_name: str) -> str:
    """Load a prompt file by name (without extension).

    Search order:
      1. ``prompts/<name>.md`` in the repo
      2. Package resource ``architoken_agent.prompts.<name>``
    """
    normalized_prompt_name = _normalize_prompt_name(prompt_name)
    for prompt_root in [
        Path(__file__).parent.parent.parent / "prompts",
        Path(__file__).parent.parent.parent.parent / "prompts",
    ]:
        repo_path = prompt_root / f"{normalized_prompt_name}.md"
        if repo_path.is_file():
            return repo_path.read_text(encoding="utf-8")

    try:
        res = files("architoken_agent.prompts").joinpath(f"{normalized_prompt_name}.md")
        return res.read_text(encoding="utf-8")
    except (FileNotFoundError, ModuleNotFoundError) as exc:
        raise FileNotFoundError(f"prompt {prompt_name!r} not found") from exc
