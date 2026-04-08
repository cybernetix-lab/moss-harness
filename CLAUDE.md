# Harness Project Guide

## 项目概述

这是一个**生产级完备**的 AI Agent Harness 工程模板，提供可靠、可观测、可恢复的 Agent 运行环境， 核心功能包括：
- **技能系统** - 可复用的 Agent 能力模块
- **会话钩子** - 自动化上下文管理
- **多 Agent 架构** - 专用 Agent 分工协作
- **代码规则** - 自动化规范检查
- **MCP 集成** - 外部工具标准化接口
- **记忆系统** - 跨会话学习
- **验证循环** - 多级质量保障

## 核心原则

1. **上下文即记忆** - 所有状态持久化到文件系统
2. **约束先于能力** - 先定义边界，再赋予权限
3. **验证内嵌** - 每个阶段自动验证
4. **可恢复性** - 任何时刻可从断点继续
5. **持续学习** - 从会话中提取模式

## 快速开始

```bash
# 初始化项目
./init.sh

# 启动 Agent 会话
./scripts/start-session.sh

# 激活技能
./scripts/skill-activate.sh typescript-patterns

# 运行验证
./scripts/verify.sh

# 运行评估
./scripts/run-evals.sh
```

## 项目结构

```
awesome-agent-harness/
├── CLAUDE.md                    # 仓库级持久指令
├── init.sh                      # 项目初始化脚本
│
├── agents/                      # Agent 配置
│   ├── implementer.yaml         # 功能实现 Agent
│   ├── reviewer.yaml            # 代码审查 Agent
│   └── researcher.yaml          # 研究分析 Agent
│
├── skills/                      # 技能系统
│   ├── coding/                  # 开发技能
│   │   ├── typescript-patterns/
│   │   └── react-hooks/
│   ├── review/                  # 审查技能
│   │   └── security-scan/
│   └── research/                # 研究技能
│       └── documentation-lookup/
│
├── hooks/                       # 会话钩子
│   ├── session-start.sh         # 会话启动
│   ├── session-stop.sh          # 会话结束
│   ├── pre-action.sh            # 动作前验证
│   └── post-action.sh           # 动作后记录
│
├── .runtime/                    # 运行时数据
│   └── context/                # 上下文管理
│       ├── PROGRESS.md
│       └── DECISIONS.md
│
├── constraints/                 # 约束与护栏
│   ├── hard-constraints.yaml    # 硬约束
│   ├── soft-constraints.yaml    # 软约束
│   └── tools-policy.yaml        # 工具策略
│
├── rules/                       # 代码规则
│   ├── typescript/              # TypeScript 规则
│   │   ├── function-size.yaml
│   │   └── type-safety.yaml
│   └── security/                # 安全规则
│       └── no-secrets.yaml
│
├── evals/                       # 评估框架
│   └── harness/
│       ├── context-retention.yaml
│       └── constraint-enforcement.yaml
│
├── verification/                # 验证循环
│   ├── README.md
│   └── config.yaml
│
├── telemetry/                   # 可观测性
│   └── config.yaml
│
├── mcp/                         # MCP 配置
│   └── servers.json
│
├── memory/                      # 记忆系统
│   └── README.md
│
├── tools/                       # 工具定义
│   ├── filesystem/
│   ├── code/
│   └── execution/
│
├── scripts/                     # 运维脚本
│   ├── start-session.sh
│   ├── update-context.sh
│   ├── create-checkpoint.sh
│   ├── restore-checkpoint.sh
│   ├── skill-list.sh            # 列出技能
│   ├── skill-activate.sh        # 激活技能
│   ├── agent-list.sh            # 列出 Agent
│   ├── verify.sh                # 运行验证
│   ├── run-evals.sh
│   └── health-check.sh
│
└── runtime/                     # 运行时数据
    ├── current -> sessions/xxx
    ├── sessions/
    └── telemetry/
```

## 使用指南

### 1. 会话管理

