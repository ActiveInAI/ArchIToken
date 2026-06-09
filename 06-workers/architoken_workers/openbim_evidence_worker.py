"""Evidence report adapter for buildingSMART/openBIM readiness gates."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from .contract import ConversionJob, WorkerResult, validate_job
from .io import input_string, source_path, file_sha256, write_json_artifact


def build_openbim_evidence_report(job: ConversionJob) -> WorkerResult:
    """Persist externally produced openBIM evidence without inventing compliance."""

    validate_job(job)
    report_kind = input_string(job, "reportKind", "report_kind", "evidenceKind", "evidence_kind")
    if report_kind in {"full_chain_sample", "full_chain_sample_validation"}:
        return _full_chain_sample_report(job)
    if report_kind in {"opencde_api_contract", "open_cde_api_contract", "api_contract"}:
        return _opencde_api_contract_report(job)
    if report_kind in {"buildingsmart_certification", "building_smart_certification", "certification"}:
        return _buildingsmart_certification_report(job)
    return WorkerResult(
        job_id=job.job_id,
        status="blocked",
        output={"adapter": "openbim_evidence", "available": False, "reportKind": report_kind},
        error={
            "code": "unsupported_openbim_evidence_kind",
            "message": "reportKind must be full_chain_sample_validation, opencde_api_contract, or buildingsmart_certification.",
        },
    )


def _full_chain_sample_report(job: ConversionJob) -> WorkerResult:
    source = source_path(job)
    checksum = input_string(job, "sourceIfcChecksum", "source_ifc_checksum")
    if source and source.is_file():
        checksum = file_sha256(source)
    chain_artifacts = job.input.get("chainArtifacts") or job.input.get("chain_artifacts") or {}
    required = ("ifc", "ids", "bsdd", "bcf", "idm")
    missing = [name for name in required if not _has_non_empty(chain_artifacts, name)]
    payload = {
        "standard": "buildingSMART/openBIM full-chain sample",
        "passed": not missing and bool(checksum),
        "sourceIfcChecksum": checksum,
        "chainArtifacts": chain_artifacts,
        "missingChainArtifacts": missing,
        "note": "This report records a real project sample chain; it is not an official buildingSMART certification.",
    }
    artifact = write_json_artifact(
        job,
        "openbim_full_chain_sample_report.json",
        payload,
        role="openbim_full_chain_sample_report",
        metadata={"standard": "buildingSMART/openBIM", "evidenceKind": "full_chain_sample_validation"},
    )
    return WorkerResult(job_id=job.job_id, status="completed", artifacts=(artifact,), output={**payload, "reportPath": artifact.metadata["path"]})


def _opencde_api_contract_report(job: ConversionJob) -> WorkerResult:
    contracts = job.input.get("contracts")
    contracts = contracts if isinstance(contracts, list) else []
    required = ("foundation", "documents", "bcf", "dictionaries")
    lower_contracts = {str(item).strip().lower() for item in contracts}
    missing = [name for name in required if name not in lower_contracts]
    payload = {
        "standard": "OpenCDE API contract",
        "passed": not missing and _input_bool(job, "passed", default=True),
        "contractSuite": input_string(job, "contractSuite", "contract_suite")
        or "OpenCDE Foundation/Documents + BCF API + Dictionaries API",
        "contracts": contracts,
        "missingContracts": missing,
        "note": "This report records contract-test evidence; it is not an official buildingSMART certification.",
    }
    artifact = write_json_artifact(
        job,
        "opencde_api_contract_report.json",
        payload,
        role="opencde_api_contract_report",
        metadata={"standard": "OpenCDE", "evidenceKind": "opencde_api_contract"},
    )
    return WorkerResult(job_id=job.job_id, status="completed", artifacts=(artifact,), output={**payload, "reportPath": artifact.metadata["path"]})


def _buildingsmart_certification_report(job: ConversionJob) -> WorkerResult:
    status = input_string(job, "status") or "pending"
    issued_by = input_string(job, "issuedBy", "issued_by")
    certificate_id = input_string(job, "certificateId", "certificate_id")
    report_url = input_string(job, "reportUrl", "report_url")
    authorized = _certification_authorized(status, issued_by, certificate_id, report_url)
    payload = {
        "standard": "buildingSMART certification/conformance evidence",
        "status": status,
        "passed": authorized,
        "issuedBy": issued_by,
        "certificateId": certificate_id,
        "reportUrl": report_url,
        "scope": input_string(job, "scope"),
        "authorization": "claim_authorized" if authorized else "claim_blocked",
        "note": "ArchIToken records this external evidence only; buildingSMART remains the authority for certification.",
    }
    artifact = write_json_artifact(
        job,
        "buildingsmart_certification_report.json",
        payload,
        role="buildingsmart_certification_report",
        metadata={"standard": "buildingSMART", "evidenceKind": "buildingsmart_certification"},
    )
    return WorkerResult(job_id=job.job_id, status="completed", artifacts=(artifact,), output={**payload, "reportPath": artifact.metadata["path"]})


def _input_bool(job: ConversionJob, name: str, *, default: bool) -> bool:
    value = job.input.get(name)
    return value if isinstance(value, bool) else default


def _has_non_empty(payload: Any, key: str) -> bool:
    return isinstance(payload, dict) and bool(str(payload.get(key, "")).strip())


def _certification_authorized(status: str, issued_by: str | None, certificate_id: str | None, report_url: str | None) -> bool:
    if status not in {"certified", "passed", "approved"}:
        return False
    if not issued_by or "buildingsmart" not in issued_by.lower():
        return False
    if not certificate_id:
        return False
    if not report_url:
        return False
    parsed = urlparse(report_url)
    return parsed.scheme == "https" and (parsed.hostname == "buildingsmart.org" or bool(parsed.hostname and parsed.hostname.endswith(".buildingsmart.org")))
