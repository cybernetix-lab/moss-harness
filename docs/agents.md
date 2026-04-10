# Agent 配置指南

Agent 是 Harness 的执行实体，每个 Agent 都有特定的角色和能力。

当前推荐理解方式不是“一个角色 = 一个固定 Agent”，而是：

- **Role Lane**：稳定职责泳道，如 Planner、Reviewer、Executor
- **Backup Agent**：该泳道的通用兜底成员
- **Expert Agent**：围绕特定领域沉淀出的专家成员
- **Candidate Agent**：由成功经验提炼出的候选专家，待审批后晋升

泳道与成员注册以 `configs/orchestration/agent-registry.yaml` 为准；本页保留对典型 Agent 模板的说明。

## 什么是 Agent？

Agent 是配置化的 AI 助手，定义了：
- **角色** - 专注于特定任务（规划、审查、执行、评估、研究）
- **能力** - 可用的技能和工具
- **行为** - 系统提示词和工作流程
- **约束** - 权限和规则限制

## Agent 类型

### Planner（规划师）

专注于需求分析、任务拆解和方案设计。

```yaml
name: planner
type: planning
description: 规划 Agent

system_prompt: |
  你是 Planner，一名专业的技术规划师...

skills:
  - requirement-analysis
  - task-decomposition
  - architecture-design

tools:
  allowed:
    - filesystem_read
    - code_search
    - network_fetch_documentation
  blocked:
    - filesystem_write  # 规划阶段不编写代码
```

### Reviewer（计划审查员）

专注于审查 Planner 制定的执行计划，确保计划的可行性。

```yaml
name: reviewer
type: plan_review
description: 计划审查 Agent

system_prompt: |
  你是 Reviewer，一名专业的计划审查员...

skills:
  - requirement-analysis
  - task-decomposition-review
  - risk-assessment
  - effort-estimation-review

tools:
  allowed:
    - filesystem_read
    - code_search
    - network_fetch_documentation
  blocked:
    - filesystem_write  # 审查阶段不编写代码
```

### Executor（执行者）

专注于按照计划高质量地实现功能。

```yaml
name: executor
type: execution
description: 执行 Agent

system_prompt: |
  你是 Executor，一名专业的代码实现工程师...

skills:
  - typescript-patterns
  - react-hooks
  - test-driven-development

tools:
  allowed:
    - filesystem_read
    - filesystem_write
    - execution_run_tests
```

### Evaluator（评估员）

专注于客观评估实现质量，提供改进建议。

```yaml
name: evaluator
type: evaluation
description: 评估 Agent

system_prompt: |
  你是 Evaluator，一名专业的质量评估员...

skills:
  - requirement-validation
  - test-coverage-analysis
  - code-quality-check

tools:
  allowed:
    - filesystem_read
    - execution_run_tests
    - execution_run_linter
  blocked:
    - filesystem_write  # 评估阶段不修改代码
```

### Researcher（研究者）

专注于技术调研和方案比较。

```yaml
name: researcher
type: research
description: 研究分析 Agent

system_prompt: |
  你是 Researcher，一名技术研究员...

skills:
  - documentation-lookup
  - api-research
```

## 完整工作流程

推荐的工作流程包含 **Planner**、**Reviewer**、**Executor**、**Evaluator** 四个角色：

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Planner │───→│ Reviewer│───→│ Executor│───→│Evaluator│
│ (规划)  │    │(计划审查)│    │ (执行)  │    │ (评估)  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     ↑                                            │
     └────────────────────────────────────────────┘
              (需要修改时返回)
```

### 流程说明

1. **Planner** 制定执行计划
2. **Reviewer** 审查计划的可行性和完整性
3. **Executor** 按审查通过的计划执行
4. **Evaluator** 客观评估实现质量

这种分离的优势：
- **避免规划偏差** - Planner 专注规划，Reviewer 独立审查
- **避免执行偏差** - Executor 专注执行，按计划实现
- **避免评估偏差** - Evaluator 作为独立第三方客观评估

详见 [Agent 协作流程](./agent-collaboration.md)

## 创建新 Agent

### 1. 创建配置文件

```bash
cat > agents/my-agent.yaml << 'EOF'
name: my-agent
type: custom
description: |
  描述这个 Agent 的用途和能力

model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.3
  max_tokens: 4096

system_prompt: |
  你是 MyAgent...
  
  ## 核心职责
  1. 职责一
  2. 职责二
  
  ## 工作流程
  1. 步骤一
  2. 步骤二

skills:
  - skill-1
  - skill-2

constraints:
  override:
    soft-constraints.code_style.max_function_lines: 100

tools:
  allowed:
    - filesystem_read
    - filesystem_write
  blocked:
    - network_request

context:
  max_tokens: 8000
  priority:
    - TASK.md
    - CLAUDE.md

evaluation:
  auto_run: true
  on_error: pause
EOF
```

### 2. 配置说明

#### 模型配置

```yaml
model:
  provider: anthropic      # 提供商
  model: claude-3-5-sonnet # 模型名称
  temperature: 0.3         # 创造性 (0-1)
  max_tokens: 4096         # 最大 token 数
```

#### 系统提示词

```yaml
system_prompt: |
  定义 Agent 的角色、职责、工作流程
  使用 Markdown 格式
  包含具体的指令和约束