```bash
# 启动新会话
./scripts/start-session.sh

# 更新任务状态
./scripts/update-context.sh task "实现用户认证"
./scripts/update-context.sh progress "完成登录表单"
./scripts/update-context.sh decision "使用 JWT 方案"

# 创建检查点
./scripts/create-checkpoint.sh "完成基础架构"

# 恢复检查点
./scripts/restore-checkpoint.sh checkpoint_xxx
```

### 2. 技能系统

```bash
# 查看可用技能
./scripts/skill-list.sh

# 激活技能
./scripts/skill-activate.sh typescript-patterns
./scripts/skill-activate.sh security-scan

# 在会话中使用技能
# (Agent 会自动识别并使用已激活的技能)
```

### 3. Agent 切换

```bash
# 查看可用 Agent
./scripts/agent-list.sh

# 启动特定 Agent 模式
export AHARNESS_AGENT=implementer

# 或使用脚本
./scripts/agent-start.sh reviewer
```

### 4. 验证循环

```bash
# 运行完整验证
./scripts/verify.sh

# 运行特定级别
./scripts/verify.sh --level unit

# 自动修复
./scripts/verify.sh --fix
```

### 5. 环境变量

```bash
# 钩子配置
export AHARNESS_HOOK_PROFILE=standard  # minimal|standard|strict
export AHARNESS_DISABLED_HOOKS=        # 禁用的钩子
export AHARNESS_SESSION_ID=xxx
export AHARNESS_AGENT=implementer

# 检查点配置
export AHARNESS_CHECKPOINT_INTERVAL=10

# 权限级别
export AHARNESS_PERMISSION_LEVEL=confirm_required
```

## 架构说明

### Agent 生命周期

```
[Session Start]
    ↓
[session-start hook] → 加载上下文、约束、技能
    ↓
[Agent Loop]
    ↓
[pre-action hook] → 验证权限、约束
    ↓
[Execute Action]
    ↓
[post-action hook] → 记录遥测、检查检查点
    ↓
[Verification] → 自动验证
    ↓
[Session Stop]
    ↓
[session-stop hook] → 保存记忆、生成摘要
```

### 约束层级

```
Level 4: Hard Constraints (硬约束) - 不可覆盖
Level 3: Soft Constraints (软约束) - 可覆盖需记录
Level 2: Guidelines (指导原则)     - 建议遵循
Level 1: Preferences (偏好设置)    - 默认行为
```

### 验证级别

```
Level 1: Syntax      → 语法检查
Level 2: Static      → 静态分析
Level 3: Unit        → 单元测试
Level 4: Integration → 集成测试
Level 5: Security    → 安全扫描
Level 6: Performance → 性能测试
```

## 扩展开发

### 添加新技能

```bash
mkdir -p skills/coding/my-skill
cat > skills/coding/my-skill/skill.yaml << 'EOF'
name: my-skill
category: coding
description: "技能描述"
triggers:
  - pattern: "触发模式"
actions:
  - type: analyze
EOF
```

### 添加新规则

```bash
cat > rules/typescript/my-rule.yaml << 'EOF'
name: my-rule
severity: warning
description: "规则描述"
detection:
  pattern: "正则表达式"
EOF
```

### 添加新 Agent

```bash
cat > agents/my-agent.yaml << 'EOF'
name: my-agent
type: custom
system_prompt: |
  你是 MyAgent...
skills:
  - typescript-patterns
EOF
```

## 最佳实践

1. **始终使用会话** - 通过 `./scripts/start-session.sh` 启动
2. **频繁创建检查点** - 关键节点保存状态
3. **激活相关技能** - 根据任务类型激活技能
4. **记录决策** - 使用 `./scripts/update-context.sh decision`
5. **运行验证** - 定期运行 `./scripts/verify.sh`

## 参考

- [everything-claude-code](https://github.com/affaan-m/everything-claude-code) - 灵感来源
- [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering) - Harness 工程资源
