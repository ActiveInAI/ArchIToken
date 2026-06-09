#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-openbim-claim-gates failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

worker_headers=()
if [[ -n "${ARCHITOKEN_WORKER_RESULT_TOKEN:-}" ]]; then
  worker_headers=(-H "x-architoken-worker-token: ${ARCHITOKEN_WORKER_RESULT_TOKEN}")
fi

post_worker_result() {
  local job_id="$1"
  local output_json="$2"
  local artifact_name="$3"

  curl -fsS -X POST "${BASE_URL}/internal/conversion-jobs/${job_id}/worker-result" \
    "${context_headers[@]}" \
    "${worker_headers[@]}" \
    "${json_headers[@]}" \
    --data "$(
      jq -nc \
        --arg job_id "${job_id}" \
        --arg artifact_name "${artifact_name}" \
        --argjson output "${output_json}" \
        '{
          jobId: $job_id,
          status: "completed",
          output: $output,
          artifacts: [
            {
              name: $artifact_name,
              mediaType: "application/json",
              role: "openbim_evidence",
              metadata: {
                objectPersisted: true,
                objectKey: ("workers/smoke/" + $job_id + "/" + $artifact_name)
              }
            }
          ]
        }'
    )" >/dev/null
}

read -r asset_id file_id < <(create_phase7_asset_with_file "ifc" "openbim-claim-gate.ifc" "model/ifc" "ifc" "ifc4x3" 256)

ingest_job="$(create_phase7_conversion_job "ifc_ingest" "${asset_id}" "${file_id}" '{"adapter":"ifcopenshell"}')"
ingest_job_id="$(printf '%s\n' "${ingest_job}" | jq -r '.jobId')"
post_worker_result "${ingest_job_id}" "$(
  jq -nc '{
    standard: "IFC4X3",
    semantics: {
      schema: "architoken.bim_semantics_manifest.v1",
      semanticLayers: [{layer: "ifcSource", status: "ready"}],
      openBimClaim: {status: "blocked_pending_required_evidence", mayClaimBuildingSmartOpenBim: false}
    }
  }'
)" "bim_semantics_manifest.json"

create_and_finish_evidence() {
  local operation="$1"
  local artifact_name="$2"
  local output_json="$3"
  local input_json="${4:-{}}"
  local job job_id

  job="$(create_phase7_conversion_job "${operation}" "${asset_id}" "${file_id}" "${input_json}")"
  job_id="$(printf '%s\n' "${job}" | jq -r '.jobId')"
  post_worker_result "${job_id}" "${output_json}" "${artifact_name}"
}

create_and_finish_evidence "openbim_validate" "ids_validation_report.json" '{"standard":"IDS","passed":true}' '{"adapter":"ids","idsPath":"/evidence/handover.ids"}'
create_and_finish_evidence "openbim_validate" "buildingsmart_validate_report.json" '{"standard":"buildingSMART Validate","passed":true,"serviceExecuted":true}' '{"adapter":"buildingsmart_validate"}'
create_and_finish_evidence "bsdd_enrich" "bsdd_classification_report.json" '{"dictionary":"bSDD","sourceUrl":"https://api.bsdd.buildingsmart.org/api/Classification/v4/Search?SearchText=Wall","classifications":[{"namespaceUri":"https://identifier.buildingsmart.org/uri/bsdd"}]}' '{"adapter":"bsdd","classificationQuery":"Wall"}'
create_and_finish_evidence "bcf_ingest" "bcf_manifest.json" '{"standard":"BCF","topicCount":1}' '{"adapter":"bcf"}'
create_and_finish_evidence "idm_ingest" "idm_manifest.json" '{"standard":"IDM","machineReadable":true}' '{"adapter":"idm"}'
create_and_finish_evidence "document_generate" "approval_audit_chain.json" '{"approvalState":"closed","auditChain":[{"actor":"approver","action":"approved"}]}' '{"adapter":"openbim_evidence"}'
create_and_finish_evidence "document_generate" "openbim_full_chain_sample_report.json" '{"passed":true,"sourceIfcChecksum":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","chainArtifacts":{"ifc":"openbim-claim-gate.ifc","ids":"handover.ids","bsdd":"bsdd_classification_report.json","bcf":"issues.bcfzip","idm":"idm_manifest.json"}}' '{"adapter":"openbim_evidence","reportKind":"full_chain_sample_validation"}'
create_and_finish_evidence "document_generate" "opencde_api_contract_report.json" '{"passed":true,"contractSuite":"OpenCDE Foundation/Documents + BCF API + Dictionaries API","contracts":["foundation","documents","bcf","dictionaries"]}' '{"adapter":"openbim_evidence","reportKind":"opencde_api_contract"}'

readiness_without_cert="$(get_json "/v1/bim/models/${asset_id}/openbim-readiness")"
printf '%s\n' "${readiness_without_cert}" | jq -e '
  .readinessStatus == "ready_for_openbim_review"
  and .openBimClaim.mayEnterBuildingSmartOpenBimReview == true
  and .openBimClaim.mayClaimBuildingSmartOpenBim == false
  and (.openBimClaim.missingClaimEvidence | index("buildingSmartCertification"))
' >/dev/null

create_and_finish_evidence "document_generate" "buildingsmart_certification_report.json" '{"status":"certified","issuedBy":"buildingSMART International","certificateId":"smoke-test-certificate","reportUrl":"https://www.buildingsmart.org/compliance/software-certification/ifc/"}' '{"adapter":"openbim_evidence","reportKind":"buildingsmart_certification"}'

readiness_with_cert="$(get_json "/v1/bim/models/${asset_id}/openbim-readiness")"
printf '%s\n' "${readiness_with_cert}" | jq -e '
  .readinessStatus == "buildingSMART_openBIM_claim_authorized"
  and .openBimClaim.mayEnterBuildingSmartOpenBimReview == true
  and .openBimClaim.mayClaimBuildingSmartOpenBim == true
  and .requiredEvidence.buildingSmartCertification.scope == "claim"
' >/dev/null

printf 'openBIM claim-gate smoke passed, asset_id=%s\n' "${asset_id}"
