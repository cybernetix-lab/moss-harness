#!/usr/bin/env bats

load ../test_helper

# agent-list.sh 测试
@test "agent-list.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/apps/agent-cli/agent-list.sh"
  [[ -x "$PROJECT_ROOT/apps/agent-cli/agent-list.sh" ]]
}

@test "agent-list.sh should show help with --help" {
  run "$PROJECT_ROOT/apps/agent-cli/agent-list.sh" --help
  assert_success
}

# agent-start.sh 测试
@test "agent-start.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/apps/agent-cli/agent-start.sh"
  [[ -x "$PROJECT_ROOT/apps/agent-cli/agent-start.sh" ]]
}

@test "agent-start.sh should show help with --help" {
  run "$PROJECT_ROOT/apps/agent-cli/agent-start.sh" --help
  assert_success
}

# agent-switch.sh 测试
@test "agent-switch.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/apps/agent-cli/agent-switch.sh"
  [[ -x "$PROJECT_ROOT/apps/agent-cli/agent-switch.sh" ]]
}

# checkpoint.sh 测试
@test "checkpoint.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/apps/agent-cli/checkpoint.sh"
  [[ -x "$PROJECT_ROOT/apps/agent-cli/checkpoint.sh" ]]
}

@test "checkpoint.sh list should work" {
  run "$PROJECT_ROOT/apps/agent-cli/checkpoint.sh" list
  assert_success
}

# start-session.sh 测试
@test "start-session.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/apps/agent-cli/start-session.sh"
  [[ -x "$PROJECT_ROOT/apps/agent-cli/start-session.sh" ]]
}

# 配置文件测试
@test "agent configs should exist" {
  assert_dir_exists "$PROJECT_ROOT/configs/agents"
  assert_file_exists "$PROJECT_ROOT/configs/agents/planner.yaml"
  assert_file_exists "$PROJECT_ROOT/configs/agents/executor.yaml"
  assert_file_exists "$PROJECT_ROOT/configs/agents/evaluator.yaml"
  assert_file_exists "$PROJECT_ROOT/configs/agents/reviewer.yaml"
}

@test "planner.yaml should be valid yaml" {
  run yamllint -d relaxed "$PROJECT_ROOT/configs/agents/planner.yaml"
  assert_success
}

@test "executor.yaml should be valid yaml" {
  run yamllint -d relaxed "$PROJECT_ROOT/configs/agents/executor.yaml"
  assert_success
}
