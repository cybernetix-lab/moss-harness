# 🚀 Awesome Agent Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/network/members)

> 一个生产级完备的 AI Agent Harness 工程模板，提供可靠、可观测、可恢复的 Agent 运行环境。

本项目是一个基于**系统论、控制论、信息论（SCI 论）**设计的模块化、可扩展的 AI Agent 平台基座，提供强大的运行时编排、观测与沙箱能力，为构建类似 LangGraph、DeerFlow 的多智能体协作框架提供底层支撑。

[English](./README.md) | [中文](./README.zh-CN.md)

---

## ✨ 核心特性

- 🤖 **六角色多 Agent 架构**：通过职责分离与信息控制机制避免大模型自评乐观偏差。
  - `Coordinator`（协调者）：系统边界，负责澄清模糊意图（防范外部噪声）。
  - `Planner`（规划师）：负责需求分析和任务分解。
  - `Reviewer`（审查员）：提供独立客观的计划审查（负反馈）。
  - `Executor`（执行者）：专注于代码实现与自测。
  - `Evaluator`（评估员）：负责代码质量和需求实现度评估（负反馈）。
  - `Memory Curator`（记忆策展）：负责上下文压缩与归档，降低系统信息熵（防退化）。

### 科学的设计哲学

本项目以"老三论"（系统论、控制论、信息论）为理论基础，构建了一套科学、严谨的 Agent 协作框架：

- **系统论** — 看见整体：六角色多 Agent 架构，实现涌现性（1+1>2）
- **信息论** — 理解沟通：结构化信息传递，信息质量量化与优化
- **控制论** — 实现目的：反馈驱动闭环，自适应质量控制

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Harness 架构                               │
├─────────────────────────────────────────────────────────────────────────┤
│  系统论层 │  Coordinator → Planner → Reviewer → Executor → Evaluator → Memory Curator  │
├─────────────────────────────────────────────────────────────────────────┤
│  信息论层 │  结构化通信 │ 置信度评分 │ 信息质量反馈闭环 │ Token 优化     │
├─────────────────────────────────────────────────────────────────────────┤
│  控制论层 │  负反馈（审查/评估）│ 正反馈（推进）│ 动态路由 │ 稳态终止    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 功能特性

- 🛠️ **技能系统** - 可复用的 Agent 能力模块，支持触发器自动识别
- 🪝 **会话钩子** - 自动化上下文管理，支持会话生命周期事件
- 🤖 **多 Agent 架构** - 专用 Agent 分工协作（规划师、审查员、执行者、评估员）
- 📊 **信息质量反馈闭环** - 基于信息论的 Token 效率优化与提示词改进
- 📋 **代码规则** - 自动化规范检查，支持自定义规则
- 🔌 **MCP 集成** - 标准化外部工具接口（文件系统、Git、GitHub 等）
- 🧠 **记忆系统** - 跨会话学习，自动提取可复用模式
- ✅ **验证循环** - 6 级质量保障（语法 → 静态分析 → 测试 → 安全 → 性能）
- 🔒 **约束护栏** - 4 级约束系统（硬约束/软约束/指导原则/偏好设置）
- 📊 **评估框架** - Agent 和技能性能评估与进化支持

---

## 🎯 为什么选择 Agent Harness？

### 1. 科学的设计基础

不同于其他 Agent 框架的"经验驱动"设计，Agent Harness 基于成熟的系统理论：

| 维度 | 传统框架 | Agent Harness |
|------|---------|---------------|
| 架构设计 | 经验驱动 | 系统论驱动 |
| 信息传递 | 非结构化文本 | 结构化 + 信息质量度量 |
| 质量控制 | 简单通过/失败 | 反馈闭环 + 自适应优化 |
| 可观测性 | 日志记录 | 信息熵 + Token 效率分析 |

### 2. 避免自评乐观偏差

六角色分离架构确保质量：

```
Coordinator → Planner → Reviewer → Executor → Evaluator → Memory Curator
                       ↑                                              │
                       └────────────── 反馈回路 ────────────────────────┘
```

- **Coordinator**：只读权限，专注意图澄清和任务分发
- **Planner**：只读权限，专注需求分析和方案设计
- **Reviewer**：只读权限，独立审查计划可行性
- **Executor**：读写+执行权限，专注实现
- **Evaluator**：只读+测试权限，独立评估质量
- **Memory Curator**：只读+执行权限，专注记忆归档和上下文压缩

### 3. 信息质量反馈闭环

基于信息论的 Token 优化系统：

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   数据采集    │───→│   质量评估    │───→│   策略决策    │
│  (Metrics)   │    │ (Evaluation) │    │  (Strategy)  │
└──────────────┘    └──────────────┘    └──────┬───────┘
       ↑                                        │
       │         ┌──────────────────────────────┘
       │         ↓
