# Agent Harness 架构扩展

> 基于 DeerFlow 参考的多 Agent 智能体应用平台扩展方案

## 项目结构

```
agent-harness-spec/
├── apps/
│   ├── agent-cli/          # Agent 命令行工具
│   └── operator/           # K8s Operator
├── configs/
│   ├── agents/             # Agent 配置
│   ├── constraints/        # 约束策略
│   ├── orchestration/      # 编排配置
│   ├── protocols/          # 协议定义
│   ├── skills/             # 技能注册表
│   └── telemetry/          # 遥测配置
├── runtime/                # TypeScript 运行时实现
├── .runtime/               # 运行时数据（.gitignore）
│   └── context/            # 上下文管理
├── integrations/
│   ├── extensions/         # 扩展模块
│   ├── mcp/                # MCP 协议
│   └── skills/             # 技能定义
├── deployments/            # 部署配置
├── observability/          # 可观测性
├── platform/               # 平台扩展
├── scripts/                # 运行时管理脚本
├── tooling/
│   ├── evals/              # 评估用例
│   ├── rules/              # 代码规范
│   └── scripts/            # 开发工具脚本
├── tests/                  # Bats 测试
└── docs/                   # 文档
```

## 快速开始

### 初始化项目

```bash
./init.sh
```

### 运行 CI 检查

```bash
./local-ci.sh
```

### 基础使用

```bash
# 查看可用 Agent
./apps/agent-cli/agent-list.sh

# 启动 Planner
./apps/agent-cli/agent-start.sh planner

# 启动新会话
./apps/agent-cli/start-session.sh

# 创建检查点
./apps/agent-cli/create-checkpoint.sh "完成架构设计"

# 运行健康检查
./tooling/scripts/health-check.sh
```

### 技能管理

```bash
# 列出所有技能
./tooling/scripts/skill-list.sh

# 激活技能
./tooling/scripts/skill-activate.sh typescript-patterns

# 评估技能
./tooling/scripts/skill-eval.sh typescript-patterns
```

## TypeScript API

### 初始化 Harness

```typescript
import { AgentHarness } from './runtime';

const harness = new AgentHarness({
  agents: ['coordinator', 'planner', 'reviewer', 'executor', 'evaluator', 'memory-curator'],
  telemetry: {
    enabled: true,
    exportToPrometheus: true,
  },
});

// 运行任务
const result = await harness.run({
  task: '实现用户认证系统',
  context: {
    requirements: '需要支持 JWT 认证、密码加密、会话管理',
    techStack: 'Node.js, TypeScript, PostgreSQL',
  },
});
```

### 使用子 Agent 编排

```typescript
import { SubAgentOrchestrator } from './runtime/orchestration';

const orchestrator = new SubAgentOrchestrator({
  maxParallelism: 5,
  enableTaskDecomposition: true,
});

// 分解任务并并行执行
const results = await orchestrator.run({
  task: '研究并对比三种认证方案',
  subAgents: [
    { type: 'researcher', task: '研究 JWT 认证方案' },
    { type: 'researcher', task: '研究 Session 认证方案' },
    { type: 'researcher', task: '研究 OAuth 认证方案' },
  ],
});
```

### 使用分层内存

```typescript
import { HierarchicalMemory } from './runtime/memory';

const memory = new HierarchicalMemory({
  storage: 'sqlite',
  layers: ['curated', 'dynamic', 'retrieval'],
});

// 存储记忆
await memory.update({
  facts: [
    { content: '用户偏好使用 JWT', confidence: 0.9, category: 'preference' },
  ],
});

// 检索记忆
const relevant = await memory.retrieve('认证方案', {
  maxTokens: 2000,
  minConfidence: 0.7,
});
```

## 模块导出

### 运行时模块

```typescript
// Agent 系统
import { AgentRegistry } from './runtime/agents';

// 编排系统
import { SubAgentOrchestrator } from './runtime/orchestration';

// 内存系统
import { HierarchicalMemory } from './runtime/memory';

// 观测系统
import { TelemetryCollector } from './runtime/telemetry';

// 存储系统
import { SQLiteStorage } from './runtime/storage';
```

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         应用层 (apps/)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  agent-cli  │  │  operator   │  │   CLI工具   │  │   Web UI        │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                         配置层 (configs/)                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ agents  │  │constraints│  │orchestration│  │protocols│  │   skills    │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         运行时层 (runtime/)                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ agents  │  │orchestration│  │ memory  │  │ sandbox │  │   storage     │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         集成层 (integrations/)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  extensions  │  │     mcp      │  │    skills    │  │   mailbox   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         观测层 (observability/)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Grafana │  │ Prometheus │  │  Events  │  │   Logs   │  │ Dashboard │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 观测系统

观测系统是 Agent Harness 的核心基础设施，基于 SCI 论设计：

### 系统论指标

- `harness_system_emergence_score`: 系统涌现性评分
- `harness_component_synergy`: 组件协同度
- `harness_adaptive_capacity`: 自适应能力

### 信息论指标

- `harness_information_entropy`: 信息熵
- `harness_token_information_density`: Token 信息密度
- `harness_signal_to_noise_ratio`: 信噪比
- `harness_confidence_calibration`: 置信度校准

### 控制论指标

- `harness_feedback_response_time`: 反馈响应时间
- `harness_stability_index`: 稳定性指标
- `harness_convergence_rate`: 收敛速度
- `harness_negative_feedback_rate`: 负反馈率

## 配置

### 基础配置

```yaml
# configs/config.yaml
agents:
  - coordinator
  - planner
  - reviewer
  - executor
  - evaluator
  - memory-curator

telemetry:
  enabled: true
  sampleRate: 1.0
  exportToPrometheus: true

orchestration:
  enableSubAgents: true
  maxParallelism: 5
```

### 模型配置

```yaml
# configs/orchestration/models.yaml
models:
  claude-3-opus:
    provider: anthropic
    model: claude-3-opus-20240229
    temperature: 0.3
    maxTokens: 8192
    
  claude-3-5-sonnet:
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.2
    maxTokens: 4096
```

## 监控看板

### Grafana Dashboard

- **SCI Theory Dashboard**: `observability/grafana/dashboards/sci-theory-dashboard.json`
- **Token Metrics Dashboard**: `observability/grafana/dashboards/token-metrics.json`
- **Harness Overview Dashboard**: `observability/grafana/dashboards/harness-dashboard.json`

### Prometheus Metrics

```
# 系统论指标
harness_system_emergence_score 1.2
harness_component_synergy 0.85
harness_adaptive_capacity 0.75

# 信息论指标
harness_information_entropy 4.5
harness_token_information_density 0.0035
harness_signal_to_noise_ratio 0.82

# 控制论指标
harness_feedback_response_time 1250
harness_stability_index 0.88
harness_convergence_rate 0.15
harness_negative_feedback_rate 0.25
```

## 开发

### 运行测试

```bash
# 运行所有测试
bats tests/

# 运行本地 CI
./local-ci.sh
```

### 目录说明

| 目录 | 用途 | 示例命令 |
|------|------|----------|
| `apps/agent-cli/` | 用户 CLI 工具 | `./apps/agent-cli/agent-start.sh planner` |
| `scripts/` | 运行时管理 | `./scripts/memory-manager.sh working create` |
| `tooling/scripts/` | 开发工具 | `./tooling/scripts/skill-discover.sh` |
| `tests/` | Bats 测试 | `bats tests/apps/*.bats` |

## 许可证

MIT
