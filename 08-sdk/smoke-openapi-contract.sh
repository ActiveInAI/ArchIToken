#!/usr/bin/env bash
# OpenAPI validator and multi-language SDK codegen smoke.
# License: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SPEC_PATH="${ROOT_DIR}/04-backend/openapi.yaml"
OUT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/architoken-openapi-codegen-smoke.XXXXXX")"

assert_model_file() {
  local out_dir="$1"
  local model_name="$2"
  local snake_name="$3"

  if ! find "${out_dir}" -type f \( \
    -iname "*${model_name}*" -o \
    -iname "*${snake_name}*" \
  \) | grep -q .; then
    printf 'Missing generated model %s in %s\n' "${model_name}" "${out_dir}" >&2
    exit 1
  fi
}

generate_sdk() {
  local generator="$1"
  local out_dir="$2"
  local additional_properties="$3"

  npx --yes @openapitools/openapi-generator-cli@2.23.0 generate \
    -i "${SPEC_PATH}" \
    -g "${generator}" \
    -o "${out_dir}" \
    --additional-properties="${additional_properties}"

  assert_model_file "${out_dir}" "AgentResponse" "agent_response"
  assert_model_file "${out_dir}" "RagRetrieveRequest" "rag_retrieve_request"
  assert_model_file "${out_dir}" "RagRetrieveResponse" "rag_retrieve_response"
}

npx --yes @redocly/cli@2.30.0 lint "${SPEC_PATH}"

generate_sdk "typescript-fetch" "${OUT_ROOT}/typescript" \
  "npmName=@architoken/sdk,npmVersion=2.0.0,supportsES6=true,typescriptThreePlus=true,withInterfaces=true,modelPropertyNaming=camelCase,licenseName=Apache-2.0"
test -f "${OUT_ROOT}/typescript/src/apis/AgentsApi.ts"
test -f "${OUT_ROOT}/typescript/src/models/RuntimeCapabilities.ts"

generate_sdk "python" "${OUT_ROOT}/python" \
  "packageName=architoken_sdk,packageVersion=2.0.0,projectName=architoken-sdk,packageUrl=https://github.com/ActiveInAI/architoken,licenseName=Apache-2.0"

generate_sdk "rust" "${OUT_ROOT}/rust" \
  "packageName=architoken-sdk,packageVersion=2.0.0,library=reqwest,supportAsync=true,useSingleRequestParameter=true"

generate_sdk "go" "${OUT_ROOT}/go" \
  "packageName=architoken,packageVersion=2.0.0,generateInterfaces=true,withGoMod=true"

generate_sdk "java" "${OUT_ROOT}/java" \
  "groupId=io.architoken,artifactId=architoken-sdk,artifactVersion=2.0.0,library=okhttp-gson,java8=true,licenseName=Apache-2.0"

generate_sdk "swift5" "${OUT_ROOT}/swift" \
  "projectName=ArchITokenSDK,podVersion=2.0.0,swiftUseApiNamespace=true,responseAs=AsyncAwait"

generate_sdk "kotlin" "${OUT_ROOT}/kotlin" \
  "groupId=io.architoken,artifactId=architoken-sdk,artifactVersion=2.0.0,library=jvm-ktor,serializationLibrary=kotlinx_serialization"

printf 'OpenAPI smoke generated TypeScript/Python/Rust/Go/Java/Swift/Kotlin SDKs at %s\n' "${OUT_ROOT}"
