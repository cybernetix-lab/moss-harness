# Context Management

上下文管理系统负责 Agent 的工作记忆，确保信息在会话间持久化。

## 核心文件

| 文件 | 用途 | 更新频率 |
|------|------|----------|
| `CLAUDE.md` | 仓库级持久指令 | 低 |
| `TASK.md` | 当前任务状态 | 高 |
| `PROGRESS.md` | 进度追踪 | 中 |
| `DECISIONS.md` | 决策记录 | 中 |

## 上下文压缩策略

1. **保留**: 目标、关键决策、失败测试、待办事项
2. **压缩**: 已完成的实现细节、过时的尝试
3. **丢弃**: 成功的测试输出、临时日志

## 使用方式

```bash
# 更新任务状态
./scripts/update-context.sh task "新目标描述"

# 记录决策
./scripts/update-context.sh decision "决策内容"

# 压缩上下文
./scripts/condense-context.sh
```
