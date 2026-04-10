#!/bin/bash
#
# Task Board
# 负责管理按 lane 分区的任务队列
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${MOSS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
TASK_BOARD_DIR="${RUNTIME_DIR}/task-board"
TELEMETRY_DIR="${RUNTIME_DIR}/telemetry"

RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[TASK-BOARD]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

show_help() {
    cat << EOF
Task Board

Usage: $0 <command> [options]

Commands:
    create --lane <lane> --task-id <task_id> --task-type <task_type> [--tags <tag1,tag2>] [--priority <priority>] [--run-id <run_id>] [--stage <stage>] [--flow-sequence <sequence>] [--work-item-type <task|learning>] [--policy-pack <name>] [--route <route>] [--route-state <state>] [--depends-on <task1,task2>] [--campaign-id <id>] [--study-node-type <type>] [--study-iteration <n>]
        Create a task in the pending queue for a lane

    move --lane <lane> --task-id <task_id> --from <state> --to <state>
        Move a task between lane queues

    show --lane <lane> --task-id <task_id> --state <state>
        Show one task payload as JSON

    update --lane <lane> --task-id <task_id> --state <state> [--route <route>] [--route-state <state>] [--status <status>] [--depends-on <task1,task2>] [--campaign-id <id>] [--study-node-type <type>] [--study-iteration <n>]
        Update selected orchestrator/status fields in place

    help
        Show this help message

Examples:
    $0 create --lane executor --task-id task-001 --task-type code_implementation --tags frontend,react --priority high --run-id run-001 --stage executor --flow-sequence 3 --work-item-type task --policy-pack task-governance --route standard-path --route-state queued --depends-on task-000 --campaign-id learn-1 --study-node-type extraction --study-iteration 1
    $0 move --lane executor --task-id task-001 --from pending --to claimed
    $0 show --lane executor --task-id task-001 --state pending
    $0 update --lane executor --task-id task-001 --state pending --route-state in_progress --depends-on task-000,task-099 --study-iteration 2
EOF
}

require_value() {
    local name="$1"
    local value="$2"

    if [[ -z "$value" ]]; then
        log_error "Missing required option: $name"
        exit 1
    fi
}

require_option_argument() {
    local option_name="$1"
    local option_value="${2-}"

    if [[ -z "$option_value" || "$option_value" == --* ]]; then
        log_error "Option ${option_name} requires a value"
        exit 1
    fi
}

require_integer() {
    local name="$1"
    local value="$2"

    if [[ -n "$value" && ! "$value" =~ ^[0-9]+$ ]]; then
        log_error "Option ${name} must be a non-negative integer"
        exit 1
    fi
}

require_path_component() {
    local name="$1"
    local value="$2"

    if [[ ! "$value" =~ ^[A-Za-z0-9._-]+$ ]]; then
        log_error "Option ${name} contains invalid path characters"
        exit 1
    fi
}

ensure_lane_dir() {
    local lane="$1"
    mkdir -p "${TASK_BOARD_DIR}/${lane}"
}

build_task_json() {
    local lane="$1"
    local task_id="$2"
    local task_type="$3"
    local tags_csv="$4"
    local priority="$5"
    local status="$6"
    local run_id="$7"
    local stage="$8"
    local flow_sequence="$9"
    local work_item_type="${10}"
    local policy_pack="${11}"
    local route="${12}"
    local route_state="${13}"
    local depends_on_csv="${14}"
    local campaign_id="${15}"
    local study_node_type="${16}"
    local study_iteration="${17}"

    python3 - "$lane" "$task_id" "$task_type" "$tags_csv" "$priority" "$status" "$run_id" "$stage" "$flow_sequence" "$work_item_type" "$policy_pack" "$route" "$route_state" "$depends_on_csv" "$campaign_id" "$study_node_type" "$study_iteration" <<'PY'
import json
import sys
from datetime import datetime, timezone

lane, task_id, task_type, tags_csv, priority, status, run_id, stage, flow_sequence, work_item_type, policy_pack, route, route_state, depends_on_csv, campaign_id, study_node_type, study_iteration = sys.argv[1:]
domain_tags = [tag.strip() for tag in tags_csv.split(",") if tag.strip()]
depends_on = [task.strip() for task in depends_on_csv.split(",") if task.strip()]

payload = {
    "task_id": task_id,
    "lane": lane,
    "task_type": task_type,
    "domain_tags": domain_tags,
    "priority": priority,
    "status": status,
    "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}

if run_id:
    payload["run_id"] = run_id

if stage:
    payload["stage"] = stage

if flow_sequence:
    payload["flow_sequence"] = int(flow_sequence)

if work_item_type:
    payload["work_item_type"] = work_item_type

if policy_pack:
    payload["policy_pack"] = policy_pack

if route:
    payload["route"] = route

if route_state:
    payload["route_state"] = route_state

if depends_on:
    payload["depends_on"] = depends_on

if campaign_id:
    payload["campaign_id"] = campaign_id

if study_node_type:
    payload["study_node_type"] = study_node_type

if study_iteration:
    payload["study_iteration"] = int(study_iteration)

print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
}

emit_task_board_event() {
    local event_type="$1"
    local task_file="$2"
    local from_state="${3:-}"
    local to_state="${4:-}"
    local telemetry_file="${TELEMETRY_DIR}/events.jsonl"

    mkdir -p "$TELEMETRY_DIR"

    python3 - "$telemetry_file" "$event_type" "$task_file" "$from_state" "$to_state" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

telemetry_file, event_type, task_file, from_state, to_state = sys.argv[1:]

with open(task_file, "r", encoding="utf-8") as fh:
    task = json.load(fh)

event = {
    "type": event_type,
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "id": f"{event_type.replace('.', '_')}_{task.get('task_id', 'unknown')}_{os.getpid()}",
    "data": {
        "lane": task.get("lane"),
        "task_id": task.get("task_id"),
        "task_type": task.get("task_type"),
        "status": task.get("status"),
        "priority": task.get("priority"),
        "domain_tags": task.get("domain_tags", []),
    },
}

for key in ("run_id", "stage", "flow_sequence", "work_item_type", "policy_pack", "route", "route_state", "depends_on", "campaign_id", "study_node_type", "study_iteration"):
    if key in task:
        event["data"][key] = task[key]

if from_state:
    event["data"]["from_state"] = from_state

if to_state:
    event["data"]["to_state"] = to_state

with open(telemetry_file, "a", encoding="utf-8") as fh:
    fh.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")
PY
}

render_task_status_json() {
    local file_path="$1"
    local next_status="$2"

    python3 - "$file_path" "$next_status" <<'PY'
import json
import sys
from datetime import datetime, timezone

file_path, next_status = sys.argv[1:]

with open(file_path, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

payload["status"] = next_status
payload["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
}

create_task() {
    local lane=""
    local task_id=""
    local task_type=""
    local tags_csv=""
    local priority="normal"
    local run_id=""
    local stage=""
    local flow_sequence=""
    local work_item_type=""
    local policy_pack=""
    local route=""
    local route_state=""
    local depends_on=""
    local campaign_id=""
    local study_node_type=""
    local study_iteration=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --task-id)
                require_option_argument "--task-id" "${2-}"
                task_id="${2:-}"
                shift 2
                ;;
            --task-type)
                require_option_argument "--task-type" "${2-}"
                task_type="${2:-}"
                shift 2
                ;;
            --tags)
                require_option_argument "--tags" "${2-}"
                tags_csv="${2:-}"
                shift 2
                ;;
            --priority)
                require_option_argument "--priority" "${2-}"
                priority="${2:-}"
                shift 2
                ;;
            --run-id)
                require_option_argument "--run-id" "${2-}"
                run_id="${2:-}"
                shift 2
                ;;
            --stage)
                require_option_argument "--stage" "${2-}"
                stage="${2:-}"
                shift 2
                ;;
            --flow-sequence)
                require_option_argument "--flow-sequence" "${2-}"
                flow_sequence="${2:-}"
                shift 2
                ;;
            --work-item-type)
                require_option_argument "--work-item-type" "${2-}"
                work_item_type="${2:-}"
                shift 2
                ;;
            --policy-pack)
                require_option_argument "--policy-pack" "${2-}"
                policy_pack="${2:-}"
                shift 2
                ;;
            --route)
                require_option_argument "--route" "${2-}"
                route="${2:-}"
                shift 2
                ;;
            --route-state)
                require_option_argument "--route-state" "${2-}"
                route_state="${2:-}"
                shift 2
                ;;
            --depends-on)
                require_option_argument "--depends-on" "${2-}"
                depends_on="${2:-}"
                shift 2
                ;;
            --campaign-id)
                require_option_argument "--campaign-id" "${2-}"
                campaign_id="${2:-}"
                shift 2
                ;;
            --study-node-type)
                require_option_argument "--study-node-type" "${2-}"
                study_node_type="${2:-}"
                shift 2
                ;;
            --study-iteration)
                require_option_argument "--study-iteration" "${2-}"
                study_iteration="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for create: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--task-id" "$task_id"
    require_value "--task-type" "$task_type"
    require_integer "--flow-sequence" "$flow_sequence"
    require_path_component "--lane" "$lane"
    require_path_component "--task-id" "$task_id"

    ensure_lane_dir "$lane"

    local queue_dir="${TASK_BOARD_DIR}/${lane}/pending"
    local task_file="${queue_dir}/${task_id}.json"
    mkdir -p "$queue_dir"

    if [[ -f "$task_file" ]]; then
        log_error "Task already exists: ${task_file}"
        exit 1
    fi

    build_task_json "$lane" "$task_id" "$task_type" "$tags_csv" "$priority" "pending" "$run_id" "$stage" "$flow_sequence" "$work_item_type" "$policy_pack" "$route" "$route_state" "$depends_on" "$campaign_id" "$study_node_type" "$study_iteration" > "$task_file"
    emit_task_board_event "task.board.created" "$task_file"
    log_info "Created task ${task_id} in ${lane}/pending"
}

