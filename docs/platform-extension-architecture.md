# 多 Agent 智能体应用平台扩展架构

> 基于 Agent Harness 框架的多 Agent 智能体应用平台扩展方案
> 参考: DeerFlow (bytedance/deer-flow)

## 1. 架构总览

### 1.1 设计原则

基于 SCI 论（系统论、控制论、信息论）的设计哲学：

- **系统论**：分层架构，清晰边界，支持涌现性
- **控制论**：反馈闭环，动态路由，自适应控制
- **信息论**：结构化通信，信息质量度量，信道优化

### 1.2 优先级排序

根据用户需求，按以下优先级实现：

1. **子 Agent 编排** - 动态创建和管理子代理
2. **内存系统** - 长周期任务的上下文保持
3. **沙箱执行** - 安全的代码执行环境
4. **K8s 部署** - 云原生部署支持
5. **飞书网关** - IM 渠道接入
6. **存储抽象** - 多存储后端支持

### 1.3 架构分层

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         多 Agent 智能体应用平台                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  接入层        │  Web UI │  IM Gateway (飞书优先)  │  API Gateway           │
├─────────────────────────────────────────────────────────────────────────────┤
│  编排层        │  Orchestrator (动态子 Agent 编排)                         │
│               │  ├─ Lead Agent (主代理)                                    │
│               │  ├─ Sub-Agent Manager (子代理管理)                          │
│               │  └─ Task Router (任务路由)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  执行层        │  Planner │ Reviewer │ Executor │ Evaluator │ Sub-Agents    │
├─────────────────────────────────────────────────────────────────────────────┤
│  能力层        │  Skills │ MCP Tools │ Sandbox │ Memory Store              │
├─────────────────────────────────────────────────────────────────────────────┤
│  基础设施层     │  K8s Operator │ Storage (SQLite/PG) │ Telemetry            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 子 Agent 编排系统

### 2.1 核心概念

**Lead Agent（主代理）**
- 接收用户请求，进行任务分解
- 动态创建 Sub-Agent 执行子任务
- 汇总结果，生成最终输出

**Sub-Agent（子代理）**
- 执行特定的子任务
- 拥有独立的上下文和记忆
- 支持并行执行

**Agent Registry（代理注册表）**
- 管理可用的 Agent 模板
- 支持动态加载和卸载

### 2.2 工作流程

```
用户请求
    ↓
Lead Agent 分析
    ↓
任务分解 (Task Decomposition)
    ↓
┌─────────────────────────────────────────┐
│  并行创建 Sub-Agents                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Sub-Agent│ │Sub-Agent│ │Sub-Agent│   │
│  │   1     │ │   2     │ │   N     │   │
│  └────┬────┘ └────┬────┘ └────┬────┘   │
│       └───────────┴───────────┘        │
│              并行执行                   │
└─────────────────────────────────────────┘
    ↓
结果汇总 (Result Aggregation)
    ↓
Lead Agent 整合输出
    ↓
最终响应
```

### 2.3 上下文隔离机制

```yaml
# subagent/context-isolation.yaml
context_isolation:
  enabled: true
  levels:
    - name: full_isolation
      description: 完全隔离，子代理无法访问父代理上下文
      use_case: 独立任务执行
      
    - name: partial_isolation
      description: 部分隔离，子代理可访问任务描述和必要上下文
      use_case: 协作任务执行
      
    - name: shared_context
      description: 共享上下文，子代理可读写共享内存
      use_case: 需要协作的复杂任务
```

### 2.4 动态路由策略

```yaml
# orchestrator/routing-strategies.yaml
routing_strategies:
  - name: parallel_decomposition
    description: 并行分解策略
    trigger: task_complexity > threshold
    action: create_multiple_subagents
    
  - name: sequential_pipeline
    description: 顺序管道策略
    trigger: task_has_dependencies
    action: create_sequential_subagents
    
  - name: hierarchical_delegation
    description: 层级委托策略
    trigger: task_scope > threshold
    action: create_lead_subagent_with_children
    
  - name: specialized_agent
    description: 专业化代理策略
    trigger: task_requires_specialization
    action: route_to_specialized_agent
```

## 3. 内存系统

