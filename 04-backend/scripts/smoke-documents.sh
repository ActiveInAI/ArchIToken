#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-documents failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

read -r asset_id file_id < <(create_phase7_asset_with_file "pdf" "phase7-document.pdf" "application/pdf" "pdf" "pdf" 55)
job="$(create_phase7_conversion_job "pdf_parse" "${asset_id}" "${file_id}" '{"adapters":["pdfium_adapter","mupdf_adapter","stirling_pdf_adapter"],"ocr":["mineru_parse","paddleocr_parse"]}')"
printf '%s\n' "${job}" | jq -e '.operation == "pdf_parse" and (.status == "queued" or .status == "dispatched") and (.input.adapters | index("pdfium_adapter")) != null' >/dev/null

printf 'phase7 documents smoke passed, job_id=%s\n' "$(printf '%s\n' "${job}" | jq -r '.jobId')"
