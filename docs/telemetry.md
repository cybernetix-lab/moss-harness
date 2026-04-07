# Telemetry & Observability 指南

Harness 框架提供了完整的遥测和可观测性功能，帮助你监控 Agent 会话的性能、健康状况和行为模式。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Telemetry Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Session    │    │    Action    │    │   System     │  │
│  │   Events     │    │    Spans     │    │   Metrics    │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         └───────────────────┼───────────────────┘          │
│                             │                              │
│                    ┌────────┴────────┐                     │
│                    │  Telemetry Bus   │                     │
│                    │  (JSON Lines)    │                     │
│                    └────────┬────────┘                     │
│                             │                              │
│         ┌───────────────────┼───────────────────┐          │
│         ▼                   ▼                   ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Traces     │    │   Events     │    │   Metrics    │  │
│  │  (trace.)    │    │  (events.)   │    │  (metrics.)  │  │
│  │   jsonl      │    │   jsonl      │    │   json       │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### 1. Traces（轨迹）

轨迹记录会话和动作的完整生命周期，兼容 OpenTelemetry 格式。

**文件**: `runtime/telemetry/{session_id}/trace.jsonl`

```json
{
  "event": "session_start",
  "session_id": "sess-abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO"
}
```

### 2. Events（事件）

结构化事件记录，便于分析和查询。

**文件**: `runtime/telemetry/{session_id}/events.jsonl`

```json
{
  "type": "action.start",
  "action_id": "action-xyz789",
  "action_type": "file_write",
  "timestamp": "2024-01-15T10:30:05Z",
  "data": {}
}
```

**事件类型**:
- `session.start` / `session.end` - 会话生命周期
- `action.start` / `action.end` - 动作生命周期
- `action.blocked` - 被阻止的动作
- `action.warning` - 警告事件
- `action.error` - 错误事件
- `action.duration` - 动作持续时间
- `checkpoint.created` - 检查点创建

### 3. Metrics（指标）

聚合指标数据，用于性能分析。

**文件**: `runtime/telemetry/{session_id}/metrics.json`

```json
{
  "session": {
    "start_time": "2024-01-15T10:30:00Z",
    "actions_count": 42,
    "successful_actions": 38,
    "failed_actions": 4,
    "checkpoints_created": 3
  },
  "performance": {
    "avg_action_duration_ms": 1250.5,
    "total_duration_ms": 52500,
    "min_duration_ms": 100,
    "max_duration_ms": 5000
  },
  "resources": {
    "files_read": 15,
    "files_written": 8,
    "commands_executed": 5
  },
  "actions": {
    "file_write": {
      "count": 8,
      "success": 7,
      "fail": 1,
      "avg_duration_ms": 800.0,
      "total_duration_ms": 6400
    }
  },
  "security": {
    "blocked_actions": 2,
    "warnings": 5
  }
}
```

### 4. Spans（跨度）

OpenTelemetry 兼容的分布式追踪数据。

**文件**: `runtime/telemetry/{session_id}/spans.jsonl`

```json
{
  "trace_id": "sess-abc123",
  "span_id": "action-xyz789",
  "parent_span_id": "session-root",
  "name": "file_write",
  "start_time": "2024-01-15T10:30:05Z",
  "end_time": "2024-01-15T10:30:06Z",
  "status": "OK",
  "attributes": {
    "action.type": "file_write",
    "action.id": "action-xyz789",
    "duration_ms": 1000
  }
}
```

## Hook 集成

### Session Start Hook

在会话开始时初始化遥测系统：

1. **系统信息收集** - 记录主机名、操作系统、架构
2. **Trace 初始化** - 创建会话根 span
3. **Metrics 初始化** - 设置初始指标值
4. **Events 初始化** - 记录会话开始事件
5. **中央日志记录** - 记录到全局会话日志

### Session Stop Hook

在会话结束时归档和分析数据：

1. **数据归档** - 将运行时数据移动到持久存储
2. **Span 完成** - 更新会话根 span 的结束时间
3. **报告生成** - 生成会话总结报告
4. **统计更新** - 更新全局统计数据
5. **事件记录** - 记录会话结束事件

### Pre-Action Hook

在动作执行前记录和验证：

1. **动作 ID 生成** - 为每个动作生成唯一标识
2. **开始时间记录** - 记录动作开始时间戳
3. **Span 创建** - 创建动作 span
4. **事件记录** - 记录 action.start 事件
5. **约束检查** - 检查并记录被阻止的动作