### 3.1 内存分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    内存系统架构                          │
├─────────────────────────────────────────────────────────┤
│  工作内存 (Working Memory)                               │
│  ├─ 当前会话上下文                                       │
│  ├─ 短期任务状态                                         │
│  └─ 临时计算结果                                         │
├─────────────────────────────────────────────────────────┤
│  短期记忆 (Short-term Memory)                            │
│  ├─ 会话历史                                             │
│  ├─ 最近交互                                             │
│  └─ 滑动窗口保留 (最近 N 轮)                              │
├─────────────────────────────────────────────────────────┤
│  长期记忆 (Long-term Memory)                             │
│  ├─ 用户画像                                             │
│  ├─ 偏好设置                                             │
│  ├─ 知识积累                                             │
│  └─ 跨会话持久化                                         │
├─────────────────────────────────────────────────────────┤
│  共享内存 (Shared Memory)                                │
│  ├─ Sub-Agent 间通信                                     │
│  ├─ 协作状态                                             │
│  └─ 分布式锁                                             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 内存更新机制

```yaml
# memory/update-mechanism.yaml
memory_update:
  working_memory:
    update_trigger: immediate
    persistence: none
    
  short_term_memory:
    update_trigger: end_of_turn
    persistence: session
    retention_policy:
      type: sliding_window
      max_turns: 10
      
  long_term_memory:
    update_trigger: debounced_async
    persistence: permanent
    debounce_interval: 30s
    extraction_method: llm_based
    
  shared_memory:
    update_trigger: on_write
    persistence: session
    consistency: eventual
```

### 3.3 记忆提取与注入

```yaml
# memory/extraction-injection.yaml
memory_extraction:
  enabled: true
  extractors:
    - type: user_preference
      description: 提取用户偏好
      trigger: explicit_statement
      
    - type: domain_knowledge
      description: 提取领域知识
      trigger: factual_information
      
    - type: task_pattern
      description: 提取任务模式
      trigger: repeated_action

memory_injection:
  enabled: true
  injection_points:
    - point: conversation_start
      content: user_profile
      
    - point: task_start
      content: relevant_history
      
    - point: context_overflow
      content: compressed_summary
```

## 4. 沙箱执行系统

### 4.1 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    沙箱执行系统                          │
├─────────────────────────────────────────────────────────┤
│  沙箱抽象层                                              │
│  ├─ Sandbox Interface                                   │
│  ├─ LocalSandboxProvider                                │
│  ├─ DockerSandboxProvider                               │
│  └─ K8sSandboxProvider                                  │
├─────────────────────────────────────────────────────────┤
│  执行环境                                                │
│  ├─ Python Runtime                                      │
│  ├─ Node.js Runtime                                     │
│  ├─ Bash Environment                                    │
│  └─ Custom Runtime                                      │
├─────────────────────────────────────────────────────────┤
│  安全控制                                                │
│  ├─ Resource Limits (CPU/Memory/Time)                   │
│  ├─ Network Isolation                                   │
│  ├─ File System Sandbox                                 │
│  └─ Capability Whitelist                                │
└─────────────────────────────────────────────────────────┘
```

### 4.2 沙箱类型

```yaml
# sandbox/providers.yaml
sandbox_providers:
  local:
    name: LocalSandbox
    description: 本地进程隔离沙箱
    use_case: 开发环境，轻量级任务
    security_level: medium
    resource_limits:
      cpu: 1.0
      memory: 512MB
      timeout: 60s
      
  docker:
    name: DockerSandbox
    description: Docker 容器沙箱
    use_case: 生产环境，代码执行
    security_level: high
    resource_limits:
      cpu: 2.0
      memory: 2GB
      timeout: 300s
      
  kubernetes:
    name: K8sSandbox
    description: Kubernetes Pod 沙箱
    use_case: 大规模部署，弹性伸缩
    security_level: high
    resource_limits:
      cpu: 4.0
      memory: 8GB
      timeout: 3600s
    auto_scaling:
      enabled: true
      min_replicas: 1
      max_replicas: 10
```

### 4.3 执行工具

```yaml
# sandbox/tools.yaml
sandbox_tools:
  bash:
    name: bash
    description: 执行 bash 命令
    sandbox_required: true
    allowed_commands:
      - ls
      - cat
      - grep
      - find
      - python
      - node
      - npm
    
  python:
    name: python
    description: 执行 Python 代码
    sandbox_required: true
    allowed_modules:
      - os
      - sys
      - json
      - re
      - math
      - datetime
      - requests
    restricted_modules:
      - subprocess
      - socket
      - urllib
