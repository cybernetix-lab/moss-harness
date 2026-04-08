# 上下文压缩管理器

基于 [ShareAI 上下文压缩设计](https://learn.shareai.run/zh/s06/) 实现的三层压缩机制，用于优化 Agent 会话的上下文管理。

## 概述

当 Agent 会话进行多轮交互后，上下文会不断增长，导致：
- Token 消耗增加
- 响应延迟变长
- 关键信息被淹没

本系统通过三层渐进式压缩机制解决这些问题。

## 三层压缩机制

### 第一层：大结果持久化 (Persisted Output Marker)

**触发条件**: 工具输出超过 2000 字符

**行为**:
- 将完整输出保存到 `.runtime/outputs/`
- 在上下文中只保留预览（前 2000 字符）
- 添加 `<persisted-output>` 标记

**示例**:
```xml
<persisted-output>
Full output saved to: /path/to/.runtime/outputs/grep_20260408_175138_a8e30d9f.txt
Size: 3000 characters
Preview:
[前2000字符的预览内容]...
</persisted-output>
```

**恢复命令**:
```bash
./runtime/context/context-compactor.sh expand /path/to/output.txt
```

### 第二层：微压缩 (Micro-Compaction)

**触发条件**: 每次会话检查时自动执行

**行为**:
- 保留最近 3 个工具结果的完整内容
- 更早的工具结果替换为占位提示

**效果**:
```json
{
  "messages": [
    {"role": "tool", "content": "[Earlier tool result omitted for brevity - use /expand to view]"},
    {"role": "tool", "content": "[Earlier tool result omitted for brevity - use /expand to view]"},
    {"role": "tool", "content": "recent result 3"},
    {"role": "tool", "content": "recent result 4"},
    {"role": "tool", "content": "recent result 5"}
  ]
}
```

### 第三层：整体历史压缩 (Full Compaction)

**触发条件**: 上下文总大小超过 8000 字符

**行为**:
- 从 `TASK.md`、`PROGRESS.md`、`DECISIONS.md` 提取关键信息
- 生成 `context-summary.md` 连续性摘要
- 保留核心目标、已完成工作、关键决策

**生成的摘要结构**:
```markdown
# Context Summary

## Current Goal
当前会话的主要目标

## Completed Work
- 已完成的工作项1
- 已完成的工作项2

## Key Decisions
- 关键决策1
- 关键决策2

## Modified Files
最近修改的文件列表

## Pending Work
- 待办事项1
- 待办事项2
```

## 使用方法

### 命令行接口

```bash
# 检查上下文大小并自动压缩（如果超过限制）
./runtime/context/context-compactor.sh auto [session_dir]

# 手动执行完整压缩
./runtime/context/context-compactor.sh compact [session_dir]

# 持久化大输出
echo "大段输出内容" | ./runtime/context/context-compactor.sh persist tool_name

# 展开已持久化的输出
./runtime/context/context-compactor.sh expand /path/to/output.txt

# 查看压缩状态
./runtime/context/context-compactor.sh status
```

### 在 Agent 会话中自动使用

上下文压缩已集成到会话管理：

1. **启动会话时**: `start-session.sh` 自动初始化压缩器
2. **启动 Agent 时**: `agent-start.sh` 自动检查并压缩上下文

### 配置参数

在 `context-compactor.sh` 顶部可调整：

```bash
PERSIST_THRESHOLD=2000  # 大结果持久化阈值（字符）
MICRO_COMPACT_KEEP=3    # 微压缩保留的最近结果数
CONTEXT_LIMIT=8000      # 触发完整压缩的上下文大小上限
```

## 状态跟踪

压缩状态保存在 `.runtime/context/compact-state.json`：

```json
{
  "has_compacted": true,
  "last_compact_time": "2026-04-08T17:51:38Z",
  "compact_count": 5,
  "last_summary": "/path/to/context-summary.md",
  "recent_files": []
}
```

## 最佳实践

1. **定期查看摘要**: 压缩后查看 `context-summary.md` 确保关键信息被保留
2. **手动触发**: 在长会话中可手动运行 `compact` 命令提前压缩
3. **恢复输出**: 需要查看完整输出时使用 `expand` 命令
4. **监控状态**: 使用 `status` 命令跟踪压缩历史

## 测试

运行测试套件：

```bash
bats tests/context/test_context_compactor.bats
```

测试覆盖：
- 大结果持久化
- 微压缩逻辑
- 完整历史压缩
- 状态跟踪
- 错误处理

## 参考

- [ShareAI 上下文压缩设计](https://learn.shareai.run/zh/s06/)
- [Agent 协作流程](../../docs/agent-collaboration.md)
