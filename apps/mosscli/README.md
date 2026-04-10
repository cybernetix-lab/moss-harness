# mosscli

`mosscli` is the CLI-first validation surface for [moss-harness](../../README.md), not the full strategic boundary of the project. It exists to prove that the substrate already supports role-aware execution, transactional claiming, replayable evidence, read-only observability, and `moss_` metrics in a working loop.

If you are trying to understand the substrate itself, start with [the root README](../../README.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md). This document is intentionally scoped to the validation app.

## What Mosscli Validates

The current app proves that `moss-harness` can support:

- lane task creation and progression
- implemented workflow orchestration across `planner -> reviewer -> executor -> evaluator`
- expert-first and backup-fallback claiming
- replayable timelines
- persisted feedback and rework routing
- emergence-oriented `moss_` metrics
- a read-only Web observability surface

## Current Flow

The current validation path is intentionally fixed:

```text
planner -> reviewer -> executor -> evaluator
```

Each `run` creates or updates:

- `moss-harness` runtime state under `.runtime/moss-harness/`
- stage tasks and claim events
- stage artifacts and stage result envelopes
- timeline, summary, feedback, and report outputs

The staged flow in `mosscli` runs on top of the workflow orchestration capability already implemented in the `moss-harness` substrate. In other words, the app is validating the orchestrator; it is not redefining it as a standalone workflow product.

## CLI Commands

```bash
mosscli run --goal "Implement login flow"
mosscli status --run-id <run_id>
mosscli replay --run-id <run_id>
mosscli report --run-id <run_id> --format md
mosscli report --run-id <run_id> --format json
mosscli serve --port 4310
```

### `run`

- starts a new validation flow
- executes `planner -> reviewer -> executor -> evaluator`
- persists artifacts, stage outputs, and feedback

### `status`

- reads the current or specified run from `.runtime/moss-harness/`
- shows stage, status, selected agent, and task identifiers

### `replay`

- reconstructs replay-safe events from `timeline.jsonl`
- ignores malformed events missing critical fields

### `report`

- `md` emits a human-readable run summary
- `json` emits machine-readable report data
- target-state metrics include:
  - `moss_expert_hit_rate`
  - `moss_fallback_rate`
  - `moss_rework_rate`
  - `moss_stage_avg_duration`

### `serve`

- starts a local **read-only** HTTP service
- exposes observation endpoints, not mutation endpoints
- keeps the control plane in the CLI

## Runtime Layout

Runtime data is written under `.runtime/moss-harness/`:

```text
.runtime/moss-harness/
├── run.json
└── runs/
    └── <run-id>/
        ├── run.json
        ├── summary.json
        ├── feedback.json
        ├── timeline.jsonl
        ├── stages/
        │   ├── 01-planner.json
        │   ├── 02-reviewer.json
        │   ├── 03-executor.json
        │   └── 04-evaluator.json
        └── artifacts/
            ├── plan.md
            ├── review.md
            ├── execution.md
            └── evaluation.md
```

## Development

```bash
npm --prefix apps/mosscli run build
node apps/mosscli/dist/cli/index.js --help
```

## Verification

```bash
bats tests/apps/test_mosscli_cli.bats
bats tests/apps/test_mosscli_task4.bats
bats tests/apps/test_mosscli_task5.bats
bats tests/apps/test_mosscli_task6.bats
```

## Repository Verification

```bash
npm --prefix apps/mosscli run build
bats tests/apps tests/scripts tests/tooling tests/context
npm test
```
