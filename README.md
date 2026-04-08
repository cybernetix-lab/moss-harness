# 🚀 Awesome Agent Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/network/members)

> A production-grade AI Agent Harness engineering template providing a reliable, observable, and recoverable Agent runtime environment.

**Next-Generation Agent Collaboration Framework Based on Systems Theory, Cybernetics, and Information Theory (SCI Theory)**

[English](./README.md) | [中文](./README.zh-CN.md)

---

## ✨ Core Features

### Scientific Design Philosophy

This project is built on the theoretical foundation of the "Three Old Theories" (Systems Theory, Cybernetics, Information Theory), constructing a scientific and rigorous Agent collaboration framework:

- **Systems Theory** — Seeing the Whole: Four-role separation architecture, achieving emergence (1+1>2)
- **Information Theory** — Understanding Communication: Structured information transfer, information quality quantification and optimization
- **Cybernetics** — Achieving Purpose: Feedback-driven closed-loop, adaptive quality control

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Harness Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Systems   │  Orchestrator → Planner → Reviewer → Executor → Evaluator  │
│ Layer     │                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Info      │  Structured Comm │ Confidence Scoring │ Info Quality     │
│ Layer     │  Feedback Loop   │ Token Optimization                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Control   │  Negative Feedback │ Positive Feedback │ Dynamic Routing │
│ Layer     │  Steady-state Termination                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Functional Features

- 🛠️ **Skill System** - Reusable Agent capability modules with automatic trigger recognition
- 🪝 **Session Hooks** - Automated context management with session lifecycle events
- 🤖 **Multi-Agent Architecture** - Specialized Agent collaboration (Planner, Reviewer, Executor, Evaluator)
- 📊 **Information Quality Feedback Loop** - Token efficiency optimization and prompt improvement based on Information Theory
- 📋 **Code Rules** - Automated compliance checking with custom rule support
- 🔌 **MCP Integration** - Standardized external tool interfaces (filesystem, Git, GitHub, etc.)
- 🧠 **Memory System** - Cross-session learning with automatic pattern extraction
- ✅ **Verification Loop** - 6-level quality assurance (syntax → static analysis → tests → security → performance)
- 🔒 **Constraint Guardrails** - 4-level constraint system (hard/soft/guidelines/preferences)
- 📊 **Evaluation Framework** - Agent and skill performance evaluation with evolution support

---

## 🎯 Why Agent Harness?

### 1. Scientific Design Foundation

Unlike "experience-driven" designs of other Agent frameworks, Agent Harness is based on mature system theories:

| Dimension | Traditional Frameworks | Agent Harness |
|-----------|----------------------|---------------|
| Architecture Design | Experience-driven | Systems Theory-driven |
| Information Transfer | Unstructured text | Structured + Information Quality Metrics |
| Quality Control | Simple pass/fail | Feedback Loop + Adaptive Optimization |
| Observability | Log recording | Information Entropy + Token Efficiency Analysis |

### 2. Avoiding Self-Evaluation Optimism Bias

Four-role separation architecture ensures quality:

```
Planner → Reviewer → Executor → Evaluator
             ↑                          │
             └──────── Feedback Loop ────┘
```

- **Planner**: Read-only permission, focused on requirement analysis and solution design
- **Reviewer**: Read-only permission, independently reviews plan feasibility
- **Executor**: Read-write + execute permission, focused on implementation
- **Evaluator**: Read-only + test permission, independently assesses quality

### 3. Information Quality Feedback Loop

Token optimization system based on Information Theory:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Data       │───→│   Quality    │───→│   Strategy   │
│  Collection  │    │  Evaluation  │    │   Decision   │
│  (Metrics)   │    │              │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
       ↑                                        │
       │         ┌──────────────────────────────┘
       │         ↓
┌──────┴──────────────┐    ┌──────────────┐
│   Effect            │←───│  Optimization│
│   Validation        │    │  Execution   │
│                     │    │              │
└─────────────────────┘    └──────────────┘
```

- **Token Information Density** = Information Entropy / Token Count
- **Automatic Prompt Optimization**: Compression, Enhancement, Pruning, Restructuring
- **Continuous Improvement**: Optimizing information transfer efficiency based on historical data

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/cybernetix-lab/harness-spec.git
cd harness-spec

# Initialize the project
./init.sh
```

### Basic Usage

