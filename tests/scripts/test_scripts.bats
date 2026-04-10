#!/usr/bin/env bats

load ../test_helper

# memory-manager.sh 测试
@test "memory-manager.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/memory-manager.sh"
  [[ -x "$PROJECT_ROOT/scripts/memory-manager.sh" ]]
}

@test "memory-manager.sh should show help" {
  run "$PROJECT_ROOT/scripts/memory-manager.sh" --help
  assert_success
}

# router.sh 测试
@test "router.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/router.sh"
  [[ -x "$PROJECT_ROOT/scripts/router.sh" ]]
}

@test "router.sh should show help" {
  run "$PROJECT_ROOT/scripts/router.sh" help
  assert_success
  assert_output_contains "Workflow Orchestrator Router"
  assert_output_contains "orchestrate"
}

@test "router.sh orchestrate should create task governance entry" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"
  local task_file="$MOSS_RUNTIME_DIR/task-board/coordinator/pending/task-router-test.json"
  local telemetry_file="$MOSS_RUNTIME_DIR/telemetry/events.jsonl"

  run "$PROJECT_ROOT/scripts/router.sh" orchestrate \
    --text "Implement a local bugfix" \
    --task-id "task-router-test" \
    --task-type "bugfix" \
    --tags "cli,test" \
    --priority "high"

  assert_success
  assert_output_contains "\"work_item_type\":\"task\""
  assert_output_contains "\"task_id\":\"task-router-test\""
  assert_file_exists "$task_file"
  assert_file_exists "$telemetry_file"

  run python3 - "$task_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

assert payload["work_item_type"] == "task"
assert payload["policy_pack"] == "task-governance"
assert payload["route"] == "fast-path"
assert payload["route_state"] == "in_progress"
PY
  assert_success

  if ! grep -q '"type":"workflow.intent.recognized"' "$telemetry_file"; then
    echo "Expected telemetry to contain workflow.intent.recognized"
    return 1
  fi
  if ! grep -q '"type":"workflow.policy.selected"' "$telemetry_file"; then
    echo "Expected telemetry to contain workflow.policy.selected"
    return 1
  fi
  if ! grep -q '"type":"task.path.selected"' "$telemetry_file"; then
    echo "Expected telemetry to contain task.path.selected"
    return 1
  fi
}

@test "router.sh orchestrate should create learning progression entry" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"
  local campaign_file="$MOSS_RUNTIME_DIR/workflows/learning/learn-feedback-control.json"
  local telemetry_file="$MOSS_RUNTIME_DIR/telemetry/events.jsonl"

  run "$PROJECT_ROOT/scripts/router.sh" orchestrate \
    --campaign "Study feedback control" \
    --campaign-id "learn-feedback-control"

  assert_success
  assert_output_contains "\"work_item_type\":\"learning\""
  assert_output_contains "\"route\":\"synthesis-cycle\""
  assert_file_exists "$campaign_file"
  assert_file_exists "$telemetry_file"

  run python3 - "$campaign_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

assert payload["campaign_id"] == "learn-feedback-control"
assert payload["policy_pack"] == "learning-progression"
assert payload["route"] == "synthesis-cycle"
assert payload["route_state"] == "collecting"
assert payload["iteration"] == 1
assert len(payload["study_plan"]["nodes"]) == 3
assert payload["study_plan"]["nodes"][0]["type"] == "source-discovery"
PY
  assert_success

  if ! grep -q '"type":"workflow.intent.recognized"' "$telemetry_file"; then
    echo "Expected telemetry to contain workflow.intent.recognized"
    return 1
  fi
  if ! grep -q '"type":"workflow.policy.selected"' "$telemetry_file"; then
    echo "Expected telemetry to contain workflow.policy.selected"
    return 1
  fi
  if ! grep -q '"type":"learning.route.selected"' "$telemetry_file"; then
    echo "Expected telemetry to contain learning.route.selected"
    return 1
  fi
}

