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