┌──────┴──────────────┐    ┌──────────────┐
│      效果验证        │←───│   优化执行    │
│   (Validation)      │    │ (Execution)  │
└─────────────────────┘    └──────────────┘
```

- **Token 信息密度** = 信息熵 / Token 数量
- **自动提示词优化**：压缩、增强、裁剪、重构
- **持续改进**：基于历史数据优化信息传递效率

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/cybernetix-lab/harness-spec.git
cd harness-spec

# 初始化项目
./init.sh
```

### 基本使用

```bash
# 启动新会话
./tooling/scripts/start-session.sh

# 激活技能
./tooling/scripts/skill-activate.sh typescript-patterns

# 更新任务状态
./tooling/scripts/update-context.sh task "实现用户认证功能"
./tooling/scripts/update-context.sh progress "完成登录表单设计"

# 创建检查点
./tooling/scripts/create-checkpoint.sh "完成基础架构"

# 运行验证
./tooling/scripts/verify.sh
```

### Token 指标观测

```bash
# 查看 Token 使用统计
./hooks/token-metrics.sh --session $(cat .session_id)

# 评估信息质量
./hooks/info-quality-evaluator.sh --session $(cat .session_id)

# 查看优化建议
./hooks/info-quality-strategy.sh --session $(cat .session_id) --dry-run
```

---

## 📁 项目结构

```
awesome-agent-harness/
├── agents/                    # Agent 配置
│   ├── planner.yaml          # 规划 Agent
│   ├── reviewer.yaml         # 审查 Agent
│   ├── executor.yaml         # 执行 Agent
│   ├── evaluator.yaml        # 评估 Agent
│   └── orchestrator.yaml     # 编排 Agent
├── config/                    # 配置中心
│   ├── models.yaml           # 模型配置（独立解耦）
│   └── info-quality-feedback.yaml  # 信息质量反馈配置
├── skills/                    # 技能系统
├── hooks/                     # 会话钩子
│   ├── token-metrics.sh      # Token 指标采集
│   ├── info-quality-evaluator.sh   # 信息质量评估
│   ├── info-quality-strategy.sh    # 反馈策略引擎
│   └── model-call-wrapper.sh       # 模型调用包装器
├── rules/                     # 代码规则
├── verification/              # 验证循环
├── .runtime/                  # 运行时数据
│   └── context/              # 上下文管理
├── constraints/               # 约束与护栏
├── evals/                     # 评估框架
├── telemetry/                 # 可观测性
├── docs/                      # 文档
│   ├── design-philosophy.md         # 设计哲学（SCI 论）
│   ├── information-quality-feedback-loop.md  # 信息质量反馈闭环
│   └── token-optimization.md        # Token 优化指南
├── monitoring/                # 监控
│   └── grafana/dashboards/   # Grafana 看板
├── mcp/                       # MCP 配置
├── memory/                    # 记忆系统
├── tools/                     # 工具定义
└── scripts/                   # 运维脚本
```

---

## 🛠️ 技能系统

技能是 Harness 的核心能力模块：

```bash
# 列出所有技能
./tooling/scripts/skill-list.sh

# 激活技能
./tooling/scripts/skill-activate.sh typescript-patterns
./tooling/scripts/skill-activate.sh security-scan
```

### 内置技能

| 技能 | 类别 | 描述 |
|------|------|------|
| `typescript-patterns` | coding | TypeScript 代码模式 |
| `react-hooks` | coding | React Hooks 开发 |
| `security-scan` | review | 安全漏洞扫描 |
| `documentation-lookup` | research | 文档查询 |

---

## 🤖 Agent 类型

本项目采用**六角色多 Agent 架构**，通过职责分离避免自评乐观偏差：

| Agent | 类型 | 职责 | 工具权限 |
|-------|------|------|----------|
| `coordinator` | orchestration | 用户交互、意图识别、需求澄清、任务分发 | 只读 |
| `planner` | planning | 需求分析、任务分解、方案设计 | 只读 |
| `reviewer` | plan_review | 风险识别、方案评估、改进建议 | 只读 |
| `executor` | execution | 代码实现、测试编写、自测验证 | 读写+执行 |
| `evaluator` | evaluation | 质量评估、需求验证、结论输出 | 只读+测试 |
| `memory_curator` | memory_management | 上下文压缩、信息归档、信噪比控制 | 只读+执行 |
| `researcher` | research | 技术调研、文档查询 | 只读+网络 |
| `orchestrator` | orchestration | 动态编排、路由决策、状态管理 | 协调层 |

### 工作流程

