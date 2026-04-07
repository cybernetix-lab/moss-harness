# 快速开始指南

本指南将帮助你在 5 分钟内开始使用 Awesome Agent Harness。

## 安装

### 前提条件

- Bash 4.0+
- Git
- Python 3.8+（可选，用于遥测分析）

### 克隆仓库

```bash
git clone https://github.com/yourusername/awesome-agent-harness.git
cd awesome-agent-harness
```

### 初始化

```bash
./init.sh
```

这将创建运行时目录并运行健康检查。

## 第一个会话

### 1. 启动会话

```bash
./scripts/start-session.sh
```

输出示例：
```
🚀 Session started: session_20240407_143052
📁 Session directory: runtime/sessions/session_20240407_143052

Next steps:
  1. Edit runtime/sessions/session_20240407_143052/TASK.md to define goals
  2. Run ./scripts/update-context.sh to update state
  3. Use ./scripts/create-checkpoint.sh to save progress
```

### 2. 定义任务

编辑 `runtime/sessions/{session_id}/TASK.md`：

```markdown
# Task State

## Session
- ID: session_20240407_143052
- Started: 2024-04-07T14:30:52Z
- Status: active

## Goals
- [ ] 创建一个 TypeScript 项目
- [ ] 设置 ESLint 和 Prettier
- [ ] 编写第一个组件

## Progress

## Current Focus
设置项目结构

## Blockers

## Next Steps
1. 初始化 npm 项目
2. 安装 TypeScript
```

### 3. 激活技能

```bash
./scripts/skill-activate.sh typescript-patterns
```

### 4. 更新进度

```bash
./scripts/update-context.sh progress "完成 npm init"
./scripts/update-context.sh decision "使用 Vite 作为构建工具"
```

### 5. 创建检查点

```bash
./scripts/create-checkpoint.sh "完成项目初始化"
```

## 常用命令

### 会话管理

```bash
# 启动新会话
./scripts/start-session.sh

# 更新任务状态
./scripts/update-context.sh task "新任务描述"
./scripts/update-context.sh progress "进度更新"
./scripts/update-context.sh decision "重要决策"

# 创建检查点
./scripts/create-checkpoint.sh "检查点描述"

# 恢复检查点
./scripts/restore-checkpoint.sh checkpoint_xxx
```

### 技能系统

```bash
# 列出技能
./scripts/skill-list.sh

# 激活技能
./scripts/skill-activate.sh typescript-patterns
./scripts/skill-activate.sh security-scan
```

### Agent 管理

```bash
# 列出 Agent
./scripts/agent-list.sh

# 设置当前 Agent
export ECC_AGENT=implementer
```

### 验证

```bash
# 运行验证
./scripts/verify.sh

# 运行特定级别
./scripts/verify.sh --level unit
```

## 下一步

- 阅读 [技能开发指南](./skills.md) 了解如何创建自定义技能
- 阅读 [Agent 配置指南](./agents.md) 了解如何配置 Agent
- 阅读 [规则编写指南](./rules.md) 了解如何添加代码规则

## 获取帮助

- 查看 [GitHub Issues](https://github.com/yourusername/awesome-agent-harness/issues)
- 参与 [Discussions](https://github.com/yourusername/awesome-agent-harness/discussions)
