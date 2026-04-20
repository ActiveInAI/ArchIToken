"""pytest configuration."""

import pytest


@pytest.fixture(autouse=True)
def _noop() -> None:
    """Placeholder autouse fixture for shared setup."""
