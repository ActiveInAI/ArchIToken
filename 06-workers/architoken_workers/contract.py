"""Shared worker contract types for ArchIToken Phase 7."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ConversionOperation(StrEnum):
    """Supported conversion operation ids."""

    IFC_INGEST = "ifc_ingest"
    IFC_TO_GLB = "ifc_to_glb"
    IFC_TO_3DTILES = "ifc_to_3dtiles"
    OPENBIM_VALIDATE = "openbim_validate"
    BCF_INGEST = "bcf_ingest"
    IDM_INGEST = "idm_ingest"
    BSDD_ENRICH = "bsdd_enrich"
    IFCDB_INDEX = "ifcdb_index"
    IFCDB_QUERY = "ifcdb_query"
    IFCDB_EXPORT = "ifcdb_export"
    IFCDB_CLASH = "ifcdb_clash"
    IFCDB_QUANTITY = "ifcdb_quantity"
    CAD_CONVERT = "cad_convert"
    CAD_EXTRACT_ENTITIES = "cad_extract_entities"
    PDF_PARSE = "pdf_parse"
    OCR = "ocr"
    OFFICE_CONVERT = "office_convert"
    GIS_TILE = "gis_tile"
    POINTCLOUD_TILE = "pointcloud_tile"
    PANORAMA_INGEST = "panorama_ingest"
    MEDIA_TRANSCODE = "media_transcode"
    IMAGE_GENERATE = "image_generate"
    AUDIO_GENERATE = "audio_generate"
    VIDEO_GENERATE = "video_generate"
    DRAWING_GENERATE = "drawing_generate"
    MODEL_GENERATE = "model_generate"
    BIM_GENERATE = "bim_generate"
    DOCUMENT_GENERATE = "document_generate"
    TABLE_GENERATE = "table_generate"
    GANTT_GENERATE = "gantt_generate"
    FLOW_GENERATE = "flow_generate"
    MINDMAP_GENERATE = "mindmap_generate"


@dataclass(frozen=True)
class ConversionJob:
    """Worker input payload copied from the Rust conversion-job API."""

    job_id: str
    tenant_id: str
    project_id: str
    actor: str
    operation: ConversionOperation
    source_asset_id: str
    source_file_id: str
    input: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class WorkerArtifact:
    """One output file or manifest produced by a worker."""

    name: str
    media_type: str
    role: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class WorkerResult:
    """Worker result returned to the runtime API for persistence and audit."""

    job_id: str
    status: str
    artifacts: tuple[WorkerArtifact, ...] = ()
    output: dict[str, Any] = field(default_factory=dict)
    error: dict[str, Any] = field(default_factory=dict)


def validate_job(job: ConversionJob) -> None:
    """Validate required context and source ids."""

    required = {
        "job_id": job.job_id,
        "tenant_id": job.tenant_id,
        "project_id": job.project_id,
        "actor": job.actor,
        "source_asset_id": job.source_asset_id,
        "source_file_id": job.source_file_id,
    }
    missing = [name for name, value in required.items() if not value.strip()]
    if missing:
        raise ValueError(f"missing required worker context fields: {', '.join(missing)}")
