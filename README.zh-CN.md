# 🚀 Awesome Agent Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/awesome-agent-harness)](https://github.com/yourusername/awesome-agent-harness/network/members)

> 一个生产级完备的 AI Agent Harness 工程模板，提供可靠、可观测、可恢复的 Agent 运行环境。

[English](./README.md) | [中文](./README.zh-CN.md)

---

## ✨ 特性

- 🛠️ **技能系统** - 可复用的 Agent 能力模块，支持触发器自动识别
- 🪝 **会话钩子** - 自动化上下文管理，支持会话生命周期事件
- 🤖 **多 Agent 架构** - 专用 Agent 分工协作（规划师、审查员、执行者、评估员）
- 📋 **代码规则** - 自动化规范检查，支持自定义规则
- 🔌 **MCP 集成** - 标准化外部工具接口（文件系统、Git、GitHub 等）
- 🧠 **记忆系统** - 跨会话学习，自动提取可复用模式
- ✅ **验证循环** - 6 级质量保障（语法 → 静态分析 → 测试 → 安全 → 性能）
- 🔒 **约束护栏** - 4 级约束系统（硬约束/软约束/指导原则/偏好设置）
- 📊 **评估框架** - Agent 和技能性能评估与进化支持

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/awesome-agent-harness.git
cd awesome-agent-harness

# 初始化项目
./init.sh
```

### 基本使用

```bash
# 启动新会话
./scripts/start-session.sh

# 激活技能
./scripts/skill-activate.sh typescript-patterns

# 更新任务状态
./scripts/update-context.sh task "实现用户认证功能"
./scripts/update-context.sh progress "完成登录表单设计"

# 创建检查点
./scripts/create-checkpoint.sh "完成基础架构"

# 运行验证
./scripts/verify.sh
```

---

## 📁 项目结构

```
awesome-agent-harness/
├── agents/              # Agent 配置
├── skills/              # 技能系统
├── hooks/               # 会话钩子
├── rules/               # 代码规则
├── verification/        # 验证循环
├── context/             # 上下文管理
├── constraints/         # 约束与护栏
├── evals/               # 评估框架
├── telemetry/           # 可观测性
├── mcp/                 # MCP 配置
├── memory/              # 记忆系统
├── tools/               # 工具定义
└── scripts/             # 运维脚本
```

---

## 🛠️ 技能系统

技能是 Harness 的核心能力模块：

```bash
# 列出所有技能
./scripts/skill-list.sh

# 激活技能
./scripts/skill-activate.sh typescript-patterns
./scripts/skill-activate.sh security-scan
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

本项目采用**四角色分离架构**，通过职责分离避免自评乐观偏差：

| Agent | 类型 | 职责 | 工具权限 |
|-------|------|------|----------|
| `planner` | planning | 需求分析、任务分解、方案设计 | 只读 |
| `reviewer` | plan_review | 风险识别、方案评估、改进建议 | 只读 |
| `executor` | execution | 代码实现、测试编写、自测验证 | 读写+执行 |
| `evaluator` | evaluation | 质量评估、需求验证、结论输出 | 只读+测试 |
| `researcher` | research | 技术调研、文档查询 | 只读+网络 |

### 工作流程

```
用户提交需求
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
任务完成          返回 Executor 修复
                  或返回 Planner 重新规划
```

详细的 Agent 配置请参考 [AGENTS.md](./AGENTS.md)。

---

## 📊 评估与进化

### Agent 评估

```bash
# 评估单个 Agent
./scripts/agent-eval.sh run planner

# 评估所有 Agent
./scripts/agent-eval.sh run-all

# 查看评估报告
./scripts/agent-eval.sh report planner
```

### Agent 进化

```bash
# 分析 Agent 性能
./scripts/agent-evolve.sh analyze planner

# 模拟进化
./scripts/agent-evolve.sh dry-run planner

# 执行进化
./scripts/agent-evolve.sh evolve planner
```

### 技能评估与进化

```bash
# 评估技能
./scripts/skill-eval.sh run typescript-patterns

# 进化技能
./scripts/skill-evolve.sh evolve typescript-patterns
```

---

## ⚙️ 配置

### 环境变量

```bash
# 钩子配置
export ECC_HOOK_PROFILE=standard  # minimal|standard|strict
export ECC_DISABLED_HOOKS=        # 禁用的钩子
export ECC_SESSION_ID=xxx
export ECC_AGENT=planner

# 检查点配置
export ECC_CHECKPOINT_INTERVAL=10

# 权限级别
export ECC_PERMISSION_LEVEL=confirm_required
```

### 约束配置

约束分为 4 个层级：

- **Level 4**: Hard Constraints (硬约束) - 不可覆盖
- **Level 3**: Soft Constraints (软约束) - 可覆盖需记录
- **Level 2**: Guidelines (指导原则) - 建议遵循
- **Level 1**: Preferences (偏好设置) - 默认行为

---

## 📝 文档

- [快速开始指南](./docs/quickstart.md)
- [技能开发指南](./docs/skills.md)
- [Agent 配置指南](./AGENTS.md)
- [Agent 协作流程](./docs/agent-collaboration.md)
- [Agent 评估与进化](./docs/agent-evolution.md)
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

- 受 [everything-claude-code](https://github.com/affaan-m/everything-claude-code) 启发
- 参考 [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering)

---

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/awesome-agent-harness&type=Date)](https://star-history.com/#yourusername/awesome-agent-harness&Date)
