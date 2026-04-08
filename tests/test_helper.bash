#!/usr/bin/env bash

# 测试辅助函数

# 获取项目根目录
export PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# 设置测试环境
setup() {
  # 创建临时测试目录
  export TEST_TEMP_DIR="$(mktemp -d)"
  
  # 设置测试模式
  export TEST_MODE=true
  
  # 确保脚本可执行
  chmod +x "$PROJECT_ROOT"/apps/agent-cli/*.sh
  chmod +x "$PROJECT_ROOT"/scripts/*.sh
  chmod +x "$PROJECT_ROOT"/tooling/scripts/*.sh
}

# 清理测试环境
teardown() {
  # 清理临时目录
  if [[ -n "$TEST_TEMP_DIR" && -d "$TEST_TEMP_DIR" ]]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

# 断言函数
assert_success() {
  if [[ "$status" -ne 0 ]]; then
    echo "Expected success but got status $status"
    echo "Output: $output"
    return 1
  fi
}

assert_failure() {
  if [[ "$status" -eq 0 ]]; then
    echo "Expected failure but got success"
    echo "Output: $output"
    return 1
  fi
}

assert_output_contains() {
  local expected="$1"
  if [[ "$output" != *"$expected"* ]]; then
    echo "Expected output to contain: $expected"
    echo "Actual output: $output"
    return 1
  fi
}

assert_file_exists() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Expected file to exist: $file"
    return 1
  fi
}

assert_dir_exists() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo "Expected directory to exist: $dir"
    return 1
  fi
}
