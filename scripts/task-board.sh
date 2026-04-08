#!/bin/bash
#
# Task Board
# 负责管理按 lane 分区的任务队列
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${AHARNESS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
TASK_BOARD_DIR="${RUNTIME_DIR}/task-board"

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
    create --lane <lane> --task-id <task_id> --task-type <task_type> [--tags <tag1,tag2>] [--priority <priority>]
        Create a task in the pending queue for a lane

    move --lane <lane> --task-id <task_id> --from <state> --to <state>
        Move a task between lane queues

    help
        Show this help message

Examples:
    $0 create --lane executor --task-id task-001 --task-type code_implementation --tags frontend,react --priority high
    $0 move --lane executor --task-id task-001 --from pending --to claimed
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

    python3 - "$lane" "$task_id" "$task_type" "$tags_csv" "$priority" "$status" <<'PY'
import json
import sys
from datetime import datetime, timezone

lane, task_id, task_type, tags_csv, priority, status = sys.argv[1:]
domain_tags = [tag.strip() for tag in tags_csv.split(",") if tag.strip()]

payload = {
    "task_id": task_id,
    "lane": lane,
    "task_type": task_type,
    "domain_tags": domain_tags,
    "priority": priority,
    "status": status,
    "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}

print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
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

    ensure_lane_dir "$lane"

    local queue_dir="${TASK_BOARD_DIR}/${lane}/pending"
    local task_file="${queue_dir}/${task_id}.json"
    mkdir -p "$queue_dir"

    if [[ -f "$task_file" ]]; then
        log_error "Task already exists: ${task_file}"
        exit 1
    fi

    build_task_json "$lane" "$task_id" "$task_type" "$tags_csv" "$priority" "pending" > "$task_file"
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
    log_info "Moved task ${task_id} from ${from_state} to ${to_state}"
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
