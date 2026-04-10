# Local CI Guide

This guide covers local verification workflows for `moss-harness`. For project positioning and architecture, start with [README.md](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

## Core Checks

Run the most important validation steps before pushing changes:

```bash
npm --prefix apps/mosscli run build
bats tests/apps/test_mosscli_cli.bats
bats tests/apps/test_mosscli_task4.bats
bats tests/apps/test_mosscli_task5.bats
bats tests/apps/test_mosscli_task6.bats
bats tests/scripts/test_executor_lane_poc.bats
npm test
```

## Optional Shell and YAML Checks

Install optional helpers if you want fuller local validation:

```bash
# macOS
brew install bats-core shellcheck yamllint
```

## What Local CI Should Protect

Local CI should protect more than syntax. It should catch regressions that would blur project boundaries or break core invariants, including:

- `mosscli` runtime behavior under `.runtime/moss-harness/`
- read-only Web observability assumptions
- Role Lane related execution flow
- `moss_` metrics and report structure
- transactional claim-related behavior

## Notes

- Keep `mosscli` as the validation surface, not the whole project narrative
- Keep root positioning in [README.md](../README.md)
- Keep substrate shape in [ARCHITECTURE.md](../ARCHITECTURE.md)
