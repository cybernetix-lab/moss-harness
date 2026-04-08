# Agent Harness 架构扩展设计

> 基于 DeerFlow 参考的分层架构扩展方案

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         应用层 (Application Layer)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Web UI    │  │  IM Gateway │  │   API GW    │  │   Scheduler     │ │
│  │  (Next.js)  │  │(飞书/Slack) │  │  (FastAPI)  │  │    (Cron)       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                         编排层 (Orchestration Layer)                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Middleware Chain (洋葱模型)                      │  │
│  │  DanglingTool → Sandbox → ThreadData → Uploads → Summarization   │  │
│  │  → Todo → TokenUsage → Title → Memory → ViewImage → ToolFilter   │  │
│  │  → SubagentLimit → LoopDetection → Clarification                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Sub-Agent Orchestrator                         │  │
│  │     任务分解 → 并行调度 → 结果聚合 → 冲突解决                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         核心层 (Core Layer)                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ Planner │→ │ Reviewer│→ │ Executor│→ │Evaluator│→ │ Orchestrator  │  │
│  │  (规划)  │  │  (审查)  │  │  (执行)  │  │  (评估)  │  │   (协调)      │  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         能力层 (Capability Layer)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Memory System│  │Sandbox System│  │  Skill System│  │MCP Integration│ │
│  │  (分层记忆)   │  │  (代码执行)   │  │  (动态技能)   │  │  (工具集成)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         观测层 (Observability Layer)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Traces  │  │  Metrics │  │  Events  │  │   Logs   │  │ Dashboard │  │
│  │ (OpenTel)│  │(Prometheus│  │ (EventBus│  │(Structured│  │ (Grafana) │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         基础设施层 (Infrastructure)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Model   │  │  Store   │  │  Queue   │  │ Telemetry│  │  Security │  │
│  │ (models) │  │(SQLite/PG│  │ (Redis)  │  │(Prometheus│  │  (RBAC)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 模块导出设计

### NPM Package 结构

```
@agent-harness/core
├── dist/
│   ├── index.js              # 主入口
│   ├── agents/               # Agent 系统
│   ├── orchestration/        # 编排系统
│   ├── memory/               # 内存系统
│   ├── telemetry/            # 观测系统
│   ├── skills/               # 技能系统
│   ├── middleware/           # Middleware 链
│   └── config/               # 配置系统
├── agents/                   # YAML 配置
├── config/                   # 默认配置
├── skills/                   # 内置技能
└── docs/                     # 文档
```

### 使用方式

```typescript
// 应用层项目引用示例
import { AgentHarness } from '@agent-harness/core';
import { TelemetryCollector } from '@agent-harness/core/telemetry';
import { SubAgentOrchestrator } from '@agent-harness/core/orchestration';
import { HierarchicalMemory } from '@agent-harness/core/memory';

// 初始化 Harness
const harness = new AgentHarness({
  agents: ['planner', 'reviewer', 'executor', 'evaluator'],
  telemetry: {
    enabled: true,
    exportToPrometheus: true,
  },
  memory: {
    type: 'hierarchical',
    storage: 'postgresql',
  },
  orchestration: {
    enableSubAgents: true,
    maxParallelism: 5,
  },
});

// 启动工作流
const result = await harness.run({
  task: '实现用户认证系统',
  context: { ... },
});
```

## 观测系统设计（重点）

### 观测架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Telemetry & Observability System                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Data Collection Layer                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
│  │  │  Events  │  │  Spans   │  │  Metrics │  │ Information Quality│ │   │
│  │  │ (EventBus)│  │(OpenTel) │  │(Prometheus│  │   (Entropy/Density)│ │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │   │
│  │       └─────────────┴─────────────┴─────────────────┘           │   │
│  │                         │                                       │   │
│  │                         ▼                                       │   │
│  │              ┌─────────────────────┐                           │   │
│  │              │  TelemetryCollector │                           │   │
│  │              │   (统一采集器)       │                           │   │
│  │              └─────────────────────┘                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Processing Layer                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │   │
│  │  │   Metrics    │  │    Traces    │  │  Information Theory  │   │   │
│  │  │ Aggregator   │  │   Processor  │  │      Analyzer        │   │   │
│  │  │              │  │              │  │  (Entropy/Density)   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Export Layer                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
│  │  │Prometheus│  │  Jaeger  │  │  Grafana │  │  Custom Export   │ │   │
│  │  │  /metrics│  │  /traces │  │Dashboards│  │    (JSON/CSV)    │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 核心观测指标

#### 1. 系统论指标（整体性）

| 指标名 | 描述 | 计算方式 |
|--------|------|----------|
| `harness_system_emergence_score` | 系统涌现性评分 | 实际产出 / 单 Agent 产出之和 |
| `harness_component_synergy` | 组件协同度 | 协作成功次数 / 总协作次数 |
| `harness_boundary_integrity` | 边界完整性 | 越界调用次数 / 总调用次数 |
| `harness_adaptive_capacity` | 自适应能力 | 成功适应变化次数 / 变化次数 |

#### 2. 信息论指标（信息质量）

| 指标名 | 描述 | 计算方式 |
|--------|------|----------|
| `harness_information_entropy` | 信息熵 | -Σp(x)log₂p(x) |
| `harness_token_information_density` | Token 信息密度 | 信息熵 / Token 数 |
| `harness_signal_to_noise_ratio` | 信噪比 | 有效信息 / 冗余信息 |
| `harness_confidence_calibration` | 置信度校准 | 预测置信度 vs 实际准确率 |
| `harness_channel_capacity_usage` | 信道容量使用率 | 实际 Token / 最大 Token |

#### 3. 控制论指标（反馈控制）

| 指标名 | 描述 | 计算方式 |
|--------|------|----------|
| `harness_feedback_response_time` | 反馈响应时间 | 问题发现到修复的时间 |
| `harness_stability_index` | 稳定性指标 | 1 - (振荡幅度 / 目标值) |
| `harness_convergence_rate` | 收敛速度 | 迭代次数 / 达到稳态所需时间 |
| `harness_negative_feedback_rate` | 负反馈率 | 负反馈次数 / 总反馈次数 |
| `harness_oscillation_amplitude` | 振荡幅度 | 连续迭代间的差异度 |

### 观测数据流

```
Agent Execution
       │
       ▼
┌─────────────────┐
│  Hook System    │
│ (pre/post action)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Event Bus      │
│ (异步事件总线)   │
└────────┬────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Events     │ │    Spans     │ │   Metrics    │ │   Quality    │
│   (JSONL)    │ │   (JSONL)    │ │   (JSON)     │ │   (JSON)     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Prometheus     │
                   │  Exporter       │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Grafana        │
                   │  Dashboard      │
                   └─────────────────┘
```

## 核心扩展模块

### 1. Sub-Agent Orchestrator

```typescript
interface SubAgentOrchestrator {
  // 任务分解
  decomposeTask(task: Task): SubTask[];
  
  // 并行调度
  scheduleParallel(tasks: SubTask[], options: ScheduleOptions): Promise<SubTaskResult[]>;
  
  // 结果聚合
  aggregateResults(results: SubTaskResult[]): AggregatedResult;
  
  // 冲突解决
  resolveConflicts(conflicts: Conflict[]): Resolution;
}
```

### 2. Hierarchical Memory System

```typescript
interface HierarchicalMemory {
  // Curated Memory (人工维护)
  curated: {
    projectBackground: string;
    constraints: string[];
    preferences: Record<string, unknown>;
  };
  
  // Dynamic Memory (自动抽取)
  dynamic: {
    workContext: string;
    facts: MemoryFact[];
    summaries: string[];
  };
  
  // Retrieval Layer
  retrieve(query: string, options: RetrievalOptions): MemoryItem[];
  
  // Update with debounce
  update(facts: MemoryFact[]): void;
}
```

### 3. Middleware Chain

```typescript
interface Middleware {
  name: string;
  order: number;
  
  // 进入时处理
  onEnter(context: Context): Promise<Context>;
  
  // 退出时处理
  onExit(context: Context, result: Result): Promise<Result>;
}

// 14 层 Middleware
const MIDDLEWARE_CHAIN = [
  DanglingToolCallMiddleware,    // 修复工具调用
  SandboxMiddleware,             // 注入沙箱状态
  ThreadDataMiddleware,          // 提取线程数据
  UploadsMiddleware,             // 处理文件上传
  SummarizationMiddleware,       // 上下文摘要
  TodoMiddleware,                // Todo 管理
  TokenUsageMiddleware,          // Token 计量
  TitleMiddleware,               // 标题生成
  MemoryMiddleware,              // 记忆更新
  ViewImageMiddleware,           // 图像处理
  DeferredToolFilterMiddleware,  // 工具延迟加载
  SubagentLimitMiddleware,       // 子 Agent 限制
  LoopDetectionMiddleware,       // 循环检测
  ClarificationMiddleware,       // 澄清请求
];
```

## 基于 SCI 论的架构验证

### 系统论验证

- ✅ **整体性**: 六角色 + Orchestrator + Sub-Agent 形成完整系统
- ✅ **层级性**: 应用层 → 编排层 → 核心层 → 能力层 → 观测层 → 基础设施层
- ✅ **涌现性**: Sub-Agent 并行执行产生 3-5x 效率提升

### 信息论验证

- ✅ **信息度量**: Token 信息密度、信息熵、信噪比
- ✅ **信道优化**: Middleware 链优化信息传递
- ✅ **噪声控制**: 置信度评分、质量反馈闭环

### 控制论验证

- ✅ **反馈回路**: Agent Loop + 子 Agent 结果反馈
- ✅ **负反馈**: Reviewer/Evaluator 质量控制
- ✅ **正反馈**: 进度推进、任务完成
- ✅ **稳态**: 终止条件、收敛检测

## 实现优先级

### Phase 1: 观测系统增强（高优先级）

1. **TelemetryCollector 实现**
   - 统一事件采集
   - Span 管理
   - Metrics 聚合

2. **信息质量分析器**
   - 信息熵计算
   - Token 密度分析
   - 信噪比评估

3. **Prometheus 导出器**
   - Metrics 暴露
   - Grafana 看板

### Phase 2: 编排层扩展（高优先级）

4. **Middleware Chain 框架**
   - 洋葱模型实现
   - 14 层 Middleware 定义

5. **Sub-Agent Orchestrator**
   - 任务分解
   - 并行调度
   - 结果聚合

### Phase 3: 能力层增强（中优先级）

6. **Hierarchical Memory**
   - 分层存储
   - 检索优化
   - 防抖更新

7. **Skill System 增强**
   - 动态加载
   - 版本管理

## 总结

本架构扩展方案：

1. **保持定位**: 专注 Harness & Agent Runtime，应用层独立
2. **模块导出**: NPM Package + 清晰的 API 设计
3. **观测优先**: 基于 SCI 论的全面观测系统
4. **分层清晰**: 6 层架构，职责明确
5. **可扩展性**: Middleware 链、Sub-Agent、Memory 均可插拔
