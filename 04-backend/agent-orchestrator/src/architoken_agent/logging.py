"""Structured logging boundary with a safe stdlib fallback.

Production installs ``structlog`` from ``pyproject.toml``. Local smoke and
contract tests must still run in a minimal Python environment so backend
readiness does not depend on optional developer tooling being preinstalled.
"""

from __future__ import annotations

import logging
from typing import Any


class _StdlibBoundLogger:
    def __init__(self, name: str) -> None:
        self._logger = logging.getLogger(name)

    def info(self, event: str, **kwargs: Any) -> None:
        self._logger.info("%s %s", event, kwargs)

    def warning(self, event: str, **kwargs: Any) -> None:
        self._logger.warning("%s %s", event, kwargs)

    def error(self, event: str, **kwargs: Any) -> None:
        self._logger.error("%s %s", event, kwargs)


def get_logger(name: str) -> Any:
    try:
        import structlog

        return structlog.get_logger(name)
    except ModuleNotFoundError:
        logging.basicConfig(level=logging.INFO)
        return _StdlibBoundLogger(name)
