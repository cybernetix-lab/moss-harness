# Prometheus & Grafana 集成指南

本指南介绍如何将 Harness 遥测数据导出到 Prometheus 并使用 Grafana 进行可视化监控。

## 架构概览

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Harness       │      │   Prometheus     │      │    Grafana      │
│   Telemetry     │──────│   (Port 9091)    │──────│   (Port 3000)   │
│   Exporter      │      │                  │      │                 │
│   (Port 9090)   │      │  - 存储指标      │      │  - 可视化       │
└─────────────────┘      │  - 查询语言      │      │  - 仪表盘       │
                         │  - 告警规则      │      │  - 告警通知     │
                         └──────────────────┘      └─────────────────┘
```

## 快速开始

### 1. 启动 Prometheus Exporter

```bash
# 在项目根目录
./scripts/telemetry-prometheus-exporter.sh start

# 或使用自定义端口
./scripts/telemetry-prometheus-exporter.sh start -p 8080
```

验证 exporter 是否正常工作：

```bash
curl http://localhost:9090/metrics
```

### 2. 启动 Prometheus 和 Grafana

使用 Docker Compose 一键启动：

```bash
cd monitoring
docker-compose up -d
```

服务将启动在：
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3000 (默认账号: admin/admin)

### 3. 查看仪表盘

打开 http://localhost:3000 并登录：

1. 使用默认账号 `admin/admin` 登录
2. 点击左侧菜单 "Dashboards"
3. 选择 "Harness Telemetry Dashboard"

## 详细配置

### Prometheus Exporter

#### 可用命令

```bash
# 启动服务器
./scripts/telemetry-prometheus-exporter.sh start

# 停止服务器
./scripts/telemetry-prometheus-exporter.sh stop

# 查看状态
./scripts/telemetry-prometheus-exporter.sh status

# 导出 metrics 到 stdout
./scripts/telemetry-prometheus-exporter.sh export
```

#### 环境变量

```bash
# 设置 exporter 端口
export MOSS_PROMETHEUS_PORT=8080

# 设置遥测数据目录
export MOSS_TELEMETRY_DIR=/path/to/telemetry

# 启动 exporter
./scripts/telemetry-prometheus-exporter.sh start
```

### Prometheus 配置

配置文件位于 `monitoring/prometheus.yml`：

```yaml
scrape_configs:
  - job_name: 'harness-telemetry'
    static_configs:
      - targets: ['host.docker.internal:9090']  # macOS/Windows
      # - targets: ['localhost:9090']           # Linux
    scrape_interval: 5s
```

**注意**：根据你的操作系统修改 target：
- **macOS/Windows**: 使用 `host.docker.internal:9090`
- **Linux**: 使用 `localhost:9090` 或宿主机的 IP 地址

### Grafana 配置

#### 预配置的数据源

Grafana 已经预配置了 Prometheus 数据源：
- **名称**: Prometheus
- **URL**: http://prometheus:9090
- **默认**: 是

#### 预配置的仪表盘

Harness Telemetry Dashboard 包含以下面板：

1. **Active Sessions** - 当前活跃会话数
2. **Total Sessions** - 总会话数
3. **Total Actions** - 总动作数
4. **Success Rate** - 成功率仪表盘
5. **Actions by Session** - 各会话的动作趋势
6. **Average Action Duration** - 平均动作执行时间
7. **Action Types Distribution** - 动作类型分布（饼图）
8. **Resource Usage** - 资源使用情况（文件读写、命令执行）
9. **Security Metrics** - 安全指标（被阻止动作、警告）
10. **Action Success/Failure by Type** - 各动作类型的成功/失败数

## 可用的 Metrics

### 会话指标

```
harness_sessions_total              # 总会话数
harness_sessions_active             # 活跃会话数
harness_global_sessions_total       # 历史总会话数（counter）
harness_global_actions_total        # 历史总动作数（counter）
```

### 会话详情指标（带 session_id 标签）

```
harness_session_actions_total       # 会话总动作数
harness_session_actions_successful  # 成功动作数
harness_session_actions_failed      # 失败动作数
harness_session_checkpoints         # 检查点数量
harness_session_avg_duration_ms     # 平均动作耗时（毫秒）
harness_session_total_duration_ms   # 总会话耗时
harness_session_min_duration_ms     # 最小动作耗时
harness_session_max_duration_ms     # 最大动作耗时
harness_session_files_read          # 文件读取次数
harness_session_files_written       # 文件写入次数
harness_session_commands_executed   # 命令执行次数
harness_session_blocked_actions     # 被阻止的动作数
harness_session_warnings            # 警告数量
```

### 动作类型指标（带 session_id 和 action_type 标签）

```
harness_action_count                # 动作计数
harness_action_success              # 成功次数
harness_action_fail                 # 失败次数
harness_action_avg_duration_ms      # 平均耗时
```

## Prometheus 查询示例

### 基础查询

```promql
# 当前活跃会话数
harness_sessions_active

# 总会话数
harness_sessions_total

# 所有会话的总动作数
sum(harness_session_actions_total)
```

### 聚合查询

```promql
# 按会话统计动作数
sum by (session_id) (harness_session_actions_total)

