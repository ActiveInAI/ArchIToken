from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.openbim_evidence_worker import build_openbim_evidence_report
from architoken_workers.worker_cli import DISPATCH


def _job(input_payload: dict) -> ConversionJob:
    return ConversionJob(
        job_id="job-openbim-evidence-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="openbim-evidence-test",
        operation=ConversionOperation.DOCUMENT_GENERATE,
        source_asset_id="asset-openbim-1",
        source_file_id="file-openbim-1",
        input=input_payload,
    )


def test_full_chain_sample_report_requires_ifc_ids_bsdd_bcf_idm(tmp_path) -> None:
    source = tmp_path / "sample.ifc"
    source.write_text("ISO-10303-21;\nEND-ISO-10303-21;\n", encoding="utf-8")

    result = build_openbim_evidence_report(
        _job(
            {
                "reportKind": "full_chain_sample_validation",
                "sourcePath": str(source),
                "chainArtifacts": {
                    "ifc": "sample.ifc",
                    "ids": "handover.ids",
                    "bsdd": "bsdd_classification_report.json",
                    "bcf": "issues.bcfzip",
                    "idm": "idm_manifest.json",
                },
            }
        )
    )

    assert result.status == "completed"
    assert result.output["passed"] is True
    assert result.artifacts[0].name == "openbim_full_chain_sample_report.json"


def test_opencde_api_contract_report_covers_required_contracts() -> None:
    result = build_openbim_evidence_report(
        _job(
            {
                "reportKind": "opencde_api_contract",
                "contracts": ["foundation", "documents", "bcf", "dictionaries"],
            }
        )
    )

    assert result.status == "completed"
    assert result.output["passed"] is True
    assert result.output["missingContracts"] == []


def test_buildingsmart_certification_report_blocks_non_official_url() -> None:
    result = build_openbim_evidence_report(
        _job(
            {
                "reportKind": "buildingsmart_certification",
                "status": "certified",
                "issuedBy": "buildingSMART International",
                "certificateId": "test-certificate-id",
                "reportUrl": "https://example.test/report.json",
            }
        )
    )

    assert result.status == "completed"
    assert result.output["passed"] is False
    assert result.output["authorization"] == "claim_blocked"
    assert DISPATCH["openbim_evidence"] is build_openbim_evidence_report
