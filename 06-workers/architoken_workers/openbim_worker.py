"""openBIM worker adapters backed by IfcOpenShell."""

from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from typing import Any

from .adapter_requirements import missing_binary, missing_env, missing_python_dependency, resolve_binary, source_build_runtime_env
from .cesium_worker import complete_cesium_asset_upload
from .contract import ConversionJob, ConversionOperation, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, file_sha256, output_dir, require_source_file, write_json_artifact, write_jsonl_artifact

IFC_INGEST_OUTPUTS = (
    "ifc_entities.jsonl",
    "ifc_relationships.jsonl",
    "ifc_properties.jsonl",
    "ifc_quantities.jsonl",
    "ifc_classifications.jsonl",
    "ifc_properties_index.json",
    "ifc_spatial_tree.json",
    "geometry_manifest.json",
    "ifc_derivative_manifest.json",
    "bim_semantics_manifest.json",
    "model_manifest.json",
)

DEFAULT_PROPERTY_PAGE_SIZE = 500


def ingest_ifc(job: ConversionJob) -> WorkerResult:
    """Parse an IFC file with IfcOpenShell and emit production ingestion artifacts."""

    validate_job(job)
    if job.operation == ConversionOperation.IFC_TO_GLB:
        return convert_ifc_to_glb(job)
    if job.operation == ConversionOperation.IFC_TO_3DTILES:
        return convert_ifc_to_3dtiles(job)
    if job.operation != ConversionOperation.IFC_INGEST:
        raise ValueError(f"unsupported openBIM operation: {job.operation}")
    if unavailable := missing_python_dependency(
        job,
        adapter="ifcopenshell",
        import_name="ifcopenshell",
        install_hint="Install IfcOpenShell in the worker image and mount source IFC bytes from object storage.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="ifcopenshell",
        install_hint="Mount the source IFC file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked

    import ifcopenshell

    model = ifcopenshell.open(str(source))
    schema = str(getattr(model, "schema", "IFC")).upper()
    products = list(model.by_type("IfcProduct"))
    rows = _entity_rows(model)
    relationships = _relationship_rows(model)
    properties = _property_rows(products)
    quantities = _quantity_rows(products)
    classifications = _classification_rows(model)
    properties_index = _properties_index(job, properties)
    spatial_tree = _spatial_tree(model)
    geometry_manifest = _geometry_manifest(job, products)
    derivative_manifest = _ifc_derivative_manifest(
        job=job,
        source_path=str(source),
        source_checksum=file_sha256(source),
        schema=schema,
        geometry_manifest=geometry_manifest,
        properties_index=properties_index,
    )
    semantic_manifest = _bim_semantics_manifest(
        job=job,
        schema=schema,
        source_path=str(source),
        source_checksum=derivative_manifest["sourceChecksum"],
        entity_count=len(rows),
        product_count=len(products),
        relationship_count=len(relationships),
        property_row_count=len(properties),
        quantity_row_count=len(quantities),
        classification_count=len(classifications),
        spatial_tree=spatial_tree,
        geometry_manifest=geometry_manifest,
        derivative_manifest=derivative_manifest,
    )
    model_manifest = {
        "schema": schema,
        "sourcePath": str(source),
        "entityCount": len(rows),
        "productCount": len(products),
        "relationshipCount": len(relationships),
        "propertyRowCount": len(properties),
        "quantityRowCount": len(quantities),
        "classificationCount": len(classifications),
        "parser": "ifcopenshell",
        "semantics": semantic_manifest,
        "derivatives": derivative_manifest,
        "propertiesIndex": properties_index,
    }
    artifacts = (
        write_jsonl_artifact(job, "ifc_entities.jsonl", rows, role="ifc_entities", metadata={"standard": schema}),
        write_jsonl_artifact(
            job,
            "ifc_relationships.jsonl",
            relationships,
            role="ifc_relationships",
            metadata={"standard": schema},
        ),
        write_jsonl_artifact(job, "ifc_properties.jsonl", properties, role="ifc_properties", metadata={"standard": schema}),
        write_jsonl_artifact(job, "ifc_quantities.jsonl", quantities, role="ifc_quantities", metadata={"standard": schema}),
        write_jsonl_artifact(
            job,
            "ifc_classifications.jsonl",
            classifications,
            role="ifc_classifications",
            metadata={"standard": schema},
        ),
        write_json_artifact(
            job,
            "ifc_properties_index.json",
            properties_index,
            role="ifc_properties_index",
            metadata={"standard": schema, "pageSize": properties_index["pageSize"]},
        ),
        write_json_artifact(job, "ifc_spatial_tree.json", spatial_tree, role="spatial_tree", metadata={"standard": schema}),
        write_json_artifact(
            job,
            "geometry_manifest.json",
            geometry_manifest,
            role="geometry_manifest",
            metadata={"standard": schema},
        ),
        write_json_artifact(
            job,
            "ifc_derivative_manifest.json",
            derivative_manifest,
            role="ifc_derivative_manifest",
            metadata={"standard": schema, "cachePolicy": "etag"},
        ),
        write_json_artifact(
            job,
            "bim_semantics_manifest.json",
            semantic_manifest,
            role="bim_semantics_manifest",
            metadata={"standard": schema, "claimStatus": semantic_manifest["openBimClaim"]["status"]},
        ),
        write_json_artifact(job, "model_manifest.json", model_manifest, role="model_manifest", metadata={"standard": schema}),
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=artifacts,
        output={
            "standard": schema,
            "outputs": list(IFC_INGEST_OUTPUTS),
            "parser": "ifcopenshell",
            "sourcePath": str(source),
            "entityCount": len(rows),
            "productCount": len(products),
            "relationshipCount": len(relationships),
            "propertyRowCount": len(properties),
            "quantityRowCount": len(quantities),
            "classificationCount": len(classifications),
            "semantics": semantic_manifest,
            "geometry": geometry_manifest,
            "propertiesIndex": properties_index,
            "derivatives": derivative_manifest,
        },
    )


def convert_ifc_to_glb(job: ConversionJob) -> WorkerResult:
    """Convert IFC to GLB with IfcOpenShell IfcConvert."""

    validate_job(job)
    artifact_result = _ifc_convert_glb_artifact(job)
    if isinstance(artifact_result, WorkerResult):
        return artifact_result
    artifact, target, source = artifact_result
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "adapter": "ifcopenshell",
            "engine": "IfcConvert",
            "converted": True,
            "sourcePath": str(source),
            "targetPath": str(target),
            "format": "glb",
        },
    )


