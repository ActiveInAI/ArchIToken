"""Command-line entrypoint for ArchIToken production workers."""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
import shutil
import sys
import urllib.request
from dataclasses import asdict
from typing import Callable

from . import ConversionJob, ConversionOperation
from .ai_generation_worker import route_generation
from .blender_worker import blender_headless_convert
from .bsdd_worker import enrich_with_bsdd
from .build123d_worker import build123d_generate
from .cad_worker import dxf_extract_entities, licensed_dwg_adapter, occt_adapter, step_metadata
from .cadquery_worker import cadquery_generate
from .cesium_worker import cesium_ion_create_asset
from .cgal_worker import cgal_generate_volume_mesh
from .diagram_worker import chart_spec_artifact, mermaid_render
from .docling_worker import docling_parse
from .document_worker import markitdown_convert, mineru_parse
from .engine_registry import ENGINE_POLICIES, policy_for_adapter, policy_manifest
from .external_app_worker import open_design_generate, siyuan_import
from .forgecad_worker import forgecad_generate
from .freecad_worker import freecad_headless_convert
from .gis_worker import geojson_ingest, postgis_index
from .ids_worker import validate_ids
from .image_worker import imagemagick_convert, opencv_analyze
from .media_worker import ffmpeg_transcode
from .ocr_worker import paddleocr_parse
from .office_worker import libreoffice_convert
from .openbim_worker import ingest_ifc
from .openbim_standards_worker import bcf_ingest, buildingsmart_validate, idm_ingest
from .panorama_worker import panorama_graph
from .pdf_worker import mupdf_adapter, pdfium_adapter, stirling_pdf_adapter
from .pointcloud_worker import pointcloud_metadata, tileset_manifest
from .runtime import WorkerRuntimeConfig
from .speckle_worker import speckle_send_metadata
from .text_to_bim_worker import ifcopenshell_text_to_bim

AdapterFn = Callable[[ConversionJob], object]


