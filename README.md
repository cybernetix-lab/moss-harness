# 🚀 Moss Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A self-evolving superintelligence harness substrate, providing a reliable, observable, and recoverable execution environment for agent systems.

**A next-generation agent collaboration framework designed on the principles of System, Control, and Information (SCI) theory.**

[English](./README.md) | [中文](./README.zh-CN.md)

---

## ✨ Core Features

### Scientific Design Philosophy

Unlike platforms driven by mere prompt stacking, this project is built on the rigorous foundation of SCI theory (Systematics, Cybernetics, and Informatics) to establish underlying system order:

- **Systematics** — Seeing the whole: A six-role lane separation architecture that enables higher-order coordination and emergence (1+1>2).
- **Informatics** — Understanding communication: Transactional fact chains, structured protocol communication, and memory curation.
- **Cybernetics** — Achieving goals: A Workflow Orchestrator driving two-stage routing and cybernetic feedback loops.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Moss Harness Architecture                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Systematics │ Coordinator → Planner → Reviewer → Executor → Evaluator   │
│             │ (with Memory Curator for cross-run curation)              │
├─────────────────────────────────────────────────────────────────────────┤
│ Informatics │ Structured Protocols │ Transactional Fact Chain │ Memory  │
├─────────────────────────────────────────────────────────────────────────┤
│ Cybernetics │ Workflow Orchestrator │ Two-Stage Routing │ Feedback Loop │
├─────────────────────────────────────────────────────────────────────────┤
│ Observability │ Execution Tracing │ Evaluation │ Analytics              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Capabilities

- 🏛️ **Four-Layer Architecture** - Strict separation of Strategy (Governance), Harness (Orchestration/Substrate), App (Case Studies), and Observability.
- 🤖 **Multi-Agent Lanes** - 6 dedicated role lanes for specialized collaboration, eliminating single-agent hallucinations.
- 🔀 **Two-Stage Routing** - Coarse Intent classification + precise Policy Evaluation.
- 🔄 **Feedback-Driven Loop** - Review and evaluation results act as control logic to dynamically alter execution paths.
- 📋 **Transactional Claiming** - "Facts before broadcast." Agents autonomously scan and claim work from the Task Board atomically.
- 🧠 **Memory & Emergence System** - Cross-session learning that automatically extracts reusable patterns and candidate expert agents.
- 📊 **Read-Only Observability** - State changes are persisted as a fact chain, providing timeline-based Execution Tracing, Quality Evaluation, and Analytics.
- 🔌 **MCP Integration** - Standardized interfaces for external tools and systems.
- 🔒 **Constraint Guardrails** - 4-level constraint system (Hard/Soft/Guidelines/Preferences).
- 🛠️ **Skill System** - Reusable agent capability modules and code rule checks.

---

## 🎯 Why Choose Moss Harness?

### 1. Scientific Foundation

Unlike traditional agent frameworks that rely on "experience-driven" design or flat capability lists, Moss Harness builds underlying order based on mature system theories:

| Dimension | Traditional Frameworks | Moss Harness |
|------|---------|---------------|
| **Architecture** | Experience-driven, API wrappers | Architecture-first, SCI theory driven |
| **Routing** | Static single-path or LLM free-roam | **Two-Stage Routing** (Intent + Policy) |
| **Quality Control** | Simple pass/fail, or post-logs | **Cybernetic Feedback**, directly altering workflow |
| **Task Claiming** | Centralized Dispatch | **Transactional Autonomous Claiming** |

### 2. Preventing Optimism Bias

The six-role separation architecture ensures execution quality through strict permission and objective isolation:

```text
Coordinator → Planner → Reviewer → Executor → Evaluator
                 ↑                         │
                 └────────── Feedback ─────┘
      Memory Curator operates across runs to curate knowledge
```

- **Planner/Reviewer/Evaluator**: Read-only permissions, focusing on requirements analysis, plan review, and objective assessment.
- **Executor**: Read/write and execution permissions, focusing on code implementation and testing.
- A Planner never evaluates its own plan; an Executor never reviews its own code.

### 3. A Truly Closed-Loop Orchestrator

Moss Harness is not a linear workflow; it is a cybernetic closed-loop system powered by the Workflow Orchestrator:

```text
Role Lane → Orchestrator → Fact (persist) → Audit → Broadcast
            ↓ execution   ↓ Execution Tracing / Evaluation / Analytics
            Feedback ← quality / confidence ← Reviewer / Evaluator
            Memory & Governance → inform the next run
```

Correction must change the path, not just add a log entry. This is the core purpose of the Orchestrator residing in the Harness layer.

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/cybernetix-lab/moss-harness.git
cd moss-harness

# Install dependencies and build
npm install
npm --prefix apps/mosscli run build
```

### Basic Usage (App Layer: mosscli)

`mosscli` is the first terminal application case built on top of `moss-harness`:

```bash
# View help
node apps/mosscli/dist/cli/index.js --help

# Run a harness case application
node apps/mosscli/dist/cli/index.js run --goal "Implement user authentication"
```

### Running Observability

```bash
# Check task status
node apps/mosscli/dist/cli/index.js status

