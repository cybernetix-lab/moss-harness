#!/usr/bin/env bats

load ../test_helper

setup_mock_command() {
  local name="$1"
  local body="$2"

  cat >"$TEST_TEMP_DIR/bin/$name" <<EOF
#!/usr/bin/env bash
$body
EOF
  chmod +x "$TEST_TEMP_DIR/bin/$name"
}

@test "local-ci.sh should collect stage failures, continue remaining TypeScript gates, and share shellcheck targets" {
  mkdir -p "$TEST_TEMP_DIR/bin"
  export PATH="$TEST_TEMP_DIR/bin:$PATH"
  export TASK4_COMMAND_LOG="$TEST_TEMP_DIR/commands.log"

  setup_mock_command "yamllint" 'printf "yamllint %s\n" "$*" >> "$TASK4_COMMAND_LOG"'
  setup_mock_command "bats" 'printf "bats %s\n" "$*" >> "$TASK4_COMMAND_LOG"'
  setup_mock_command "shellcheck" 'printf "shellcheck %s\n" "$*" >> "$TASK4_COMMAND_LOG"'
  setup_mock_command "npm" '
printf "npm %s\n" "$*" >> "$TASK4_COMMAND_LOG"
if [[ "$*" == "--prefix apps/mossclaw/server run build" ]]; then
  exit 1
fi
'

  run bash "$PROJECT_ROOT/local-ci.sh"
  assert_failure

  assert_output_contains "发现 1 个问题"
  assert_output_contains "TypeScript gate"
  assert_output_contains "apps/mosscli build"
  assert_output_contains "npm test"
  assert_output_contains "apps/mossclaw/server build"
  assert_output_contains "apps/mossclaw/server test"
  assert_output_contains "apps/mossclaw/web build"

  run grep -F "npm --prefix apps/mossclaw/server run build" "$TASK4_COMMAND_LOG"
  assert_success

  run grep -F "npm --prefix apps/mossclaw/server test" "$TASK4_COMMAND_LOG"
  assert_success

  run grep -F "npm --prefix apps/mossclaw/web run build" "$TASK4_COMMAND_LOG"
  assert_success

  run bash -lc "source \"$PROJECT_ROOT/scripts/ci-shellcheck-targets.sh\" && printf '%s\n' \"\${SHELLCHECK_TARGETS[@]}\""
  assert_success
  assert_output_contains "local-ci.sh"
  assert_output_contains "scripts/ci-shellcheck-targets.sh"
  assert_output_contains "apps/agent-cli/agent-list.sh"
  assert_output_contains "scripts/health-check.sh"
  assert_output_contains "scripts/skill-list.sh"
  assert_output_contains "scripts/verify.sh"
}
