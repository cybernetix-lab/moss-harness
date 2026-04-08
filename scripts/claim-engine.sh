#!/bin/bash
#
# Claim Engine
# 基于 lane roster、task board 和 presence 为任务选择认领者
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${AHARNESS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
TASK_BOARD_DIR="${RUNTIME_DIR}/task-board"
TEAMMATES_DIR="${RUNTIME_DIR}/teammates"
TELEMETRY_DIR="${RUNTIME_DIR}/telemetry"
TRANSACTIONS_DIR="${RUNTIME_DIR}/transactions"
TASK_BOARD_SCRIPT="${SCRIPT_DIR}/task-board.sh"
ROSTER_LOADER_SCRIPT="${SCRIPT_DIR}/roster-loader.sh"

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
CLAIM_ENGINE_ROSTER_TMP=""
CLAIM_ENGINE_LOCK_DIR=""

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

cleanup_claim_resources() {
    if [[ -n "${CLAIM_ENGINE_ROSTER_TMP}" ]]; then
        rm -f "${CLAIM_ENGINE_ROSTER_TMP}"
    fi
    if [[ -n "${CLAIM_ENGINE_LOCK_DIR}" ]]; then
        rm -rf "${CLAIM_ENGINE_LOCK_DIR}"
    fi
}

trap cleanup_claim_resources EXIT

show_help() {
    cat << EOF
Claim Engine

Usage: $0 <command> [options]

Commands:
    claim --lane <lane> --task-id <task_id> [--agent <agent_id>]
        Claim a pending task in a lane with expert-first selection and backup fallback

    help
        Show this help message

Examples:
    $0 claim --lane executor --task-id task-frontend
    $0 claim --lane executor --task-id task-backend --agent backend_executor
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

run_before_move_hook() {
    local lane="$1"
    local task_id="$2"
    local hook_path="${AHARNESS_CLAIM_BEFORE_MOVE_HOOK:-}"

    if [[ -z "$hook_path" ]]; then
        return 0
    fi

    if [[ ! -x "$hook_path" ]]; then
        log_error "Claim before-move hook is not executable: ${hook_path}"
        exit 1
    fi

    "$hook_path" "$lane" "$task_id"
}

should_fail_after_step() {
    local step="$1"
    local configured_step="${AHARNESS_CLAIM_FAIL_AFTER:-}"
    [[ -n "$configured_step" && "$configured_step" == "$step" ]]
}

write_transaction_state() {
    local transaction_dir="$1"
    local state="$2"
    printf '%s\n' "$state" > "${transaction_dir}/state"
}

# Mark commit failed and perform minimal rollback to keep pending visible and remove partial side-effects
commit_fail() {
    local transaction_dir="$1"
    local request_id="$2"
    local task_id="$3"
    local claimed_file="$4"
    local claim_record_dir="$5"
    local pending_backup="$6"
    local pending_file="$7"
    local message="${8:-}"

    # Best-effort cleanup of partial artifacts
    rm -f "$claimed_file" 2>/dev/null || true
    rm -rf "$claim_record_dir" 2>/dev/null || true
    # Restore pending from backup if present
    if [[ -f "$pending_backup" ]]; then
        mv -f "$pending_backup" "$pending_file" 2>/dev/null || true
    fi
    write_transaction_state "$transaction_dir" "commit_failed"
    printf '{"error":"transaction_commit_failed","request_id":"%s","task_id":"%s","message":"%s"}\n' "$request_id" "$task_id" "$message" >&2
    exit 1
}

claim_task() {
    local lane=""
    local task_id=""
    local requested_agent=""

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
            --agent)
                require_option_argument "--agent" "${2-}"
                requested_agent="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for claim: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--task-id" "$task_id"

    local pending_task_file="${TASK_BOARD_DIR}/${lane}/pending/${task_id}.json"
    local claimed_task_file="${TASK_BOARD_DIR}/${lane}/claimed/${task_id}.json"
    # claim records are stored by request_id under .runtime/claims/<request_id>/record.json
    local claims_root_dir="${RUNTIME_DIR}/claims"
    local telemetry_file="${TELEMETRY_DIR}/events.jsonl"
    local transactions_root_dir="${TRANSACTIONS_DIR}/claims"
    local claim_lock_parent_dir="${RUNTIME_DIR}/locks/claim-engine/${lane}"
    local claim_lock_dir="${claim_lock_parent_dir}/${task_id}.lock"

    mkdir -p "$claim_lock_parent_dir"
    if ! mkdir "$claim_lock_dir" 2>/dev/null; then
        log_error "Task is already being claimed: ${lane}/${task_id}"
        exit 1
    fi
    CLAIM_ENGINE_LOCK_DIR="$claim_lock_dir"

    if [[ ! -f "$pending_task_file" ]]; then
        log_error "Pending task not found: ${pending_task_file}"
        exit 1
    fi

    local roster_json
    if ! roster_json="$("${ROSTER_LOADER_SCRIPT}" list --lane "$lane")"; then
        log_error "Failed to load roster for lane: ${lane}"
        exit 1
    fi

    local roster_tmp
    roster_tmp="$(mktemp "${RUNTIME_DIR}/.claim-roster.${lane}.${task_id}.XXXXXX")"
    CLAIM_ENGINE_ROSTER_TMP="$roster_tmp"
    printf '%s\n' "$roster_json" > "$roster_tmp"

    local selection_json
    if ! selection_json="$(python3 - "$pending_task_file" "$roster_tmp" "$TEAMMATES_DIR" "$lane" "$requested_agent" <<'PY'
import json
import sys

task_file, roster_file, teammates_dir, lane, requested_agent = sys.argv[1:]

with open(task_file, "r", encoding="utf-8") as fh:
    task = json.load(fh)

with open(roster_file, "r", encoding="utf-8") as fh:
    roster = json.load(fh)

selection_policy = roster.get("selection_policy")
selection_policy = selection_policy if isinstance(selection_policy, dict) else {}
preferred_modes = selection_policy.get("preferred_modes")
preferred_modes = [
    str(mode).strip().lower()
    for mode in preferred_modes
    if str(mode).strip()
] if isinstance(preferred_modes, list) else []

candidate_ids = {
    str(member.get("id", "")).strip()
    for member in roster.get("candidates", [])
    if isinstance(member, dict) and str(member.get("id", "")).strip()
}

task_tags = task.get("domain_tags")
task_tags = [str(tag).strip() for tag in task_tags] if isinstance(task_tags, list) else []
task_tag_set = {tag for tag in task_tags if tag}

members = []

for mode_name in ("experts", "backup"):
    raw_members = roster.get(mode_name)
    if not isinstance(raw_members, list):
        continue
    default_mode = "expert" if mode_name == "experts" else "backup"
    for member in raw_members:
        if not isinstance(member, dict):
            continue
        member_id = str(member.get("id", "")).strip()
        if not member_id:
            continue
        members.append({
            "id": member_id,
            "mode": str(member.get("mode", default_mode)).strip() or default_mode,
            "status": str(member.get("status", "")).strip().lower(),
            "domain_tags": [
                str(tag).strip()
                for tag in member.get("domain_tags", [])
                if str(tag).strip()
            ] if isinstance(member.get("domain_tags"), list) else [],
        })

requested_agent = requested_agent.strip()
if requested_agent:
    members = [member for member in members if member["id"] == requested_agent]
    if not members:
        print(json.dumps({
            "error": f"requested agent is not registered in lane {lane}",
            "requested_agent": requested_agent,
        }, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
        sys.exit(1)
else:
    if preferred_modes:
        preferred_mode_set = set(preferred_modes)
        members = [member for member in members if member["mode"] in preferred_mode_set]


def load_presence(agent_id: str):
    presence_file = f"{teammates_dir}/{lane}/{agent_id}/presence.json"
    try:
        with open(presence_file, "r", encoding="utf-8") as fh:
            presence = json.load(fh)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None

    if str(presence.get("lane", lane)).strip() != lane:
        return None

    lifecycle = str(presence.get("lifecycle", "")).strip().lower()
    availability_raw = presence.get("availability", 0)
    try:
        availability = float(availability_raw)
    except (TypeError, ValueError):
        availability = 0.0

    if lifecycle != "idle" or availability <= 0:
        return None

    return {
        "lifecycle": lifecycle,
        "availability": availability,
    }


def score_member(member):
    member_tags = set(member["domain_tags"])
    overlap_count = len(task_tag_set & member_tags)
    has_task_tags = bool(task_tag_set)
    mode = member["mode"]
    route_score = overlap_count * 100.0
    route_score += member["availability"] * 10.0
    if mode == "expert":
        route_score += 1000.0
        # Candidate experts remain eligible peers; this only nudges sorting.
        if member["id"] in candidate_ids:
            route_score += 1.0
    if not has_task_tags and mode == "expert":
        route_score += 50.0
    return overlap_count, route_score


eligible = []
for member in members:
    presence = load_presence(member["id"])
    if presence is None:
        continue
    member["availability"] = presence["availability"]
    member["lifecycle"] = presence["lifecycle"]
    overlap_count, route_score = score_member(member)
    member["overlap_count"] = overlap_count
    member["route_score"] = route_score
    eligible.append(member)

expert_candidates = [
    member for member in eligible
    if member["mode"] == "expert" and (member["overlap_count"] > 0 or not task_tag_set)
]
backup_candidates = [member for member in eligible if member["mode"] == "backup"]

selected = None
selection_reason = ""
fallback_used = False

if requested_agent:
    selected = max(eligible, key=lambda item: (item["route_score"], item["availability"], item["id"]), default=None)
    if selected is None:
        print(json.dumps({
            "error": f"requested agent is unavailable: {requested_agent}",
            "requested_agent": requested_agent,
        }, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
        sys.exit(1)
    selection_reason = "manual_override"
    fallback_used = selected["mode"] == "backup"
else:
    mode_order = preferred_modes or ["expert", "backup"]
    expert_was_preferred = False

    for mode in mode_order:
        if mode == "expert":
            expert_was_preferred = True
            if expert_candidates:
                selected = max(expert_candidates, key=lambda item: (item["route_score"], item["availability"], item["id"]))
                selection_reason = "expert_domain_match"
                break
        elif mode == "backup":
            if backup_candidates:
                selected = max(backup_candidates, key=lambda item: (item["availability"], item["route_score"], item["id"]))
                fallback_used = True
                selection_reason = "backup_fallback" if expert_was_preferred else "preferred_mode_backup"
                break

    if selected is None:
        print(json.dumps({
            "error": f"no available claimant for lane {lane}",
            "lane": lane,
            "task_id": task.get("task_id"),
        }, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
        sys.exit(1)

print(json.dumps({
    "task_id": task.get("task_id"),
    "lane": lane,
    "selected_agent": selected["id"],
    "selected_mode": selected["mode"],
    "selection_reason": selection_reason,
    "fallback_used": fallback_used,
    "route_score": round(float(selected["route_score"]), 3),
    "availability": round(float(selected["availability"]), 3),
    "matched_domain_tags": [
        tag for tag in task_tags
        if tag in set(selected["domain_tags"])
    ],
}, ensure_ascii=True, separators=(",", ":")))
PY
    )"; then
        mkdir -p "$TELEMETRY_DIR"
        python3 - "$telemetry_file" "$lane" "$task_id" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

telemetry_file, lane, task_id = sys.argv[1:]
os.makedirs(os.path.dirname(telemetry_file), exist_ok=True)
event = {
    "type": "task.claim.rejected",
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "id": f"claim_rejected_{task_id}_{os.getpid()}",
    "data": {
        "lane": lane,
        "task_id": task_id,
        "reason": "selection_failed",
    },
}
with open(telemetry_file, "a", encoding="utf-8") as fh:
    fh.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")
PY
        exit 1
    fi

    run_before_move_hook "$lane" "$task_id"

    mkdir -p "$claims_root_dir" "$TELEMETRY_DIR" "$transactions_root_dir" "$(dirname "$claimed_task_file")"

    local claim_timestamp
    claim_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    local claim_suffix
    claim_suffix="$(date +%s)"
    local claim_id="claim_${task_id}_${claim_suffix}_$$"
    local request_id="task_claim_${task_id}_${claim_suffix}_$$"
    local transaction_dir="${transactions_root_dir}/${request_id}"
    mkdir -p "$transaction_dir"

    if ! python3 - "$pending_task_file" "$transaction_dir" "$selection_json" "$claim_id" "$request_id" "$claim_timestamp" <<'PY'
import json
import os
import sys

pending_task_file, transaction_dir, selection_json, claim_id, request_id, timestamp = sys.argv[1:]

with open(pending_task_file, "r", encoding="utf-8") as fh:
    task = json.load(fh)

selection = json.loads(selection_json)

task["selected_agent"] = selection["selected_agent"]
task["selected_mode"] = selection["selected_mode"]
task["selection_reason"] = selection["selection_reason"]
task["claim_id"] = claim_id
task["claimed_at"] = timestamp

claim_record = {
    "claim_id": claim_id,
    "request_id": request_id,
    "protocol_type": "task_claim",
    "lifecycle_state": "claimed",
    "protocol_envelope": {
        "request_id": request_id,
        "protocol_type": "task_claim",
        "lifecycle_state": "claimed",
    },
    "task_id": selection["task_id"],
    "lane": selection["lane"],
    "selected_agent": selection["selected_agent"],
    "selected_mode": selection["selected_mode"],
    "selection_reason": selection["selection_reason"],
    "claimed_at": timestamp,
}

telemetry_event = {
    "type": "task.claim.granted",
    "timestamp": timestamp,
    "id": claim_id,
    "data": {
        "request_id": request_id,
        "protocol_type": "task_claim",
        "lifecycle_state": "claimed",
        "task_id": selection["task_id"],
        "lane": selection["lane"],
        "selected_agent": selection["selected_agent"],
        "selected_mode": selection["selected_mode"],
        "selection_reason": selection["selection_reason"],
        "fallback_used": selection["fallback_used"],
        "matched_domain_tags": selection["matched_domain_tags"],
        "route_score": selection["route_score"],
        "availability": selection["availability"],
    },
}

manifest = {
    "request_id": request_id,
    "claim_id": claim_id,
    "task_id": selection["task_id"],
    "lane": selection["lane"],
    "selected_agent": selection["selected_agent"],
    "selected_mode": selection["selected_mode"],
    "selection_reason": selection["selection_reason"],
    "fallback_used": selection["fallback_used"],
    "claimed_at": timestamp,
}

os.makedirs(transaction_dir, exist_ok=True)

with open(os.path.join(transaction_dir, "claimed-task.json"), "w", encoding="utf-8") as fh:
    json.dump(task, fh, ensure_ascii=True, separators=(",", ":"))

with open(os.path.join(transaction_dir, "claim-record.json"), "w", encoding="utf-8") as fh:
    json.dump(claim_record, fh, ensure_ascii=True, separators=(",", ":"))

with open(os.path.join(transaction_dir, "telemetry-event.json"), "w", encoding="utf-8") as fh:
    fh.write(json.dumps(telemetry_event, ensure_ascii=True, separators=(",", ":")) + "\n")

with open(os.path.join(transaction_dir, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=True, separators=(",", ":"))
PY
    then
        write_transaction_state "$transaction_dir" "aborted"
        log_error "Failed to prepare transactional claim artifacts"
        exit 1
    fi

    write_transaction_state "$transaction_dir" "prepared"

    if [[ ! -f "$pending_task_file" ]]; then
        write_transaction_state "$transaction_dir" "commit_failed"
        log_error "Pending task disappeared before commit: ${pending_task_file}"
        printf '{"error":"transaction_commit_failed","request_id":"%s","task_id":"%s"}\n' "$request_id" "$task_id" >&2
        exit 1
    fi

    local temp_claimed_file=""
    local temp_claim_record_dir=""
    local claim_record_dir="${claims_root_dir}/${request_id}"
    local temp_telemetry_file=""
    local pending_backup_file="${TASK_BOARD_DIR}/${lane}/pending/.${task_id}.bak.$$"

    # Move pending to a backup to avoid double-visibility; restore on failure
    if ! mv -f "$pending_task_file" "$pending_backup_file"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to backup pending before commit"
    fi

    temp_claimed_file="$(mktemp "${TASK_BOARD_DIR}/${lane}/claimed/.${task_id}.XXXXXX")"
    if ! cp "${transaction_dir}/claimed-task.json" "$temp_claimed_file"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to stage claimed task"
    fi
    if ! mv -f "$temp_claimed_file" "$claimed_task_file"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to publish claimed task"
    fi
    temp_claimed_file=""

    if should_fail_after_step "claim_record"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failure injected after claim_record"
    fi

    temp_claim_record_dir="${claims_root_dir}/.${request_id}.tmp.$$"
    if ! mkdir -p "$temp_claim_record_dir"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to create claim record tmp dir"
    fi
    if ! cp "${transaction_dir}/claim-record.json" "${temp_claim_record_dir}/record.json"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to stage claim record"
    fi
    if ! mv "$temp_claim_record_dir" "$claim_record_dir"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to publish claim record"
    fi
    temp_claim_record_dir=""

    if should_fail_after_step "telemetry"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failure injected before telemetry"
    fi

    temp_telemetry_file="$(mktemp "${TELEMETRY_DIR}/.events.jsonl.XXXXXX")"
    if [[ -f "$telemetry_file" ]]; then
        if ! cat "$telemetry_file" > "$temp_telemetry_file"; then
            commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to copy existing telemetry"
        fi
    fi
    if ! cat "${transaction_dir}/telemetry-event.json" >> "$temp_telemetry_file"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to append telemetry event"
    fi
    if ! mv -f "$temp_telemetry_file" "$telemetry_file"; then
        commit_fail "$transaction_dir" "$request_id" "$task_id" "$claimed_task_file" "$claim_record_dir" "$pending_backup_file" "$pending_task_file" "failed to publish telemetry"
    fi
    temp_telemetry_file=""

    # Success path: remove pending backup and mark committed
    rm -f "$pending_backup_file" 2>/dev/null || true
    write_transaction_state "$transaction_dir" "committed"

    python3 - "$transaction_dir/manifest.json" <<'PY'
import json
import sys

manifest_file = sys.argv[1]
with open(manifest_file, "r", encoding="utf-8") as fh:
    manifest = json.load(fh)

print(json.dumps({
    "task_id": manifest["task_id"],
    "lane": manifest["lane"],
    "selected_agent": manifest["selected_agent"],
    "selected_mode": manifest["selected_mode"],
    "fallback_used": manifest.get("fallback_used", False),
    "claim_id": manifest["claim_id"],
    "request_id": manifest["request_id"],
}, ensure_ascii=True, separators=(",", ":")))
PY
}

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        claim)
            claim_task "$@"
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
