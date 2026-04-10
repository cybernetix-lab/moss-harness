#!/bin/bash
#
# Learning Controller (Skeleton)
# Controls learning progression: start-iteration / spawn-study-tasks / replan / status.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${MOSS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
WORKFLOW_DIR="${RUNTIME_DIR}/workflows/learning"
TELEMETRY_DIR="${RUNTIME_DIR}/telemetry"
TELEMETRY_FILE="${TELEMETRY_DIR}/events.jsonl"
TASK_BOARD_SCRIPT="${PROJECT_ROOT}/scripts/task-board.sh"

BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info() { echo -e "${BLUE}[LEARN-CTRL]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

emit_learning_event() {
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

ensure_workflow_dir() {
  mkdir -p "$WORKFLOW_DIR"
}

campaign_file_path() {
  local campaign_id="$1"
  printf '%s/%s.json\n' "$WORKFLOW_DIR" "$campaign_id"
}

write_campaign_state() {
  local campaign_id="$1"
  local route="$2"
  local route_state="$3"
  local iteration="$4"
  local last_action="$5"
  local reason="${6-}"
  local file_path
  file_path="$(campaign_file_path "$campaign_id")"
  ensure_workflow_dir

  python3 - "$file_path" "$campaign_id" "$route" "$route_state" "$iteration" "$last_action" "$reason" <<'PY'
import json
import sys
from datetime import datetime, timezone

file_path, campaign_id, route, route_state, iteration, last_action, reason = sys.argv[1:]

payload = {
    "campaign_id": campaign_id,
    "policy_pack": "learning-progression",
    "route": route,
    "route_state": route_state,
    "iteration": int(iteration),
    "last_action": last_action,
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}

if reason:
    payload["reason"] = reason

try:
    with open(file_path, "r", encoding="utf-8") as fh:
        existing = json.load(fh)
except FileNotFoundError:
    existing = {}

existing.update(payload)

with open(file_path, "w", encoding="utf-8") as fh:
    json.dump(existing, fh, ensure_ascii=True, separators=(",", ":"))
PY
}

# Build and attach a minimal study plan to the campaign file based on the route
attach_study_plan() {
  local campaign_id="$1"
  local route="$2"
  local file_path
  file_path="$(campaign_file_path "$campaign_id")"
  ensure_workflow_dir

  python3 - "$file_path" "$route" <<'PY'
import json, sys

file_path, route = sys.argv[1:]

def build_plan(r: str):
    if r == "survey-cycle":
        return {"iteration": 1, "nodes": [{"type": "source-discovery", "topic": "topic-survey"}], "dependencies": []}
    if r == "extraction-cycle":
        return {"iteration": 1, "nodes": [{"type": "extraction", "batch": "top5"}], "dependencies": []}
    if r == "validation-cycle":
        return {"iteration": 1, "nodes": [{"type": "validation", "on": "representative-task"}], "dependencies": []}
    # default: synthesis-cycle
    return {
        "iteration": 1,
        "nodes": [
            {"type": "source-discovery", "topic": "topic-discovery"},
            {"type": "extraction", "batch": "top5"},
            {"type": "synthesis", "target": "patterns-v1"},
        ],
        "dependencies": [["source-discovery", "extraction"], ["extraction", "synthesis"]],
    }

with open(file_path, "r", encoding="utf-8") as fh:
    campaign = json.load(fh)

campaign["study_plan"] = build_plan(route)

with open(file_path, "w", encoding="utf-8") as fh:
    json.dump(campaign, fh, ensure_ascii=True, separators=(",", ":"))
PY
}

attach_study_plan_json() {
  local campaign_id="$1"
  local study_plan_json="$2"
  local file_path
  file_path="$(campaign_file_path "$campaign_id")"
  ensure_workflow_dir

  python3 - "$file_path" "$study_plan_json" <<'PY'
import json, sys

file_path, raw_plan = sys.argv[1:]
study_plan = json.loads(raw_plan)

with open(file_path, "r", encoding="utf-8") as fh:
    campaign = json.load(fh)

campaign["study_plan"] = study_plan

with open(file_path, "w", encoding="utf-8") as fh:
    json.dump(campaign, fh, ensure_ascii=True, separators=(",", ":"))
PY
}

create_delegated_tasks_from_plan() {
  local campaign_id="$1"
  local route="$2"
  local file_path
  file_path="$(campaign_file_path "$campaign_id")"

  # Load study plan and emit delegated tasks
  python3 - "$file_path" "$TASK_BOARD_SCRIPT" "$RUNTIME_DIR" "$campaign_id" "$route" "$TELEMETRY_FILE" <<'PY'
import json, subprocess, sys, shlex
from pathlib import Path
from datetime import datetime, timezone
import os

file_path, task_board_script, runtime_dir, campaign_id, route, telemetry_file = sys.argv[1:]

def emit_event(event_type: str, payload: dict):
    event = {
        "type": event_type,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "id": f"{event_type.replace('.', '_')}_{payload.get('task_id', 'unknown')}_{os.getpid()}",
        "data": payload,
    }
    Path(telemetry_file).parent.mkdir(parents=True, exist_ok=True)
    with open(telemetry_file, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")

with open(file_path, "r", encoding="utf-8") as fh:
    campaign = json.load(fh)

plan = campaign.get("study_plan", {})
nodes = plan.get("nodes", [])
dependencies = plan.get("dependencies", [])

delegated_ids = []
node_task_map = {}
seq = 0
for node in nodes:
    seq += 1
    ntype = node.get("type")
    # Map node -> lane
    if ntype in ("source-discovery", "extraction"):
        lane = "researcher"
    elif ntype == "synthesis":
        lane = "planner"
    elif ntype == "validation":
        lane = "evaluator"
    else:
        lane = "researcher"
    task_id = f"{campaign_id}-{ntype}-{seq}"
    delegated_ids.append(task_id)
    node_task_map[ntype] = task_id
    task_file = Path(runtime_dir) / "task-board" / lane / "pending" / f"{task_id}.json"
    # Create task via task-board
    if not task_file.exists():
        cmd = [
            task_board_script, "create",
            "--lane", lane,
            "--task-id", task_id,
            "--task-type", ntype,
            "--work-item-type", "learning",
            "--policy-pack", "learning-progression",
            "--route", route,
            "--route-state", "collecting",
            "--campaign-id", campaign_id,
            "--study-node-type", ntype,
            "--study-iteration", str(plan.get("iteration", 1)),
        ]
        subprocess.run(cmd, check=True)
        emit_event("learning.study.task.created", {
            "campaign_id": campaign_id,
            "task_id": task_id,
            "lane": lane,
            "study_node_type": ntype,
            "study_iteration": int(plan.get("iteration", 1)),
            "route": route,
        })
    else:
        emit_event("learning.study.task.skipped", {
            "campaign_id": campaign_id,
            "task_id": task_id,
            "lane": lane,
            "study_node_type": ntype,
            "study_iteration": int(plan.get("iteration", 1)),
            "route": route,
            "reason": "task_exists",
        })

# Apply dependency metadata after all tasks exist via task-board interface
for from_node, to_node in dependencies:
    dependent_task_id = node_task_map.get(to_node)
    prerequisite_task_id = node_task_map.get(from_node)
    if not dependent_task_id or not prerequisite_task_id:
        continue
    # Find dependent task file
    dependent_file = None
    for lane in ("researcher", "planner", "evaluator"):
        candidate = Path(runtime_dir) / "task-board" / lane / "pending" / f"{dependent_task_id}.json"
        if candidate.exists():
            dependent_file = candidate
            dependent_lane = lane
            break
    if dependent_file is None:
        continue
    with open(dependent_file, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    depends_on = payload.get("depends_on", [])
    if prerequisite_task_id not in depends_on:
        depends_on.append(prerequisite_task_id)
        cmd = [
            task_board_script, "update",
            "--lane", dependent_lane,
            "--task-id", dependent_task_id,
            "--state", "pending",
            "--depends-on", ",".join(depends_on),
        ]
        subprocess.run(cmd, check=True)

campaign["delegated_task_ids"] = delegated_ids

with open(file_path, "w", encoding="utf-8") as fh:
    json.dump(campaign, fh, ensure_ascii=True, separators=(",", ":"))

print(json.dumps({"count": len(delegated_ids), "task_ids": delegated_ids}, ensure_ascii=True, separators=(",", ":")))
PY
}

show_help() {
  cat <<EOF
Learning Controller

Usage: $0 <command> [options]

Commands:
  start-iteration --campaign-id <id> --route <route>
  spawn-study-tasks --campaign-id <id>
  replan --campaign-id <id> [--reason <text>]
  status --campaign-id <id>
  help

Notes:
- This is a minimal skeleton for call-chain wiring.
- It should eventually emit delegated lane tasks via task-board.sh.
EOF
}

cmd="${1-:help}"
shift || true

case "$cmd" in
  start-iteration)
    campaign_id=""; route=""; study_plan_json=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --campaign-id) campaign_id="${2-}"; shift 2;;
        --route) route="${2-}"; shift 2;;
        --study-plan-json) study_plan_json="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$campaign_id" || -z "$route" ]] && { log_err "Missing --campaign-id or --route"; exit 1; }
    write_campaign_state "$campaign_id" "$route" "collecting" "1" "start_iteration"
    if [[ -n "$study_plan_json" ]]; then
      attach_study_plan_json "$campaign_id" "$study_plan_json"
    else
      # Fallback for direct controller usage without orchestrator-provided plan
      attach_study_plan "$campaign_id" "$route"
    fi
    emit_learning_event "learning.iteration.started" "$(python3 - "$campaign_id" "$route" <<'PY'