```

#### 技能配置

```yaml
skills:
  - typescript-patterns    # 激活的技能
  - react-hooks
  - security-scan
```

#### 工具权限

```yaml
tools:
  allowed:                 # 允许的工具
    - filesystem_read
    - filesystem_write
    - code_search
  blocked:                 # 禁止的工具
    - network_request
    - code_execution
```

#### 上下文管理

```yaml
context:
  max_tokens: 8000         # 最大上下文
  priority:                # 文件优先级
    - TASK.md
    - CLAUDE.md
    - DECISIONS.md
  retention:               # 保留的内容
    - goals
    - decisions
    - failures
```

## 使用 Agent

### 切换 Agent

```bash
# 设置环境变量
export MOSS_AGENT=executor

# 或在会话中切换
./scripts/agent-switch.sh evaluator
```

### 查看 Agent 列表

```bash
./scripts/agent-list.sh
```

## 最佳实践

### 1. 明确角色定位

```yaml
# ✅ 明确的角色
description: |
  专注于 React 组件开发的 Agent。
  擅长函数组件、Hooks、TypeScript。

# ❌ 模糊的角色
description: |
  一个全能的编程 Agent。
```

### 2. 限制工具权限

```yaml
tools:
  allowed:
    - filesystem_read
    - filesystem_write
  blocked:
    - network_request      # 不需要网络访问
    - code_execution       # 不需要执行代码
```

### 3. 配置适当的约束

```yaml
constraints:
  override:
    # 放宽某些约束
    soft-constraints.code_style.max_function_lines: 100
    
    # 加强某些约束
    soft-constraints.testing.coverage.minimum_percentage: 90
```

### 4. 提供清晰的指令

```yaml
system_prompt: |
  ## 工作流程
  1. 首先阅读 TASK.md 了解目标
  2. 分析现有代码结构
  3. 提出实现方案
  4. 编写代码
  5. 运行测试验证
  
  ## 编码规范
  - 使用 TypeScript 严格类型
  - 函数不超过 50 行
  - 添加 JSDoc 注释
```

## 高级配置

### 多模型路由

```yaml
model_routing:
  default: claude-3-5-sonnet
  tasks:
    - pattern: "复杂架构设计"
      model: claude-3-opus
    - pattern: "简单修改"
      model: claude-3-haiku
```

### 动态技能加载

```yaml
dynamic_skills:
  based_on:
    - file_types
    - project_structure
    - task_description
```

### 自定义验证

```yaml
evaluation:
  custom_validators:
    - name: custom-check
      command: ./scripts/custom-validator.sh
      on_failure: warn
```

## 示例：完整 Agent 配置

```yaml
name: frontend-architect
type: coding
description: |
  前端架构师 Agent。
  专注于大型前端应用的架构设计、组件库建设、性能优化。

model:
  provider: anthropic
  model: claude-3-opus
  temperature: 0.2
  max_tokens: 8192

system_prompt: |
  你是 FrontendArchitect，一名经验丰富的前端架构师。
  
  ## 专业领域
  - React/Vue/Angular 架构设计
  - 组件库和 Design System
  - 性能优化和工程化
  - 微前端和模块化
  
  ## 工作流程
  1. **需求分析** - 理解业务需求和技术约束
  2. **架构设计** - 提出可扩展的架构方案
  3. **技术选型** - 选择合适的技术栈
  4. **规范制定** - 定义代码规范和最佳实践
  5. **原型实现** - 创建核心模块的原型
  6. **文档编写** - 编写架构文档和开发指南
  
  ## 设计原则
  - 关注点分离
  - 单一职责
  - 开闭原则
  - 可测试性
  
  ## 输出要求
  - 提供架构图和说明
  - 定义模块接口
  - 编写示例代码
  - 列出风险和缓解方案

skills:
  - typescript-patterns
  - react-hooks
  - performance-optimization
  - testing-strategies

constraints:
  override:
    soft-constraints.architecture.principles:
      - single_responsibility
      - dependency_inversion
      - interface_segregation

tools:
  allowed:
    - filesystem_read
    - filesystem_write
    - code_search
    - execution_run_tests
    - network_fetch_documentation

context:
  max_tokens: 12000
  priority:
    - TASK.md
    - docs/ARCHITECTURE.md
    - CLAUDE.md
  retention:
    - goals
    - decisions
    - architecture_patterns
    - performance_metrics

evaluation:
  auto_run: true
  on_error: pause
  checkpoints:
    - after_architecture_design
    - after_prototype

output:
  format: structured
  sections:
    - architecture_overview
    - module_design
    - technology_stack
    - coding_standards
    - example_code
    - risk_assessment
    - next_steps
```

## 参考

- [Planner Agent](../agents/planner.yaml) - 规划 Agent
- [Reviewer Agent](../agents/reviewer.yaml) - 计划审查 Agent
- [Executor Agent](../agents/executor.yaml) - 执行 Agent
- [Evaluator Agent](../agents/evaluator.yaml) - 评估 Agent
- [Researcher Agent](../agents/researcher.yaml) - 研究 Agent
- [Agent 协作流程](./agent-collaboration.md) - 完整协作流程说明