```

## 5. K8s 部署模式

### 5.1 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    K8s 部署架构                          │
├─────────────────────────────────────────────────────────┤
│  Ingress Controller                                      │
│  ├─ Web UI: app.example.com                             │
│  ├─ API: api.example.com                                │
│  └─ WebSocket: ws.example.com                           │
├─────────────────────────────────────────────────────────┤
│  Services                                                │
│  ├─ orchestrator-service (ClusterIP)                    │
│  ├─ gateway-service (ClusterIP)                         │
│  ├─ sandbox-service (ClusterIP)                         │
│  └─ memory-service (ClusterIP)                          │
├─────────────────────────────────────────────────────────┤
│  Deployments                                             │
│  ├─ orchestrator (3 replicas)                           │
│  ├─ gateway (2 replicas)                                │
│  ├─ sub-agent-pool (HPA: 2-20)                          │
│  └─ sandbox-provisioner (1 replica)                     │
├─────────────────────────────────────────────────────────┤
│  StatefulSets                                            │
│  ├─ memory-store (3 replicas, PostgreSQL)               │
│  └─ message-queue (3 replicas, Redis/RabbitMQ)          │
├─────────────────────────────────────────────────────────┤
│  Jobs / CronJobs                                         │
│  ├─ memory-compaction (daily)                           │
│  └─ telemetry-aggregation (hourly)                      │
└─────────────────────────────────────────────────────────┘
```

### 5.2 K8s Operator

```yaml
# k8s/operator/agent-harness-operator.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: agentpools.agent-harness.io
spec:
  group: agent-harness.io
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                agentType:
                  type: string
                  enum: [planner, reviewer, executor, evaluator, sub-agent]
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 100
                resources:
                  type: object
                  properties:
                    cpu:
                      type: string
                    memory:
                      type: string
                autoScaling:
                  type: object
                  properties:
                    enabled:
                      type: boolean
                    minReplicas:
                      type: integer
                    maxReplicas:
                      type: integer
                    targetCPUUtilization:
                      type: integer
```

## 6. 飞书消息网关

### 6.1 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    飞书消息网关                          │
├─────────────────────────────────────────────────────────┤
│  飞书开放平台                                            │
│  ├─ 事件订阅 (Event Subscription)                        │
│  ├─ 消息卡片 (Message Card)                              │
│  └─ 机器人 (Bot)                                         │
├─────────────────────────────────────────────────────────┤
│  Gateway Service                                         │
│  ├─ Webhook Handler                                     │
│  ├─ Message Parser                                      │
│  ├─ Session Manager                                     │
│  └─ Response Formatter                                  │
├─────────────────────────────────────────────────────────┤
│  消息转换层                                              │
│  ├─ Feishu → Internal Format                            │
│  └─ Internal Format → Feishu                            │
└─────────────────────────────────────────────────────────┘
```

### 6.2 消息类型映射

```yaml
# channels/feishu/message-mapping.yaml
message_mapping:
  inbound:
    - feishu_type: text
      internal_type: text_message
      parser: text_parser
      
    - feishu_type: image
      internal_type: image_message
      parser: image_parser
      
    - feishu_type: file
      internal_type: file_message
      parser: file_parser
      
    - feishu_type: post
      internal_type: rich_text_message
      parser: post_parser
      
  outbound:
    - internal_type: text_response
      feishu_type: text
      formatter: text_formatter
      
    - internal_type: code_response
      feishu_type: interactive
      formatter: code_card_formatter
      
    - internal_type: error_response
      feishu_type: text
      formatter: error_formatter
```

### 6.3 会话管理

```yaml
# channels/feishu/session-management.yaml
session_management:
  session_identification:
    method: chat_id + user_id
    persistence: redis
    ttl: 24h
    
  context_preservation:
    enabled: true
    max_history: 20
    compression_threshold: 10
    
  multi_user_sessions:
    enabled: true
    mention_required: true
    group_mode: shared_context
```

## 7. 存储层抽象

### 7.1 存储接口

```yaml
# storage/interface.yaml
storage_interface:
  name: StorageProvider
  operations:
    - name: get
      signature: get(key: string) -> Value
      
    - name: set
      signature: set(key: string, value: Value, ttl?: int)
      
    - name: delete
      signature: delete(key: string) -> bool
      
    - name: query
      signature: query(filter: Filter) -> List[Value]
      
    - name: transaction
      signature: transaction(operations: List[Operation]) -> bool
```

### 7.2 存储实现

```yaml
# storage/implementations.yaml
storage_implementations:
  sqlite:
    name: SQLiteStorage
    description: 嵌入式 SQLite 存储
    use_case: 单节点部署，轻量级应用
    connection_string: sqlite:///data/agent_harness.db
    
  postgresql:
    name: PostgreSQLStorage
    description: PostgreSQL 关系型存储
    use_case: 生产环境，高并发
    connection_string: postgresql://user:pass@host:5432/db
    connection_pool:
      min: 5
      max: 20
      
  redis:
    name: RedisStorage
    description: Redis 内存存储
    use_case: 高速缓存，会话存储
    connection_string: redis://host:6379/0
    persistence: rdb