import json, sys
campaign_id, route = sys.argv[1:]
print(json.dumps({
    "campaign_id": campaign_id,
    "route": route,
    "route_state": "collecting",
    "iteration": 1,
}, ensure_ascii=True, separators=(",", ":")))
PY
)"
    log_info "START iteration campaign=${campaign_id} route=${route}"
    echo "{\"campaign_id\":\"${campaign_id}\",\"action\":\"start_iteration\",\"route\":\"${route}\"}"
    ;;
  spawn-study-tasks)
    campaign_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --campaign-id) campaign_id="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$campaign_id" ]] && { log_err "Missing --campaign-id"; exit 1; }
    current_route="unknown"
    current_file="$(campaign_file_path "$campaign_id")"
    if [[ -f "$current_file" ]]; then
      current_route="$(python3 - "$current_file" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    print(json.load(fh).get("route", "unknown"))
PY
)"
    fi
    write_campaign_state "$campaign_id" "$current_route" "collecting" "1" "spawn_study_tasks"
    # Create delegated lane tasks from study plan and record ids
    spawned="$(create_delegated_tasks_from_plan "$campaign_id" "$current_route" )"
    emit_learning_event "learning.study.tasks.spawned" "$(python3 - "$campaign_id" "$current_route" "$spawned" <<'PY'
