#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-data-plane failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

smoke_run_id="${ARCHITOKEN_DATA_PLANE_SMOKE_RUN_ID:-$(date +%s)-$$}"
module_id="${ARCHITOKEN_DATA_PLANE_SMOKE_MODULE_ID:-digital_twin}"
from_entity_id="smoke-sensor-${smoke_run_id}"
to_entity_id="smoke-space-${smoke_run_id}"
series_key="smoke.temperature.${smoke_run_id}"
event_target_id="smoke-target-${smoke_run_id}"
metric_name="smoke.data_plane.write.${smoke_run_id}"

bindings="$(get_json "/v1/data-plane/bindings")"
printf '%s\n' "${bindings}" | jq -e '
  (.total == (.bindings | length)) and
  ([.bindings[].capability] as $capabilities |
    ($capabilities | index("relational_store")) != null and
    ($capabilities | index("object_store")) != null and
    ($capabilities | index("vector_store")) != null and
    ($capabilities | index("time_series_store")) != null and
    ($capabilities | index("graph_store")) != null and
    ($capabilities | index("event_store")) != null and
    ($capabilities | index("cache_store")) != null and
    ($capabilities | index("analytics_store")) != null
  )
' >/dev/null
printf '%s\n' "${bindings}" | jq -e '
  .bindings[] | select(.capability == "graph_store")
  | .currentProvider == "postgres_adjacency"
    and .fallbackProvider == "postgres_adjacency"
    and .metadata.externalized == false
' >/dev/null

if [[ -n "${CLICKHOUSE_URL:-}${ARCHITOKEN_TIMESERIES__URL:-}${ARCHITOKEN_TIME_SERIES__URL:-}" ]]; then
  printf '%s\n' "${bindings}" | jq -e '
    .bindings[] | select(.capability == "time_series_store")
    | .currentProvider == "clickhouse"
      and .fallbackProvider == "postgres_partitioned"
      and .metadata.adapter == "clickhouse_http"
  ' >/dev/null
fi

if [[ -n "${CLICKHOUSE_URL:-}${ARCHITOKEN_ANALYTICS__URL:-}" ]]; then
  printf '%s\n' "${bindings}" | jq -e '
    .bindings[] | select(.capability == "analytics_store")
    | .currentProvider == "clickhouse"
      and .fallbackProvider == "postgres_materialized_views"
      and .metadata.adapter == "clickhouse_http"
  ' >/dev/null
fi

graph_edge="$(
  post_json "/v1/data-plane/graph-edges" "$(
    jq -nc \
      --arg module_id "${module_id}" \
      --arg from_entity_id "${from_entity_id}" \
      --arg to_entity_id "${to_entity_id}" \
      '{
        moduleId: $module_id,
        fromEntityType: "sensor",
        fromEntityId: $from_entity_id,
        toEntityType: "space",
        toEntityId: $to_entity_id,
        relationshipType: "feeds",
        properties: { smoke: true },
        source: "smoke-data-plane"
      }'
  )"
)"
graph_edge_id="$(printf '%s\n' "${graph_edge}" | jq -r '.id')"
printf '%s\n' "${graph_edge}" | jq -e \
  --arg module_id "${module_id}" \
  --arg from_entity_id "${from_entity_id}" \
  --arg to_entity_id "${to_entity_id}" \
  '.moduleId == $module_id and .fromEntityId == $from_entity_id and .toEntityId == $to_entity_id and .relationshipType == "feeds"' \
  >/dev/null

listed_graph_edges="$(get_json "/v1/data-plane/graph-edges?moduleId=${module_id}&fromEntityId=${from_entity_id}&relationshipType=feeds&limit=20")"
printf '%s\n' "${listed_graph_edges}" | jq -e --arg graph_edge_id "${graph_edge_id}" \
  '.edges[] | select(.id == $graph_edge_id and .source == "smoke-data-plane")' \
  >/dev/null

time_series_point="$(
  post_json "/v1/data-plane/time-series/points" "$(
    jq -nc \
      --arg module_id "${module_id}" \
      --arg series_key "${series_key}" \
      '{
        moduleId: $module_id,
        seriesKey: $series_key,
        valueNumeric: 23.5,
        unit: "C",
        quality: "raw",
        attributes: { smoke: true }
      }'
  )"
)"
time_series_point_id="$(printf '%s\n' "${time_series_point}" | jq -r '.id')"
printf '%s\n' "${time_series_point}" | jq -e \
  --arg module_id "${module_id}" \
  --arg series_key "${series_key}" \
  '.moduleId == $module_id and .seriesKey == $series_key and .valueNumeric == 23.5 and .unit == "C"' \
  >/dev/null

listed_time_series_points="$(get_json "/v1/data-plane/time-series/points?moduleId=${module_id}&seriesKey=${series_key}&limit=20")"
printf '%s\n' "${listed_time_series_points}" | jq -e --arg time_series_point_id "${time_series_point_id}" \
  '.points[] | select(.id == $time_series_point_id and .quality == "raw")' \
  >/dev/null

outbox_event="$(
  post_json "/v1/data-plane/event-outbox" "$(
    jq -nc \
      --arg module_id "${module_id}" \
      --arg event_target_id "${event_target_id}" \
      '{
        moduleId: $module_id,
        eventType: "smoke.data_plane",
        targetType: "smoke",
        targetId: $event_target_id,
        payload: { smoke: true }
      }'
  )"
)"
outbox_event_id="$(printf '%s\n' "${outbox_event}" | jq -r '.id')"
printf '%s\n' "${outbox_event}" | jq -e \
  --arg module_id "${module_id}" \
  --arg event_target_id "${event_target_id}" \
  '.moduleId == $module_id and .eventType == "smoke.data_plane" and .targetId == $event_target_id and .status == "pending"' \
  >/dev/null

listed_outbox_events="$(get_json "/v1/data-plane/event-outbox?moduleId=${module_id}&status=pending&limit=50")"
printf '%s\n' "${listed_outbox_events}" | jq -e --arg outbox_event_id "${outbox_event_id}" \
  '.events[] | select(.id == $outbox_event_id and .targetType == "smoke")' \
  >/dev/null

analytics_event="$(
  post_json "/v1/data-plane/analytics-events" "$(
    jq -nc \
      --arg module_id "${module_id}" \
      --arg metric_name "${metric_name}" \
      '{
        moduleId: $module_id,
        metricName: $metric_name,
        metricValue: 1,
        dimensions: { smoke: true }
      }'
  )"
)"
analytics_event_id="$(printf '%s\n' "${analytics_event}" | jq -r '.id')"
printf '%s\n' "${analytics_event}" | jq -e \
  --arg module_id "${module_id}" \
  --arg metric_name "${metric_name}" \
  '.moduleId == $module_id and .metricName == $metric_name and .metricValue == 1' \
  >/dev/null

listed_analytics_events="$(get_json "/v1/data-plane/analytics-events?moduleId=${module_id}&metricName=${metric_name}&limit=20")"
printf '%s\n' "${listed_analytics_events}" | jq -e --arg analytics_event_id "${analytics_event_id}" \
  '.events[] | select(.id == $analytics_event_id)' \
  >/dev/null

printf 'data-plane smoke passed for %s module=%s graph_edge=%s time_series_point=%s outbox_event=%s analytics_event=%s\n' \
  "${BASE_URL}" \
  "${module_id}" \
  "${graph_edge_id}" \
  "${time_series_point_id}" \
  "${outbox_event_id}" \
  "${analytics_event_id}"
