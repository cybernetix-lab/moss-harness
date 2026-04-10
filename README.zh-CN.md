# 🚀 Moss Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 面向可自动进化学习的超级智能体系统的 Harness 底座，提供可靠、可观测、可恢复的 Agent 运行环境。

**基于系统论、控制论、信息论（SCI 论）设计的下一代 Agent 协作框架**

[English](./README.md) | [中文](./README.zh-CN.md)

---

## ✨ 核心特性

### 科学的设计哲学

本项目以“老三论”（系统论、控制论、信息论）为理论基础，构建了一套科学、严谨的 Agent 协作框架。它不关注简单的 prompt 堆砌，而是建立底层的系统秩序：

- **系统论** — 看见整体：六角色泳道分离架构，实现高阶协同与涌现性（1+1>2）。
- **信息论** — 理解沟通：事务化事实链（Fact Chain），结构化协议通信与记忆沉淀。
- **控制论** — 实现目的：Workflow Orchestrator 驱动的两段式路由与反馈闭环。

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        Moss Harness 架构设计                            │
├─────────────────────────────────────────────────────────────────────────┤
│  系统论层 │  Coordinator → Planner → Reviewer → Executor → Evaluator   │
│          │  (加上跨会话的 Memory Curator)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  信息论层 │  结构化协议通信 │ 事务化事实链 │ 知识沉淀与信噪比控制          │
├─────────────────────────────────────────────────────────────────────────┤
│  控制论层 │  Workflow Orchestrator │ 两段式动态路由 │ 反馈驱动闭环        │
├─────────────────────────────────────────────────────────────────────────┤
│  Observability 层 │  执行追踪 (Tracing) │ 质量评测 (Evaluation) │ 大盘分析 (Analytics) │
└─────────────────────────────────────────────────────────────────────────┘
```

### 功能特性

- 🏛️ **四层架构分离** - Strategy (治理), Harness (底座), App (应用), Observability (观测面) 严格解耦。
- 🤖 **多 Agent 泳道** - 6 角色专用泳道分工协作，消除单体 Agent 幻觉。
- 🔀 **两段式路由** - 意图粗分类 (Intent) + 策略精算 (Policy Evaluation)。
- 🔄 **反馈驱动闭环** - 审查与评估结果直接作为控制逻辑改变执行路径。
- 📋 **事务化认领** - “事实先于广播”，基于 Task Board 自主扫描与原子化认领。
- 🧠 **记忆与涌现系统** - 跨会话学习，自动提取可复用模式与候选专家 Agent。
- 📊 **只读观测面** - 状态变更落盘为事实链，提供基于时间线的执行追踪 (Execution Tracing) 与质量评测分析 (Evaluation & Analytics) 能力。
- 🔌 **MCP 集成** - 标准化外部工具与外部系统接口对接。
- 🔒 **约束护栏** - 4 级约束系统（硬约束/软约束/指导原则/偏好设置）。
- 🛠️ **技能系统** - 可复用的 Agent 能力模块与代码规则检查。

---

## 🎯 为什么选择 Moss Harness？

### 1. 科学的设计基础

不同于其他 Agent 框架的“经验驱动”设计，Moss Harness 基于成熟的系统理论构建底层秩序：

| 维度 | 传统框架 | Moss Harness |
|------|---------|---------------|
| **架构设计** | 经验驱动、API 封装 | 架构优先、SCI 系统论驱动 |
| **路由机制** | 静态单路径或 LLM 自由发散 | **两段式路由** (意图识别 + 策略评估) |
| **质量控制** | 简单通过/失败，或事后日志 | **控制论负反馈**，直接改变 Workflow 路径 |
| **任务认领** | 集中式分配 (Centralized Dispatch) | **事务化自主认领** (事实先于广播) |

### 2. 避免自评乐观偏差

六角色分离架构确保执行质量：

```text
Coordinator → Planner → Reviewer → Executor → Evaluator
                 ↑                         │
                 └────────── Feedback ─────┘
      Memory Curator 跨 Run 维护可沉淀、可复用的知识
