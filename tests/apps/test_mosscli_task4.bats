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

@test "mosscli run should write stage result envelopes and required artifacts" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Implement login flow"
  assert_success

  local run_id
  run_id="$(extract_run_id_from_output "$output")"

  assert_file_exists "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/artifacts/plan.md"
  assert_file_exists "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/artifacts/review.md"
  assert_file_exists "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/artifacts/execution.md"
  assert_file_exists "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/artifacts/evaluation.md"
}

@test "mosscli run should stop after the configured rework limit" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  export MOSSCLI_FORCE_REVIEW_REJECT=1
  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Implement login flow"
  assert_success

  local run_id
  run_id="$(extract_run_id_from_output "$output")"

  run jq -r '.status' "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/run.json"
  assert_success
  [ "$output" = "failed" ] || [ "$output" = "completed" ]

  run jq -r '.reworkCount' "$MOSS_RUNTIME_DIR/moss-harness/runs/$run_id/summary.json"
  assert_success
  [ "$output" = "2" ]
}

@test "mosscli trace should emit the persisted event timeline for one run" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Implement login flow"
  assert_success

  local run_id
  run_id="$(extract_run_id_from_output "$output")"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" trace --run-id "$run_id"
  assert_success
  assert_output_contains "run_created"
}
