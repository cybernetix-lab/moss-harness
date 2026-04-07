# Agent 评估与进化

本文档描述 Agent 的评估和进化机制，通过持续监控 Agent 性能并自动优化配置，确保 Agent 始终保持最佳表现。

## 概述

与 Skill 进化类似，Agent 也需要持续的评估和优化。Agent 进化机制通过以下闭环实现持续改进：

```
Agent 执行 → 性能监控 → 评估分析 → 进化优化 → Agent 更新
     ↑                                              ↓
     └──────────────── 持续循环 ←───────────────────┘
```

## 为什么需要 Agent 进化？

### 1. 配置漂移

随着项目演进，Agent 的初始配置可能不再适用：
- **Prompt 过时** - system_prompt 中的指导可能不再符合当前最佳实践
- **工具权限不当** - 权限配置可能过于宽松或严格
- **模型参数不适** - temperature、max_tokens 等参数可能需要调整

### 2. 性能衰减

长期使用后，Agent 可能出现性能衰减：
- **成功率下降** - 任务失败率逐渐升高
- **质量波动** - 输出质量不稳定
- **效率降低** - 执行时间变长

### 3. 环境变化

外部环境变化需要 Agent 适应：
- **技术栈更新** - 项目技术栈可能发生变化
- **约束调整** - 编码规范、流程可能更新
- **需求变化** - 业务需求复杂度可能改变

## 架构设计

### 组件关系

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Evolution System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Agent Eval  │───→│  Analysis    │───→│  Evolution   │      │
│  │  评估执行器   │    │  性能分析     │    │  进化引擎     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              Memory (agent-eval-results)              │     │
│  │         评估结果 / 进化历史 / 配置备份                │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 与 Skill 进化的关系

```
┌─────────────────┐     ┌─────────────────┐
│   Skill Eval    │     │   Agent Eval    │
│   技能评估       │     │   Agent 评估     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────┐
│         Unified Analysis            │
│         统一性能分析                 │
│  - Skill 性能影响 Agent 评分        │
│  - Agent 配置影响 Skill 表现        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Coordinated Evolution            │
│    协同进化                          │
│  - Agent 进化触发 Skill 更新        │
│  - Skill 进化反馈到 Agent 配置      │
└─────────────────────────────────────┘
```

## 评估维度

### 核心指标

| 指标 | 说明 | 权重 | 目标值 |
|------|------|------|--------|
| **成功率** | 任务成功完成的比例 | 40% | ≥ 70% |
| **质量评分** | 输出质量的平均评分 | 40% | ≥ 75% |
| **约束遵守度** | 遵守配置约束的比例 | 20% | ≥ 90% |

### 详细指标

#### 1. 任务执行指标

```yaml
metrics:
  total_tasks: 100          # 总任务数
  successful_tasks: 85      # 成功任务数
  failed_tasks: 15          # 失败任务数
  success_rate: 85.0        # 成功率 (%)
  
  avg_duration: 180         # 平均执行时间 (秒)
  min_duration: 30          # 最短执行时间
  max_duration: 600         # 最长执行时间
```

#### 2. 质量评估指标

```yaml
metrics:
  avg_quality_score: 82.5   # 平均质量评分
  
  # Evaluator 评估结果分布
  verdict_distribution:
    EXCELLENT: 10
    PASS: 60
    PASS_WITH_WARNINGS: 20
    NEEDS_IMPROVEMENT: 10
```

#### 3. 工具使用指标

```yaml
metrics:
  avg_tool_calls: 12        # 平均工具调用次数
  tool_efficiency: 0.85     # 工具使用效率
  
  # 工具使用分布
  tool_usage:
    filesystem_read: 45%
    filesystem_write: 20%
    code_search: 15%
    execution_run_tests: 20%
```

#### 4. 约束遵守指标

```yaml
metrics:
  constraint_compliance: 92.5  # 约束遵守度 (%)
  constraint_violations: 5     # 约束违反次数
  
  # 违反类型分布
  violation_types:
    max_function_lines: 3
    code_style: 2
```

## 进化策略

### 1. Prompt 优化

**触发条件**: 成功率 < 80%

**优化方向**:
- 添加更详细的步骤说明
- 强化约束提醒
- 增加示例和最佳实践
- 明确禁止事项

