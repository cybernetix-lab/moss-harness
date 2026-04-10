#!/usr/bin/env bats

load ../test_helper

@test "mosscli MVP task 1 scaffolds a buildable CLI with help output" {
  assert_dir_exists "$PROJECT_ROOT/apps/mosscli"
  assert_file_exists "$PROJECT_ROOT/apps/mosscli/package.json"
  assert_file_exists "$PROJECT_ROOT/apps/mosscli/tsconfig.json"
  assert_file_exists "$PROJECT_ROOT/apps/mosscli/README.md"
  assert_file_exists "$PROJECT_ROOT/apps/mosscli/src/cli/index.ts"

  run npm --prefix "$PROJECT_ROOT/apps/mosscli" run build
  assert_success

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" --help
  assert_success
  assert_output_contains "mosscli"
  assert_output_contains "run"
  assert_output_contains "status"
  assert_output_contains "trace"
  assert_output_contains "evaluate"
  assert_output_contains "serve"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --help
  assert_success
  assert_output_contains "mosscli run"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" status --help
  assert_success
  assert_output_contains "mosscli status"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" trace --help
  assert_success
  assert_output_contains "mosscli trace"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" evaluate --help
  assert_success
  assert_output_contains "mosscli evaluate"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" serve --help
  assert_success
  assert_output_contains "mosscli serve"
}

@test "mosscli run should create runtime run.json, bootstrap planner stage, and status should render it" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"

  run npm --prefix "$PROJECT_ROOT/apps/mosscli" run build
  assert_success

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Bootstrap mosscli MVP"
  assert_success
  assert_output_contains '"run_id":"'
  assert_output_contains '"current_stage":"evaluator"'
  assert_output_contains '"status":"completed"'
  assert_output_contains '"selected_agent":"evaluator"'

  if [[ ! "$output" =~ \"run_id\":\"([^\"]+)\" ]]; then
    echo "Expected run output to contain run_id"
    return 1
  fi
  local run_id="${BASH_REMATCH[1]}"

  if [[ ! "$output" =~ \"request_id\":\"([^\"]+)\" ]]; then
    echo "Expected run output to contain request_id"
    return 1
  fi
  local request_id="${BASH_REMATCH[1]}"

  local moss_harness_dir="$MOSS_RUNTIME_DIR/moss-harness"
  local run_file="$moss_harness_dir/run.json"
  local snapshot_file="$moss_harness_dir/runs/$run_id/stages/01-planner.json"
  local per_run_file="$moss_harness_dir/runs/$run_id/run.json"
  local presence_file="$MOSS_RUNTIME_DIR/teammates/planner/planner/presence.json"
  local claimed_task_file="$MOSS_RUNTIME_DIR/task-board/planner/claimed/${run_id}-planner-01.json"
  local claim_record_file="$MOSS_RUNTIME_DIR/claims/$request_id/record.json"

  assert_file_exists "$run_file"
  assert_file_exists "$per_run_file"
  assert_file_exists "$snapshot_file"
  assert_file_exists "$presence_file"
  assert_file_exists "$claimed_task_file"
  assert_file_exists "$claim_record_file"

  if ! grep -q "\"run_id\":\"$run_id\"" "$run_file"; then
    echo "Expected run.json to contain run_id"
    return 1
  fi
  if ! grep -q '"current_stage":"evaluator"' "$run_file"; then
    echo "Expected run.json to contain current_stage=evaluator"
    return 1
  fi
  if ! grep -q '"status":"completed"' "$run_file"; then
    echo "Expected run.json to contain status=completed"
    return 1
  fi
  if ! grep -q "\"run_id\":\"$run_id\"" "$snapshot_file"; then
    echo "Expected first stage snapshot to contain run_id"
    return 1
  fi
  if ! grep -q '"stage":"planner"' "$snapshot_file"; then
    echo "Expected first stage snapshot to contain stage=planner"
    return 1
  fi
  if ! grep -q '"sequence":1' "$snapshot_file"; then
    echo "Expected first stage snapshot to contain sequence=1"
    return 1
  fi
  if ! grep -q '"selected_agent":"planner"' "$snapshot_file"; then
    echo "Expected first stage snapshot to contain selected_agent=planner"
    return 1
  fi

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" status --run-id "$run_id"
  assert_success
  assert_output_contains "Run ID: $run_id"
  assert_output_contains "Status: completed"
  assert_output_contains "Current Stage: evaluator"
  assert_output_contains "Selected Agent: evaluator"
  assert_output_contains "Task ID: ${run_id}-evaluator-04"
}
