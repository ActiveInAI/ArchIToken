#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-registries failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

skill_id="smoke-skill-$(date +%s)"
skill="$(
  post_json '/v1/skills' "{
    \"id\": \"${skill_id}\",
    \"name\": \"Smoke MIT Skill\",
    \"owner\": \"smoke\",
    \"version\": \"0.1.0\",
    \"inputSchemaRef\": \"generation.input.schema.v1\",
    \"outputSchemaRef\": \"artifact.ifc.schema.v1\",
    \"capabilities\": [{\"id\":\"text_to_bim\",\"description\":\"smoke\",\"inputKinds\":[\"text\"],\"outputKinds\":[\"bim\"]}],
    \"licensePolicy\": {\"license\":\"MIT\",\"commercialUseAllowed\":true,\"reviewNote\":\"smoke\"},
    \"sandboxPolicy\": {\"profile\":\"isolated_tool_sandbox_no_network\",\"networkAccess\":false,\"timeoutMs\":30000,\"memoryMb\":512},
    \"fixtures\": []
  }"
)"
printf '%s\n' "${skill}" | jq -e '.status == "draft" and .productionRouteEnabled == false' >/dev/null

approved_skill="$(post_json "/v1/skills/${skill_id}/approve" '{"actor":"smoke","comment":"approved"}')"
printf '%s\n' "${approved_skill}" | jq -e '.status == "approved" and .productionRouteEnabled == true' >/dev/null

blocked_status="$(
  curl -sS -o /tmp/architoken-smoke-blocked-skill.json -w '%{http_code}' \
    -X POST "${BASE_URL}/v1/skills" \
    "${context_headers[@]}" \
    "${json_headers[@]}" \
    --data "{
      \"id\": \"${skill_id}-blocked\",
      \"name\": \"Blocked Skill\",
      \"owner\": \"smoke\",
      \"version\": \"0.1.0\",
      \"inputSchemaRef\": \"generation.input.schema.v1\",
      \"outputSchemaRef\": \"artifact.ifc.schema.v1\",
      \"capabilities\": [],
      \"licensePolicy\": {\"license\":\"AGPL-3.0-only\",\"commercialUseAllowed\":true,\"reviewNote\":\"blocked\"},
      \"sandboxPolicy\": {\"profile\":\"isolated_tool_sandbox_no_network\",\"networkAccess\":false,\"timeoutMs\":30000,\"memoryMb\":512},
      \"fixtures\": []
    }"
)"
test "${blocked_status}" = "400"
grep -q 'license violation' /tmp/architoken-smoke-blocked-skill.json

tool_id="smoke-tool-$(date +%s)"
tool="$(
  post_json '/v1/mcp-tools' "{
    \"id\": \"${tool_id}\",
    \"name\": \"Smoke Tool\",
    \"owner\": \"smoke\",
    \"version\": \"0.1.0\",
    \"capability\": {\"id\":\"artifact_probe\",\"description\":\"smoke\"},
    \"permissionScope\": {\"tenantScope\":\"current_tenant\",\"projectScope\":\"current_project\",\"operations\":[\"artifact:read\"]},
    \"inputSchemaRef\": \"tool.input.schema.v1\",
    \"outputSchemaRef\": \"tool.output.schema.v1\",
    \"timeoutMs\": 30000,
    \"rateLimitPerMinute\": 60,
    \"auditPolicy\": {\"auditRequired\": true, \"redactInputs\": true, \"redactOutputs\": false}
  }"
)"
printf '%s\n' "${tool}" | jq -e '.status == "draft"' >/dev/null
post_json "/v1/mcp-tools/${tool_id}/approve" '{"actor":"smoke","comment":"audit required"}' | jq -e '.status == "approved"' >/dev/null

source_id="smoke-vendor-source-$(date +%s)"
source="$(
  post_json '/v1/knowledge-sources' "{
    \"id\": \"${source_id}\",
    \"kind\": \"external_ai_model_open_source_candidate\",
    \"name\": \"Smoke Vendor Candidate\",
    \"sourceUrl\": \"https://example.invalid/vendor\",
    \"license\": \"proprietary_eula\",
    \"version\": \"candidate\",
    \"vendorId\": \"vendor.smoke\",
    \"productionEnabled\": true,
    \"defaultRoute\": \"enabled\",
    \"commercialPolicy\": \"legal review required\",
    \"capabilities\": [\"viewer candidate\"],
    \"requirementsBeforeUse\": [\"legal review\", \"SBOM\", \"security scan\"],
    \"owner\": \"smoke\",
    \"refreshPolicy\": \"manual metadata only\",
    \"permissionPolicy\": \"tenant_project_scoped\",
    \"auditPolicy\": \"audit every ingest\",
    \"indexBinding\": {\"vectorIndex\": null, \"fullTextIndex\": null, \"graphIndex\": null, \"objectPrefix\":\"knowledge/smoke/\"},
    \"citationPolicy\": {\"citationRequired\": true, \"exposeSourceUrl\": true, \"requiredFields\":[\"sourceUrl\"]}
  }"
)"
printf '%s\n' "${source}" | jq -e '.status == "candidate_only" and .productionEnabled == false and .defaultRoute == "disabled"' >/dev/null

post_json "/v1/knowledge-sources/${source_id}/ingest" '{"actor":"smoke","comment":"candidate registry ingest"}' | jq -e '.status == "completed"' >/dev/null
get_json "/v1/knowledge-sources/${source_id}" | jq -e '.status == "candidate_only" and .productionEnabled == false and .defaultRoute == "disabled"' >/dev/null

printf 'registry smoke passed\n'
