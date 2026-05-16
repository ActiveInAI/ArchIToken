#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-openbim failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

read -r asset_id file_id < <(create_phase7_asset_with_file "ifc" "phase7-openbim.ifc" "model/ifc" "ifc" "ifc4x3" 96)
job="$(create_phase7_conversion_job "ifc_to_3dtiles" "${asset_id}" "${file_id}" '{"outputs":["model_manifest.json","geometry_manifest.json"],"openbim":["IFC4x3","IDS","bSDD"]}')"
printf '%s\n' "${job}" | jq -e '.operation == "ifc_to_3dtiles" and .status == "queued" and .input.openbim[0] == "IFC4x3"' >/dev/null

ifcdb_job="$(create_phase7_conversion_job "ifcdb_query" "${asset_id}" "${file_id}" '{"adapter":"ifcdb_agent","query":"select GlobalId, Name from IfcProduct limit 10","requiredRuntime":"DeeJoin/IFCDB-Agent v1.0.9"}')"
printf '%s\n' "${ifcdb_job}" | jq -e '.operation == "ifcdb_query" and .status == "queued" and .input.adapter == "ifcdb_agent"' >/dev/null

printf 'phase7 openbim smoke passed, job_id=%s\n' "$(printf '%s\n' "${job}" | jq -r '.jobId')"