move_task() {
    local lane=""
    local task_id=""
    local from_state=""
    local to_state=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --task-id)
                require_option_argument "--task-id" "${2-}"
                task_id="${2:-}"
                shift 2
                ;;
            --from)
                require_option_argument "--from" "${2-}"
                from_state="${2:-}"
                shift 2
                ;;
            --to)
                require_option_argument "--to" "${2-}"
                to_state="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for move: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--task-id" "$task_id"
    require_value "--from" "$from_state"
    require_value "--to" "$to_state"
    require_path_component "--lane" "$lane"
    require_path_component "--task-id" "$task_id"
    require_path_component "--from" "$from_state"
    require_path_component "--to" "$to_state"

    ensure_lane_dir "$lane"

    local source_dir="${TASK_BOARD_DIR}/${lane}/${from_state}"
    local target_dir="${TASK_BOARD_DIR}/${lane}/${to_state}"
    local source_file="${source_dir}/${task_id}.json"
    local target_file="${target_dir}/${task_id}.json"

    if [[ ! -f "$source_file" ]]; then
        log_error "Task not found: ${source_file}"
        exit 1
    fi

    mkdir -p "$target_dir"
    local tmp_target
    tmp_target="$(mktemp "${target_dir}/.${task_id}.tmp.XXXXXX")"
    render_task_status_json "$source_file" "$to_state" > "$tmp_target"
    mv -f "$tmp_target" "$target_file"
    rm -f "$source_file"
    emit_task_board_event "task.board.moved" "$target_file" "$from_state" "$to_state"
    log_info "Moved task ${task_id} from ${from_state} to ${to_state}"
}

