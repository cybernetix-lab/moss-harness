#!/usr/bin/env bats

load ../test_helper

build_mosscli() {
  run npm --prefix "$PROJECT_ROOT/apps/mosscli" run build
  assert_success
}

extract_run_id_from_output() {
  local command_output="$1"

  if [[ ! "$command_output" =~ \"run_id\":\"([^\"]+)\" ]]; then
    echo "Expected command output to contain run_id"
    return 1
  fi

  printf '%s\n' "${BASH_REMATCH[1]}"
}

@test "mosscli run should reroute when reviewer rejects and write feedback decisions" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  export MOSSCLI_FORCE_REVIEW_REJECT=1
  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Implement login flow"
  assert_success

  local run_id
  run_id="$(extract_run_id_from_output "$output")"

  assert_file_exists "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/feedback.json"

  run jq -r '.[0].action' "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/feedback.json"
  assert_success
  assert_output_contains "send_to_previous_stage"
}

@test "mosscli evaluate should include system signals and emergence-oriented metrics" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Implement login flow"
  assert_success

  local run_id
  run_id="$(extract_run_id_from_output "$output")"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" evaluate --run-id "$run_id" --format json
  assert_success
  assert_output_contains '"moss_expert_hit_rate"'
  assert_output_contains '"moss_fallback_rate"'
  assert_output_contains '"systemSignals"'
}

@test "mosscli evaluate should render learning campaign summary" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$MOSS_RUNTIME_DIR/workflows/learning" \
           "$MOSS_RUNTIME_DIR/task-board/researcher/pending" \
           "$MOSS_RUNTIME_DIR/task-board/planner/pending" \
           "$MOSS_RUNTIME_DIR/telemetry"
  build_mosscli

  cat > "$MOSS_RUNTIME_DIR/workflows/learning/learn-report.json" <<'JSON'
{"campaign_id":"learn-report","policy_pack":"learning-progression","route":"synthesis-cycle","route_state":"collecting","iteration":1,"last_action":"spawn_study_tasks","study_plan":{"iteration":1,"nodes":[{"type":"source-discovery","topic":"topic-discovery"},{"type":"extraction","batch":"top5"},{"type":"synthesis","target":"patterns-v1"}],"dependencies":[["source-discovery","extraction"],["extraction","synthesis"]]},"delegated_task_ids":["learn-report-source-discovery-1","learn-report-extraction-2","learn-report-synthesis-3"]}
JSON

  cat > "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-report-source-discovery-1.json" <<'JSON'
{"task_id":"learn-report-source-discovery-1","status":"pending","campaign_id":"learn-report","study_node_type":"source-discovery","study_iteration":1}
JSON
  cat > "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-report-extraction-2.json" <<'JSON'
{"task_id":"learn-report-extraction-2","status":"pending","campaign_id":"learn-report","study_node_type":"extraction","study_iteration":1,"depends_on":["learn-report-source-discovery-1"]}
JSON
  cat > "$MOSS_RUNTIME_DIR/task-board/planner/pending/learn-report-synthesis-3.json" <<'JSON'
{"task_id":"learn-report-synthesis-3","status":"pending","campaign_id":"learn-report","study_node_type":"synthesis","study_iteration":1,"depends_on":["learn-report-extraction-2"]}
JSON

  cat > "$MOSS_RUNTIME_DIR/telemetry/events.jsonl" <<'JSONL'
{"type":"learning.study.task.created","timestamp":"2026-04-09T10:00:00Z","id":"evt1","data":{"campaign_id":"learn-report","task_id":"learn-report-source-discovery-1","study_node_type":"source-discovery","study_iteration":1,"route":"synthesis-cycle"}}
{"type":"learning.study.task.created","timestamp":"2026-04-09T10:01:00Z","id":"evt2","data":{"campaign_id":"learn-report","task_id":"learn-report-extraction-2","study_node_type":"extraction","study_iteration":1,"route":"synthesis-cycle"}}
{"type":"learning.study.task.skipped","timestamp":"2026-04-09T10:02:00Z","id":"evt3","data":{"campaign_id":"learn-report","task_id":"learn-report-synthesis-3","study_node_type":"synthesis","study_iteration":1,"route":"synthesis-cycle","reason":"task_exists"}}
JSONL

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" evaluate --run-id learn-report
  assert_success
  assert_output_contains "Learning Campaign Report"
  assert_output_contains "Campaign ID: learn-report"
  assert_output_contains "Route: synthesis-cycle"
  assert_output_contains "Study Nodes: 3"
  assert_output_contains "Delegated Tasks: 3"
  assert_output_contains "Created Tasks: 2"
  assert_output_contains "Skipped Tasks: 1"
}
