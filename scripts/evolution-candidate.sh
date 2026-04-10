#!/bin/bash
#
# Evolution Candidate
# 仅生成候选专家的原始提案（raw proposal），不触发自动 promotion。
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${MOSS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
TASK_BOARD_DIR="${RUNTIME_DIR}/task-board"
EVOLUTION_DIR="${RUNTIME_DIR}/evolution"
TELEMETRY_DIR="${RUNTIME_DIR}/telemetry"

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

show_help() {
    cat << EOF
Evolution Candidate

Usage: $0 <command> [options]

Commands:
    propose --lane <lane> --source-task <task_id> --proposed-by <agent_id>
        从成功的任务（completed）生成候选专家的原始提案，写入 .runtime/evolution/candidates/
        并记录 telemetry 事件；不修改 registry，不触发 MEMBER_PROMOTION_*。

    help
        Show this help message

Examples:
    $0 propose --lane executor --source-task task-frontend --proposed-by memory_curator
EOF
}

require_option_argument() {
    local option_name="$1"
    local option_value="${2-}"

    if [[ -z "$option_value" || "$option_value" == --* ]]; then
        log_error "Option ${option_name} requires a value"
        exit 1
    fi
}

require_value() {
    local name="$1"
    local value="$2"

    if [[ -z "$value" ]]; then
        log_error "Missing required option: $name"
        exit 1
    fi
}

propose_candidate() {
    local lane=""
    local source_task=""
    local proposed_by=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --source-task)
                require_option_argument "--source-task" "${2-}"
                source_task="${2:-}"
                shift 2
                ;;
            --proposed-by)
                require_option_argument "--proposed-by" "${2-}"
                proposed_by="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for propose: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--source-task" "$source_task"
    require_value "--proposed-by" "$proposed_by"

    local completed_task_file="${TASK_BOARD_DIR}/${lane}/completed/${source_task}.json"
    if [[ ! -f "$completed_task_file" ]]; then
        log_error "Completed task not found: ${completed_task_file}"
        exit 1
    fi

    mkdir -p "${EVOLUTION_DIR}/candidates/${lane}" "${TELEMETRY_DIR}"

    # 读取完成任务，提取基础证据
    local proposal_json
    if ! proposal_json="$(python3 - "$completed_task_file" "$lane" "$proposed_by" <<'PY'
import json
import sys
from datetime import datetime, timezone

task_file, lane, proposed_by = sys.argv[1:]
with open(task_file, "r", encoding="utf-8") as fh:
    task = json.load(fh)

task_id = str(task.get("task_id", "")).strip()
selected_agent = str(task.get("selected_agent", "")).strip()
domain_tags = task.get("domain_tags")
domain_tags = [str(t).strip() for t in domain_tags] if isinstance(domain_tags, list) else []
quality_score = task.get("quality_score")
try:
    quality_score = int(quality_score) if quality_score is not None else None
except (TypeError, ValueError):
    quality_score = None

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
candidate_id = f"{lane}_candidate_{task_id}"
request_id = f"member_promotion_proposed_{lane}_{task_id}_{int(datetime.now(timezone.utc).timestamp())}"

proposal = {
    "candidate_id": candidate_id,
    "lane": lane,
    "source_task": task_id,
    "proposed_by": proposed_by,
    "status": "proposal",
    "evidence": {
        "domain_tags": domain_tags,
        "quality_score": quality_score,
        "selected_agent": selected_agent
    },
    "protocol_envelope": {
        "request_id": request_id,
        "protocol_type": "member_promotion",
        "lifecycle_state": "proposed"
    },
    "created_at": timestamp
}

print(json.dumps(proposal, ensure_ascii=True, separators=(",", ":")))
PY
    )"; then
        log_error "Failed to build proposal from task: ${completed_task_file}"
        exit 1
    fi

    # 写入提案文件
    local candidate_id
    candidate_id="$(python3 -c 'import json,sys; p=json.loads(sys.argv[1]); print(p.get("candidate_id",""))' "$proposal_json")"
    if [[ -z "$candidate_id" ]]; then
        log_error "Invalid proposal payload (missing candidate_id)"
        exit 1
    fi
    local proposal_file="${EVOLUTION_DIR}/candidates/${lane}/${candidate_id}.json"
    printf '%s\n' "$proposal_json" > "$proposal_file"

    # 记录 telemetry 事件，仅为 proposed，不做审批或晋升
    python3 - "$TELEMETRY_DIR/events.jsonl" "$proposal_json" <<'PY'
import json, sys, os
from datetime import datetime, timezone

telemetry_file, proposal_json = sys.argv[1:]
proposal = json.loads(proposal_json)
timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
event = {
    "type": "member.promotion.proposed",
    "timestamp": timestamp,
    "id": proposal["protocol_envelope"]["request_id"],
    "data": {
        "candidate_id": proposal["candidate_id"],
        "lane": proposal["lane"],
        "source_task": proposal["source_task"],
        "proposed_by": proposal["proposed_by"],
        "evidence": proposal.get("evidence", {}),
        "protocol_envelope": proposal.get("protocol_envelope", {}),
    },
}
os.makedirs(os.path.dirname(telemetry_file), exist_ok=True)
with open(telemetry_file, "a", encoding="utf-8") as fh:
    fh.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")
PY

    # 输出 summary（供 bats 校验）
    echo "$proposal_json"
}

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        propose)
            propose_candidate "$@"
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

