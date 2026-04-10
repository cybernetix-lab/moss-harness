#!/bin/bash
#
# Path Controller (Skeleton)
# Controls task governance paths: start / advance / upgrade / status.
# This script should remain side-effect light until wired with task-board.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${MOSS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
TASK_BOARD_DIR="${RUNTIME_DIR}/task-board"
TASK_BOARD_SCRIPT="${PROJECT_ROOT}/scripts/task-board.sh"
TELEMETRY_DIR="${RUNTIME_DIR}/telemetry"
TELEMETRY_FILE="${TELEMETRY_DIR}/events.jsonl"

BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info() { echo -e "${BLUE}[PATH-CTRL]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

emit_path_event() {
  local event_type="$1"
  local json_payload="${2-}"
  if [[ -z "$json_payload" ]]; then
    json_payload='{}'
  fi
  mkdir -p "$TELEMETRY_DIR"
  python3 - "$TELEMETRY_FILE" "$event_type" "$json_payload" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

telemetry_file, event_type, raw_payload = sys.argv[1:]
payload = json.loads(raw_payload)
event = {
    "type": event_type,
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "id": f"{event_type.replace('.', '_')}_{os.getpid()}",
    "data": payload,
}
with open(telemetry_file, "a", encoding="utf-8") as fh:
    fh.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")
PY
}

find_task_location() {
  local task_id="$1"
  python3 - "$TASK_BOARD_DIR" "$task_id" <<'PY'
import os
import sys

task_board_dir, task_id = sys.argv[1:]

for lane in os.listdir(task_board_dir) if os.path.isdir(task_board_dir) else []:
    lane_dir = os.path.join(task_board_dir, lane)
    if not os.path.isdir(lane_dir):
        continue
    for state in os.listdir(lane_dir):
        state_dir = os.path.join(lane_dir, state)
        candidate = os.path.join(state_dir, f"{task_id}.json")
        if os.path.isfile(candidate):
            print(f"{lane}:{state}")
            raise SystemExit(0)

raise SystemExit(1)
PY
}

update_route_fields() {
  local lane="$1"
  local state="$2"
  local task_id="$3"
  local route="$4"
  local route_state="$5"

  "$TASK_BOARD_SCRIPT" update \
    --lane "$lane" \
    --task-id "$task_id" \
    --state "$state" \
    --route "$route" \
    --route-state "$route_state" >/dev/null
}

show_help() {
  cat <<EOF
Path Controller (task governance)

Usage: $0 <command> [options]

Commands:
  start   --task-id <id> --route <fast-path|standard-path|full-governance-path>
  advance --task-id <id>
  upgrade --task-id <id> --to <standard-path|full-governance-path>
  status  --task-id <id>
  help

Notes:
- This is a minimal skeleton. It prints planned actions so callers can be wired.
- Do not implement lane-local selection here (claim-engine handles that).
EOF
}

cmd="${1-:help}"
shift || true

case "$cmd" in
  start)
    task_id=""; route=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2-}"; shift 2;;
        --route)   route="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$task_id" || -z "$route" ]] && { log_err "Missing --task-id or --route"; exit 1; }
    location="$(find_task_location "$task_id" || true)"
    if [[ -z "$location" ]]; then
      log_err "Task file not found for task_id=${task_id}"
      exit 1
    fi
    IFS=':' read -r lane state <<< "$location"
    update_route_fields "$lane" "$state" "$task_id" "$route" "in_progress"
    emit_path_event "task.path.started" "$(python3 - "$task_id" "$route" "$lane" <<'PY'
import json, sys
task_id, route, lane = sys.argv[1:]
print(json.dumps({
    "task_id": task_id,
    "route": route,
    "lane": lane,
    "route_state": "in_progress",
}, ensure_ascii=True, separators=(",", ":")))
PY
)"
    log_info "START route for task=${task_id} route=${route}"
    echo "{\"task_id\":\"${task_id}\",\"action\":\"start\",\"route\":\"${route}\"}"
    ;;
  advance)
    task_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$task_id" ]] && { log_err "Missing --task-id"; exit 1; }
    location="$(find_task_location "$task_id" || true)"
    if [[ -z "$location" ]]; then
      log_err "Task file not found for task_id=${task_id}"
      exit 1
    fi
    IFS=':' read -r lane state <<< "$location"
    log_info "ADVANCE task=${task_id}"
    "$TASK_BOARD_SCRIPT" show --lane "$lane" --task-id "$task_id" --state "$state"
    ;;
  upgrade)
    task_id=""; to=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2-}"; shift 2;;
        --to)      to="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$task_id" || -z "$to" ]] && { log_err "Missing --task-id or --to"; exit 1; }
    location="$(find_task_location "$task_id" || true)"
    if [[ -z "$location" ]]; then
      log_err "Task file not found for task_id=${task_id}"
      exit 1
    fi
    IFS=':' read -r lane state <<< "$location"
    update_route_fields "$lane" "$state" "$task_id" "$to" "upgraded"
    emit_path_event "task.path.upgraded" "$(python3 - "$task_id" "$to" "$lane" <<'PY'
import json, sys
task_id, route, lane = sys.argv[1:]
print(json.dumps({
    "task_id": task_id,
    "route": route,
    "lane": lane,
    "route_state": "upgraded",
}, ensure_ascii=True, separators=(",", ":")))
PY
)"
    log_warn "UPGRADE task=${task_id} -> ${to}"
    echo "{\"task_id\":\"${task_id}\",\"action\":\"upgrade\",\"to\":\"${to}\"}"
    ;;
  status)
    task_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$task_id" ]] && { log_err "Missing --task-id"; exit 1; }
    location="$(find_task_location "$task_id" || true)"
    if [[ -z "$location" ]]; then
      log_err "Task file not found for task_id=${task_id}"
      exit 1
    fi
    IFS=':' read -r lane state <<< "$location"
    "$TASK_BOARD_SCRIPT" show --lane "$lane" --task-id "$task_id" --state "$state"
    ;;
  help|--help|-h|"")
    show_help;;
  *)
    log_err "Unknown command: $cmd"; show_help; exit 1;;
esac
