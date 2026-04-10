#!/usr/bin/env bats

load ../test_helper

build_mosscli() {
  run npm --prefix "$PROJECT_ROOT/apps/mosscli" run build
  assert_success
}

pick_free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

extract_run_id_from_output() {
  local command_output="$1"

  if [[ ! "$command_output" =~ \"run_id\":\"([^\"]+)\" ]]; then
    echo "Expected command output to contain run_id"
    return 1
  fi

  printf '%s\n' "${BASH_REMATCH[1]}"
}

@test "mosscli evaluate should generate markdown and json summaries" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" run --goal "Implement login flow"
  assert_success

  local run_id
  run_id="$(extract_run_id_from_output "$output")"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" evaluate --run-id "$run_id" --format md
  assert_success
  assert_output_contains "# Moss-Harness Run Report"

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" evaluate --run-id "$run_id" --format json
  assert_success
  assert_output_contains '"status"'
}

@test "mosscli trace should ignore invalid events and keep only replay-safe records" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$MOSS_RUNTIME_DIR/moss-harness/runs/run-001"
  cat > "$MOSS_RUNTIME_DIR/moss-harness/runs/run-001/timeline.jsonl" <<'EOF'
{"type":"run_created","timestamp":"2026-04-08T12:00:00Z","run_id":"run-001","source":"mosscli","data":{"goal":"demo"}}
{"type":"stage_claimed","timestamp":"2026-04-08T12:01:00Z","source":"claim-engine","data":{"task_id":"task-1"}}
EOF

  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" trace --run-id run-001
  assert_success
  assert_output_contains "run_created"
  [[ "$output" != *"stage_claimed"* ]]
}

@test "mosscli trace should render learning DAG timeline" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$MOSS_RUNTIME_DIR/workflows/learning" \
           "$MOSS_RUNTIME_DIR/task-board/researcher/pending" \
           "$MOSS_RUNTIME_DIR/task-board/planner/pending" \
           "$MOSS_RUNTIME_DIR/telemetry"

  cat > "$MOSS_RUNTIME_DIR/workflows/learning/learn-replay.json" <<'JSON'
{"campaign_id":"learn-replay","policy_pack":"learning-progression","route":"synthesis-cycle","route_state":"collecting","iteration":1,"study_plan":{"iteration":1,"nodes":[{"type":"source-discovery","topic":"topic-discovery"},{"type":"extraction","batch":"top5"},{"type":"synthesis","target":"patterns-v1"}],"dependencies":[["source-discovery","extraction"],["extraction","synthesis"]]},"delegated_task_ids":["learn-replay-source-discovery-1","learn-replay-extraction-2","learn-replay-synthesis-3"]}
JSON

  cat > "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-replay-source-discovery-1.json" <<'JSON'
{"task_id":"learn-replay-source-discovery-1","status":"pending","campaign_id":"learn-replay","study_node_type":"source-discovery","study_iteration":1}
JSON
  cat > "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-replay-extraction-2.json" <<'JSON'
{"task_id":"learn-replay-extraction-2","status":"pending","campaign_id":"learn-replay","study_node_type":"extraction","study_iteration":1,"depends_on":["learn-replay-source-discovery-1"]}
JSON
  cat > "$MOSS_RUNTIME_DIR/task-board/planner/pending/learn-replay-synthesis-3.json" <<'JSON'
{"task_id":"learn-replay-synthesis-3","status":"pending","campaign_id":"learn-replay","study_node_type":"synthesis","study_iteration":1,"depends_on":["learn-replay-extraction-2"]}
JSON

  cat > "$MOSS_RUNTIME_DIR/telemetry/events.jsonl" <<'JSONL'
{"type":"learning.iteration.started","timestamp":"2026-04-09T10:00:00Z","id":"evt1","data":{"campaign_id":"learn-replay","route":"synthesis-cycle","route_state":"collecting","iteration":1}}
{"type":"learning.study.task.created","timestamp":"2026-04-09T10:01:00Z","id":"evt2","data":{"campaign_id":"learn-replay","task_id":"learn-replay-source-discovery-1","study_node_type":"source-discovery","study_iteration":1,"route":"synthesis-cycle"}}
{"type":"learning.study.task.created","timestamp":"2026-04-09T10:02:00Z","id":"evt3","data":{"campaign_id":"learn-replay","task_id":"learn-replay-extraction-2","study_node_type":"extraction","study_iteration":1,"route":"synthesis-cycle"}}
JSONL

  build_mosscli

  run node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" trace --run-id learn-replay
  assert_success
  assert_output_contains "Learning Campaign Replay"
  assert_output_contains "Campaign ID: learn-replay"
  assert_output_contains "Route: synthesis-cycle"
  assert_output_contains "source-discovery -> extraction"
  assert_output_contains "extraction -> synthesis"
  assert_output_contains "learn-replay-source-discovery-1"
  assert_output_contains "[researcher/pending] (source-discovery)"
  assert_output_contains "[planner/pending] (synthesis)"
  assert_output_contains "## Timeline"
  assert_output_contains "learning.iteration.started"
  assert_output_contains "learning.study.task.created"
}

