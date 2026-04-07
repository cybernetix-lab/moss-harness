# Telemetry & Observability

可观测性系统记录 Agent 的执行轨迹，支持调试和优化。

## 数据类型

1. **Traces** - 执行轨迹（调用链）
2. **Metrics** - 指标（性能、成功率）
3. **Logs** - 结构化日志
4. **Checkpoints** - 状态检查点

## 数据结构

### Trace
```json
{
  "trace_id": "uuid",
  "session_id": "session_xxx",
  "timestamp": "2024-01-15T10:00:00Z",
  "operation": "file_write",
  "input": {...},
  "output": {...},
  "duration_ms": 150,
  "status": "success"
}
```

## 查看遥测

```bash
# 查看会话轨迹
./scripts/view-trace.sh <session_id>

# 查看指标仪表板
./scripts/metrics-dashboard.sh

# 导出数据
./scripts/export-telemetry.sh
```
