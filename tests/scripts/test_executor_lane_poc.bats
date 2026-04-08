#!/usr/bin/env bats

load ../test_helper

@test "task-board.sh create should write executor task into pending queue" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  run "$PROJECT_ROOT/scripts/task-board.sh" create \
    --lane executor \
    --task-id task-001 \
    --task-type code_implementation \
    --tags frontend,react \
    --priority high

  assert_success
  assert_file_exists "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-001.json"
}

@test "task-board.sh move should move task between executor states" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"

  run "$PROJECT_ROOT/scripts/task-board.sh" create \
    --lane executor \
    --task-id task-001 \
    --task-type code_implementation \
    --tags frontend,react \
    --priority high
  assert_success

  run "$PROJECT_ROOT/scripts/task-board.sh" move \
    --lane executor \
    --task-id task-001 \
    --from pending \
    --to claimed

  assert_success
  # 确认任务已从 pending 移除
  if [[ -f "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-001.json" ]]; then
    echo "Expected task-001 to be removed from pending after move"
    return 1
  fi
  # 确认任务已在 claimed 出现
  assert_file_exists "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-001.json"
  # 确认 JSON 状态已更新为 claimed（脚本会在 move 后更新 status）
  if ! grep -q '"status":"claimed"' "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-001.json"; then
    echo "Expected claimed file JSON to contain status=claimed"
    return 1
  fi
}

@test "roster-loader.sh list executor should return backups and experts from members" {
  run "$PROJECT_ROOT/scripts/roster-loader.sh" list --lane executor
  assert_success
  assert_output_contains '"backup"'
  assert_output_contains '"frontend_executor"'
  assert_output_contains '"backend_executor"'
}

@test "roster-loader.sh list executor should include selection policy and candidates" {
  run "$PROJECT_ROOT/scripts/roster-loader.sh" list --lane executor

  assert_success
  assert_output_contains '"selection_policy"'
  assert_output_contains '"preferred_modes":["expert","backup"]'
  assert_output_contains '"preferred_domain_tags":["frontend","backend","database"]'
  assert_output_contains '"candidates"'
  assert_output_contains '"status":"candidate"'
}

@test "presence-manager.sh set should write teammate presence file" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  run "$PROJECT_ROOT/scripts/presence-manager.sh" set \
    --lane executor \
    --agent frontend_executor \
    --lifecycle idle \
    --availability 1.0

  assert_success
  assert_file_exists "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json"
}

@test "presence-manager.sh set should reject availability outside 0..1" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  run "$PROJECT_ROOT/scripts/presence-manager.sh" set \
    --lane executor \
    --agent frontend_executor \
    --lifecycle idle \
    --availability 1.5

  assert_failure
  assert_output_contains 'availability out of range'
  if [[ -d "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor" ]] && compgen -G "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/.presence.json.tmp.*" > /dev/null; then
    echo "Expected invalid presence update to clean up temporary files"
    return 1
  fi
}

@test "presence-manager.sh set should reject unknown lifecycle" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  run "$PROJECT_ROOT/scripts/presence-manager.sh" set \
    --lane executor \
    --agent frontend_executor \
    --lifecycle unknown \
    --availability 1.0

  assert_failure
  assert_output_contains 'Invalid lifecycle'
}