@test "mosscli serve should start a local read-only server" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  local port
  port="$(pick_free_port)"
  export MOSSCLI_PORT="$port"
  build_mosscli

  node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" serve --port "$port" >"$TEST_TEMP_DIR/serve.log" 2>&1 &
  local server_pid=$!

  sleep 1

  run node -e "fetch(\"http://127.0.0.1:${port}/runs\").then(async (res) => { process.stdout.write(String(res.status) + \"\\n\" + await res.text()); }).catch((error) => { console.error(error); process.exit(1); })"
  kill "$server_pid" >/dev/null 2>&1 || true
  wait "$server_pid" >/dev/null 2>&1 || true

  assert_success
  assert_output_contains "200"
}

@test "mosscli serve should expose learning campaign view endpoints" {
  export MOSS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  local port
  port="$(pick_free_port)"
  export MOSSCLI_PORT="$port"
  mkdir -p "$MOSS_RUNTIME_DIR/workflows/learning" \
           "$MOSS_RUNTIME_DIR/task-board/researcher/pending" \
           "$MOSS_RUNTIME_DIR/telemetry"
  build_mosscli

  cat > "$MOSS_RUNTIME_DIR/workflows/learning/learn-serve.json" <<'JSON'
{"campaign_id":"learn-serve","policy_pack":"learning-progression","route":"synthesis-cycle","route_state":"collecting","iteration":1,"study_plan":{"iteration":1,"nodes":[{"type":"source-discovery","topic":"topic-discovery"},{"type":"extraction","batch":"top5"}],"dependencies":[["source-discovery","extraction"]]},"delegated_task_ids":["learn-serve-source-discovery-1"]}
JSON

  cat > "$MOSS_RUNTIME_DIR/task-board/researcher/pending/learn-serve-source-discovery-1.json" <<'JSON'
{"task_id":"learn-serve-source-discovery-1","status":"pending","campaign_id":"learn-serve","study_node_type":"source-discovery","study_iteration":1}
JSON

  cat > "$MOSS_RUNTIME_DIR/telemetry/events.jsonl" <<'JSONL'
{"type":"learning.iteration.started","timestamp":"2026-04-09T09:59:00Z","id":"evt0","data":{"campaign_id":"learn-serve","route":"synthesis-cycle","route_state":"collecting","iteration":1}}
{"type":"learning.study.task.created","timestamp":"2026-04-09T10:00:00Z","id":"evt1","data":{"campaign_id":"learn-serve","task_id":"learn-serve-source-discovery-1","study_node_type":"source-discovery","study_iteration":1,"route":"synthesis-cycle"}}
{"type":"learning.study.task.skipped","timestamp":"2026-04-09T10:01:00Z","id":"evt2","data":{"campaign_id":"learn-serve","task_id":"learn-serve-extraction-2","study_node_type":"extraction","study_iteration":1,"route":"synthesis-cycle","reason":"task_exists"}}
JSONL

  node "$PROJECT_ROOT/apps/mosscli/dist/cli/index.js" serve --port "$port" >"$TEST_TEMP_DIR/serve-learning.log" 2>&1 &
  local server_pid=$!

  sleep 1

  run node -e "fetch(\"http://127.0.0.1:${port}/\").then(async (res) => { process.stdout.write(String(res.status) + \"\\n\" + await res.text()); }).catch((error) => { console.error(error); process.exit(1); })"
  assert_success
  assert_output_contains "200"
  assert_output_contains "Learning Campaigns"
  assert_output_contains "/learning"
  assert_output_contains "/learning/learn-serve/view"
  assert_output_contains "synthesis-cycle"
  assert_output_contains "Iteration: 1"
  assert_output_contains "Created: 1"
  assert_output_contains "Skipped: 1"

  run node -e "fetch(\"http://127.0.0.1:${port}/learning\").then(async (res) => { process.stdout.write(String(res.status) + \"\\n\" + await res.text()); }).catch((error) => { console.error(error); process.exit(1); })"
  assert_success
  assert_output_contains "200"
  assert_output_contains "\"campaign_id\":\"learn-serve\""
  assert_output_contains "\"createdTasks\":1"

  run node -e "fetch(\"http://127.0.0.1:${port}/learning/learn-serve\").then(async (res) => { process.stdout.write(String(res.status) + \"\\n\" + await res.text()); }).catch((error) => { console.error(error); process.exit(1); })"

  assert_success
  assert_output_contains "200"
  assert_output_contains "\"campaign_id\":\"learn-serve\""
  assert_output_contains "\"delegated_task_ids\":[\"learn-serve-source-discovery-1\"]"
  assert_output_contains "\"delegatedTasks\":1"

  run node -e "fetch(\"http://127.0.0.1:${port}/learning/learn-serve/view\").then(async (res) => { process.stdout.write(String(res.status) + \"\\n\" + await res.text()); }).catch((error) => { console.error(error); process.exit(1); })"
  kill "$server_pid" >/dev/null 2>&1 || true
  wait "$server_pid" >/dev/null 2>&1 || true

  assert_success
  assert_output_contains "200"
  assert_output_contains "Learning Campaign"
  assert_output_contains "Learning Campaign: learn-serve"
  assert_output_contains "source-discovery &rarr; extraction"
  assert_output_contains "learn-serve-source-discovery-1"
  assert_output_contains "Created Tasks: <strong>1</strong>"
  assert_output_contains "Skipped Tasks: <strong>1</strong>"
  assert_output_contains "Timeline"
  assert_output_contains "learning.iteration.started"
  assert_output_contains "learning.study.task.skipped"
}
