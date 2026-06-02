"""Adapter dependency checks for production workers."""

from __future__ import annotations

import importlib.util
import importlib
import ctypes
import os
import shutil
import sys
from pathlib import Path

from .contract import ConversionJob, WorkerResult


def ensure_python_dependency(import_name: str) -> bool:
    """Return whether a dependency can be imported, including source-build prefixes."""

    if _dependency_available(import_name):
        return True
    for path in _python_dependency_paths(import_name):
        if path not in sys.path:
            sys.path.insert(0, path)
        if import_name == "ifcopenshell":
            _prepare_ifcopenshell_shared_libraries()
        if _dependency_available(import_name):
            return True
    return False


def source_build_runtime_env(base: dict[str, str] | None = None) -> dict[str, str]:
    """Return an environment with source-built native libraries visible to child processes."""

    env = dict(base or os.environ)
    library_paths = [str(path) for path in _runtime_library_paths()]
    if library_paths:
        current = env.get("LD_LIBRARY_PATH", "")
        env["LD_LIBRARY_PATH"] = ":".join([*library_paths, current] if current else library_paths)
    return env


def resolve_binary(binary: str) -> str | None:
    """Resolve a binary from PATH or known source-build prefixes."""

    binary = binary.strip()
    if not binary:
        return None
    if "/" in binary:
        path = Path(binary)
        return str(path) if path.is_file() and os.access(path, os.X_OK) else None
    resolved = shutil.which(binary)
    if resolved:
        return resolved
    for path in _binary_candidates(binary):
        if path.is_file() and os.access(path, os.X_OK):
            return str(path)
    return None


def missing_python_dependency(
    job: ConversionJob,
    *,
    adapter: str,
    import_name: str,
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when a required Python dependency is absent."""

    if ensure_python_dependency(import_name):
        return None
    return blocked(job, adapter=adapter, reason=f"missing Python dependency: {import_name}", install_hint=install_hint)


def missing_binary(
    job: ConversionJob,
    *,
    adapter: str,
    binary: str,
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when a required executable is absent."""

    if resolve_binary(binary):
        return None
    return blocked(job, adapter=adapter, reason=f"missing executable: {binary}", install_hint=install_hint)


def missing_env(
    job: ConversionJob,
    *,
    adapter: str,
    name: str,
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when an adapter service URL or credential is absent."""

    if os.getenv(name, "").strip():
        return None
    return blocked(job, adapter=adapter, reason=f"missing environment variable: {name}", install_hint=install_hint)


def missing_any_env(
    job: ConversionJob,
    *,
    adapter: str,
    names: tuple[str, ...],
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when none of the accepted env vars is configured."""

    if any(os.getenv(name, "").strip() for name in names):
        return None
    return blocked(
        job,
        adapter=adapter,
        reason=f"missing one of environment variables: {', '.join(names)}",
        install_hint=install_hint,
    )


def blocked(job: ConversionJob, *, adapter: str, reason: str, install_hint: str) -> WorkerResult:
    """Build an explicit blocked result instead of pretending conversion succeeded."""

    return WorkerResult(
        job_id=job.job_id,
        status="blocked",
        output={
            "adapter": adapter,
            "available": False,
            "reason": reason,
            "installHint": install_hint,
        },
        error={
            "code": "adapter_not_configured",
            "message": reason,
        },
    )


def _dependency_available(import_name: str) -> bool:
    if importlib.util.find_spec(import_name) is None:
        return False
    if import_name != "ifcopenshell":
        return True
    try:
        importlib.import_module(import_name)
    except ImportError:
        return False
    return True


def _python_dependency_paths(import_name: str) -> tuple[str, ...]:
    if import_name != "ifcopenshell":
        return ()
    candidates: list[Path] = []
    explicit = os.getenv("IFCOPENSHELL_PYTHONPATH", "").strip()
    if explicit:
        candidates.append(Path(explicit))
    for prefix in _ifcopenshell_prefixes():
        candidates.append(prefix / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages")
    return tuple(str(path) for path in candidates if (path / import_name).exists())


def _binary_candidates(binary: str) -> tuple[Path, ...]:
    if binary != "IfcConvert":
        return ()
    return tuple(prefix / "bin" / "IfcConvert" for prefix in _ifcopenshell_prefixes())


def _ifcopenshell_prefixes() -> tuple[Path, ...]:
    roots = [
        os.getenv("ARCHITOKEN_IFCOPENSHELL_PREFIX", "").strip(),
        str(Path(os.getenv("ARCHITOKEN_SOURCE_BUILD_ROOT", "/tmp/architoken-source-builds")) / "ifcopenshell" / "prefix"),
        "/tmp/architoken-source-builds-real/ifcopenshell/prefix",
    ]
    return tuple(Path(root) for root in roots if root)


def _runtime_library_paths() -> tuple[Path, ...]:
    explicit = os.getenv("ARCHITOKEN_SOURCE_BUILD_LIBRARY_PATH", "").strip()
    paths = [Path(path) for path in explicit.split(":") if path] if explicit else []
    for root in _source_build_roots():
        paths.append(root / "occt-7-9-1" / "prefix" / "lib")
        paths.append(root / "ifcopenshell" / "prefix" / "lib")
    return tuple(path for path in paths if path.is_dir())


def _source_build_roots() -> tuple[Path, ...]:
    configured = os.getenv("ARCHITOKEN_SOURCE_BUILD_ROOT", "").strip()
    roots = [Path(configured)] if configured else []
    roots.extend((Path("/tmp/architoken-source-builds-real"), Path("/tmp/architoken-source-builds")))
    return tuple(dict.fromkeys(roots))


def _prepare_ifcopenshell_shared_libraries() -> None:
    pending = []
    for directory in _runtime_library_paths():
        pending.extend(path for path in sorted(directory.glob("lib*.so*")) if path.is_file())
    seen: set[Path] = set()
    pending = [path for path in pending if not (path.resolve() in seen or seen.add(path.resolve()))]
    for _attempt in range(8):
        next_pending = []
        progressed = False
        for path in pending:
            try:
                ctypes.CDLL(str(path), mode=ctypes.RTLD_GLOBAL)
                progressed = True
            except OSError:
                next_pending.append(path)
        if not next_pending or not progressed:
            break
        pending = next_pending
