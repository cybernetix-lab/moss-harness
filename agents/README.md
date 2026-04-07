# Agent Configurations

Agent 配置目录定义不同类型的专用 Agent 及其行为模式。

## Agent 类型

| Agent | 用途 | 特点 |
|-------|------|------|
| `initializer` | 项目初始化 | 创建项目结构、配置环境 |
| `implementer` | 功能实现 | 编写代码、实现功能 |
| `reviewer` | 代码审查 | 检查质量、发现问题 |
| `researcher` | 研究分析 | 调研技术、查找资料 |
| `optimizer` | 性能优化 | 优化代码、提升性能 |
| `debugger` | 调试修复 | 诊断问题、修复 bug |

## 配置结构

```yaml
name: agent_name
type: implementer
description: Agent 描述

# 模型配置
model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.7
  max_tokens: 4096

# 系统提示词
system_prompt: |
  你是 {{name}}，专门负责 {{description}}。
  
  ## 工作原则
  1. 原则一
  2. 原则二
  
  ## 输出格式
  ...

# 可用技能
skills:
  - typescript-patterns
  - react-hooks
  - security-scan

# 约束覆盖
constraints:
  override:
    - soft-constraints.code_style.max_function_lines: 100
  
# 工具权限
tools:
  allowed:
    - filesystem_read
    - filesystem_write
    - code_search
    - execution_run_tests

# 上下文管理
context:
  max_tokens: 8000
  retention:
    - goals
    - decisions
    - failures
    - todo

# 评估配置
evaluation:
  auto_run: true
  on_error: pause
```

## 使用 Agent

```bash
# 列出可用 Agent
./scripts/agent-list.sh

# 启动特定 Agent
./scripts/agent-start.sh implementer

# 切换 Agent
./scripts/agent-switch.sh reviewer
```