### Post-Action Hook

在动作执行后更新指标：

1. **持续时间计算** - 计算动作执行时间
2. **Metrics 更新** - 更新会话、性能、资源指标
3. **Span 完成** - 更新动作 span 的结束时间和状态
4. **事件记录** - 记录 action.end 和 action.duration 事件
5. **错误记录** - 记录失败的详细信息

## 使用 Telemetry Viewer

### 列出所有会话

```bash
./scripts/telemetry-view.sh list
```

输出示例：
```
═══════════════════════════════════════════════════════════════
                      会话列表
═══════════════════════════════════════════════════════════════
Session ID                     Start Time           Actions
────────────────────────────────────────────────────────────────
sess-abc123                    2024-01-15T10:30:00  42
sess-def456                    2024-01-15T11:00:00  15
```

### 查看会话详情

```bash
./scripts/telemetry-view.sh show sess-abc123
```

### 实时监控

```bash
./scripts/telemetry-view.sh live
```

### 导出 HTML 报告

```bash
./scripts/telemetry-view.sh export sess-abc123
```

生成的报告可以在浏览器中打开查看。

### 查看汇总统计

```bash
./scripts/telemetry-view.sh summary
```

## 数据保留策略

### 运行时数据 (runtime/telemetry/)

- **保留时间**: 当前活跃会话
- **用途**: 实时监控和调试
- **清理**: 会话结束后归档到 memory/

### 归档数据 (memory/telemetry/)

- **保留时间**: 长期保留
- **用途**: 历史分析、模式提取
- **结构**: 按会话 ID 组织

### 中央日志 (runtime/telemetry/all-sessions.jsonl)

- **保留时间**: 长期保留
- **用途**: 全局会话追踪
- **内容**: 仅包含会话启动/结束事件

## 集成外部系统

### OpenTelemetry Collector

可以将 spans.jsonl 导入 OpenTelemetry Collector：

```bash
# 使用 otel-cli 发送数据
cat runtime/telemetry/{session_id}/spans.jsonl | \
  otel-cli span --service harness --endpoint collector:4317
```

### Prometheus Metrics

可以暴露 metrics.json 为 Prometheus 格式：

```bash
# 启动 metrics 服务器
./scripts/telemetry-server.sh

# 访问 metrics
curl http://localhost:9090/metrics
```

### Jaeger Tracing

可以将 spans 导入 Jaeger 进行可视化：

```bash
# 导出为 Jaeger 格式
./scripts/telemetry-export.sh --format jaeger --session sess-abc123
```

## 性能考虑

### 写入优化

- 使用 JSON Lines 格式，追加写入
- 批量更新 metrics.json
- 异步事件记录

### 存储优化

- 定期压缩旧数据
- 自动清理过期会话
- 支持数据采样

### 查询优化

- 按会话 ID 分区
- 时间戳索引
- 预聚合常用指标

## 安全与隐私

### 敏感数据过滤

- 自动过滤密码、密钥等敏感信息
- 可配置的数据脱敏规则
- 支持 PII 检测

### 访问控制

- 遥测数据遵循文件系统权限
- 支持加密存储
- 审计日志记录

## 故障排除

### 诊断命令

```bash
# 检查遥测目录结构
ls -la runtime/telemetry/

# 验证 JSON 格式
python3 -m json.tool runtime/telemetry/sess-abc123/metrics.json

# 查看实时事件流
tail -f runtime/telemetry/sess-abc123/events.jsonl

# 统计事件数量
wc -l runtime/telemetry/sess-abc123/events.jsonl
```

### 常见问题

**Q: 遥测数据占用太多磁盘空间？**
A: 可以配置数据保留策略，定期清理旧数据。

**Q: 如何禁用遥测？**
A: 设置环境变量 `ECC_TELEMETRY_ENABLED=false`。

**Q: 如何导出特定时间范围的数据？**
A: 使用 `./scripts/telemetry-export.sh --start 2024-01-01 --end 2024-01-31`。

## 最佳实践

1. **定期检查** - 使用 `telemetry-view.sh summary` 查看整体健康状况
2. **监控异常** - 关注失败率、阻塞动作数等安全指标
3. **性能优化** - 分析动作持续时间，识别性能瓶颈
4. **模式提取** - 从成功的会话中提取可复用模式
5. **定期归档** - 将重要会话数据归档到 memory/ 目录
