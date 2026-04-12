# Tests

This directory documents repository verification. For the strategic project narrative, start with [README.md](../README.md). For the current validation app, see [apps/mosscli/README.md](../apps/mosscli/README.md).

The repository currently uses two main test families:

- `Bats` for CLI and shell behavior across `apps/`, `scripts/`, `configs/rules/`, and `context/`
- `Jest` for TypeScript runtime coverage such as `tests/runtime/**/*.test.ts`

## Install Bats

```bash
# macOS
brew install bats-core

# Linux
sudo apt-get install bats

# or via npm
npm install -g bats
```

## Run Tests

```bash
# Run the Bats suites
bats tests/apps tests/scripts tests/tooling tests/context

# Run specific directories
bats tests/apps/
bats tests/scripts/
bats tests/tooling/
bats tests/context/

# Run a single file
bats tests/apps/test_mosscli_cli.bats

# Run TypeScript / Jest tests
npm test
```

## Test Layout

```text
tests/
├── README.md
├── test_helper.bash
├── apps/
│   ├── test_agent_cli.bats
│   ├── test_mosscli_cli.bats
│   ├── test_mosscli_task4.bats
│   ├── test_mosscli_task5.bats
│   └── test_mosscli_task6.bats
├── context/
├── runtime/
│   └── context/
├── scripts/
└── tooling/
```

## Writing Tests

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
