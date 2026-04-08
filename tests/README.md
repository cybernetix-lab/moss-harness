# Tests

使用 Bats (Bash Automated Testing System) 进行脚本测试。

## 安装 Bats

```bash
# macOS
brew install bats-core

# Linux
sudo apt-get install bats

# 或使用 npm
npm install -g bats
```

## 运行测试

```bash
# 运行所有测试
bats tests/

# 运行特定目录测试
bats tests/apps/
bats tests/scripts/
bats tests/tooling/

# 运行单个测试文件
bats tests/apps/test_agent_cli.bats
```

## 测试结构

```
tests/
├── README.md              # 本文件
├── test_helper.bash       # 测试辅助函数
├── apps/                  # apps/agent-cli/ 测试
│   └── test_agent_cli.bats
├── scripts/               # scripts/ 测试
│   └── test_scripts.bats
└── tooling/               # tooling/scripts/ 测试
    └── test_tooling.bats
```

## 编写测试

```bash
#!/usr/bin/env bats

load ../test_helper

@test "agent-list should show available agents" {
  run "$PROJECT_ROOT/apps/agent-cli/agent-list.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"planner"* ]]
  [[ "$output" == *"executor"* ]]
}
```