# 按动作类型统计
sum by (action_type) (harness_action_count)

# 计算成功率
sum(harness_session_actions_successful) / sum(harness_session_actions_total) * 100
```

### 时间序列查询

```promql
# 过去 1 小时的平均动作耗时
avg_over_time(harness_session_avg_duration_ms[1h])

# 动作数的增长率
rate(harness_session_actions_total[5m])

# 过去 5 分钟的动作数增加量
increase(harness_session_actions_total[5m])
```

### 告警查询

```promql
# 成功率低于 90%
sum(harness_session_actions_successful) / sum(harness_session_actions_total) < 0.9

# 有被阻止的动作
sum(harness_session_blocked_actions) > 0

# 平均动作耗时超过 5 秒
harness_session_avg_duration_ms > 5000
```

## 自定义 Grafana 仪表盘

### 创建新面板

1. 点击仪表盘右上角的 "Add panel"
2. 选择可视化类型（Graph、Stat、Gauge、Table 等）
3. 输入 PromQL 查询
4. 配置面板标题和选项
5. 点击 "Apply"

### 常用可视化类型

#### 1. 时间序列图（Time series）

适合展示指标随时间的变化：

```promql
# 各会话的动作数趋势
harness_session_actions_total
```

#### 2. 统计卡片（Stat）

适合展示当前值：

```promql
# 当前活跃会话
harness_sessions_active
```

#### 3. 仪表盘（Gauge）

适合展示百分比：

```promql
# 成功率
sum(harness_session_actions_successful) / sum(harness_session_actions_total) * 100
```

配置阈值：
- 0-80%: 红色
- 80-95%: 黄色
- 95-100%: 绿色

#### 4. 饼图（Pie chart）

适合展示分布：

```promql
# 动作类型分布
sum by (action_type) (harness_action_count)
```

#### 5. 热力图（Heatmap）

适合展示动作耗时分布：

```promql
# 动作耗时
harness_session_avg_duration_ms
```

## 告警配置

### 在 Prometheus 中配置告警规则

创建 `monitoring/alert_rules.yml`：

```yaml
groups:
  - name: harness_alerts
    rules:
      - alert: HighFailureRate
        expr: sum(harness_session_actions_failed) / sum(harness_session_actions_total) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High failure rate detected"
          description: "Failure rate is above 10%"

      - alert: BlockedActions
        expr: sum(harness_session_blocked_actions) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Actions are being blocked"
          description: "{{ $value }} actions have been blocked"

      - alert: SlowActions
        expr: harness_session_avg_duration_ms > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow action execution"
          description: "Average action duration is above 10 seconds"
```

在 `prometheus.yml` 中添加：

```yaml
rule_files:
  - "alert_rules.yml"
```

### 在 Grafana 中配置告警

1. 编辑面板，切换到 "Alert" 标签
2. 点击 "Create alert rule from this panel"
3. 配置告警条件和通知渠道

## 故障排除

### Exporter 无法启动

```bash
# 检查端口是否被占用
lsof -i :9090

# 使用其他端口
./scripts/telemetry-prometheus-exporter.sh start -p 8080
```

### Prometheus 无法抓取指标

```bash
# 检查 exporter 是否运行
curl http://localhost:9090/metrics

# 检查 Prometheus target 状态
open http://localhost:9091/targets
```

### Grafana 无法连接 Prometheus

1. 检查 Prometheus 是否运行：`docker ps`
2. 检查数据源配置：Grafana → Configuration → Data Sources
3. 测试数据源连接

### Docker 网络问题

如果使用 Docker Desktop，确保使用 `host.docker.internal`：

```yaml
# monitoring/prometheus.yml
static_configs:
  - targets: ['host.docker.internal:9090']
```

如果使用 Linux，可能需要使用宿主机的 IP 地址：

```bash
# 获取宿主机 IP
ip addr show docker0

# 使用 IP 地址
static_configs:
  - targets: ['172.17.0.1:9090']
```

## 性能优化

### Prometheus 性能调优

在 `docker-compose.yml` 中添加：

```yaml
prometheus:
  command:
    - '--storage.tsdb.retention.time=7d'  # 减少保留时间
    - '--storage.tsdb.min-block-duration=2h'
    - '--storage.tsdb.max-block-duration=2h'
    - '--query.max-samples=50000000'
```

### 减少指标数量

如果指标过多，可以在 exporter 中过滤：

```bash
# 只导出活跃会话的指标
export MOSS_EXPORT_INACTIVE=false
./scripts/telemetry-prometheus-exporter.sh start
```

## 安全建议

1. **限制访问**：使用防火墙限制 Prometheus 和 Grafana 的访问
2. **更改默认密码**：修改 Grafana 的默认 admin 密码
3. **启用 HTTPS**：使用反向代理（如 Nginx）启用 HTTPS
4. **认证**：为 Prometheus Exporter 添加认证

## 参考链接

- [Prometheus 文档](https://prometheus.io/docs/)
- [Grafana 文档](https://grafana.com/docs/)
- [PromQL 查询语言](https://prometheus.io/docs/prometheus/latest/querying/basics/)
