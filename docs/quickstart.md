# Quickstart

This guide covers a fast local path into the repository. For the full project narrative and architecture, start with [README.md](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md). For the current validation app, see [apps/mosscli/README.md](../apps/mosscli/README.md).

## Install

### Prerequisites

- Node.js 20+
- npm
- Git
- `bats` for shell-based verification

### Clone the repository

```bash
git clone <your-fork-or-repo-url>
cd agent-harness-spec
npm install
```

## Validate the current app surface

```bash
npm --prefix apps/mosscli run build
node apps/mosscli/dist/cli/index.js --help
bats tests/apps/test_mosscli_cli.bats
```

## Run a validation flow

```bash
node apps/mosscli/dist/cli/index.js run --goal "Validate a harness workflow"
node apps/mosscli/dist/cli/index.js serve --port 4310
```

The Web endpoint exposed by `serve` is read-only. Use the CLI as the control plane.

## Next Reading

- [README.md](../README.md)
- [README.zh-CN.md](../README.zh-CN.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [docs/design-philosophy.md](design-philosophy.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