@test "claim-engine.sh should grant frontend task to frontend_executor before backup" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-frontend.json" <<'EOF'
{"task_id":"task-frontend","lane":"executor","domain_tags":["frontend","react"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-frontend
  assert_success
  assert_output_contains '"selected_agent":"frontend_executor"'
  if [[ ! "$output" =~ \"request_id\":\"([^\"]+)\" ]]; then
    echo "Expected claim output to contain request_id"
    return 1
  fi
  local claim_request_id="${BASH_REMATCH[1]}"
  local claim_record_file="$AHARNESS_RUNTIME_DIR/claims/$claim_request_id/record.json"
  assert_file_exists "$claim_record_file"
  if ! grep -q '"request_id":"task_claim_task-frontend_' "$claim_record_file"; then
    echo "Expected claim record to contain request_id"
    return 1
  fi
  if ! grep -q '"protocol_envelope":{"request_id":"task_claim_task-frontend_.*","protocol_type":"task_claim","lifecycle_state":"claimed"}' "$claim_record_file"; then
    echo "Expected claim record to contain protocol_envelope"
    return 1
  fi
  if ! grep -q '"protocol_type":"task_claim"' "$claim_record_file"; then
    echo "Expected claim record to contain protocol_type=task_claim"
    return 1
  fi
  if ! grep -q '"lifecycle_state":"claimed"' "$claim_record_file"; then
    echo "Expected claim record to contain lifecycle_state=claimed"
    return 1
  fi
  assert_file_exists "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"
  if ! grep -q '"type":"task.claim.granted"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"; then
    echo "Expected telemetry to contain task.claim.granted event"
    return 1
  fi
  if ! grep -q '"selected_agent":"frontend_executor"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"; then
    echo "Expected telemetry to record selected agent"
    return 1
  fi
}

@test "claim-engine.sh should fallback backend task to executor backup when no expert is available" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-backend.json" <<'EOF'
{"task_id":"task-backend","lane":"executor","domain_tags":["backend","api"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/executor/presence.json" <<'EOF'
{"agent":"executor","lane":"executor","lifecycle":"idle","availability":0.9}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-backend

  assert_success
  assert_output_contains '"selected_agent":"executor"'
  assert_output_contains '"selected_mode":"backup"'
  assert_output_contains '"fallback_used":true'
  assert_file_exists "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-backend.json"
  if ! grep -q '"selection_reason":"backup_fallback"' "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-backend.json"; then
    echo "Expected claimed task JSON to contain selection_reason=backup_fallback"
    return 1
  fi
}

@test "claim-engine.sh should honor preferred_modes from roster selection policy" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  export AHARNESS_AGENT_REGISTRY="$TEST_TEMP_DIR/agent-registry.yaml"
  cat > "$AHARNESS_AGENT_REGISTRY" <<'EOF'
lanes:
  executor:
    selection_policy:
      preferred_modes:
        - backup
members:
  executor:
    backup:
      - id: executor
        status: active
        mode: backup
        domain_tags: [general, implementation]
    experts:
      - id: frontend_executor
        status: candidate
        mode: expert
        domain_tags: [frontend, react]
selection_policy:
  allow_manual_override: true
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-policy.json" <<'EOF'
{"task_id":"task-policy","lane":"executor","domain_tags":["frontend"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/executor/presence.json" <<'EOF'
{"agent":"executor","lane":"executor","lifecycle":"idle","availability":0.8}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-policy

  assert_success
  assert_output_contains '"selected_agent":"executor"'
  assert_output_contains '"selected_mode":"backup"'
}

@test "claim-engine.sh should keep active experts eligible while candidates only affect preference" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  export AHARNESS_AGENT_REGISTRY="$TEST_TEMP_DIR/agent-registry.yaml"
  cat > "$AHARNESS_AGENT_REGISTRY" <<'EOF'
lanes:
  executor:
    selection_policy:
      preferred_modes:
        - expert
        - backup
members:
  executor:
    backup:
      - id: executor
        status: active
        mode: backup
        domain_tags: [general, implementation]
    experts:
      - id: frontend_executor
        status: active
        mode: expert
        domain_tags: [frontend, react]
      - id: candidate_frontend_executor
        status: candidate
        mode: expert
        domain_tags: [frontend, react]
selection_policy:
  allow_manual_override: true
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-candidate.json" <<'EOF'
{"task_id":"task-candidate","lane":"executor","domain_tags":["frontend"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/candidate_frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/candidate_frontend_executor/presence.json" <<'EOF'
{"agent":"candidate_frontend_executor","lane":"executor","lifecycle":"idle","availability":0.7}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-candidate

  assert_success
  assert_output_contains '"selected_agent":"frontend_executor"'
  if grep -q '"selected_agent":"candidate_frontend_executor"' <<<"$output"; then
    echo "Expected active expert to remain eligible and beat lower-availability candidate"
    return 1
  fi
}

@test "claim-engine.sh should allow only one concurrent claim for the same task" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-race.json" <<'EOF'
{"task_id":"task-race","lane":"executor","domain_tags":["frontend"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF
  cat > "$TEST_TEMP_DIR/claim-before-move-hook.sh" <<'EOF'
#!/usr/bin/env bash
sleep "${AHARNESS_CLAIM_TEST_DELAY:-0.5}"
EOF
  chmod +x "$TEST_TEMP_DIR/claim-before-move-hook.sh"
  export AHARNESS_CLAIM_BEFORE_MOVE_HOOK="$TEST_TEMP_DIR/claim-before-move-hook.sh"
  export AHARNESS_CLAIM_TEST_DELAY=0.5

  local claim_output_one="$TEST_TEMP_DIR/claim-one.log"
  local claim_output_two="$TEST_TEMP_DIR/claim-two.log"
  "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-race >"$claim_output_one" 2>&1 &
  local claim_pid_one=$!
  "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-race >"$claim_output_two" 2>&1 &
  local claim_pid_two=$!

  set +e
  wait "$claim_pid_one"
  local claim_status_one=$?
  wait "$claim_pid_two"
  local claim_status_two=$?
  set -e

  local success_count=0
  local failure_count=0
  [[ "$claim_status_one" -eq 0 ]] && success_count=$((success_count + 1))
  [[ "$claim_status_two" -eq 0 ]] && success_count=$((success_count + 1))
  [[ "$claim_status_one" -ne 0 ]] && failure_count=$((failure_count + 1))
  [[ "$claim_status_two" -ne 0 ]] && failure_count=$((failure_count + 1))

  if [[ "$success_count" -ne 1 || "$failure_count" -ne 1 ]]; then
    echo "Expected exactly one concurrent claim to succeed and one to fail"
    echo "claim_status_one=$claim_status_one"
    echo "claim_status_two=$claim_status_two"
    echo "claim_output_one=$(cat "$claim_output_one")"
    echo "claim_output_two=$(cat "$claim_output_two")"
    return 1
  fi

  assert_file_exists "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-race.json"
  if [[ -f "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-race.json" ]]; then
    echo "Expected concurrent claim winner to remove task-race from pending"
    return 1
  fi

  local claim_record_count
  claim_record_count="$(find "$AHARNESS_RUNTIME_DIR/claims" -name 'record.json' -print | wc -l | tr -d ' ')"
  if [[ "$claim_record_count" -ne 1 ]]; then
    echo "Expected exactly one claim record after concurrent claims"
    return 1
  fi

  local granted_count
  granted_count="$(grep -c '"type":"task.claim.granted"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl" || true)"
  if [[ "$granted_count" -ne 1 ]]; then
    echo "Expected exactly one task.claim.granted event after concurrent claims"
    return 1
  fi
}

@test "claim-engine.sh should reject duplicate claim after task is already claimed" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-duplicate.json" <<'EOF'
{"task_id":"task-duplicate","lane":"executor","domain_tags":["frontend"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-duplicate
  assert_success

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-duplicate
  assert_failure
  assert_file_exists "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-duplicate.json"
  if [[ -f "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-duplicate.json" ]]; then
    echo "Expected duplicate claim target to remain absent from pending"
    return 1
  fi

  local claim_record_count
  claim_record_count="$(find "$AHARNESS_RUNTIME_DIR/claims" -name 'record.json' -print | wc -l | tr -d ' ')"
  if [[ "$claim_record_count" -ne 1 ]]; then
    echo "Expected duplicate claim to avoid creating a second claim record"
    return 1
  fi

  local granted_count
  granted_count="$(grep -c '"type":"task.claim.granted"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl" || true)"
  if [[ "$granted_count" -ne 1 ]]; then
    echo "Expected duplicate claim to avoid a second task.claim.granted event"
    return 1
  fi
}

@test "claim-engine.sh should commit transactional claim artifacts consistently" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-txn.json" <<'EOF'
{"task_id":"task-txn","lane":"executor","domain_tags":["frontend"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-txn
  assert_success
  if [[ ! "$output" =~ \"request_id\":\"([^\"]+)\" ]]; then
    echo "Expected claim output to contain request_id"
    return 1
  fi
  local claim_request_id="${BASH_REMATCH[1]}"
  local transaction_dir="$AHARNESS_RUNTIME_DIR/transactions/claims/$claim_request_id"
  local claim_record_file="$AHARNESS_RUNTIME_DIR/claims/$claim_request_id/record.json"
  local claimed_task_file="$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-txn.json"

  assert_file_exists "$transaction_dir/manifest.json"
  assert_file_exists "$transaction_dir/claimed-task.json"
  assert_file_exists "$transaction_dir/claim-record.json"
  assert_file_exists "$transaction_dir/telemetry-event.json"
  assert_file_exists "$transaction_dir/state"
  if ! grep -q '^committed$' "$transaction_dir/state"; then
    echo "Expected transaction state to be committed"
    return 1
  fi

  assert_file_exists "$claimed_task_file"
  assert_file_exists "$claim_record_file"
  assert_file_exists "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"
  if [[ -f "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-txn.json" ]]; then
    echo "Expected pending task to be removed only after transactional commit"
    return 1
  fi
}

@test "claim-engine.sh should keep pending task when transactional commit fails" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  export AHARNESS_CLAIM_FAIL_AFTER="claim_record"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/pending"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-txn-fail.json" <<'EOF'
{"task_id":"task-txn-fail","lane":"executor","domain_tags":["frontend"],"priority":"high"}
EOF
  mkdir -p "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor"
  cat > "$AHARNESS_RUNTIME_DIR/teammates/executor/frontend_executor/presence.json" <<'EOF'
{"agent":"frontend_executor","lane":"executor","lifecycle":"idle","availability":1}
EOF

  run "$PROJECT_ROOT/scripts/claim-engine.sh" claim --lane executor --task-id task-txn-fail
  assert_failure
  if [[ ! "$output" =~ \"request_id\":\"([^\"]+)\" ]]; then
    echo "Expected failed transactional claim to surface request_id"
    return 1
  fi
  local claim_request_id="${BASH_REMATCH[1]}"
  local transaction_dir="$AHARNESS_RUNTIME_DIR/transactions/claims/$claim_request_id"

  assert_file_exists "$AHARNESS_RUNTIME_DIR/task-board/executor/pending/task-txn-fail.json"
  if [[ -f "$AHARNESS_RUNTIME_DIR/task-board/executor/claimed/task-txn-fail.json" ]]; then
    echo "Expected claimed task file to be absent when transactional commit fails"
    return 1
  fi
  if [[ -d "$AHARNESS_RUNTIME_DIR/claims/$claim_request_id" ]]; then
    echo "Expected claim record publish to be skipped on commit failure"
    return 1
  fi
  assert_file_exists "$transaction_dir/state"
  if ! grep -q '^commit_failed$' "$transaction_dir/state"; then
    echo "Expected transaction state to be commit_failed"
    return 1
  fi
  if [[ -f "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl" ]] && grep -q '"type":"task.claim.granted"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"; then
    echo "Expected no task.claim.granted telemetry on commit failure"
    return 1
  fi
}

@test "evolution-candidate.sh propose should create candidate proposal from successful executor runs" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"
  mkdir -p "$AHARNESS_RUNTIME_DIR/task-board/executor/completed"
  cat > "$AHARNESS_RUNTIME_DIR/task-board/executor/completed/task-frontend.json" <<'EOF'
{"task_id":"task-frontend","lane":"executor","domain_tags":["frontend","react"],"quality_score":85,"selected_agent":"frontend_executor"}
EOF

  run "$PROJECT_ROOT/scripts/evolution-candidate.sh" propose --lane executor --source-task task-frontend --proposed-by memory_curator
  assert_success
  assert_output_contains '"candidate_id":"executor_candidate_task-frontend"'
  assert_output_contains '"status":"proposal"'
  assert_output_contains '"protocol_envelope":{"request_id":"member_promotion_proposed_executor_task-frontend_'
  assert_output_contains '"protocol_type":"member_promotion"'
  assert_output_contains '"lifecycle_state":"proposed"'

  local proposal_file="$AHARNESS_RUNTIME_DIR/evolution/candidates/executor/executor_candidate_task-frontend.json"
  assert_file_exists "$proposal_file"

  if ! grep -q '"source_task":"task-frontend"' "$proposal_file"; then
    echo "Expected proposal file to keep source task"
    return 1
  fi
  if ! grep -q '"selected_agent":"frontend_executor"' "$proposal_file"; then
    echo "Expected proposal file to capture selected agent evidence"
    return 1
  fi
  if ! grep -q '"quality_score":85' "$proposal_file"; then
    echo "Expected proposal file to capture quality score evidence"
    return 1
  fi

  assert_file_exists "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"
  if ! grep -q '"type":"member.promotion.proposed"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"; then
    echo "Expected telemetry to contain member.promotion.proposed event"
    return 1
  fi
  if ! grep -q '"candidate_id":"executor_candidate_task-frontend"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"; then
    echo "Expected telemetry to record candidate_id"
    return 1
  fi
  if grep -q '"type":"member.promotion.approved"' "$AHARNESS_RUNTIME_DIR/telemetry/events.jsonl"; then
    echo "Expected raw proposal flow to avoid promotion approval event"
    return 1
  fi
}

@test "evolution-candidate.sh propose should fail when completed source task is missing" {
  export AHARNESS_RUNTIME_DIR="$TEST_TEMP_DIR/.runtime"

  run "$PROJECT_ROOT/scripts/evolution-candidate.sh" propose --lane executor --source-task missing-task --proposed-by memory_curator

  assert_failure
  assert_output_contains 'Completed task not found'
  if [[ -d "$AHARNESS_RUNTIME_DIR/evolution/candidates/executor" ]]; then
    echo "Expected no proposal directory to be created for missing completed task"
    return 1
  fi
}
