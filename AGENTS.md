# Agent 配置指南

本文档详细说明项目中所有 Agent 的配置、职责和使用方法。

## Agent 概述

本项目采用**四角色分离架构**，通过职责分离避免自评乐观偏差：

| Agent | 职责 | 核心能力 | 工具权限 |
|-------|------|----------|----------|
| **Planner** | 规划 | 需求分析、任务分解、方案设计 | 只读 |
| **Reviewer** | 计划审查 | 风险识别、方案评估、改进建议 | 只读 |
| **Executor** | 执行 | 代码实现、测试编写、自测验证 | 读写+执行 |
| **Evaluator** | 评估 | 质量评估、需求验证、结论输出 | 只读+测试 |

## 工作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        任务开始                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 规划 (Planner)                                        │
│  ├─ 分析需求                                                     │
│  ├─ 拆解任务                                                     │
│  ├─ 设计方案                                                     │
│  └─ 输出执行计划                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 执行计划
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: 计划审查 (Reviewer)                                   │
│  ├─ 审查需求理解                                                 │
│  ├─ 检查任务分解                                                 │
│  ├─ 评估技术方案                                                 │
│  └─ 给出审查结论                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 审查通过
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 执行 (Executor)                                       │
│  ├─ 理解任务                                                     │
│  ├─ 编写实现                                                     │
│  ├─ 编写测试                                                     │
│  └─ 自测验证                                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 实现结果
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: 评估 (Evaluator)                                      │
│  ├─ 验证需求                                                     │
│  ├─ 检查测试                                                     │
│  ├─ 代码审查                                                     │
│  └─ 给出结论                                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐
│  EXCELLENT/PASS     │    │  NEEDS_IMPROVEMENT  │
│  任务完成           │    │  返回改进           │
└─────────────────────┘    └─────────────────────┘
```

## Agent 详细说明

### 1. Planner（规划师）

**配置文件**: [`agents/planner.yaml`](agents/planner.yaml)

**类型**: `planning`

**职责**:
- 需求分析和理解
- 任务拆解和排序
- 技术方案设计
- 风险评估和工时估算
- 输出执行计划

**核心能力**:
- requirement-analysis
- task-decomposition
- architecture-design
- risk-assessment
- effort-estimation

**模型配置**:
```yaml
model:
  provider: anthropic
  model: claude-3-opus
  temperature: 0.3
  max_tokens: 8192
```

**工具权限**:
- ✅ filesystem_read
- ✅ code_search
- ✅ memory_search
- ✅ network_fetch_documentation
- ✅ network_search
- ❌ filesystem_write
- ❌ execution_run_tests
- ❌ execution_run_linter
- ❌ execution_run_command

**输出格式**:
```yaml
execution_plan:
  summary: "实现用户认证系统"
  tasks:
    - id: 1
      description: "设计数据库用户表结构"
      acceptance_criteria:
        - "包含 id, username, password_hash 字段"
      estimated_hours: 2
      risk: low
  risks:
    - "密码加密性能可能影响响应时间"
```

**使用场景**:
```bash
# 启动 Planner 模式
export AHARNESS_AGENT=planner

# 或使用脚本
./scripts/agent-start.sh planner
```

---

### 2. Reviewer（计划审查员）

**配置文件**: [`agents/reviewer.yaml`](agents/reviewer.yaml)

**类型**: `plan_review`

**职责**:
- 审查 Planner 制定的执行计划
- 识别计划中的风险、遗漏和不合理之处
- 评估技术方案的可行性
- 验证任务分解的合理性
- 确保计划的可执行性

**核心能力**:
- requirement-analysis
- task-decomposition-review
- risk-assessment
- effort-estimation-review
- architecture-review

**模型配置**:
```yaml
model:
  provider: anthropic
  model: claude-3-opus
  temperature: 0.3
  max_tokens: 8192
```

**工具权限**:
- ✅ filesystem_read
- ✅ code_search
- ✅ memory_search
- ✅ network_fetch_documentation
- ✅ network_search
- ❌ filesystem_write
- ❌ execution_run_tests
- ❌ execution_run_linter
- ❌ execution_run_command

**审查结论**:

| 结论 | 条件 |
|------|------|
| **APPROVED** | 计划完整、可行，可以进入执行阶段 |
| **APPROVED_WITH_SUGGESTIONS** | 计划可行，但有小问题建议改进 |
| **NEEDS_REVISION** | 计划有重大缺陷，需要 Planner 重新规划 |

**审查维度**:
- 需求理解 - 是否遗漏显性或隐性需求
- 任务分解 - 任务粒度是否合适
- 技术方案 - 技术选型是否合理
- 风险评估 - 是否遗漏重要风险
- 工时估算 - 估算是否合理
- 验收标准 - 验收标准是否明确

**使用场景**:
```bash
# 在 Planner 输出计划后，切换到 Reviewer 审查
export AHARNESS_AGENT=reviewer