@test "learning-controller.sh should report and replan campaign state" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"
  local telemetry_file="$MOSS_RUNTIME_DIR/telemetry/events.jsonl"

  run "$PROJECT_ROOT/scripts/learning-controller.sh" start-iteration \
    --campaign-id "learn-status-test" \
    --route "survey-cycle"
  assert_success

  run "$PROJECT_ROOT/scripts/learning-controller.sh" status \
    --campaign-id "learn-status-test"
  assert_success
  assert_output_contains "\"route\":\"survey-cycle\""
  assert_output_contains "\"route_state\":\"collecting\""

  run "$PROJECT_ROOT/scripts/learning-controller.sh" replan \
    --campaign-id "learn-status-test" \
    --reason "need more evidence"
  assert_success

  run "$PROJECT_ROOT/scripts/learning-controller.sh" status \
    --campaign-id "learn-status-test"
  assert_success
  assert_output_contains "\"route_state\":\"replanning\""
  assert_output_contains "\"reason\":\"need more evidence\""

  assert_file_exists "$telemetry_file"
  if ! grep -q '"type":"learning.iteration.started"' "$telemetry_file"; then
    echo "Expected telemetry to contain learning.iteration.started"
    return 1
  fi
  if ! grep -q '"type":"learning.replan.requested"' "$telemetry_file"; then
    echo "Expected telemetry to contain learning.replan.requested"
    return 1
  fi
}

@test "learning-controller.sh should spawn delegated lane tasks from study plan" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"
  local campaign_file="$MOSS_RUNTIME_DIR/workflows/learning/learn-spawn-test.json"
  local telemetry_file="$MOSS_RUNTIME_DIR/telemetry/events.jsonl"
  local task_board_dir="$MOSS_RUNTIME_DIR/task-board"

  run "$PROJECT_ROOT/scripts/learning-controller.sh" start-iteration \
    --campaign-id "learn-spawn-test" \
    --route "synthesis-cycle"
  assert_success

  run "$PROJECT_ROOT/scripts/learning-controller.sh" spawn-study-tasks \
    --campaign-id "learn-spawn-test"
  assert_success
  assert_output_contains "\"action\":\"spawn_study_tasks\""

  assert_file_exists "$campaign_file"
  assert_file_exists "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-spawn-test-source-discovery-1.json"
  assert_file_exists "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-spawn-test-extraction-2.json"
  assert_file_exists "$MOSS_RUNTIME_DIR/task-board/planner/pending/learn-spawn-test-synthesis-3.json"

  run python3 - "$campaign_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

assert payload["route"] == "synthesis-cycle"
assert payload["last_action"] == "spawn_study_tasks"
assert len(payload["study_plan"]["nodes"]) == 3
assert len(payload["delegated_task_ids"]) == 3
PY
  assert_success

  assert_file_exists "$telemetry_file"
  if ! grep -q '"type":"learning.study.tasks.spawned"' "$telemetry_file"; then
    echo "Expected telemetry to contain learning.study.tasks.spawned"
    return 1
  fi
  local created_count
  created_count=$(grep -c '"type":"learning.study.task.created"' "$telemetry_file" || true)
  [ "$created_count" -ge 3 ]

  local before_count
  before_count=$(find "$task_board_dir" -type f -name 'learn-spawn-test-*.json' | wc -l | tr -d ' ')

  run "$PROJECT_ROOT/scripts/learning-controller.sh" spawn-study-tasks \
    --campaign-id "learn-spawn-test"
  assert_success

  local after_count
  after_count=$(find "$task_board_dir" -type f -name 'learn-spawn-test-*.json' | wc -l | tr -d ' ')
  [ "$before_count" -eq "$after_count" ]
  local skipped_count
  skipped_count=$(grep -c '"type":"learning.study.task.skipped"' "$telemetry_file" || true)
  [ "$skipped_count" -ge 3 ]

  run python3 - "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-spawn-test-extraction-2.json" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

assert "learn-spawn-test-source-discovery-1" in payload.get("depends_on", [])
assert payload["campaign_id"] == "learn-spawn-test"
assert payload["study_node_type"] == "extraction"
assert payload["study_iteration"] == 1
PY
  assert_success

  run python3 - "$MOSS_RUNTIME_DIR/task-board/planner/pending/learn-spawn-test-synthesis-3.json" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

assert "learn-spawn-test-extraction-2" in payload.get("depends_on", [])
assert payload["campaign_id"] == "learn-spawn-test"
assert payload["study_node_type"] == "synthesis"
assert payload["study_iteration"] == 1
PY
  assert_success
}

@test "path-controller.sh should update route_state for tracked task" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"
  local task_file="$MOSS_RUNTIME_DIR/task-board/planner/pending/task-path-state.json"
  local telemetry_file="$MOSS_RUNTIME_DIR/telemetry/events.jsonl"

  run "$PROJECT_ROOT/scripts/task-board.sh" create \
    --lane "planner" \
    --task-id "task-path-state" \
    --task-type "feature" \
    --work-item-type "task" \
    --policy-pack "task-governance" \
    --route "standard-path" \
    --route-state "queued"
  assert_success
  assert_file_exists "$task_file"

  run "$PROJECT_ROOT/scripts/path-controller.sh" start \
    --task-id "task-path-state" \
    --route "standard-path"
  assert_success

  run "$PROJECT_ROOT/scripts/path-controller.sh" status \
    --task-id "task-path-state"
  assert_success
  assert_output_contains "\"route\":\"standard-path\""
  assert_output_contains "\"route_state\":\"in_progress\""

  run "$PROJECT_ROOT/scripts/path-controller.sh" upgrade \
    --task-id "task-path-state" \
    --to "full-governance-path"
  assert_success

  run python3 - "$task_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

