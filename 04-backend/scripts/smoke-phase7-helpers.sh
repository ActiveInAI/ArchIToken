#!/usr/bin/env bash
set -euo pipefail

create_phase7_asset_with_file() {
  local kind="$1"
  local name="$2"
  local content_type="$3"
  local source_format="$4"
  local canonical_format="$5"
  local size_bytes="${6:-42}"

  local asset_payload asset asset_id presign file_id complete_payload
  asset_payload="$(
    jq -nc \
      --arg kind "${kind}" \
      --arg name "${name}" \
      --arg source_format "${source_format}" \
      --arg canonical_format "${canonical_format}" \
      '{
        kind: $kind,
        name: $name,
        sourceFormat: $source_format,
        canonicalFormat: $canonical_format,
        metadata: { smoke: true }
      }'
  )"
  asset="$(post_json "/v1/assets" "${asset_payload}")"
  asset_id="$(printf '%s\n' "${asset}" | jq -r '.assetId')"
  printf '%s\n' "${asset}" | jq -e --arg kind "${kind}" '.kind == $kind and .status == "draft"' >/dev/null

  presign="$(
    post_json "/v1/assets/${asset_id}/files/presign-upload" "$(
      jq -nc \
        --arg file_name "${name}" \
        --arg content_type "${content_type}" \
        --argjson size_bytes "${size_bytes}" \
        '{ fileName: $file_name, contentType: $content_type, sizeBytes: $size_bytes }'
    )"
  )"
  file_id="$(printf '%s\n' "${presign}" | jq -r '.fileId')"
  printf '%s\n' "${presign}" | jq -e --arg file_id "${file_id}" '.fileId == $file_id and .method == "PUT"' >/dev/null

  complete_payload="$(
    jq -nc \
      --arg file_id "${file_id}" \
      --arg key "${ARCHITOKEN_TENANT_ID}/${ARCHITOKEN_PROJECT_ID}/${asset_id}/${file_id}/${name}" \
      --arg content_type "${content_type}" \
      --arg checksum "phase7-smoke-${file_id}" \
      --arg source_format "${source_format}" \
      --argjson size_bytes "${size_bytes}" \
      '{
        fileId: $file_id,
        key: $key,
        sizeBytes: $size_bytes,
        contentType: $content_type,
        checksumSha256: $checksum,
        role: "source",
        format: $source_format
      }'
  )"
  post_json "/v1/assets/${asset_id}/files/complete-upload" "${complete_payload}" \
    | jq -e --arg file_id "${file_id}" '.file.metadata.id == $file_id and .binding.assetFileId == $file_id' >/dev/null

  printf '%s %s\n' "${asset_id}" "${file_id}"
}

create_phase7_conversion_job() {
  local operation="$1"
  local asset_id="$2"
  local file_id="$3"
  local input_json="${4:-}"
  if [[ -z "${input_json}" ]]; then
    input_json="{}"
  fi
  local runtime_profile
  runtime_profile="$(curl -fsS "${BASE_URL}/readyz" | jq -r '.runtimeProfile')"
  if [[ "${runtime_profile}" == "production" ]]; then
    case "${ARCHITOKEN_PRODUCTION_CONTRACT_SMOKE:-}" in
      1|true|TRUE|yes|YES|on|ON)
        input_json="$(printf '%s\n' "${input_json}" | jq -c '. + {worker:"contract"}')"
        ;;
    esac
  fi

  post_json "/v1/conversion-jobs" "$(
    jq -nc \
      --arg operation "${operation}" \
      --arg asset_id "${asset_id}" \
      --arg file_id "${file_id}" \
      --argjson input "${input_json}" \
      '{
        operation: $operation,
        sourceAssetId: $asset_id,
        sourceFileId: $file_id,
        input: $input
      }'
  )"
}