# 审查完成后，根据结论决定下一步
# - APPROVED: 进入执行阶段
# - NEEDS_REVISION: 返回 Planner 重新规划
```

---

### 3. Executor（执行者）

**配置文件**: [`agents/executor.yaml`](agents/executor.yaml)

**类型**: `execution`

**职责**:
- 按照计划实现功能
- 编写高质量代码
- 编写单元测试
- 自测验证

**核心能力**:
- code-implementation
- test-writing
- debugging
- refactoring

**模型配置**:
```yaml
model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.2
  max_tokens: 4096
```

**工具权限**:
- ✅ filesystem_read
- ✅ filesystem_write
- ✅ code_search
- ✅ execution_run_tests
- ✅ execution_run_linter
- ✅ execution_run_command

**输出格式**:
```yaml
execution_report:
  task_id: 2
  status: completed
  code_changes:
    - file: "src/auth/register.ts"
      lines_added: 45
      description: "实现用户注册逻辑"
  test_results:
    total: 8
    passed: 8
    failed: 0
    coverage: 94%
```

**问题升级**:
如果 Executor 发现以下情况，必须停止并反馈：
- 计划有重大缺陷
- 任务依赖无法满足
- 技术方案不可行
- 预计工时严重超出估算

**使用场景**:
```bash
# 在 Reviewer 审查通过后，切换到 Executor 执行
export AHARNESS_AGENT=executor

# 或使用脚本
./scripts/agent-start.sh executor
```

---

### 4. Evaluator（评估员）

**配置文件**: [`agents/evaluator.yaml`](agents/evaluator.yaml)

**类型**: `evaluation`

**职责**:
- 独立评估实现质量
- 检查需求满足度
- 评估测试覆盖
- 给出评估结论和改进建议

**核心能力**:
- requirement-verification
- test-assessment
- code-quality-review
- objective-assessment

**模型配置**:
```yaml
model:
  provider: anthropic
  model: claude-3-opus
  temperature: 0.2
  max_tokens: 4096
```

**工具权限**:
- ✅ filesystem_read
- ✅ code_search
- ✅ execution_run_tests
- ✅ execution_run_linter
- ❌ filesystem_write
- ❌ execution_run_command

**评估结论**:

| 结论 | 条件 |
|------|------|
| **EXCELLENT** | 所有需求实现 + 测试通过 + 代码质量高 + 无 Critical/Warning |
| **PASS** | 所有需求实现 + 测试通过 + 代码符合规范 + 无 Critical |
| **PASS_WITH_WARNINGS** | 核心功能实现 + 测试通过 + 有小缺陷 |
| **NEEDS_IMPROVEMENT** | 有需求未实现 或 测试失败 或 有 Critical/Warning 问题 |

**输出格式**:
```yaml
evaluation_report:
  verdict: PASS
  requirements_check:
    - requirement: "POST /api/auth/register 端点"
      status: implemented
      evidence: "src/auth/register.ts:15"
  test_validation:
    total_tests: 8
    passed: 8
    coverage: 94%
  issues_found:
    critical: []
    warnings: []
    suggestions:
      - "建议添加 rate limiting"
```

**使用场景**:
```bash
# 在 Executor 提交实现后，切换到 Evaluator 评估
export AHARNESS_AGENT=evaluator

# 根据评估结论决定下一步
# - PASS/EXCELLENT: 任务完成
# - NEEDS_IMPROVEMENT: 返回 Executor 修复或 Planner 重新规划
```

---

### 5. Researcher（研究员）

**配置文件**: [`agents/researcher.yaml`](agents/researcher.yaml)

**类型**: `research`

**职责**:
- 技术调研和分析
- 文档查找和整理
- 最佳实践研究
- 方案对比评估

**核心能力**:
- technology-research
- documentation-lookup
- best-practice-analysis
- solution-comparison

**模型配置**:
```yaml
model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.3
  max_tokens: 4096
```

**工具权限**:
- ✅ filesystem_read
- ✅ code_search
- ✅ network_search
- ✅ network_fetch_documentation
- ❌ filesystem_write
- ❌ execution_run_tests

**使用场景**:
```bash
# 在需要技术调研时使用
export AHARNESS_AGENT=researcher

# 例如：调研新的技术方案
# "研究一下目前主流的认证方案，对比 JWT 和 Session 的优缺点"
```

## Agent 切换

### 命令行切换

```bash
# 查看可用 Agent
./scripts/agent-list.sh

# 启动特定 Agent
./scripts/agent-start.sh planner

# 或使用环境变量
export AHARNESS_AGENT=planner
```

### 会话中切换

在一个完整的任务流程中，Agent 会按以下顺序切换：

```
用户提交需求
    ↓