```bash
# Start a new session
./scripts/start-session.sh

# Activate a skill
./scripts/skill-activate.sh typescript-patterns

# Update task status
./scripts/update-context.sh task "Implement user authentication"
./scripts/update-context.sh progress "Complete login form design"

# Create a checkpoint
./scripts/create-checkpoint.sh "Complete basic architecture"

# Run verification
./scripts/verify.sh
```

### Token Metrics Observation

```bash
# View token usage statistics
./hooks/token-metrics.sh --session $(cat .session_id)

# Evaluate information quality
./hooks/info-quality-evaluator.sh --session $(cat .session_id)

# View optimization suggestions
./hooks/info-quality-strategy.sh --session $(cat .session_id) --dry-run
```

---

## 📁 Project Structure

```
awesome-agent-harness/
├── agents/                    # Agent configurations
│   ├── planner.yaml          # Planning Agent
│   ├── reviewer.yaml         # Review Agent
│   ├── executor.yaml         # Execution Agent
│   ├── evaluator.yaml        # Evaluation Agent
│   └── orchestrator.yaml     # Orchestration Agent
├── config/                    # Configuration center
│   ├── models.yaml           # Model configuration (decoupled)
│   └── info-quality-feedback.yaml  # Info quality feedback config
├── skills/                    # Skill system
├── hooks/                     # Session hooks
│   ├── token-metrics.sh      # Token metrics collection
│   ├── info-quality-evaluator.sh   # Information quality evaluator
│   ├── info-quality-strategy.sh    # Feedback strategy engine
│   └── model-call-wrapper.sh       # Model call wrapper
├── rules/                     # Code rules
├── verification/              # Verification loop
├── context/                   # Context management
├── constraints/               # Constraints & guardrails
├── evals/                     # Evaluation framework
├── telemetry/                 # Observability
├── docs/                      # Documentation
│   ├── design-philosophy.md         # Design philosophy (SCI Theory)
│   ├── information-quality-feedback-loop.md  # Info quality feedback loop
│   └── token-optimization.md        # Token optimization guide
├── monitoring/                # Monitoring
│   └── grafana/dashboards/   # Grafana dashboards
├── mcp/                       # MCP configuration
├── memory/                    # Memory system
├── tools/                     # Tool definitions
└── scripts/                   # Operation scripts
```

---

## 🛠️ Skill System

Skills are the core capability modules of Harness:

```bash
# List all skills
./scripts/skill-list.sh

# Activate a skill
./scripts/skill-activate.sh typescript-patterns
./scripts/skill-activate.sh security-scan
```

### Built-in Skills

| Skill | Category | Description |
|-------|----------|-------------|
| `typescript-patterns` | coding | TypeScript code patterns |
| `react-hooks` | coding | React Hooks development |
| `security-scan` | review | Security vulnerability scanning |
| `documentation-lookup` | research | Documentation query |

---

## 🤖 Agent Types

This project adopts a **four-role separation architecture** to avoid self-evaluation optimism bias:

| Agent | Type | Responsibility | Tool Permission |
|-------|------|----------------|-----------------|
| `planner` | planning | Requirements analysis, task decomposition, solution design | Read-only |
| `reviewer` | plan_review | Risk identification, solution evaluation, improvement suggestions | Read-only |
| `executor` | execution | Code implementation, test writing, self-verification | Read-write + Execute |
| `evaluator` | evaluation | Quality assessment, requirements verification, conclusion output | Read-only + Test |
| `researcher` | research | Technology research, documentation lookup | Read-only + Network |
| `orchestrator` | orchestration | Dynamic orchestration, routing decisions, state management | Coordination Layer |

### Workflow

```
User submits requirements
    ↓
Planner analyzes and creates a plan
    ↓
Reviewer reviews the plan
    ↓ (APPROVED)
Executor implements the solution
    ↓
Evaluator assesses quality
    ↓
┌──────────┴──────────┐
│                     │
PASS/EXCELLENT    NEEDS_IMPROVEMENT
│                     │
Task completed    Return to Executor for fixes
                  or return to Planner for replanning
```

For detailed Agent configuration, see [AGENTS.md](./AGENTS.md).

---

## 📊 Evaluation & Evolution

### Agent Evaluation

```bash
# Evaluate a single Agent
./scripts/agent-eval.sh run planner

# Evaluate all Agents
./scripts/agent-eval.sh run-all

# View evaluation report
./scripts/agent-eval.sh report planner
```

### Agent Evolution