```

- **Planner/Reviewer/Evaluator**：只读权限，专注需求分析、方案审查和质量评估。
- **Executor**：读写+执行权限，专注代码实现与测试。
- 绝不让 Planner 评估自己的计划，也不让 Executor 审查自己的代码。

### 3. 真正闭环的 Orchestrator

Moss Harness 不是一条线性的流程，而是一套基于 Workflow Orchestrator 的控制论闭环系统：

```text
Role Lane → Orchestrator → Fact（落盘）→ Audit → Broadcast
            ↓ 执行        ↓ Execution Tracing / Evaluation / Analytics
            Feedback ← 质量 / 置信度 ← Reviewer / Evaluator
            Memory & Governance → 影响下一轮运行
```

纠偏必须改变路径，而不只是补一条日志。这就是 Orchestrator 存在于 Harness 层的核心意义。

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/cybernetix-lab/moss-harness.git
cd moss-harness

# 安装依赖并构建
npm install
npm --prefix apps/mosscli run build
```

### 基本使用 (App Layer: mosscli)

`mosscli` 是建立在 `moss-harness` 之上的首个终端应用案例：

```bash
# 查看帮助
node apps/mosscli/dist/cli/index.js --help

# 运行一个 Harness 案例应用
node apps/mosscli/dist/cli/index.js run --goal "实现用户认证功能"
```

### 运行观测

```bash
# 查看任务状态
node apps/mosscli/dist/cli/index.js status

# 运行执行追踪 (Execution Tracing) 与评测大盘
node apps/mosscli/dist/cli/index.js trace
node apps/mosscli/dist/cli/index.js evaluate
```

---

## 📁 项目结构

项目严格遵循四层架构 (Strategy -> Harness -> App -> Observability) 进行组织：

```text
moss-harness/
├── apps/                      # 【App 层】案例应用
│   └── mosscli/               # CLI-first 的验证应用
├── configs/                   # 【Strategy 层】配置中心
│   ├── orchestration/         # 编排与泳道配置
│   ├── protocols/             # 结构化通信协议
│   └── agents/                # Agent 模板配置
├── docs/                      # 文档与架构规范
├── evals/                     # 评估框架
├── .runtime/moss-harness/     # 【Observability 层】运行时落盘与事实链
│   ├── tasks/                 # Task Board 状态事实
│   └── telemetry/             # 遥测事件日志
├── src/                       # 【Harness 层】核心源码
│   ├── core/                  # Workflow Orchestrator 及路由
│   ├── agents/                # 角色 Agent 实现
│   └── memory/                # 记忆与沉淀系统
├── tests/                     # 测试用例 (Bats/Jest)
└── scripts/                   # 运维与管控脚本
```

---

## 🛠️ 技能系统

技能是 App 层和 Harness 层可复用的能力模块，通过 MCP 或直接挂载提供：

```bash
# 激活技能 (示例)
./scripts/skill-activate.sh code-review
```

### 内置能力方向

| 技能类别 | 关联角色 | 描述 |
|------|------|------|
| `architecture-design` | Planner | 架构模式与技术方案输出 |
| `security-review` | Reviewer | 代码与计划的安全性检查 |
| `test-driven-dev` | Executor | TDD 红绿循环实现 |
| `knowledge-extraction` | Memory Curator | 从上下文中提取候选专家特征 |

---

## 🤖 Agent 角色模型

本项目采用**六角色多 Agent 架构**，并在每个泳道（Lane）下沉淀专家（Expert）。

| 角色分类 (Role) | 职责 | 工具权限 | 专家 Agent 示例 |
|-------|------|----------|----------------|
| **Coordinator** | 意图识别、需求澄清、任务分发 | 只读 | `api_coordinator` |
| **Planner** | 需求分析、任务分解、方案设计 | 只读 | `db_planner` |
| **Reviewer** | 风险识别、方案评估、改进建议 | 只读 | `sec_reviewer` |
| **Executor** | 代码实现、测试编写、自测验证 | 读写+执行 | `frontend_executor` |
| **Evaluator** | 质量评估、需求验证、结论输出 | 只读+测试 | `perf_evaluator` |
| **Memory Curator**| 上下文压缩、信息归档、信噪比控制 | 只读+执行 | `doc_curator` |