Planner 分析并制定计划
    ↓
Reviewer 审查计划
    ↓ (APPROVED)
Executor 执行实现
    ↓
Evaluator 评估质量
    ↓
┌──────────┴──────────┐
│                     │
PASS/EXCELLENT    NEEDS_IMPROVEMENT
│                     │
任务完成          返回 Executor 修复
                  或返回 Planner 重新规划
```

## Agent 评估与进化

### 评估机制

每个 Agent 都有独立的评估机制：

```bash
# 评估单个 Agent
./scripts/agent-eval.sh run planner

# 评估所有 Agent
./scripts/agent-eval.sh run-all

# 查看评估报告
./scripts/agent-eval.sh report planner
```

### 进化机制

Agent 配置会根据评估结果自动优化：

```bash
# 分析 Agent 性能
./scripts/agent-evolve.sh analyze planner

# 模拟进化
./scripts/agent-evolve.sh dry-run planner

# 执行进化
./scripts/agent-evolve.sh evolve planner

# 查看进化历史
./scripts/agent-evolve.sh status planner
```

### 进化策略

| 策略 | 触发条件 | 优化内容 |
|------|----------|----------|
| **Prompt 优化** | 成功率 < 80% | 增强 system_prompt 的指导性 |
| **工具权限调整** | 约束遵守度 < 90% | 调整 allowed/blocked 工具 |
| **模型参数调优** | 质量评分 < 75% | 调整 temperature、max_tokens |
| **上下文优化** | 执行时间 > 300s | 优化 context 配置 |

## 工具权限对比

| 工具 | Planner | Reviewer | Executor | Evaluator | Researcher |
|------|---------|----------|----------|-----------|------------|
| filesystem_read | ✅ | ✅ | ✅ | ✅ | ✅ |
| filesystem_write | ❌ | ❌ | ✅ | ❌ | ❌ |
| code_search | ✅ | ✅ | ✅ | ✅ | ✅ |
| execution_run_tests | ❌ | ❌ | ✅ | ✅ | ❌ |
| execution_run_linter | ❌ | ❌ | ✅ | ✅ | ❌ |
| execution_run_command | ❌ | ❌ | ✅ | ❌ | ❌ |
| network_search | ✅ | ✅ | ❌ | ❌ | ✅ |
| network_fetch_documentation | ✅ | ✅ | ❌ | ❌ | ✅ |

## 最佳实践

### 1. 按阶段使用正确的 Agent

- **需求分析阶段** → 使用 Planner
- **计划审查阶段** → 使用 Reviewer
- **代码实现阶段** → 使用 Executor
- **质量评估阶段** → 使用 Evaluator
- **技术调研阶段** → 使用 Researcher

### 2. 遵循工作流顺序

不要跳过 Reviewer 直接让 Executor 执行，也不要让 Planner 直接评估自己的计划。

### 3. 及时反馈问题

- Executor 发现计划问题 → 立即反馈给 Planner
- Evaluator 发现问题 → 明确分类并给出改进建议
- Reviewer 发现风险 → 详细说明并提供替代方案

### 4. 保持配置同步

当 Agent 进化后，确保所有团队成员使用最新的配置：

```bash
# 提交进化后的配置
git add agents/
git commit -m "chore: evolve planner agent - improve prompt clarity"

# 其他成员拉取更新
git pull
```

### 5. 监控 Agent 性能

定期运行评估，监控 Agent 性能趋势：

```bash
# 添加到 CI/CD 或定时任务
./scripts/agent-eval.sh run-all
./scripts/agent-evolve.sh list
```

## 故障排除

### Agent 无法启动

```bash
# 检查配置文件是否存在
ls -la agents/${AHARNESS_AGENT}.yaml

# 验证配置格式
yq eval agents/${AHARNESS_AGENT}.yaml > /dev/null && echo "配置有效"

# 查看详细错误
./scripts/agent-start.sh ${AHARNESS_AGENT} --verbose
```

### Agent 表现异常

```bash
# 检查最近的评估结果
./scripts/agent-eval.sh status ${AHARNESS_AGENT}

# 查看进化历史
./scripts/agent-evolve.sh status ${AHARNESS_AGENT}

# 回滚到上一版本
./scripts/agent-evolve.sh rollback ${AHARNESS_AGENT}
```

### 工具权限问题

```bash
# 检查当前 Agent 的工具权限
cat agents/${AHARNESS_AGENT}.yaml | yq '.tools'

# 确认约束配置
cat constraints/tools-policy.yaml
```

## 参考文档

- [Agent 协作流程](docs/agent-collaboration.md) - 详细的协作流程说明
- [Agent 评估与进化](docs/agent-evolution.md) - 评估和进化机制
- [Agent 配置目录](agents/) - 所有 Agent 配置文件
- [评估用例](evals/agents/) - Agent 评估用例