**示例**:
```yaml
# 优化前
system_prompt: |
  你是 Planner，负责制定执行计划。

# 优化后
system_prompt: |
  你是 Planner，一名专业的技术规划师。
  
  ## 核心职责
  1. 需求分析和理解
  2. 任务拆解和排序
  3. 技术方案设计
  
  ## 重要原则
  - **只规划，不执行** - 你的职责是制定计划，不是写代码
  - **保持客观** - 不要过度乐观，合理评估难度和风险
  - **可验证性** - 每个任务都应有明确的完成标准
  
  ## 禁止事项
  - ❌ 不要编写具体代码
  - ❌ 不要过度承诺或低估难度
  - ❌ 不要忽略边界情况和错误处理
```

### 2. 工具权限调整

**触发条件**: 约束遵守度 < 90%

**调整方向**:
- 重新评估 allowed/blocked 工具
- 添加或移除特定工具权限
- 调整工具使用指导

**示例**:
```yaml
# 调整前
tools:
  allowed:
    - filesystem_read
    - filesystem_write
    - execution_run_tests

# 调整后
tools:
  allowed:
    - filesystem_read
    - code_search
  blocked:
    - filesystem_write    # 规划阶段不需要写文件
    - execution_run_tests # 规划阶段不需要运行测试
```

### 3. 模型参数调优

**触发条件**: 质量评分 < 75%

**调整方向**:
- 降低 temperature 以提高稳定性
- 调整 max_tokens 以优化成本
- 考虑更换模型版本

**示例**:
```yaml
# 调整前
model:
  temperature: 0.7
  max_tokens: 8192

# 调整后
model:
  temperature: 0.5    # 降低随机性
  max_tokens: 7168    # 优化成本
```

### 4. 上下文优化

**触发条件**: 平均执行时间 > 300 秒

**优化方向**:
- 减少 max_tokens
- 优化 context retention 策略
- 调整 priority 配置

**示例**:
```yaml
# 优化前
context:
  max_tokens: 8000
  retention:
    - goals
    - constraints
    - decisions
    - failures
    - todo

# 优化后
context:
  max_tokens: 6144    # 减少 token 使用
  retention:
    - goals
    - constraints
    # 移除不常用的 retention 项
```

## 使用指南

### 评估 Agent

```bash
# 评估单个 Agent
./scripts/agent-eval.sh run planner

# 评估所有 Agent
./scripts/agent-eval.sh run-all

# 查看评估状态
./scripts/agent-eval.sh status executor

# 生成评估报告
./scripts/agent-eval.sh report reviewer --format json

# 对比两个 Agent
./scripts/agent-eval.sh compare planner executor

# 查看评估历史
./scripts/agent-eval.sh history planner
```

### 进化 Agent

```bash
# 分析 Agent 性能
./scripts/agent-evolve.sh analyze planner

# 模拟进化（dry-run）
./scripts/agent-evolve.sh dry-run planner --verbose

# 执行进化
./scripts/agent-evolve.sh evolve planner

# 强制进化（忽略阈值）
./scripts/agent-evolve.sh evolve planner --force

# 查看进化状态
./scripts/agent-evolve.sh status executor

# 列出可进化的 Agent
./scripts/agent-evolve.sh list

# 查看所有提案
./scripts/agent-evolve.sh proposals

# 应用指定提案
./scripts/agent-evolve.sh apply prop-20240101-abc123

# 回滚到上一版本
./scripts/agent-evolve.sh rollback planner
```

### 配置进化参数

编辑 `config/agent-evolution.yaml`:

```yaml
# 调整阈值
thresholds:
  min_success_rate: 75        # 提高成功率要求
  min_quality_score: 80       # 提高质量要求
  max_evolution_frequency: 5d # 缩短进化间隔

# 调整权重
weights:
  success_rate: 0.5           # 提高成功率权重
  quality_score: 0.3
  constraint_compliance: 0.2

# 启用/禁用策略
strategies:
  prompt_optimization:
    enabled: true
  tool_adjustment:
    enabled: false            # 禁用工具调整
```

## 评估用例

### 用例结构

评估用例位于 `evals/agents/` 目录，每个 Agent 类型有独立的评估用例：

```
evals/agents/
├── planner-task-decomposition.yaml    # Planner 任务分解评估
├── executor-code-quality.yaml         # Executor 代码质量评估
├── reviewer-plan-review.yaml          # Reviewer 计划审查评估
└── evaluator-assessment.yaml          # Evaluator 质量评估评估
```

### 用例示例

```yaml
# evals/agents/planner-task-decomposition.yaml
name: planner-task-decomposition
description: 评估 Planner 的任务分解能力

test_cases:
  - id: TC-001
    name: 简单功能实现
    input:
      requirements: |
        实现一个用户注册功能...
    expected_output:
      task_count_range: [3, 5]
      max_task_hours: 4
    evaluation_criteria:
      - 任务分解粒度合理
      - 依赖关系清晰

scoring:
  weights:
    task_granularity: 0.3
    dependency_clarity: 0.2
  thresholds:
    pass: 75
    excellent: 90
```

