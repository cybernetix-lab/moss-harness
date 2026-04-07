# 🚀 Awesome Agent Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/network/members)

> A production-grade AI Agent Harness engineering template providing a reliable, observable, and recoverable Agent runtime environment.

[English](./README.md) | [中文](./README.zh-CN.md)

---

## ✨ Features

- 🛠️ **Skill System** - Reusable Agent capability modules with automatic trigger recognition
- 🪝 **Session Hooks** - Automated context management with session lifecycle events
- 🤖 **Multi-Agent Architecture** - Specialized Agent collaboration (Planner, Reviewer, Executor, Evaluator)
- 📋 **Code Rules** - Automated compliance checking with custom rule support
- 🔌 **MCP Integration** - Standardized external tool interfaces (filesystem, Git, GitHub, etc.)
- 🧠 **Memory System** - Cross-session learning with automatic pattern extraction
- ✅ **Verification Loop** - 6-level quality assurance (syntax → static analysis → tests → security → performance)
- 🔒 **Constraint Guardrails** - 4-level constraint system (hard/soft/guidelines/preferences)
- 📊 **Evaluation Framework** - Agent and skill performance evaluation with evolution support

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/awesome-agent-harness.git
cd awesome-agent-harness

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

---

## 📁 Project Structure

```
awesome-agent-harness/
├── agents/              # Agent configurations
├── skills/              # Skill system
├── hooks/               # Session hooks
├── rules/               # Code rules
├── verification/        # Verification loop
├── context/             # Context management
├── constraints/         # Constraints & guardrails
├── evals/               # Evaluation framework
├── telemetry/           # Observability
├── mcp/                 # MCP configuration
├── memory/              # Memory system
├── tools/               # Tool definitions
└── scripts/             # Operation scripts
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

## ⚙️ Configuration

### Environment Variables

```bash
# Hook configuration
export ECC_HOOK_PROFILE=standard  # minimal|standard|strict
export ECC_DISABLED_HOOKS=        # Disabled hooks
export ECC_SESSION_ID=xxx
export ECC_AGENT=planner

# Checkpoint configuration
export ECC_CHECKPOINT_INTERVAL=10

# Permission level
export ECC_PERMISSION_LEVEL=confirm_required
```

### Constraint Configuration

Constraints are divided into 4 levels:

- **Level 4**: Hard Constraints - Cannot be overridden
- **Level 3**: Soft Constraints - Can be overridden with logging
- **Level 2**: Guidelines - Recommended to follow
- **Level 1**: Preferences - Default behavior

---

## 📝 Documentation

- [Quick Start Guide](./docs/quickstart.md)
- [Skill Development Guide](./docs/skills.md)
- [Agent Configuration Guide](./AGENTS.md)
- [Agent Collaboration Workflow](./docs/agent-collaboration.md)
- [Agent Evaluation & Evolution](./docs/agent-evolution.md)
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

- Inspired by [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- Reference [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering)

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/awesome-agent-harness&type=Date)](https://star-history.com/#yourusername/awesome-agent-harness&Date)
