#!/usr/bin/env bats

setup() {
    load '../test_helper'

    COMPACTOR="${PROJECT_ROOT}/runtime/context/context-compactor.sh"
    POLICY_FILE="${PROJECT_ROOT}/runtime/context/compaction-policy.yaml"
    TEST_SESSION="${PROJECT_ROOT}/.runtime/sessions/test_policy_$$"
    TELEMETRY_FILE="${PROJECT_ROOT}/.runtime/telemetry/events.jsonl"

    mkdir -p "$TEST_SESSION"
    mkdir -p "$(dirname "$TELEMETRY_FILE")"
    rm -f "$TELEMETRY_FILE"
}

teardown() {
    if [[ -d "$TEST_SESSION" ]]; then
        rm -rf "$TEST_SESSION"
    fi
}

@test "compaction policy file exists and defines balanced profile" {
    assert_file_exists "$POLICY_FILE"

    run ruby - <<'RUBY' "$POLICY_FILE"
require 'yaml'

data = YAML.load_file(ARGV[0])
raise 'bad version' unless data['version'] == 2
raise 'missing default profile' unless data.dig('defaults', 'profile') == 'balanced'
raise 'missing balanced profile' unless data.fetch('profiles', {}).key?('balanced')
puts 'ok'
RUBY

    assert_success
    [[ "$output" == "ok" ]]
}

@test "compactor status exposes current profile" {
    run "$COMPACTOR" status
    assert_success
    [[ "$output" == *"current_profile"* ]]
}

@test "compactor auto records context action telemetry" {
    cat > "$TEST_SESSION/messages.json" <<'EOF'
{
  "messages": [
    {"role": "tool", "content": "repeat repeat repeat repeat repeat repeat repeat repeat"}
  ]
}
EOF

    run "$COMPACTOR" auto "$TEST_SESSION"
    assert_success

    assert_file_exists "$TELEMETRY_FILE"
    grep -q '"type":"context.action.applied"' "$TELEMETRY_FILE"
}

@test "typescript policy evaluator is the active evaluator" {
    assert_file_exists "${PROJECT_ROOT}/runtime/context/policy-evaluator.ts"
    [[ ! -f "${PROJECT_ROOT}/runtime/context/policy-evaluator.rb" ]]
}