def convert_ifc_to_3dtiles(job: ConversionJob) -> WorkerResult:
    """Convert IFC to GLB and create a Cesium ion 3D Tiles asset manifest."""

    validate_job(job)
    artifact_result = _ifc_convert_glb_artifact(job)
    if isinstance(artifact_result, WorkerResult):
        return artifact_result
    if unavailable := missing_env(
        job,
        adapter="cesium_ion",
        name="CESIUM_ION_TOKEN",
        install_hint="Configure CESIUM_ION_TOKEN so IFC-derived GLB can be tiled by Cesium ion.",
    ):
        return unavailable

    glb_artifact, glb_path, source = artifact_result
    base_url = os.getenv("CESIUM_ION_API_URL", "https://api.cesium.com").rstrip("/")
    payload = {
        "name": str(job.input.get("name", source.stem)),
        "description": str(job.input.get("description", f"ArchIToken IFC tiling job {job.job_id}")),
        "type": "3DTILES",
        "options": {"sourceType": "3D_MODEL"},
    }
    request = urllib.request.Request(
        f"{base_url}/v1/assets",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {os.environ['CESIUM_ION_TOKEN']}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 120))) as response:
        asset_response = json.loads(response.read().decode("utf-8"))
    upload_result = complete_cesium_asset_upload(
        asset_response,
        glb_path,
        timeout_seconds=int(job.input.get("timeoutSeconds", 600)),
    )
    manifest = write_json_artifact(
        job,
        "ifc_3dtiles_manifest.json",
        {
            "request": payload,
            "response": asset_response,
            "sourcePath": str(source),
            "glbPath": str(glb_path),
            "upload": upload_result,
        },
        role="cesium_ion_asset_manifest",
        metadata={"adapter": "cesium_ion", "engine": "IfcConvert"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(glb_artifact, manifest),
        output={
            "adapter": "ifcopenshell",
            "engine": "IfcConvert",
            "cesiumAssetId": asset_response.get("assetMetadata", {}).get("id") or asset_response.get("id"),
            "sourcePath": str(source),
            "glbPath": str(glb_path),
            "upload": upload_result,
        },
    )


def _ifc_convert_glb_artifact(job: ConversionJob) -> tuple[WorkerArtifact, Any, Any] | WorkerResult:
    binary = os.getenv("IFCCONVERT_BINARY", "IfcConvert")
    if unavailable := missing_binary(
        job,
        adapter="ifcconvert",
        binary=binary,
        install_hint="Install IfcOpenShell IfcConvert in the worker image for IFC geometry conversion.",
    ):
        return unavailable
    resolved_binary = resolve_binary(binary) or binary
    source, blocked = require_source_file(
        job,
        adapter="ifcconvert",
        install_hint="Mount the source IFC file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    target = output_dir(job) / f"{source.stem}.glb"
    completed = subprocess.run(
        [resolved_binary, str(source), str(target)],
        check=False,
        capture_output=True,
        env=source_build_runtime_env(),
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 600)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "ifcconvert_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"adapter": "ifcconvert", "sourcePath": str(source), "targetPath": str(target)},
        )
    artifact = artifact_for_path(
        target,
        job=job,
        media_type="model/gltf-binary",
        role="ifc_glb",
        metadata={"engine": "IfcConvert", "sourcePath": str(source)},
    )
    return artifact, target, source


def _entity_rows(model: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for entity in model:
        rows.append(
            {
                "stepId": entity.id(),
                "type": entity.is_a(),
                "globalId": getattr(entity, "GlobalId", None),
                "name": getattr(entity, "Name", None),
                "attributes": _json_safe(entity.get_info(recursive=False)),
            }
        )
    return rows


def _relationship_rows(model: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for rel in model.by_type("IfcRelationship"):
        rows.append(
            {
                "stepId": rel.id(),
                "type": rel.is_a(),
                "globalId": getattr(rel, "GlobalId", None),
                "name": getattr(rel, "Name", None),
                "attributes": _json_safe(rel.get_info(recursive=False)),
            }
        )
    return rows


def _property_rows(products: list[Any]) -> list[dict[str, Any]]:
    import ifcopenshell.util.element

    rows: list[dict[str, Any]] = []
    for product in products:
        try:
            psets = ifcopenshell.util.element.get_psets(product, psets_only=True) or {}
        except TypeError:
            psets = {
                name: values
                for name, values in (ifcopenshell.util.element.get_psets(product) or {}).items()
                if not str(name).startswith("Qto_")
            }
        for pset_name, values in psets.items():
            if not isinstance(values, dict):
                continue
            for name, value in values.items():
                if name == "id":
                    continue
                rows.append(
                    {
                        "stepId": product.id(),
                        "globalId": getattr(product, "GlobalId", None),
                        "elementType": product.is_a(),
                        "propertySet": pset_name,
                        "name": name,
                        "value": _json_safe(value),
                    }
                )
    return rows


def _quantity_rows(products: list[Any]) -> list[dict[str, Any]]:
    import ifcopenshell.util.element

    rows: list[dict[str, Any]] = []
    for product in products:
        try:
            qtos = ifcopenshell.util.element.get_psets(product, qtos_only=True) or {}
        except TypeError:
            qtos = {
                name: values
                for name, values in (ifcopenshell.util.element.get_psets(product) or {}).items()
                if str(name).startswith("Qto_")
            }
        for quantity_set, values in qtos.items():
            if not isinstance(values, dict):
                continue
            for name, value in values.items():
                if name == "id":
                    continue
                rows.append(
                    {
                        "stepId": product.id(),
                        "globalId": getattr(product, "GlobalId", None),
                        "elementType": product.is_a(),
                        "quantitySet": quantity_set,
                        "name": name,
                        "value": _json_safe(value),
                    }
                )
    return rows


def _classification_rows(model: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for rel in model.by_type("IfcRelAssociatesClassification"):
        classification = getattr(rel, "RelatingClassification", None)
        classification_info = _classification_info(classification)
        for related in getattr(rel, "RelatedObjects", []) or []:
            rows.append(
                {
                    "relationshipStepId": rel.id(),
                    "relationshipGlobalId": getattr(rel, "GlobalId", None),
                    "elementStepId": related.id() if hasattr(related, "id") else None,
                    "elementGlobalId": getattr(related, "GlobalId", None),
                    "elementType": related.is_a() if hasattr(related, "is_a") else None,
                    "classification": classification_info,
                }
            )
    return rows


def _classification_info(classification: Any) -> dict[str, Any]:
    if classification is None:
        return {"type": None}
    referenced_source = getattr(classification, "ReferencedSource", None)
    return {
        "stepId": classification.id() if hasattr(classification, "id") else None,
        "type": classification.is_a() if hasattr(classification, "is_a") else None,
        "name": getattr(classification, "Name", None),
        "identification": getattr(classification, "Identification", None)
        or getattr(classification, "ItemReference", None),
        "location": getattr(classification, "Location", None),
        "source": {
            "stepId": referenced_source.id() if hasattr(referenced_source, "id") else None,
            "type": referenced_source.is_a() if hasattr(referenced_source, "is_a") else None,
            "name": getattr(referenced_source, "Name", None),
            "source": getattr(referenced_source, "Source", None),
            "edition": getattr(referenced_source, "Edition", None),
            "location": getattr(referenced_source, "Location", None),
        }
        if referenced_source is not None
        else None,
    }


def _spatial_tree(model: Any) -> dict[str, Any]:
    projects = list(model.by_type("IfcProject"))
    return {
        "roots": [_spatial_node(project) for project in projects],
        "projectCount": len(projects),
    }


def _spatial_node(entity: Any) -> dict[str, Any]:
    children: list[dict[str, Any]] = []
    for rel in getattr(entity, "IsDecomposedBy", []) or []:
        for child in getattr(rel, "RelatedObjects", []) or []:
            children.append(_spatial_node(child))
    for rel in getattr(entity, "ContainsElements", []) or []:
        for child in getattr(rel, "RelatedElements", []) or []:
            children.append(_spatial_node(child))
    return {
        "stepId": entity.id(),
        "type": entity.is_a(),
        "globalId": getattr(entity, "GlobalId", None),
        "name": getattr(entity, "Name", None),
        "children": children,
    }


def _geometry_manifest(job: ConversionJob, products: list[Any]) -> dict[str, Any]:
    if job.input.get("generateGeometry", True) is False:
        return {"engine": "ifcopenshell.geom", "enabled": False, "meshCount": 0, "failures": []}

    import ifcopenshell.geom

    settings = ifcopenshell.geom.settings()
    if hasattr(settings, "USE_WORLD_COORDS"):
        settings.set(settings.USE_WORLD_COORDS, True)
    limit = int(job.input.get("maxGeometryElements", 1000))
    mesh_count = 0
    failures: list[dict[str, Any]] = []
    for element in products[:limit]:
        if not getattr(element, "Representation", None):
            continue
        try:
            shape = ifcopenshell.geom.create_shape(settings, element)
            if getattr(shape, "geometry", None) is not None:
                mesh_count += 1
        except Exception as exc:  # noqa: BLE001 - native geometry failures must be reported per element.
            failures.append(
                {
                    "stepId": element.id(),
                    "globalId": getattr(element, "GlobalId", None),
                    "type": element.is_a(),
                    "error": str(exc),
                }
            )
    return {
        "engine": "ifcopenshell.geom",
        "enabled": True,
        "meshCount": mesh_count,
        "attemptedElements": min(len(products), limit),
        "failureCount": len(failures),
        "failures": failures[:100],
    }


def _properties_index(job: ConversionJob, properties: list[dict[str, Any]]) -> dict[str, Any]:
    page_size = int(job.input.get("propertyPageSize", DEFAULT_PROPERTY_PAGE_SIZE))
    page_size = max(50, min(page_size, 5000))
    total_rows = len(properties)
    pages = []
    for page_index, start in enumerate(range(0, total_rows, page_size), start=1):
        end = min(start + page_size, total_rows)
        pages.append(
            {
                "page": page_index,
                "rowStart": start,
                "rowEnd": end,
                "rowCount": end - start,
                "source": "ifc_properties.jsonl",
                "query": {"offset": start, "limit": page_size},
            }
        )
    return {
        "format": "jsonl-page-index",
        "source": "ifc_properties.jsonl",
        "totalRows": total_rows,
        "pageSize": page_size,
        "totalPages": len(pages),
        "pages": pages,
        "cache": {
            "policy": "stream+etag",
            "sourceFileId": job.source_file_id,
            "sourceAssetId": job.source_asset_id,
            "sourceChecksum": job.input.get("sourceChecksum") or job.input.get("source_checksum"),
        },
    }


def _ifc_derivative_manifest(
    *,
    job: ConversionJob,
    source_path: str,
    source_checksum: str | None,
    schema: str,
    geometry_manifest: dict[str, Any],
    properties_index: dict[str, Any],
) -> dict[str, Any]:
    glb_key = job.input.get("glbObjectKey")
    fragments_key = job.input.get("fragmentsObjectKey")
    tiles_key = job.input.get("tilesetObjectKey") or job.input.get("tilesetUrl")
    checksum = source_checksum or job.input.get("sourceChecksum") or job.input.get("source_checksum")
    checksum_text = str(checksum) if checksum else None
    cache_key = (
        f"{job.source_file_id}:{checksum_text[:16]}:ifc"
        if checksum_text
        else f"{job.source_file_id}:unversioned:ifc"
    )
    etag = f'W/"{cache_key}"'
    return {
        "schema": "architoken.ifc_derivative_cache.v1",
        "standard": schema,
        "sourceFileId": job.source_file_id,
        "sourceAssetId": job.source_asset_id,
        "sourcePath": source_path,
        "sourceChecksum": checksum_text,
        "sourceOfRecord": "ifc_source_file",
        "cacheKey": cache_key,
        "etag": etag,
        "cachePolicy": "stream+etag",
        "cacheHit": bool(job.input.get("cacheHit", False)),
        "geometry": geometry_manifest,
        "properties": {
            "status": "ready",
            "index": "ifc_properties_index.json",
            "source": properties_index["source"],
            "totalRows": properties_index["totalRows"],
            "pageSize": properties_index["pageSize"],
            "etag": f'{etag}:properties',
        },
        "derivatives": [
            {
                "kind": "glb",
                "status": "ready" if glb_key else "pending_worker",
                "objectKey": glb_key,
                "format": "model/gltf-binary",
                "preferredViewer": "threejs",
                "workerOperation": "ifc_to_glb",
            },
            {
                "kind": "fragments",
                "status": "ready" if fragments_key else "pending_worker",
                "objectKey": fragments_key,
                "format": "thatopen-fragments",
                "preferredViewer": "thatopen",
                "workerOperation": "ifc_ingest",
            },
            {
                "kind": "tiles",
                "status": "ready" if tiles_key else "pending_worker",
                "objectKey": tiles_key,
                "format": "3dtiles",
                "preferredViewer": "cesium",
                "workerOperation": "ifc_to_3dtiles",
            },
        ],
    }


def _bim_semantics_manifest(
    *,
    job: ConversionJob,
    schema: str,
    source_path: str,
    source_checksum: str | None,
    entity_count: int,
    product_count: int,
    relationship_count: int,
    property_row_count: int,
    quantity_row_count: int,
    classification_count: int,
    spatial_tree: dict[str, Any],
    geometry_manifest: dict[str, Any],
    derivative_manifest: dict[str, Any],
) -> dict[str, Any]:
    semantic_layers = {
        "ifcSourceAndSchema": _ready_layer("model_manifest.json", schemaRef=schema, sourcePath=source_path),
        "entityGraph": _ready_layer("ifc_entities.jsonl", count=entity_count),
        "relationshipGraph": _ready_layer("ifc_relationships.jsonl", count=relationship_count),
        "spatialStructure": _ready_layer(
            "ifc_spatial_tree.json",
            projectCount=spatial_tree.get("projectCount", 0),
        ),
        "propertySets": _ready_layer("ifc_properties.jsonl", count=property_row_count),
        "quantitySets": _ready_layer("ifc_quantities.jsonl", count=quantity_row_count),
        "classificationLinks": _ready_layer("ifc_classifications.jsonl", count=classification_count),
        "geometryExpression": {
            "status": "ready" if geometry_manifest.get("enabled") else "disabled",
            "artifact": "geometry_manifest.json",
            "engine": geometry_manifest.get("engine"),
            "meshCount": geometry_manifest.get("meshCount", 0),
            "failureCount": geometry_manifest.get("failureCount", 0),
        },
        "derivativeCache": {
            "status": "ready",
            "artifact": "ifc_derivative_manifest.json",
            "sourceOfRecord": derivative_manifest.get("sourceOfRecord"),
            "cacheKey": derivative_manifest.get("cacheKey"),
        },
    }
    evidence = {
        "idsValidation": _external_evidence(
            job,
            "idsValidation",
            "ids_validation_report.json",
            "IDS validation report is required before claiming buildingSMART openBIM compliance.",
            scope="review",
        ),
        "buildingSmartValidate": _external_evidence(
            job,
            "buildingSmartValidate",
            "buildingsmart_validate_report.json",
            "Official buildingSMART Validate service or CLI evidence is required before claiming IFC syntax/schema/normative validation.",
            scope="review",
        ),
        "bsddClassification": _external_evidence(
            job,
            "bsddClassification",
            "bsdd_classification_report.json",
            "bSDD or approved standard-dictionary mapping evidence is required for semantic terms and URI mappings.",
            scope="review",
        ),
        "bcfIssueClosure": _external_evidence(
            job,
            "bcfIssueClosure",
            "bcf_manifest.json",
            "BCF-compatible issue, clash, viewpoint, responsibility, and closure evidence is required.",
            scope="review",
        ),
        "idmExchangeRequirements": _external_evidence(
            job,
            "idmExchangeRequirements",
            "idm_manifest.json",
            "IDM exchange requirements are required to prove who exchanges what information and when.",
            scope="review",
        ),
        "approvalAuditChain": _external_evidence(
            job,
            "approvalAuditChain",
            "approval_audit_chain.json",
            "Approval, version, responsible party, close-state, and audit-chain evidence is required.",
            scope="review",
        ),
        "fullChainSampleValidation": _external_evidence(
            job,
            "fullChainSampleValidation",
            "openbim_full_chain_sample_report.json",
            "A real project IFC+IDS+bSDD+BCF+IDM full-chain sample validation report is required.",
            scope="review",
        ),
        "openCdeApiContract": _external_evidence(
            job,
            "openCdeApiContract",
            "opencde_api_contract_report.json",
            "OpenCDE Foundation/Documents, BCF API, and Dictionaries API end-to-end contract evidence is required.",
            scope="review",
        ),
        "buildingSmartCertification": _external_evidence(
            job,
            "buildingSmartCertification",
            "buildingsmart_certification_report.json",
            "Official buildingSMART certification or conformance-report evidence is required before external claim.",
            scope="claim",
        ),
    }
    missing = [name for name, item in evidence.items() if item["scope"] == "review" and item["status"] != "ready"]
    missing_claim = [name for name, item in evidence.items() if item["scope"] == "claim" and item["status"] != "ready"]
    may_enter_review = not missing
    may_claim = may_enter_review and not missing_claim
    claim_status = (
        "buildingSMART_openBIM_claim_authorized"
        if may_claim
        else "ready_for_openbim_review"
        if may_enter_review
        else "blocked_pending_required_evidence"
    )
    return {
        "schema": "architoken.bim_semantics_manifest.v1",
        "standard": schema,
        "sourceOfRecord": "ifc_source_file",
        "sourceFileId": job.source_file_id,
        "sourceAssetId": job.source_asset_id,
        "sourcePath": source_path,
        "sourceChecksum": source_checksum,
        "modelIdentity": {
            "tenantId": job.tenant_id,
            "projectId": job.project_id,
            "jobId": job.job_id,
            "actor": job.actor,
            "ifcSchema": schema,
            "productCount": product_count,
        },
        "semanticLayers": semantic_layers,
        "requiredEvidence": evidence,
        "openBimClaim": {
            "status": claim_status,
            "mayEnterBuildingSmartOpenBimReview": may_enter_review,
            "mayClaimBuildingSmartOpenBim": may_claim,
            "claimAuthority": "Approver may issue an external claim only after review evidence, official buildingSMART certification/conformance evidence, and audit closure are linked.",
            "missingEvidence": missing,
            "missingClaimEvidence": missing_claim,
            "rule": "IFC semantic extraction is necessary but not sufficient; IDS, official buildingSMART Validate, bSDD/standard dictionary, BCF/issue closure, IDM, approval/audit, real full-chain sample, and OpenCDE/API contract evidence must be linked before review. External buildingSMART claims also require official certification or conformance-report evidence.",
        },
    }


def _ready_layer(artifact: str, **metadata: Any) -> dict[str, Any]:
    return {"status": "ready", "artifact": artifact, **metadata}


def _external_evidence(job: ConversionJob, key: str, artifact: str, reason: str, *, scope: str) -> dict[str, Any]:
    raw_evidence = job.input.get("openbimEvidence") or job.input.get("openBimEvidence") or {}
    evidence = raw_evidence if isinstance(raw_evidence, dict) else {}
    entry = evidence.get(key) if isinstance(evidence.get(key), dict) else {}
    object_key = (
        entry.get("objectKey")
        or entry.get("object_key")
        or job.input.get(f"{key}ObjectKey")
        or job.input.get(f"{key}_object_key")
    )
    path = entry.get("path") or job.input.get(f"{key}Path") or job.input.get(f"{key}_path")
    uri = entry.get("uri") or job.input.get(f"{key}Uri") or job.input.get(f"{key}_uri")
    status = "ready" if object_key or path or uri else "required_pending"
    payload = {
        "status": status,
        "artifact": artifact,
        "required": True,
        "scope": scope,
        "reason": None if status == "ready" else reason,
    }
    if object_key:
        payload["objectKey"] = str(object_key)
    if path:
        payload["path"] = str(path)
    if uri:
        payload["uri"] = str(uri)
    return payload


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    if hasattr(value, "id") and hasattr(value, "is_a"):
        return {"stepId": value.id(), "type": value.is_a(), "globalId": getattr(value, "GlobalId", None)}
    return str(value)
