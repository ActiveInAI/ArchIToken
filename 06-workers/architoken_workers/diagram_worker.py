"""Diagram and chart render worker adapters."""

from __future__ import annotations

import subprocess

from .adapter_requirements import missing_binary
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, write_json_artifact


def mermaid_render(job: ConversionJob) -> WorkerResult:
    """Render flowcharts, gantt charts, and mind maps with Mermaid CLI."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="mermaid",
        binary="mmdc",
        install_hint="Install @mermaid-js/mermaid-cli in the worker image for real diagram rendering.",
    ):
        return unavailable
    diagram = str(job.input.get("diagram") or job.input.get("mermaid") or "").strip()
    if not diagram:
        raise ValueError("job.input.diagram or job.input.mermaid is required")
    out_dir = output_dir(job)
    stem = str(job.input.get("name", job.operation.value)).strip() or job.operation.value
    source = out_dir / f"{_safe_stem(stem)}.mmd"
    source.write_text(diagram, encoding="utf-8")
    formats = job.input.get("outputFormats", ["svg"])
    artifacts = [
        artifact_for_path(
            source,
            job=job,
            media_type="text/vnd.mermaid",
            role="diagram_source",
            metadata={"adapter": "mermaid", "operation": job.operation.value},
        )
    ]
    for output_format in formats:
        suffix = str(output_format).lower().lstrip(".")
        target = out_dir / f"{source.stem}.{suffix}"
        completed = subprocess.run(
            ["mmdc", "-i", str(source), "-o", str(target)],
            check=False,
            capture_output=True,
            text=True,
            timeout=int(job.input.get("timeoutSeconds", 120)),
        )
        if completed.returncode != 0:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={"code": "mermaid_render_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
                output={"adapter": "mermaid", "format": suffix},
            )
        artifacts.append(
            artifact_for_path(
                target,
                job=job,
                media_type=_media_type(suffix),
                role="diagram_render",
                metadata={"adapter": "mermaid", "operation": job.operation.value, "format": suffix},
            )
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={"adapter": "mermaid", "artifactCount": len(artifacts), "operation": job.operation.value},
    )


def chart_spec_artifact(job: ConversionJob) -> WorkerResult:
    """Persist a chart analysis/spec artifact for frontend ECharts/Vega rendering."""

    validate_job(job)
    spec = job.input.get("chartSpec") or job.input.get("echartsOption") or job.input.get("vegaLiteSpec")
    if not isinstance(spec, dict):
        raise ValueError("job.input.chartSpec, echartsOption, or vegaLiteSpec must be an object")
    artifact = write_json_artifact(
        job,
        "chart_spec.json",
        spec,
        role="chart_spec",
        metadata={"adapter": "chart_spec", "renderer": str(job.input.get("renderer", "frontend"))},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "chart_spec", "renderer": str(job.input.get("renderer", "frontend"))},
    )


def _media_type(output_format: str) -> str:
    return {
        "svg": "image/svg+xml",
        "png": "image/png",
        "pdf": "application/pdf",
    }.get(output_format, "application/octet-stream")


def _safe_stem(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in value) or "diagram"