```bash
# Analyze Agent performance
./scripts/agent-evolve.sh analyze planner

# Simulate evolution
./scripts/agent-evolve.sh dry-run planner

# Execute evolution
./scripts/agent-evolve.sh evolve planner
```

### Skill Evaluation & Evolution

```bash
# Evaluate a skill
./scripts/skill-eval.sh run typescript-patterns

# Evolve a skill
./scripts/skill-evolve.sh evolve typescript-patterns
```

---

## 🔬 Information Quality Feedback Loop

Token efficiency optimization system based on Information Theory:

### Core Metrics

| Metric | Description | Formula |
|--------|-------------|---------|
| `token_input_count` | Input token count | Direct statistics |
| `token_output_count` | Output token count | Direct statistics |
| `information_entropy` | Information entropy | -Σp(x)log₂p(x) |
| `token_information_density` | Token information density | Information Entropy / Token Count |

### Quality Evaluation

```bash
# Evaluate information quality for current session
./hooks/info-quality-evaluator.sh --session $(cat .session_id)

# Example output:
# {
#   "quality_level": "GOOD",
#   "information_density": 0.0035,
#   "information_entropy": 4.2,
#   "suggestions": ["Consider compressing redundant information"]
# }
```

### Automatic Optimization

```bash
# Generate optimization strategy (dry run)
./hooks/info-quality-strategy.sh --session $(cat .session_id) --dry-run

# Execute optimization
./hooks/info-quality-strategy.sh --session $(cat .session_id) --apply
```

### Monitoring Dashboard

Grafana dashboard located at `monitoring/grafana/dashboards/token-metrics.json`, displaying:

- Token usage trends
- Information density distribution
- Agent efficiency comparison
- Optimization effect tracking

---

## ⚙️ Configuration

### Environment Variables

```bash
# Hook configuration
export AHARNESS_HOOK_PROFILE=standard  # minimal|standard|strict
export AHARNESS_DISABLED_HOOKS=        # Disabled hooks
export AHARNESS_SESSION_ID=xxx
export AHARNESS_AGENT=planner

# Checkpoint configuration
export AHARNESS_CHECKPOINT_INTERVAL=10

# Permission level
export AHARNESS_PERMISSION_LEVEL=confirm_required
```

### Model Configuration

Model configuration is independent of Agent configuration, located at `config/models.yaml`:

```yaml
models:
  claude-3-opus:
    provider: anthropic
    model: claude-3-opus-20240229
    temperature: 0.3
    max_tokens: 8192
  
  claude-3-5-sonnet:
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.2
    max_tokens: 4096
```

### Constraint Configuration

Constraints are divided into 4 levels:

- **Level 4**: Hard Constraints - Cannot be overridden
- **Level 3**: Soft Constraints - Can be overridden with logging
- **Level 2**: Guidelines - Recommended to follow
- **Level 1**: Preferences - Default behavior

### Information Quality Feedback Configuration

```yaml
feedback_loop:
  enabled: true
  mode: adaptive
  evaluation:
    thresholds:
      low_density: 0.001
      low_entropy: 2.0
      high_token_usage: 10000
  strategy:
    max_iterations: 3
    min_improvement: 0.1
```

---

## 📝 Documentation

- [Quick Start Guide](./docs/quickstart.md)
- [Skill Development Guide](./docs/skills.md)
- [Agent Configuration Guide](./AGENTS.md)
- [Agent Collaboration Workflow](./docs/agent-collaboration.md)
- [Agent Evaluation & Evolution](./docs/agent-evolution.md)
- [**Design Philosophy** - Systems Theory, Cybernetics, Information Theory](./docs/design-philosophy.md)
- [**Information Quality Feedback Loop**](./docs/information-quality-feedback-loop.md)
- [**Token Optimization Guide**](./docs/token-optimization.md)
- [Rule Writing Guide](./docs/rules.md)
- [API Documentation](./docs/api.md)

---

## 🤝 Contributing

We welcome all forms of contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to participate.

### Contributors

<a href="https://github.com/yourusername/awesome-agent-harness/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yourusername/awesome-agent-harness" />
</a>

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

## 🙏 Acknowledgments

- Design philosophy inspired by Systems Theory, Cybernetics, and Information Theory
- Inspired by [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- Reference [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering)

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/awesome-agent-harness&type=Date)](https://star-history.com/#yourusername/awesome-agent-harness&Date)