### 工作流程

```text
用户提交意图
    ↓
Coordinator 澄清需求并输出 Requirement Task
    ↓
Planner 认领需求，输出 Execution Plan
    ↓
Reviewer 结构化审查 (APPROVED / NEEDS_REVISION)
    ↓
Executor 认领并执行代码实现
    ↓
Evaluator 评估实现质量 (PASS / NEEDS_IMPROVEMENT)
    ↓
┌──────────┴──────────┐
│                     │
PASS/EXCELLENT    NEEDS_IMPROVEMENT
│                     │
Memory Curator    (Orchestrator 路由)
进行知识沉淀        返回 Executor/Planner 修复
```

---

## 📊 评估与进化

### Agent 评估

基于 Evaluator 的客观事实链，系统支持对各泳道 Agent 进行度量：

```bash
# 评估单个 Agent
./scripts/agent-eval.sh run planner

# 查看评估报告
./scripts/agent-eval.sh report planner
```

### 模式提取与进化

当某类模式连续多次在同一泳道下成功复现时，Memory Curator 会将其记录为 **Candidate Expert**，经过审查后自动晋升为正式 Expert Agent。

```bash
# 分析 Agent 性能与沉淀的模式
./scripts/agent-evolve.sh analyze planner
```

---

## 🔬 反馈驱动闭环

基于控制论的反馈循环，直接介入 Workflow Orchestrator 路由：

### 核心机制

- **任务治理 (Task Governance)**：基于 Reviewer/Evaluator 的风险反馈，动态决定是“继续推进”、“打回返工”还是“熔断重入”。
- **认知推进 (Learning Progression)**：基于知识缺口自动拆解搜集、抽取、综合、验证子任务。

### 两段式路由

1. **意图粗分类**：由 `intent-classifier` 决定选用哪个 Policy 家族（Governance vs Learning）。
2. **策略精算**：由 `task-governance` 或 `learning-progression` 计算出精确的下一个流转阶段（如 `NEEDS_REVISION` → 路由回 Planner）。

---

## ⚙️ 配置

### 环境变量

```bash
export MOSS_AGENT=planner            # 激活特定角色 Agent
export MOSS_PERMISSION_LEVEL=strict  # 约束级别
export MOSS_TELEMETRY_ENABLED=true       # 开启遥测与可观测性
```

### 模型配置

模型配置位于 `configs/agents/` 或 `config/models.yaml`：

```yaml
model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.2
  max_tokens: 4096
```

### 治理约束配置

系统的规则不仅是 prompt，更是硬编码的治理策略：
- **Level 4 (Hard)**: 不可越权的沙箱执行隔离。
- **Level 3 (Soft)**: 必须结构化落盘的事实链协议。

---

## 📝 文档导航

- [ARCHITECTURE.md](ARCHITECTURE.md) - 核心四层架构、运行逻辑与边界说明
- [docs/design-philosophy.md](docs/design-philosophy.md) - SCI 理论与设计哲学
- [docs/agent-collaboration.md](docs/agent-collaboration.md) - Agent 协作流程说明
- [apps/mosscli/README.md](apps/mosscli/README.md) - 作为应用层案例的 `mosscli`
- [CONTRIBUTING.md](CONTRIBUTING.md) - 参与底座建设的工程公约

---

## 🤝 贡献

我们欢迎所有形式的贡献！请遵循架构优先（Architecture-First）的原则，查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解如何参与底座的开发。

---

## 📄 许可证

本项目采用 [MIT 许可证](./LICENSE)。

---

## 🙏 致谢

- 设计哲学灵感来源于系统论、控制论、信息论（SCI 论）。
- 架构设计借鉴了神经科学中的执行控制与学习记忆机制。

---

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=cybernetix-lab/moss-harness&type=Date)](https://star-history.com/#cybernetix-lab/moss-harness&Date)