```
用户提交意图
    ↓
Coordinator 澄清意图
    ↓
Planner 分析并制定计划
    ↓
Reviewer 审查计划
    ↓ (APPROVED)
Executor 执行实现
    ↓
Evaluator 评估质量
    ↓
┌──────────┴──────────┐
│                     │
PASS/EXCELLENT    NEEDS_IMPROVEMENT
│                     │
Memory Curator        返回 Executor 修复
知识沉淀与归档        或返回 Planner 重新规划
│
任务彻底完成
```

详细的 Agent 配置请参考 [AGENTS.md](./AGENTS.md)。

---

## 📊 评估与进化

### Agent 评估

```bash
# 评估单个 Agent
./tooling/scripts/agent-eval.sh run planner

# 评估所有 Agent
./tooling/scripts/agent-eval.sh run-all

# 查看评估报告
./tooling/scripts/agent-eval.sh report planner
```

### Agent 进化

```bash
# 分析 Agent 性能
./tooling/scripts/agent-evolve.sh analyze planner

# 模拟进化
./tooling/scripts/agent-evolve.sh dry-run planner

# 执行进化
./tooling/scripts/agent-evolve.sh evolve planner
```

### 技能评估与进化

```bash
# 评估技能
./tooling/scripts/skill-eval.sh run typescript-patterns

# 进化技能
./tooling/scripts/skill-evolve.sh evolve typescript-patterns
```

---

## 🔬 信息质量反馈闭环

基于信息论的 Token 效率优化系统：

### 核心指标

| 指标 | 说明 | 计算公式 |
|------|------|----------|
| `token_input_count` | 输入 Token 数 | 直接统计 |
| `token_output_count` | 输出 Token 数 | 直接统计 |
| `information_entropy` | 信息熵 | -Σp(x)log₂p(x) |
| `token_information_density` | Token 信息密度 | 信息熵 / Token 数量 |

### 质量评估

```bash
# 评估当前会话的信息质量
./hooks/info-quality-evaluator.sh --session $(cat .session_id)

# 输出示例：
# {
#   "quality_level": "GOOD",
#   "information_density": 0.0035,
#   "information_entropy": 4.2,
#   "suggestions": ["考虑压缩冗余信息"]
# }
```

### 自动优化

```bash
# 生成优化策略（试运行）
./hooks/info-quality-strategy.sh --session $(cat .session_id) --dry-run

# 执行优化
./hooks/info-quality-strategy.sh --session $(cat .session_id) --apply
```

### 监控看板

Grafana 看板位于 `monitoring/grafana/dashboards/token-metrics.json`，展示：

- Token 使用量趋势
- 信息密度分布
- Agent 效率对比
- 优化效果追踪

---

## ⚙️ 配置

### 环境变量

```bash
# 钩子配置
export AHARNESS_HOOK_PROFILE=standard  # minimal|standard|strict
export AHARNESS_DISABLED_HOOKS=        # 禁用的钩子
export AHARNESS_SESSION_ID=xxx
export AHARNESS_AGENT=planner

# 检查点配置
export AHARNESS_CHECKPOINT_INTERVAL=10

# 权限级别
export AHARNESS_PERMISSION_LEVEL=confirm_required
```

### 模型配置

模型配置独立于 Agent 配置，位于 `config/models.yaml`：

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

### 约束配置

约束分为 4 个层级：

- **Level 4**: Hard Constraints (硬约束) - 不可覆盖
- **Level 3**: Soft Constraints (软约束) - 可覆盖需记录
- **Level 2**: Guidelines (指导原则) - 建议遵循
- **Level 1**: Preferences (偏好设置) - 默认行为

### 信息质量反馈配置

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

## 📝 文档

- [快速开始指南](./docs/quickstart.md)
- [技能开发指南](./docs/skills.md)
- [Agent 配置指南](./AGENTS.md)
- [Agent 协作流程](./docs/agent-collaboration.md)
- [Agent 评估与进化](./docs/agent-evolution.md)
- [**设计哲学** - 系统论、控制论、信息论](./docs/design-philosophy.md)
- [**信息质量反馈闭环**](./docs/information-quality-feedback-loop.md)
- [**Token 优化指南**](./docs/token-optimization.md)
- [规则编写指南](./docs/rules.md)
- [API 文档](./docs/api.md)

---

## 🤝 贡献

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解如何参与。

### 贡献者

<a href="https://github.com/yourusername/awesome-agent-harness/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yourusername/awesome-agent-harness" />
</a>

---

## 📄 许可证

本项目采用 [MIT 许可证](./LICENSE)。

---

## 🙏 致谢

- 设计哲学灵感来源于系统论、控制论、信息论
- 受 [everything-claude-code](https://github.com/affaan-m/everything-claude-code) 启发
- 参考 [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering)

---

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/awesome-agent-harness&type=Date)](https://star-history.com/#yourusername/awesome-agent-harness&Date)