```

### 7.3 数据模型

```yaml
# storage/schema.yaml
data_models:
  session:
    table: sessions
    fields:
      - name: id
        type: string
        primary_key: true
      - name: user_id
        type: string
        index: true
      - name: channel
        type: string
      - name: context
        type: json
      - name: created_at
        type: timestamp
      - name: updated_at
        type: timestamp
      - name: expires_at
        type: timestamp
        
  memory:
    table: memories
    fields:
      - name: id
        type: string
        primary_key: true
      - name: session_id
        type: string
        index: true
      - name: type
        type: enum [working, short_term, long_term]
      - name: content
        type: json
      - name: embedding
        type: vector
        index: true
      - name: created_at
        type: timestamp
        
  task:
    table: tasks
    fields:
      - name: id
        type: string
        primary_key: true
      - name: parent_id
        type: string
        nullable: true
      - name: session_id
        type: string
        index: true
      - name: status
        type: enum [pending, running, completed, failed]
      - name: result
        type: json
        nullable: true
      - name: created_at
        type: timestamp
      - name: completed_at
        type: timestamp
        nullable: true
```

## 8. 集成方案

### 8.1 与现有框架的集成

```
现有 Agent Harness 框架
├─ agents/ (六角色 Agent)
├─ skills/ (技能系统)
├─ hooks/ (钩子系统)
├─ telemetry/ (可观测性)
└─ docs/ (设计哲学)

扩展组件
├─ orchestrator/subagents/ (子 Agent 编排)
├─ memory/ (内存系统增强)
├─ sandbox/ (沙箱执行)
├─ channels/feishu/ (飞书网关)
├─ storage/ (存储抽象)
└─ k8s/ (K8s 部署)
```

### 8.2 渐进式迁移路径

**Phase 1: 子 Agent 编排**
- 扩展现有 Orchestrator，添加 Sub-Agent Manager
- 复用现有的六角色 Agent 作为 Sub-Agent 模板
- 保持现有接口不变

**Phase 2: 内存系统**
- 增强现有 memory/ 目录
- 添加长期记忆和共享内存支持
- 集成向量数据库

**Phase 3: 沙箱执行**
- 新增 sandbox/ 目录
- 实现 LocalSandbox 和 DockerSandbox
- 添加代码执行工具

**Phase 4: 部署和网关**
- 添加 K8s Operator
- 实现飞书网关
- 完成存储抽象

## 9. 关键技术决策

### 9.1 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 编排引擎 | 扩展现有 Orchestrator | 保持架构一致性 |
| 内存存储 | PostgreSQL + Redis | 成熟稳定，支持向量扩展 |
| 沙箱 | Docker (默认) + K8s (生产) | 安全隔离，弹性伸缩 |
| 消息队列 | Redis Streams / RabbitMQ | 轻量，与现有技术栈兼容 |
| 向量数据库 | pgvector | 与 PostgreSQL 集成 |

### 9.2 与 DeerFlow 的差异

| 特性 | DeerFlow | 本方案 |
|------|----------|--------|
| 架构基础 | LangGraph | 自定义 Orchestrator |
| Agent 模型 | 单一 Lead Agent | 六角色分离 |
| 设计哲学 | 功能导向 | SCI 论导向 |
| 扩展性 | Markdown Skills | YAML Skills + Hooks |
| 可观测性 | LangSmith/Langfuse | 自研 Telemetry |

## 10. 下一步行动

1. **实现子 Agent 编排系统**
   - 创建 `orchestrator/subagents/` 目录
   - 实现 Sub-Agent Manager
   - 添加动态路由逻辑

2. **增强内存系统**
   - 扩展 `memory/` 目录
   - 实现长期记忆存储
   - 添加记忆提取和注入

3. **实现沙箱执行**
   - 创建 `sandbox/` 目录
   - 实现 LocalSandbox
   - 添加代码执行工具

4. **实现存储抽象**
   - 创建 `storage/` 目录
   - 实现 SQLite 和 PostgreSQL 驱动
   - 添加数据迁移脚本

5. **实现飞书网关**
   - 创建 `channels/feishu/` 目录
   - 实现消息解析和格式化
   - 添加会话管理

6. **K8s 部署**
   - 创建 `k8s/` 目录
   - 编写 Helm Chart
   - 实现 Operator