import json, sys
campaign_id, route, spawned = sys.argv[1:]
info = json.loads(spawned)
print(json.dumps({
    "campaign_id": campaign_id,
    "route": route,
    "route_state": "collecting",
    "delegated_count": info.get("count", 0),
    "delegated_task_ids": info.get("task_ids", []),
}, ensure_ascii=True, separators=(",", ":")))
PY
)"
    log_info "SPAWN delegated study tasks for campaign=${campaign_id}"
    echo "{\"campaign_id\":\"${campaign_id}\",\"action\":\"spawn_study_tasks\"}"
    ;;
  replan)
    campaign_id=""; reason=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --campaign-id) campaign_id="${2-}"; shift 2;;
        --reason) reason="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$campaign_id" ]] && { log_err "Missing --campaign-id"; exit 1; }
    current_route="unknown"
    current_file="$(campaign_file_path "$campaign_id")"
    if [[ -f "$current_file" ]]; then
      current_route="$(python3 - "$current_file" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    print(json.load(fh).get("route", "unknown"))
PY
)"
    fi
    write_campaign_state "$campaign_id" "$current_route" "replanning" "1" "replan" "$reason"
    emit_learning_event "learning.replan.requested" "$(python3 - "$campaign_id" "$current_route" "$reason" <<'PY'
import json, sys
campaign_id, route, reason = sys.argv[1:]
payload = {
    "campaign_id": campaign_id,
    "route": route,
    "route_state": "replanning",
}
if reason:
    payload["reason"] = reason
print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
)"
    log_warn "REPLAN campaign=${campaign_id} reason=${reason:-n/a}"
    echo "{\"campaign_id\":\"${campaign_id}\",\"action\":\"replan\",\"reason\":\"${reason}\"}"
    ;;
  status)
    campaign_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --campaign-id) campaign_id="${2-}"; shift 2;;
        *) log_err "Unknown option: $1"; exit 1;;
      esac
    done
    [[ -z "$campaign_id" ]] && { log_err "Missing --campaign-id"; exit 1; }
    current_file="$(campaign_file_path "$campaign_id")"
    if [[ ! -f "$current_file" ]]; then
      log_err "Campaign state not found: ${campaign_id}"
      exit 1
    fi
    cat "$current_file"
    ;;
  help|--help|-h|"")
    show_help;;
  *)
    log_err "Unknown command: $cmd"; show_help; exit 1;;
esac