assert payload["route_state"] == "upgraded"
assert payload["route"] == "full-governance-path"
PY
  assert_success

  assert_file_exists "$telemetry_file"
  if ! grep -q '"type":"task.path.started"' "$telemetry_file"; then
    echo "Expected telemetry to contain task.path.started"
    return 1
  fi
  if ! grep -q '"type":"task.path.upgraded"' "$telemetry_file"; then
    echo "Expected telemetry to contain task.path.upgraded"
    return 1
  fi
}

@test "task-board.sh should show and update orchestrator metadata" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"

  run "$PROJECT_ROOT/scripts/task-board.sh" create \
    --lane "planner" \
    --task-id "task-board-meta" \
    --task-type "feature" \
    --work-item-type "task" \
    --policy-pack "task-governance" \
    --route "standard-path" \
    --route-state "queued"
  assert_success

  run "$PROJECT_ROOT/scripts/task-board.sh" show \
    --lane "planner" \
    --task-id "task-board-meta" \
    --state "pending"
  assert_success
  assert_output_contains "\"route\":\"standard-path\""
  assert_output_contains "\"route_state\":\"queued\""

  run "$PROJECT_ROOT/scripts/task-board.sh" update \
    --lane "planner" \
    --task-id "task-board-meta" \
    --state "pending" \
    --route-state "in_progress" \
    --route "standard-path"
  assert_success

  run "$PROJECT_ROOT/scripts/task-board.sh" show \
    --lane "planner" \
    --task-id "task-board-meta" \
    --state "pending"
  assert_success
  assert_output_contains "\"route_state\":\"in_progress\""
}

@test "task-board.sh should persist depends_on metadata" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/runtime"
  mkdir -p "$MOSS_RUNTIME_DIR"
  local task_file="$MOSS_RUNTIME_DIR/task-board/planner/pending/task-board-deps.json"

  run "$PROJECT_ROOT/scripts/task-board.sh" create \
    --lane "planner" \
    --task-id "task-board-deps" \
    --task-type "synthesis" \
    --work-item-type "learning" \
    --policy-pack "learning-progression" \
    --route "synthesis-cycle" \
    --route-state "collecting" \
    --depends-on "dep-a,dep-b"
  assert_success
  assert_file_exists "$task_file"

  run python3 - "$task_file" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
assert payload.get("depends_on") == ["dep-a", "dep-b"]
PY
  assert_success

  run "$PROJECT_ROOT/scripts/task-board.sh" update \
    --lane "planner" \
    --task-id "task-board-deps" \
    --state "pending" \
    --depends-on "dep-a,dep-b,dep-c"
  assert_success

  run python3 - "$task_file" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)
assert payload.get("depends_on") == ["dep-a", "dep-b", "dep-c"]
PY
  assert_success
}

# sandbox-manager.sh 测试
@test "sandbox-manager.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/sandbox-manager.sh"
  [[ -x "$PROJECT_ROOT/scripts/sandbox-manager.sh" ]]
}

@test "sandbox-manager.sh should show help" {
  run "$PROJECT_ROOT/scripts/sandbox-manager.sh" --help
  assert_success
}

# subagent-manager.sh 测试
@test "subagent-manager.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/subagent-manager.sh"
  [[ -x "$PROJECT_ROOT/scripts/subagent-manager.sh" ]]
}

# storage-manager.sh 测试
@test "storage-manager.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/storage-manager.sh"
  [[ -x "$PROJECT_ROOT/scripts/storage-manager.sh" ]]
}

# feishu-gateway.sh 测试
@test "feishu-gateway.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/feishu-gateway.sh"
  [[ -x "$PROJECT_ROOT/scripts/feishu-gateway.sh" ]]
}

# 运行时目录测试
@test "runtime directory should exist" {
  assert_dir_exists "$PROJECT_ROOT/runtime"
  assert_dir_exists "$PROJECT_ROOT/runtime/memory"
  assert_dir_exists "$PROJECT_ROOT/runtime/sandbox"
  assert_dir_exists "$PROJECT_ROOT/runtime/subagent"
}
