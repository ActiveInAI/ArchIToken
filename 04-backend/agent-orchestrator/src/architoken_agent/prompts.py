"""Prompt loader.

Constitution §13: ``AGENTS.md`` < 100 lines (index only); detailed
instructions live in ``prompts/*.md`` and are loaded on demand.
"""

from __future__ import annotations

import functools
from importlib.resources import files
from pathlib import Path


@functools.lru_cache(maxsize=64)
def load(prompt_name: str) -> str:
    """Load a prompt file by name (without extension).

    Search order:
      1. ``prompts/<name>.md`` in the repo
      2. Package resource ``architoken_agent.prompts.<name>``
    """
    for prompt_root in [
        Path(__file__).parent.parent.parent / "prompts",
        Path(__file__).parent.parent.parent.parent / "prompts",
    ]:
        repo_path = prompt_root / f"{prompt_name}.md"
        if repo_path.is_file():
            return repo_path.read_text(encoding="utf-8")

    try:
        res = files("architoken_agent.prompts").joinpath(f"{prompt_name}.md")
        return res.read_text(encoding="utf-8")
    except (FileNotFoundError, ModuleNotFoundError) as exc:
        raise FileNotFoundError(f"prompt {prompt_name!r} not found") from exc
