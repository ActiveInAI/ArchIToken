"""Module graph registry."""

from __future__ import annotations

import functools
from collections.abc import Awaitable, Callable

from .module_graph import build_module_graph
from .state import ACTIVE_MODULE_IDS, ModuleId, ModuleState

ModuleRunner = Callable[[ModuleState], Awaitable[ModuleState]]


@functools.lru_cache(maxsize=1)
def _registry() -> dict[str, ModuleRunner]:
    return {
        module_id: build_module_graph(
            module_id,
            planner_prompt_name=f"{module_id}/planner",
            generator_prompt_name=f"{module_id}/generator",
            evaluator_prompt_name=f"{module_id}/evaluator",
        )
        for module_id in ACTIVE_MODULE_IDS
    }


def get_runner(module_id: ModuleId) -> ModuleRunner:
    """Return the compiled graph for the given module."""
    return _registry()[module_id]


def list_module_ids() -> tuple[str, ...]:
    """Return active module ids in registry order."""
    return ACTIVE_MODULE_IDS
