# Agent 原子能力模型

## 概述

Agent 原子能力模型定义了每个 Agent 应该具备的**自描述能力**，使 Orchestrator 能够动态编排 Agent Loop，而无需硬编码路由逻辑。

## 设计原则

1. **自描述** - Agent 声明自己能做什么、需要什么、能输出什么
2. **可发现** - Orchestrator 通过读取配置即可了解 Agent 能力
3. **可组合** - Agent 之间通过标准接口协作
4. **可扩展** - 新增 Agent 只需声明能力，无需修改编排逻辑

## 原子能力分类

### 1. 执行能力 (Execution)

定义 Agent 能执行的任务类型、输入模式和输出模式。

```yaml
atomic_capabilities:
  execution:
    task_types:
      - requirement_analysis      # 任务类型列表
      - task_decomposition
    
    input_patterns:
      - type: raw_requirement    # 输入模式
        description: 原始用户需求
        required: true
    
    output_schema:               # 输出模式
      plan:
        type: object
        required: true
        fields:
          - summary
          - tasks
```

**作用**：
- Orchestrator 根据 `task_types` 匹配合适的 Agent
- 验证输入数据是否满足 `input_patterns`
- 验证输出数据是否符合 `output_schema`

### 2. 决策能力 (Decision)

定义 Agent 能输出的决策信号和路由提示。

```yaml
atomic_capabilities:
  decision:
    output_signals:
      - name: plan_complete      # 信号名称
        description: 计划已完成
        trigger: 正常完成规划
    
    routing_hints:
      next_agents:
        - reviewer               # 默认下一节点
      conditions:
        - condition: plan_complete
          next: reviewer
        - condition: need_more_info
          next: user
```

**作用**：
- Agent 通过 `output_signals` 表达完成状态
- Orchestrator 根据 `routing_hints` 决定下一节点
- 支持条件路由，无需硬编码

### 3. 反馈能力 (Feedback)

定义 Agent 如何报告状态、上报问题和提供建议。

```yaml
atomic_capabilities:
  feedback:
    status_reporting:
      - planning_in_progress    # 状态类型
      - planning_blocked
    
    issue_escalation:
      - type: requirement_ambiguous  # 问题类型
        description: 需求不明确
        action: request_clarification
        severity: high
    
    progress_reporting:
      enabled: true
      granularity: per_task
```

**作用**：
- Agent 实时报告执行状态
- 遇到问题按 `severity` 分级上报
- Orchestrator 根据 `action` 决定处理方式

### 4. 自省能力 (Introspection)

定义 Agent 如何评估自己的能力和局限性。

```yaml
atomic_capabilities:
  introspection:
    confidence_scoring:
      enabled: true
      factors:
        - requirement_clarity     # 置信度因子
        - domain_familiarity
    
    limitations:
      - 无法执行实际代码编写     # 局限性声明
      - 无法访问外部实时数据
    
    self_assessment:
      - plan_quality_score        # 自评指标
      - risk_coverage_score
```

**作用**：
- Agent 输出 `confidence` 帮助 Orchestrator 决策
- 明确声明 `limitations` 避免过度期望
- `self_assessment` 支持质量追溯

### 5. 协作能力 (Collaboration)

定义 Agent 如何与其他 Agent 协作。

```yaml
atomic_capabilities:
  collaboration:
    dependencies:
      - agent: reviewer          # 依赖的 Agent
        relationship: output_to
        description: 计划输出给 Reviewer
    
    collaboration_interfaces:
      - name: plan_delivery      # 协作接口
        format: structured_yaml
        content: execution_plan
    
    context_sharing:
      shared_context:            # 共享上下文
        - requirements
        - constraints
      private_context:           # 私有上下文
        - draft_notes
```

**作用**：
- 声明 Agent 之间的依赖关系
- 标准化协作接口格式
- 区分共享和私有上下文

## 动态编排流程

基于原子能力，Orchestrator 可以实现完全动态的编排：

```
1. 读取所有 Agent 的 atomic_capabilities
2. 根据用户输入匹配 task_types
3. 选择合适的 Agent 开始执行
4. 等待 Agent 输出 output_signals
5. 根据 routing_hints 和 conditions 决定下一节点
6. 重复步骤 4-5 直到终止条件满足
```

## 优势

### 1. 去中心化编排

传统方式：Orchestrator 硬编码所有路由逻辑
```python
if agent == "planner":
    return "reviewer"
elif agent == "reviewer":
    if verdict == "APPROVED":
        return "executor"
```

原子能力方式：Orchestrator 读取配置动态决策
```python
# 从 Agent 配置读取 routing_hints
hints = agent_config['atomic_capabilities']['decision']['routing_hints']
# 根据当前信号选择下一节点
next_agent = match_condition(hints, current_signal)
```

### 2. 易于扩展

新增 Agent 只需：
1. 创建新的 YAML 配置文件
2. 声明 atomic_capabilities
3. Orchestrator 自动识别并编排

### 3. 自文档化

Agent 的能力、限制、接口都在配置中声明，无需额外文档。

## 配置示例

### Planner Agent

```yaml
atomic_capabilities:
  execution:
    task_types:
      - requirement_analysis
      - task_decomposition
    output_schema:
      plan:
        type: object
        fields: [summary, tasks, risks]
  
  decision:
    output_signals:
      - name: plan_complete
      - name: need_more_info
    routing_hints:
      conditions:
        - condition: plan_complete
          next: reviewer
        - condition: need_more_info
          next: user
```

### Executor Agent

```yaml
atomic_capabilities:
  execution:
    task_types:
      - code_implementation
      - test_writing
    input_patterns:
      - type: execution_plan
        required: true
  
  decision:
    output_signals:
      - name: execution_complete
      - name: plan_defect_detected
    routing_hints:
      conditions:
        - condition: execution_complete
          next: evaluator
        - condition: plan_defect_detected
          next: planner
```

## 实现建议

### 1. 配置验证

添加配置验证逻辑，确保 atomic_capabilities 格式正确：

```python
def validate_capabilities(config):
    required_sections = ['execution', 'decision', 'feedback']
    for section in required_sections:
        if section not in config['atomic_capabilities']:
            raise ValueError(f"Missing {section} in atomic_capabilities")
```

### 2. 能力发现

实现能力发现机制，让 Orchestrator 动态发现可用 Agent：

```python
def discover_agents():
    agents = []
    for config_file in glob('agents/*.yaml'):
        config = load_yaml(config_file)
        agents.append({
            'name': config['name'],
            'capabilities': config['atomic_capabilities']
        })
    return agents
```

### 3. 动态路由

基于能力的路由决策：

```python
def route_next_agent(current_agent, output_signal, agents):
    # 获取当前 Agent 的路由提示
    hints = current_agent['capabilities']['decision']['routing_hints']
    
    # 匹配条件
    for condition in hints['conditions']:
        if condition['condition'] == output_signal:
            return condition['next']
    
    # 默认下一节点
    return hints.get('next_agents', [None])[0]
```

## 总结

Agent 原子能力模型将编排逻辑从 Orchestrator 中解耦，使每个 Agent 成为**自描述、自包含、可组合**的单元。这种设计支持：

- **动态发现** - 自动识别可用 Agent
- **动态编排** - 基于能力而非硬编码
- **动态扩展** - 新增 Agent 无需修改编排逻辑
- **动态适配** - Agent 可以声明多种路由条件