DISPATCH: dict[str, AdapterFn] = {
    "ai_provider": route_generation,
    "blender": blender_headless_convert,
    "bcf": bcf_ingest,
    "bsdd": enrich_with_bsdd,
    "build123d": build123d_generate,
    "buildingsmart_validate": buildingsmart_validate,
    "cadquery": cadquery_generate,
    "cesium_ion": cesium_ion_create_asset,
    "cgal": cgal_generate_volume_mesh,
    "chart_spec": chart_spec_artifact,
    "docling": docling_parse,
    "dxf": dxf_extract_entities,
    "dwg": licensed_dwg_adapter,
    "ffmpeg": ffmpeg_transcode,
    "forgecad": forgecad_generate,
    "freecad": freecad_headless_convert,
    "geojson": geojson_ingest,
    "ids": validate_ids,
    "idm": idm_ingest,
    "imagemagick": imagemagick_convert,
    "ifcopenshell": ingest_ifc,
    "ifcopenshell_text_to_bim": ifcopenshell_text_to_bim,
    "libreoffice": libreoffice_convert,
    "markitdown": markitdown_convert,
    "mermaid": mermaid_render,
    "mineru": mineru_parse,
    "mupdf": mupdf_adapter,
    "occt": occt_adapter,
    "open_design": open_design_generate,
    "opencv": opencv_analyze,
    "paddleocr": paddleocr_parse,
    "panorama": panorama_graph,
    "pdal": pointcloud_metadata,
    "pdfium": pdfium_adapter,
    "pointcloud_tiles": tileset_manifest,
    "postgis": postgis_index,
    "speckle": speckle_send_metadata,
    "stirling_pdf": stirling_pdf_adapter,
    "step": step_metadata,
    "siyuan": siyuan_import,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ArchIToken worker CLI")
    parser.add_argument("--job", help="Path to a worker job JSON payload")
    parser.add_argument("--adapter", help="Adapter id to execute; defaults to job.input.adapter")
    parser.add_argument("--serve", action="store_true", help="Run the NATS worker daemon")
    parser.add_argument("--self-check", action="store_true", help="Print adapter dependency readiness")
    parser.add_argument("--require-all", action="store_true", help="Fail self-check when any production adapter is missing")
    args = parser.parse_args(argv)

    if args.serve:
        return asyncio.run(serve(require_all=args.require_all))

    if args.self_check:
        checks = production_self_check()
        print(json.dumps(checks, indent=2, sort_keys=True))
        return 1 if args.require_all and not all(item["available"] for item in checks.values()) else 0

    if not args.job:
        parser.error("--job is required unless --self-check is used")
    payload = json.loads(open(args.job, encoding="utf-8").read())
    job = ConversionJob(
        job_id=str(payload["job_id"]),
        tenant_id=str(payload["tenant_id"]),
        project_id=str(payload["project_id"]),
        actor=str(payload["actor"]),
        operation=ConversionOperation(str(payload["operation"])),
        source_asset_id=str(payload["source_asset_id"]),
        source_file_id=str(payload["source_file_id"]),
        input=dict(payload.get("input", {})),
    )
    adapter = args.adapter or str(job.input.get("adapter", "")).strip()
    if adapter not in DISPATCH:
        raise SystemExit(f"unknown worker adapter: {adapter}")
    result = dispatch_job(job, adapter)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


async def serve(*, require_all: bool) -> int:
    """Run a NATS-backed worker loop."""

    checks = production_self_check()
    if require_all and not all(item["available"] for item in checks.values()):
        print(json.dumps({"status": "failed", "checks": checks}, indent=2, sort_keys=True), file=sys.stderr)
        return 1

    config = WorkerRuntimeConfig.from_env()
    import nats

    subject = os.getenv("ARCHITOKEN_WORKER_SUBJECT", "architoken.conversion.jobs")
    result_subject = os.getenv("ARCHITOKEN_WORKER_RESULT_SUBJECT", "architoken.conversion.results")
    nc = await nats.connect(config.nats_url)

    async def handle(message: object) -> None:
        raw = message.data.decode("utf-8")
        try:
            response = dispatch_payload(json.loads(raw))
        except Exception as exc:  # noqa: BLE001 - invalid queue payloads must not stop the daemon.
            response = {
                "job_id": "",
                "status": "failed",
                "error": {"code": "invalid_worker_payload", "message": str(exc)},
            }
        try:
            post_result_to_gateway(response)
        except Exception as exc:  # noqa: BLE001 - keep NATS result delivery even when HTTP callback fails.
            response["gatewayDeliveryError"] = str(exc)
        encoded = json.dumps(response, sort_keys=True).encode("utf-8")
        reply = getattr(message, "reply", "")
        if reply:
            await nc.publish(reply, encoded)
        else:
            await nc.publish(result_subject, encoded)

    await nc.subscribe(subject, cb=handle)
    print(json.dumps({"status": "ready", "subject": subject, "resultSubject": result_subject}, sort_keys=True))
    while True:
        await asyncio.sleep(3600)


def dispatch_payload(payload: dict[str, object]) -> dict[str, object]:
    """Dispatch a raw worker job payload and return a JSON-serializable result."""

    try:
        job = ConversionJob(
            job_id=str(payload["job_id"]),
            tenant_id=str(payload["tenant_id"]),
            project_id=str(payload["project_id"]),
            actor=str(payload["actor"]),
            operation=ConversionOperation(str(payload["operation"])),
            source_asset_id=str(payload["source_asset_id"]),
            source_file_id=str(payload["source_file_id"]),
            input=dict(payload.get("input", {})),
        )
    except Exception as exc:
        return {
            "job_id": str(payload.get("job_id", "")),
            "status": "failed",
            "error": {"code": "invalid_worker_payload", "message": str(exc)},
        }
    adapter = str(job.input.get("adapter", "")).strip()
    if adapter not in DISPATCH:
        return {
            "job_id": job.job_id,
            "status": "failed",
            "error": {"code": "unknown_adapter", "message": f"unknown worker adapter: {adapter}"},
        }
    if adapter not in ENGINE_POLICIES:
        return {
            "job_id": job.job_id,
            "status": "failed",
            "output": {"adapter": adapter},
            "error": {"code": "missing_isolation_policy", "message": f"adapter has no isolation policy: {adapter}"},
        }
    policy = policy_for_adapter(adapter)
    if policy and policy.isolation.value == "reference_only":
        return {
            "job_id": job.job_id,
            "status": "failed",
            "output": {"adapter": adapter, "adapterIsolation": policy.to_json()},
            "error": {"code": "adapter_reference_only", "message": f"adapter is reference-only: {adapter}"},
        }
    return dispatch_job(job, adapter)


def dispatch_job(job: ConversionJob, adapter: str) -> dict[str, object]:
    """Execute a configured adapter and attach its isolation policy."""

    try:
        response = asdict(DISPATCH[adapter](job))
        policy = policy_for_adapter(adapter)
        if policy:
            output = response.setdefault("output", {})
            if isinstance(output, dict):
                output.setdefault("adapterIsolation", policy.to_json())
        return response
    except Exception as exc:  # pragma: no cover - exercised by integration/runtime failures.
        policy = policy_for_adapter(adapter)
        output: dict[str, object] = {"adapter": adapter}
        if policy:
            output["adapterIsolation"] = policy.to_json()
        return {
            "job_id": job.job_id,
            "status": "failed",
            "output": output,
            "error": {"code": "worker_exception", "message": str(exc)},
        }


def post_result_to_gateway(response: dict[str, object]) -> None:
    """Post worker results back to the gateway when configured."""

    gateway_url = os.getenv("ARCHITOKEN_GATEWAY_URL", "").rstrip("/")
    if not gateway_url:
        return
    job_id = response.get("job_id")
    if not job_id:
        return
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    token = os.getenv("ARCHITOKEN_WORKER_RESULT_TOKEN", "")
    if token:
        headers["x-architoken-worker-token"] = token
    request = urllib.request.Request(
        f"{gateway_url}/internal/conversion-jobs/{job_id}/worker-result",
        data=json.dumps(response).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=int(os.getenv("ARCHITOKEN_WORKER_RESULT_TIMEOUT_SECONDS", "30"))) as result:
        result.read()


def production_self_check() -> dict[str, dict[str, object]]:
    """Return dependency readiness for all production engine adapters."""

    return {
        "ifcopenshell": _python_check("ifcopenshell"),
        "ifcconvert": _binary_check(os.getenv("IFCCONVERT_BINARY", "IfcConvert")),
        "ifctester": _python_check("ifctester"),
        "buildingsmart_validate": _validate_runtime_check(),
        "bsdd_api_url": _env_check("BSDD_API_URL"),
        "ezdxf": _python_check("ezdxf"),
        "cadquery": _python_check("cadquery"),
        "build123d": _python_check("build123d"),
        "occt_oCP": _python_check("OCP"),
        "freecad": _binary_check("FreeCADCmd"),
        "blender": _binary_check(os.getenv("BLENDER_BINARY", "blender")),
        "ffmpeg": _binary_check("ffmpeg"),
        "imagemagick": _binary_any_check(("magick", "convert")),
        "libreoffice": _binary_check("libreoffice"),
        "mmdc": _binary_check("mmdc"),
        "mineru": _binary_check(os.getenv("MINERU_BINARY", "mineru")),
        "pdal": _binary_check("pdal"),
        "specklepy": _python_check("specklepy"),
        "docling": _python_check("docling"),
        "markitdown": _python_check("markitdown"),
        "opencv": _python_check("cv2"),
        "paddleocr": _python_check("paddleocr"),
        "pygalmesh_cgal": _python_check("pygalmesh"),
        "speckle_server_url": _env_check("SPECKLE_SERVER_URL"),
        "speckle_token": _env_check("SPECKLE_TOKEN"),
        "cesium_ion_token": _env_check("CESIUM_ION_TOKEN"),
        "forgecad_runtime": _runtime_any_check("ForgeCAD service or CLI", env_names=("FORGECAD_URL",), binaries=("forgecad",)),
        "dwg_adapter_url": _env_check("DWG_ADAPTER_URL"),
        "stirling_pdf_url": _env_check("STIRLING_PDF_URL"),
        "open_design_url": _env_check("OPEN_DESIGN_URL"),
        "siyuan_api_url": _env_check("SIYUAN_API_URL"),
        "isolation_policies": {
            "type": "manifest",
            "name": "engine_isolation_policies",
            "available": all(adapter in ENGINE_POLICIES for adapter in DISPATCH),
            "adapters": policy_manifest(),
        },
    }


def _python_check(import_name: str) -> dict[str, object]:
    spec = importlib.util.find_spec(import_name)
    return {"type": "python", "name": import_name, "available": spec is not None}


def _binary_check(binary: str) -> dict[str, object]:
    path = shutil.which(binary)
    return {"type": "binary", "name": binary, "available": path is not None, "path": path}


def _binary_any_check(binaries: tuple[str, ...]) -> dict[str, object]:
    paths = {binary: shutil.which(binary) for binary in binaries}
    return {
        "type": "binary",
        "name": " or ".join(binaries),
        "available": any(path is not None for path in paths.values()),
        "paths": paths,
    }


def _env_check(name: str) -> dict[str, object]:
    return {"type": "env", "name": name, "available": bool(os.getenv(name, "").strip())}


def _runtime_any_check(label: str, *, env_names: tuple[str, ...], binaries: tuple[str, ...]) -> dict[str, object]:
    env = {name: bool(os.getenv(name, "").strip()) for name in env_names}
    paths = {binary: shutil.which(binary) for binary in binaries}
    return {
        "type": "runtime",
        "name": label,
        "available": any(env.values()) or any(path is not None for path in paths.values()),
        "env": env,
        "paths": paths,
    }


def _validate_runtime_check() -> dict[str, object]:
    has_service = bool(os.getenv("BUILDINGSMART_VALIDATE_URL", "").strip()) and bool(
        os.getenv("BUILDINGSMART_VALIDATE_OPERATION_PATH", "").strip()
    )
    binary = os.getenv("BUILDINGSMART_VALIDATE_BINARY", "").strip()
    has_binary = bool(binary and shutil.which(binary))
    return {
        "type": "runtime",
        "name": "buildingSMART Validate local/service route",
        "available": has_service or has_binary or importlib.util.find_spec("ifcopenshell") is not None,
        "serviceConfigured": has_service,
        "binaryConfigured": has_binary,
        "localIfcOpenShellAvailable": importlib.util.find_spec("ifcopenshell") is not None,
    }


if __name__ == "__main__":
    sys.exit(main())