## 进化流程

### 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                         开始进化                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 评估分析                                               │
│  ├─ 加载最新评估结果                                            │
│  ├─ 计算性能指标                                                │
│  └─ 识别需要改进的方面                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐
│  性能良好           │    │  需要改进           │
│  (无需进化)         │    │  (继续进化)         │
└─────────────────────┘    └─────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 生成提案                                               │
│  ├─ 分析性能瓶颈                                                │
│  ├─ 确定进化策略                                                │
│  ├─ 生成具体变更                                                │
│  └─ 创建进化提案文件                                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: 备份配置                                               │
│  └─ 备份当前 Agent 配置到 memory/agent-backups/                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: 应用变更                                               │
│  ├─ 应用模型参数调整（自动）                                    │
│  ├─ 应用上下文优化（自动）                                      │
│  ├─ Prompt 优化（需人工审查）                                   │
│  └─ 工具权限调整（需人工审查）                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: 验证                                                   │
│  ├─ 配置格式检查                                                │
│  ├─ 参数范围验证                                                │
│  └─ 更新提案状态                                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: 监控                                                   │
│  ├─ 记录进化历史                                                │
│  ├─ 跟踪性能变化                                                │
│  └─ 等待下次评估                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 人工审查流程

某些变更需要人工审查：

```
┌─────────────────┐
│  生成提案        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  需要人工审查?   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│ 是    │ │ 否        │
│       │ │           │
│ Prompt│ │ 自动应用   │
│ 工具   │ │           │
└───┬───┘ └─────┬─────┘
    │           │
    ▼           │
┌───────────────────┐
│ 人工审查提案      │
│ $0 proposals      │
│ $0 apply <id>     │
└───────────────────┘
```

## 最佳实践

### 1. 定期评估

建议每周运行一次全面评估：

```bash
# 添加到 crontab
0 9 * * 1 cd /path/to/project && ./scripts/agent-eval.sh run-all
```

### 2. 渐进式进化

- 不要一次性应用所有变更
- 优先应用自动变更（模型参数、上下文）
- 仔细审查 Prompt 和工具权限变更
- 每次进化后观察一段时间再决定下次进化

### 3. 保留备份

进化前会自动备份，但建议：
- 定期清理旧备份（保留最近 10 个）
- 重要变更前手动备份
- 记录每次进化的原因和效果

### 4. 与 Skill 进化协同

```bash
# 1. 先评估 Skill
./scripts/skill-eval.sh run-all

# 2. 再评估 Agent
./scripts/agent-eval.sh run-all

# 3. 分析关联性
# - Skill 失败是否因为 Agent 配置问题？
# - Agent 性能是否受 Skill 质量影响？

# 4. 协同进化
./scripts/skill-evolve.sh evolve <skill>
./scripts/agent-evolve.sh evolve <agent>
```

### 5. 监控进化效果

```bash
# 对比进化前后的性能
./scripts/agent-eval.sh history planner

# 查看进化趋势
cat memory/agent-evolution/prop-*.json | jq -s '
  group_by(.agent_name) |
  map({
    agent: .[0].agent_name,
    evolutions: length,
    avg_score: (map(.overall_score) | add / length)
  })
'
```

## 故障排除

### 评估失败

```bash
# 检查评估数据是否存在
ls -la memory/agent-eval-results/

# 检查 Agent 配置是否有效
./scripts/agent-eval.sh status <agent_name>

# 重新运行评估
./scripts/agent-eval.sh run <agent_name> --verbose
```

### 进化失败

```bash
# 查看进化提案
./scripts/agent-evolve.sh proposals

# 检查提案详情
cat memory/agent-evolution/prop-<id>.json | jq .

# 回滚到上一版本
./scripts/agent-evolve.sh rollback <agent_name>
```

### 配置损坏

```bash
# 从备份恢复
latest_backup=$(ls -t memory/agent-backups/<agent_name>-*.yaml | head -1)
cp "$latest_backup" agents/<agent_name>.yaml

# 验证配置
yq eval agents/<agent_name>.yaml > /dev/null && echo "配置有效"
```

## 相关文档

- [Agent 协作流程](agent-collaboration.md) - 了解 Agent 的工作流程
- [Skill 进化](skill-evolution.md) - Skill 的评估和进化机制
- [评估框架](evaluation-framework.md) - 整体评估框架设计
- [配置说明](../config/agent-evolution.yaml) - 进化引擎配置详情
