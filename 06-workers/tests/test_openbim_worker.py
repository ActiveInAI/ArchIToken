from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.bsdd_worker import enrich_with_bsdd
from architoken_workers.ids_worker import validate_ids
from architoken_workers.openbim_worker import IFC_INGEST_OUTPUTS, _bim_semantics_manifest, _ifc_derivative_manifest, ingest_ifc


def _completed_or_blocked(result, adapter: str) -> bool:
    assert result.status in {"completed", "blocked"}
    if result.status == "blocked":
        assert result.error["code"] == "adapter_not_configured"
        assert result.output["adapter"] == adapter
        assert result.output["available"] is False
        assert result.output["installHint"]
        return False
    return True


def _job(operation: ConversionOperation = ConversionOperation.IFC_INGEST) -> ConversionJob:
    return ConversionJob(
        job_id="job-openbim-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="openbim-worker-test",
        operation=operation,
        source_asset_id="asset-ifc-1",
        source_file_id="file-ifc-1",
    )


def test_ifc_ingest_outputs_required_manifests() -> None:
    result = ingest_ifc(_job())
    if _completed_or_blocked(result, "ifcopenshell"):
        assert tuple(artifact.name for artifact in result.artifacts) == IFC_INGEST_OUTPUTS
        assert "ifc_entities.jsonl" in result.output["outputs"]
        assert "ifc_quantities.jsonl" in result.output["outputs"]
        assert "ifc_classifications.jsonl" in result.output["outputs"]
        assert "bim_semantics_manifest.json" in result.output["outputs"]
        assert result.output["standard"] == "IFC4x3"
        assert result.output["derivatives"]["schema"] == "architoken.ifc_derivative_cache.v1"
        assert result.output["semantics"]["schema"] == "architoken.bim_semantics_manifest.v1"
        assert result.output["derivatives"]["sourceChecksum"]


def test_ifc_ingest_rejects_wrong_operation() -> None:
    try:
        ingest_ifc(_job(ConversionOperation.PDF_PARSE))
    except ValueError as exc:
        assert "unsupported openBIM operation" in str(exc)
    else:
        raise AssertionError("expected wrong operation to fail")


def test_ifc_derivative_operations_block_or_complete_explicitly() -> None:
    glb = ingest_ifc(_job(ConversionOperation.IFC_TO_GLB))
    tiles = ingest_ifc(_job(ConversionOperation.IFC_TO_3DTILES))

    assert glb.status in {"blocked", "completed"}
    assert tiles.status in {"blocked", "completed"}
    if glb.status == "blocked":
        assert glb.output["adapter"] == "ifcconvert"
    if tiles.status == "blocked":
        assert tiles.output["adapter"] in {"ifcconvert", "cesium_ion"}


def test_ifc_derivative_manifest_is_checksum_cache_contract() -> None:
    manifest = _ifc_derivative_manifest(
        job=_job(),
        source_path="/tmp/source.ifc",
        source_checksum="a" * 64,
        schema="IFC4X3",
        geometry_manifest={"engine": "ifcopenshell.geom", "enabled": True, "meshCount": 0},
        properties_index={"source": "ifc_properties.jsonl", "totalRows": 0, "pageSize": 500},
    )

    assert manifest["schema"] == "architoken.ifc_derivative_cache.v1"
    assert manifest["sourceChecksum"] == "a" * 64
    assert manifest["sourceOfRecord"] == "ifc_source_file"
    assert manifest["cacheKey"] == "file-ifc-1:aaaaaaaaaaaaaaaa:ifc"
    assert manifest["etag"] == 'W/"file-ifc-1:aaaaaaaaaaaaaaaa:ifc"'
    assert manifest["properties"]["etag"].endswith(":properties")
    assert {item["kind"]: item["status"] for item in manifest["derivatives"]} == {
        "glb": "pending_worker",
        "fragments": "pending_worker",
        "tiles": "pending_worker",
    }


def test_bim_semantics_manifest_blocks_openbim_claim_without_required_evidence() -> None:
    manifest = _bim_semantics_manifest(
        job=_job(),
        schema="IFC4X3",
        source_path="/tmp/source.ifc",
        source_checksum="b" * 64,
        entity_count=10,
        product_count=3,
        relationship_count=4,
        property_row_count=5,
        quantity_row_count=2,
        classification_count=1,
        spatial_tree={"projectCount": 1, "roots": []},
        geometry_manifest={"engine": "ifcopenshell.geom", "enabled": True, "meshCount": 3, "failureCount": 0},
        derivative_manifest={"sourceOfRecord": "ifc_source_file", "cacheKey": "file-ifc-1:bbbbbbbbbbbbbbbb:ifc"},
    )

    assert manifest["schema"] == "architoken.bim_semantics_manifest.v1"
    assert manifest["semanticLayers"]["quantitySets"]["artifact"] == "ifc_quantities.jsonl"
    assert manifest["semanticLayers"]["classificationLinks"]["artifact"] == "ifc_classifications.jsonl"
    assert manifest["requiredEvidence"]["idsValidation"]["status"] == "required_pending"
    assert manifest["openBimClaim"]["status"] == "blocked_pending_required_evidence"
    assert manifest["openBimClaim"]["mayClaimBuildingSmartOpenBim"] is False
    assert manifest["openBimClaim"]["mayEnterBuildingSmartOpenBimReview"] is False


