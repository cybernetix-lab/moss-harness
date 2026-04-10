# Moss-Harness Architecture

## North Star

`moss-harness` is a self-evolving superintelligence harness substrate.

The architecture is not organized around a single agent, a single UI, or a single workflow. It is organized around a harder objective: building agent systems that can coordinate, remember, execute, observe, govern, and improve themselves without collapsing into opacity.

## Architectural Thesis

The project treats the following as one closed-loop system:

- orchestration
- memory
- sandbox execution
- telemetry
- replay and reporting
- governance
- evolutionary feedback

A strong substrate cannot let these drift into separate silos. If they are designed independently, the system may complete tasks but it will not learn safely, explain itself clearly, or evolve coherently.

## System Layers

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Strategy Layer | Define the north star, constraints, and evolution doctrine | SCI theory, project priorities, architectural invariants |
| Substrate Layer | Provide core harness behavior | orchestration, memory, sandbox, telemetry, governance |
| Runtime Layer | Execute runs and persist facts | claim engine, runtime stores, flow execution, replay data |
| Validation Layer | Prove the substrate through a controlled app surface | `apps/mosscli/` |
| Observability Layer | Expose facts without mutating system state | reports, timelines, `moss_` metrics, read-only Web panel |

## Capability Stack

The current strategic priority order is:

1. **Orchestration**
   - role-aware routing
   - implemented workflow orchestration across staged execution paths
   - sub-agent coordination
   - feedback-aware rework and reroute transitions
   - deterministic stage progression where required
2. **Memory**
   - durable facts and observations
   - retrieval discipline
   - information quality control
3. **Sandbox**
   - controlled execution
   - isolated side effects
   - replayable output surfaces
4. **Telemetry / Replay / Report**
   - timeline capture
   - causal reconstruction
   - operator-facing evidence
5. **Governance / Feedback / Evolution**
   - rule-based intervention
   - bounded adaptation
   - measurable system improvement

This order reflects current emphasis, not final capability limits. The workflow orchestrator is already part of the runtime orchestration layer: it coordinates stage progression, rework routing, and run-structure continuity as part of the substrate rather than as a standalone workflow product.

## Core Invariants

The following invariants are architectural, not optional implementation details.

### Role Lane Ownership

Every execution belongs to a Role Lane.

Role Lanes define:

- responsibility boundaries
- artifact expectations
- what kinds of work an agent can claim
- how feedback should route through the system

This protects the substrate from becoming an undifferentiated pool of agents.

### Transactional Claiming

Task claiming follows this order:

1. `Fact`
2. `Audit`
3. `Broadcast`

The system must record the fact first, persist the audit trail second, and only then broadcast the change to downstream telemetry and observers. This keeps the runtime reconstructable under failure.

### Read-Only Web Observability

The Web surface exposed by `mosscli serve` is read-only.

The control plane remains CLI-first. This boundary is intentional:

- operators act through explicit commands
- the Web panel observes facts and timelines
- the system avoids accidental hidden writes from UI workflows

The Web layer is a visibility surface, not a second control plane.

### Runtime Namespace

Validation runtime data lives under `.runtime/moss-harness/`.

A typical run layout is:

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
        └── artifacts/
```

### Metric Contract

Target-state observability indicators use the `moss_` prefix.

Examples:

- `moss_expert_hit_rate`
- `moss_fallback_rate`
- `moss_rework_rate`
- `moss_stage_avg_duration`

This keeps exported signals clearly associated with the substrate and makes long-horizon comparison easier.

## Feedback and Evolution Loop

`moss-harness` is designed as a controlled adaptive loop rather than a fire-and-forget workflow engine.

A simplified loop looks like this:

1. work is routed into a Role Lane
2. the workflow orchestrator advances or reroutes stages based on the current run state
3. claim facts are persisted transactionally
4. execution produces stage artifacts and result envelopes
5. telemetry captures events and metrics
6. replay and reports expose what happened
7. feedback determines whether the system should continue, rework, reroute, or escalate
8. memory and governance inform later runs

The point is not just to finish a run. The point is to improve the substrate's future behavior without losing legibility.

## Runtime Data Boundaries

The architecture intentionally separates:

- **control inputs** - CLI commands and explicit operator actions
- **execution facts** - run state, stage outputs, feedback files, claims, audits
- **observability outputs** - reports, replay timelines, `moss_` metrics, read-only Web views

This boundary keeps the substrate honest. Observability should describe the system, not secretly mutate it.

## Mosscli as Validation App

`apps/mosscli/` is the current validation surface for `moss-harness`.

Its role is to prove that the substrate can already support:

- fixed-path staged execution
- implemented workflow orchestration for stage sequencing and feedback-aware routing
- task progression across explicit roles
- artifact persistence
- replayable run history
- feedback-driven rework
- read-only operational observability

`mosscli` is intentionally narrower than the substrate. It should never be mistaken for the entire strategic boundary of the project.

## Practical Reading Path

- Start with [README.md](README.md) for project positioning
- Read [docs/design-philosophy.md](docs/design-philosophy.md) for the SCI doctrine behind the architecture
- Use [CONTRIBUTING.md](CONTRIBUTING.md) for contributor workflow and verification expectations
- Open [apps/mosscli/README.md](apps/mosscli/README.md) when working specifically with the validation app

## Current MVP Boundary and Future Direction

Today the substrate is validated primarily through `mosscli`. Tomorrow the architecture is meant to support richer evolution loops, stronger memory regimes, deeper governance, and more capable sandboxed execution.

What should not change is the underlying discipline:

- facts before stories
- replay before hand-waving
- feedback before blind automation
- governance before unconstrained evolution