# Run execution tracing and evaluation analytics
node apps/mosscli/dist/cli/index.js trace
node apps/mosscli/dist/cli/index.js evaluate
```

---

## 📁 Project Structure

The project is strictly organized following the four-layer architecture (Strategy -> Harness -> App -> Observability):

```text
moss-harness/
├── apps/                      # [App Layer] Case applications
│   └── mosscli/               # CLI-first validation app
├── configs/                   # [Strategy Layer] Configuration center
│   ├── orchestration/         # Orchestration and lane configs
│   ├── protocols/             # Structured communication protocols
│   └── agents/                # Agent template configurations
├── docs/                      # Documentation and architecture specs
├── evals/                     # Evaluation framework
├── .runtime/moss-harness/     # [Observability Layer] Runtime persistence and fact chain
│   ├── tasks/                 # Task Board state facts
│   └── telemetry/             # Telemetry event logs
├── src/                       # [Harness Layer] Core source code
│   ├── core/                  # Workflow Orchestrator and routing
│   ├── agents/                # Role Agent implementations
│   └── memory/                # Memory and curation system
├── tests/                     # Test cases (Bats/Jest)
└── scripts/                   # DevOps and management scripts
```

---

## 🛠️ Skill System

Skills are reusable capability modules provided at the App and Harness layers, either directly mounted or via MCP:

```bash
# Activate a skill (Example)
./scripts/skill-activate.sh code-review
```

### Built-in Capability Directions

| Skill Category | Associated Role | Description |
|------|------|------|
| `architecture-design` | Planner | Architecture patterns and technical solution output |
| `security-review` | Reviewer | Security checks for code and plans |
| `test-driven-dev` | Executor | TDD red-green cycle implementation |
| `knowledge-extraction` | Memory Curator | Extracting candidate expert traits from context |

---

## 🤖 Agent Role Model

This project adopts a **six-role multi-agent architecture** and curates Experts within each Lane.

| Role Category | Responsibility | Permissions | Expert Agent Example |
|-------|------|----------|----------------|
| **Coordinator** | Intent recognition, requirement clarification | Read-only | `api_coordinator` |
| **Planner** | Requirement analysis, task breakdown, design | Read-only | `db_planner` |
| **Reviewer** | Risk identification, plan evaluation, suggestions | Read-only | `sec_reviewer` |
| **Executor** | Code implementation, test writing, self-testing | Read/Write/Exec | `frontend_executor` |
| **Evaluator** | Quality assessment, requirement validation | Read/Test | `perf_evaluator` |
| **Memory Curator**| Context compression, knowledge archiving | Read/Exec | `doc_curator` |

### Workflow

```text
User submits intent
    ↓
Coordinator clarifies requirements and outputs Requirement Task
    ↓
Planner claims requirement, outputs Execution Plan
    ↓
Reviewer performs structured review (APPROVED / NEEDS_REVISION)
    ↓
Executor claims and executes code implementation
    ↓
Evaluator assesses implementation quality (PASS / NEEDS_IMPROVEMENT)
    ↓
┌──────────┴──────────┐
│                     │
PASS/EXCELLENT    NEEDS_IMPROVEMENT
│                     │
Memory Curator    (Orchestrator Routing)
curates knowledge   Returns to Executor/Planner to fix
```

---

## 📊 Evaluation & Emergence

### Agent Evaluation

Based on the objective fact chain produced by the Evaluator, the system supports metrics for agents in each lane:

```bash
# Evaluate a single agent
./scripts/agent-eval.sh run planner

# View evaluation report
./scripts/agent-eval.sh report planner
```

### Pattern Extraction & Evolution

When a pattern successfully recurs multiple times within the same lane, the Memory Curator records it as a **Candidate Expert**. After review, it is automatically promoted to a formal Expert Agent.

```bash
# Analyze agent performance and curated patterns
./scripts/agent-evolve.sh analyze planner
```

---

## 🔬 Feedback-Driven Loop

A cybernetics-based feedback loop that directly intervenes in the Workflow Orchestrator routing:

### Core Mechanisms

- **Task Governance**: Based on risk feedback from the Reviewer/Evaluator, dynamically decides whether to "proceed", "rework", or "circuit break".
- **Learning Progression**: Automatically breaks down collection, extraction, synthesis, and validation subtasks based on knowledge gaps.

### Two-Stage Routing

1. **Coarse Intent Classification**: `intent-classifier` decides which Policy family to use (Governance vs Learning).
2. **Precise Policy Evaluation**: `task-governance` or `learning-progression` calculates the exact next stage (e.g., `NEEDS_REVISION` → route back to Planner).

---

## ⚙️ Configuration

### Environment Variables

```bash
export MOSS_AGENT=planner            # Activate a specific role agent
export MOSS_PERMISSION_LEVEL=strict  # Constraint level
export MOSS_TELEMETRY_ENABLED=true       # Enable telemetry and observability
```

### Model Configuration

Model configurations are located in `configs/agents/` or `config/models.yaml`:

```yaml
model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.2
  max_tokens: 4096
```

### Governance Constraints

System rules are not just prompts; they are hard-coded governance strategies:
- **Level 4 (Hard)**: Unauthorized sandbox execution isolation.
- **Level 3 (Soft)**: Fact chain protocols that must be structurally persisted.

---

## 📝 Docs Map

- [ARCHITECTURE.md](ARCHITECTURE.md) - Deeper system shape, runtime logic, and four-layer boundaries.
- [docs/design-philosophy.md](docs/design-philosophy.md) - Why SCI theory matters to the architecture.
- [docs/agent-collaboration.md](docs/agent-collaboration.md) - Agent collaboration workflow instructions.
- [apps/mosscli/README.md](apps/mosscli/README.md) - `mosscli` as an app-layer case application.
- [CONTRIBUTING.md](CONTRIBUTING.md) - Engineering conventions for contributing to the substrate.

---

## 🤝 Contributing

We welcome all forms of contribution! Please follow the Architecture-First principle and check [CONTRIBUTING.md](./CONTRIBUTING.md) to learn how to participate in building the substrate.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

## 🙏 Acknowledgments

- Design philosophy inspired by Systematics, Cybernetics, and Informatics (SCI theory).
- Architecture design inspired by executive control and learning memory mechanisms in neuroscience.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cybernetix-lab/moss-harness&type=Date)](https://star-history.com/#cybernetix-lab/moss-harness&Date)
