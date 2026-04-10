# Contributing to moss-harness

Thank you for contributing to `moss-harness`.

This repository is not a generic agent playground. It is a substrate project for self-evolving superintelligence systems. Contributions are welcome, but they must strengthen the coherence of the harness rather than add disconnected features.

## What Matters Most

The highest-value contributions usually improve one of these areas:

- orchestration and Role Lane discipline
- memory quality and retrieval correctness
- sandboxed execution and side-effect control
- telemetry, replay, reporting, and `moss_` metrics
- governance, feedback, and bounded adaptation
- documentation that clarifies the substrate/app boundary

## Project Values

Please preserve the following values when making changes:

- **Facts before stories** - persist and verify execution facts before describing system behavior
- **Readability before hype** - explain the architecture clearly; do not hide complexity behind vague language
- **Governance before unchecked evolution** - stronger systems must remain controllable
- **Replayability before intuition** - make it possible to inspect and replay what happened
- **Boundary clarity before convenience** - do not blur substrate, app, and observability surfaces

## Architectural Invariants

Your changes must not weaken these invariants:

- every execution belongs to a **Role Lane**
- claiming follows **`Fact -> Audit -> Broadcast`**
- the Web panel remains **read-only**
- runtime data for the validation app belongs under **`.runtime/moss-harness/`**
- target-state observability indicators use the **`moss_`** prefix

If your change challenges one of these rules, document the rationale explicitly and discuss it before implementation.

## Local Setup

```bash
npm install
npm --prefix apps/mosscli run build
node apps/mosscli/dist/cli/index.js --help
```

Recommended validation commands:

```bash
bats tests/apps/test_mosscli_cli.bats
bats tests/apps/test_mosscli_task4.bats
bats tests/apps/test_mosscli_task5.bats
bats tests/apps/test_mosscli_task6.bats
bats tests/scripts/test_executor_lane_poc.bats
npm test
```

## Contribution Areas

### Orchestration

Work here when improving:

- role routing
- task progression
- claim handling
- run lifecycle structure

Guardrail:
- do not turn the system into an undifferentiated pool of agents

### Memory

Work here when improving:

- fact capture
- observation quality
- retrieval discipline
- long-horizon knowledge structure

Guardrail:
- do not optimize for memory volume at the expense of signal quality

### Sandbox

Work here when improving:

- controlled execution
- isolation boundaries
- reproducibility
- side-effect safety

Guardrail:
- do not add execution power without preserving inspection and control

### Telemetry and Reporting

Work here when improving:

- timeline fidelity
- replay quality
- report structure
- exported metrics

Guardrail:
- telemetry must describe system behavior, not invent it after the fact

### Governance and Feedback

Work here when improving:

- review loops
- evaluator decisions
- bounded adaptation
- evolution guardrails

Guardrail:
- every adaptive mechanism should remain explainable and testable

### Documentation

Work here when improving:

- project positioning
- architecture clarity
- contributor guidance
- app/substrate boundaries

Guardrail:
- do not present `mosscli` as the entire project

## Documentation Sync Rules

When your change affects project behavior, update the canonical doc owner instead of scattering partial explanations.

- `README.md` - strategic positioning and docs map
- `README.zh-CN.md` - Chinese parity narrative
- `ARCHITECTURE.md` - architectural layers and invariants
- `docs/design-philosophy.md` - SCI doctrine and superiority framing
- `CONTRIBUTING.md` - contributor workflow and standards
- `apps/mosscli/README.md` - validation app usage and runtime behavior

Side-entry docs such as `tests/README.md`, `README-EXTENSION.md`, `docs/quickstart.md`, and `docs/local-ci.md` should stay lightweight and link back to the canonical docs when needed.

## Pull Request Expectations

Before opening a PR, verify that you have:

- kept `moss-harness` and `mosscli` boundaries explicit
- preserved Role Lane ownership and transactional claiming order
- kept the Web panel read-only
- used `moss_` for target-state observability examples where relevant
- updated the appropriate docs
- run the most relevant tests for your area

## Commit Guidance

We use conventional commit style where practical:

- `feat:` for new capability
- `fix:` for bug fixes
- `docs:` for documentation updates
- `refactor:` for structural improvements
- `test:` for test work
- `chore:` for tooling and maintenance

Examples:

```bash
git commit -m "docs: refresh moss-harness project narrative"
git commit -m "refactor: strengthen mosscli runtime invariants"
```

## Review Standard

Reviews should focus on:

- correctness
- boundary clarity
- invariant preservation
- documentation accuracy
- verification evidence

“Looks useful” is not enough. A change should make the substrate stronger, clearer, or safer.

## Where to Start

If you are new to the repository, start here:

- [README.md](README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/design-philosophy.md](docs/design-philosophy.md)
- [apps/mosscli/README.md](apps/mosscli/README.md)
- [tests/README.md](tests/README.md)