def test_bim_semantics_manifest_allows_openbim_review_when_evidence_is_linked() -> None:
    job = ConversionJob(
        job_id="job-openbim-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="openbim-worker-test",
        operation=ConversionOperation.IFC_INGEST,
        source_asset_id="asset-ifc-1",
        source_file_id="file-ifc-1",
        input={
            "openbimEvidence": {
                "idsValidation": {"objectKey": "workers/job/ids_validation_report.json"},
                "buildingSmartValidate": {"objectKey": "workers/job/buildingsmart_validate_report.json"},
                "bsddClassification": {"objectKey": "workers/job/bsdd_classification_report.json"},
                "bcfIssueClosure": {"objectKey": "workers/job/bcf_manifest.json"},
                "idmExchangeRequirements": {"objectKey": "workers/job/idm_manifest.json"},
                "approvalAuditChain": {"objectKey": "workers/job/approval_audit_chain.json"},
                "fullChainSampleValidation": {"objectKey": "workers/job/openbim_full_chain_sample_report.json"},
                "openCdeApiContract": {"objectKey": "workers/job/opencde_api_contract_report.json"},
            }
        },
    )
    manifest = _bim_semantics_manifest(
        job=job,
        schema="IFC4X3",
        source_path="/tmp/source.ifc",
        source_checksum="b" * 64,
        entity_count=10,
        product_count=3,
        relationship_count=4,
        property_row_count=5,
        quantity_row_count=2,
        classification_count=1,
        spatial_tree={"projectCount": 1, "roots": []},
        geometry_manifest={"engine": "ifcopenshell.geom", "enabled": True, "meshCount": 3, "failureCount": 0},
        derivative_manifest={"sourceOfRecord": "ifc_source_file", "cacheKey": "file-ifc-1:bbbbbbbbbbbbbbbb:ifc"},
    )

    assert manifest["openBimClaim"]["status"] == "ready_for_openbim_review"
    assert manifest["openBimClaim"]["mayEnterBuildingSmartOpenBimReview"] is True
    assert manifest["openBimClaim"]["mayClaimBuildingSmartOpenBim"] is False
    assert manifest["openBimClaim"]["missingEvidence"] == []
    assert manifest["openBimClaim"]["missingClaimEvidence"] == ["buildingSmartCertification"]


def test_bim_semantics_manifest_authorizes_claim_with_certification_evidence() -> None:
    job = ConversionJob(
        job_id="job-openbim-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="openbim-worker-test",
        operation=ConversionOperation.IFC_INGEST,
        source_asset_id="asset-ifc-1",
        source_file_id="file-ifc-1",
        input={
            "openbimEvidence": {
                "idsValidation": {"objectKey": "workers/job/ids_validation_report.json"},
                "buildingSmartValidate": {"objectKey": "workers/job/buildingsmart_validate_report.json"},
                "bsddClassification": {"objectKey": "workers/job/bsdd_classification_report.json"},
                "bcfIssueClosure": {"objectKey": "workers/job/bcf_manifest.json"},
                "idmExchangeRequirements": {"objectKey": "workers/job/idm_manifest.json"},
                "approvalAuditChain": {"objectKey": "workers/job/approval_audit_chain.json"},
                "fullChainSampleValidation": {"objectKey": "workers/job/openbim_full_chain_sample_report.json"},
                "openCdeApiContract": {"objectKey": "workers/job/opencde_api_contract_report.json"},
                "buildingSmartCertification": {"objectKey": "workers/job/buildingsmart_certification_report.json"},
            }
        },
    )
    manifest = _bim_semantics_manifest(
        job=job,
        schema="IFC4X3",
        source_path="/tmp/source.ifc",
        source_checksum="b" * 64,
        entity_count=10,
        product_count=3,
        relationship_count=4,
        property_row_count=5,
        quantity_row_count=2,
        classification_count=1,
        spatial_tree={"projectCount": 1, "roots": []},
        geometry_manifest={"engine": "ifcopenshell.geom", "enabled": True, "meshCount": 3, "failureCount": 0},
        derivative_manifest={"sourceOfRecord": "ifc_source_file", "cacheKey": "file-ifc-1:bbbbbbbbbbbbbbbb:ifc"},
    )

    assert manifest["openBimClaim"]["status"] == "buildingSMART_openBIM_claim_authorized"
    assert manifest["openBimClaim"]["mayEnterBuildingSmartOpenBimReview"] is True
    assert manifest["openBimClaim"]["mayClaimBuildingSmartOpenBim"] is True
    assert manifest["requiredEvidence"]["buildingSmartCertification"]["scope"] == "claim"


def test_bsdd_and_ids_worker_adapters() -> None:
    bsdd = enrich_with_bsdd(_job())
    ids = validate_ids(_job())
    assert bsdd.output["networkPolicy"] == "scheduled_explicit_only"
    assert ids.output["standard"] == "IDS"
    assert ids.output["passed"] is None
    assert ids.artifacts[0].name == "ids_validation_report.json"