show_task() {
    local lane=""
    local task_id=""
    local state=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --task-id)
                require_option_argument "--task-id" "${2-}"
                task_id="${2:-}"
                shift 2
                ;;
            --state)
                require_option_argument "--state" "${2-}"
                state="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for show: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--task-id" "$task_id"
    require_value "--state" "$state"
    require_path_component "--lane" "$lane"
    require_path_component "--task-id" "$task_id"
    require_path_component "--state" "$state"

    local task_file="${TASK_BOARD_DIR}/${lane}/${state}/${task_id}.json"
    if [[ ! -f "$task_file" ]]; then
        log_error "Task not found: ${task_file}"
        exit 1
    fi

    cat "$task_file"
}

update_task() {
    local lane=""
    local task_id=""
    local state=""
    local route=""
    local route_state=""
    local next_status=""
    local depends_on=""
    local campaign_id=""
    local study_node_type=""
    local study_iteration=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --task-id)
                require_option_argument "--task-id" "${2-}"
                task_id="${2:-}"
                shift 2
                ;;
            --state)
                require_option_argument "--state" "${2-}"
                state="${2:-}"
                shift 2
                ;;
            --route)
                require_option_argument "--route" "${2-}"
                route="${2:-}"
                shift 2
                ;;
            --route-state)
                require_option_argument "--route-state" "${2-}"
                route_state="${2:-}"
                shift 2
                ;;
            --status)
                require_option_argument "--status" "${2-}"
                next_status="${2:-}"
                shift 2
                ;;
            --depends-on)
                require_option_argument "--depends-on" "${2-}"
                depends_on="${2:-}"
                shift 2
                ;;
            --campaign-id)
                require_option_argument "--campaign-id" "${2-}"
                campaign_id="${2:-}"
                shift 2
                ;;
            --study-node-type)
                require_option_argument "--study-node-type" "${2-}"
                study_node_type="${2:-}"
                shift 2
                ;;
            --study-iteration)
                require_option_argument "--study-iteration" "${2-}"
                study_iteration="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for update: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--task-id" "$task_id"
    require_value "--state" "$state"
    require_path_component "--lane" "$lane"
    require_path_component "--task-id" "$task_id"
    require_path_component "--state" "$state"

    local task_file="${TASK_BOARD_DIR}/${lane}/${state}/${task_id}.json"
    if [[ ! -f "$task_file" ]]; then
        log_error "Task not found: ${task_file}"
        exit 1
    fi

    local tmp_file
    tmp_file="$(mktemp "${task_file}.tmp.XXXXXX")"
    python3 - "$task_file" "$route" "$route_state" "$next_status" "$depends_on" "$campaign_id" "$study_node_type" "$study_iteration" <<'PY' > "$tmp_file"
import json
import sys
from datetime import datetime, timezone

task_file, route, route_state, next_status, depends_on_csv, campaign_id, study_node_type, study_iteration = sys.argv[1:]
with open(task_file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

if route:
    payload["route"] = route
if route_state:
    payload["route_state"] = route_state
if next_status:
    payload["status"] = next_status
if depends_on_csv:
    payload["depends_on"] = [task.strip() for task in depends_on_csv.split(",") if task.strip()]
if campaign_id:
    payload["campaign_id"] = campaign_id
if study_node_type:
    payload["study_node_type"] = study_node_type
if study_iteration:
    payload["study_iteration"] = int(study_iteration)

payload["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
    mv -f "$tmp_file" "$task_file"
    emit_task_board_event "task.board.updated" "$task_file"
    log_info "Updated task ${task_id} in ${lane}/${state}"
}

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        create)
            create_task "$@"
            ;;
        move)
            move_task "$@"
            ;;
        show)
            show_task "$@"
            ;;
        update)
            update_task "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_warn "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
