"""The 9 business-phase graphs.

Each phase points to three prompt files under ``prompts/<phase>/``:
``planner.md``, ``generator.md``, ``evaluator.md``.
"""

from __future__ import annotations

import functools
from collections.abc import Awaitable, Callable

from .phase_graph import build_phase_graph
from .state import BusinessPhase, PhaseState

PhaseRunner = Callable[[PhaseState], Awaitable[PhaseState]]


@functools.lru_cache(maxsize=1)
def _registry() -> dict[BusinessPhase, PhaseRunner]:
    return {
        BusinessPhase.PRE_SALES: build_phase_graph(
            BusinessPhase.PRE_SALES,
            planner_prompt_name="pre_sales/planner",
            generator_prompt_name="pre_sales/generator",
            evaluator_prompt_name="pre_sales/evaluator",
        ),
        BusinessPhase.CONCEPT: build_phase_graph(
            BusinessPhase.CONCEPT,
            planner_prompt_name="concept/planner",
            generator_prompt_name="concept/generator",
            evaluator_prompt_name="concept/evaluator",
        ),
        BusinessPhase.DEVELOP: build_phase_graph(
            BusinessPhase.DEVELOP,
            planner_prompt_name="develop/planner",
            generator_prompt_name="develop/generator",
            evaluator_prompt_name="develop/evaluator",
        ),
        BusinessPhase.COSTING: build_phase_graph(
            BusinessPhase.COSTING,
            planner_prompt_name="costing/planner",
            generator_prompt_name="costing/generator",
            evaluator_prompt_name="costing/evaluator",
        ),
        BusinessPhase.FABRICATION: build_phase_graph(
            BusinessPhase.FABRICATION,
            planner_prompt_name="fabrication/planner",
            generator_prompt_name="fabrication/generator",
            evaluator_prompt_name="fabrication/evaluator",
        ),
        BusinessPhase.LOGISTICS: build_phase_graph(
            BusinessPhase.LOGISTICS,
            planner_prompt_name="logistics/planner",
            generator_prompt_name="logistics/generator",
            evaluator_prompt_name="logistics/evaluator",
        ),
        BusinessPhase.CONSTRUCTION: build_phase_graph(
            BusinessPhase.CONSTRUCTION,
            planner_prompt_name="construction/planner",
            generator_prompt_name="construction/generator",
            evaluator_prompt_name="construction/evaluator",
        ),
        BusinessPhase.ACCEPTANCE: build_phase_graph(
            BusinessPhase.ACCEPTANCE,
            planner_prompt_name="acceptance/planner",
            generator_prompt_name="acceptance/generator",
            evaluator_prompt_name="acceptance/evaluator",
        ),
        BusinessPhase.OPERATIONS: build_phase_graph(
            BusinessPhase.OPERATIONS,
            planner_prompt_name="operations/planner",
            generator_prompt_name="operations/generator",
            evaluator_prompt_name="operations/evaluator",
        ),
    }


def get_runner(phase: BusinessPhase) -> PhaseRunner:
    """Return the compiled graph for the given phase."""
    return _registry()[phase]
