# Agent 配置指南

本文档详细说明项目中所有 Agent 的配置、职责和使用方法。

## Agent 概述与自组织架构

本项目采用**六角色多 Agent 架构**，基于系统论、控制论和信息论设计，通过职责分离避免自评乐观偏差，同时维持高信噪比。

**架构演进**：当前的六个角色（Coordinator, Planner, Reviewer, Executor, Evaluator, Memory Curator）在系统设计中作为**角色分类（Role Categories/Lanes）**。针对不同场景的任务，每一角色下会不断沉淀出对应的**专家 Agent（Expert Agents）**，而基础的角色 Agent 则作为通用的 **Backup（兜底）** 存在。这体现了 Agent 系统的自组织和涌现能力。

**当前建模约定**：
- 六角色是**职责泳道**，不是六个固定实例。
- `configs/orchestration/agent-registry.yaml` 中的 `lanes` 只描述每条泳道的输入、输出、认领策略和选择规则。
- `members` 是 Team Roster，也是成员唯一真相源，描述 Backup、Expert、Candidate 三类成员。
- `lanes.member_source` 用于声明某条泳道应从哪一组成员中选择执行者。
- `agents` 保留为向后兼容模板视图，便于旧脚本或旧文档继续读取基础配置。

| 角色分类 (Role) | 职责 | 核心能力 | 工具权限 | Backup Agent | 专家 Agent 示例 |
|-------|------|----------|----------|--------------|----------------|
| **Coordinator** | 协调 | 意图识别、需求澄清、任务分发 | 只读 | `coordinator` | `api_coordinator` |
| **Planner** | 规划 | 需求分析、任务分解、方案设计 | 只读 | `planner` | `db_planner` |
| **Reviewer** | 计划审查 | 风险识别、方案评估、改进建议 | 只读 | `reviewer` | `sec_reviewer` |
| **Executor** | 执行 | 代码实现、测试编写、自测验证 | 读写+执行 | `executor` | `frontend_executor` |
| **Evaluator** | 评估 | 质量评估、需求验证、结论输出 | 只读+测试 | `evaluator` | `perf_evaluator` |
| **Memory Curator**| 记忆策展 | 上下文压缩、信息归档、信噪比控制 | 只读+执行 | `memory_curator` | `doc_curator` |

## 团队协作与自组织机制

基于系统进化，团队引入了以下三大核心机制，使得 Agent 团队能够真正地“自主运转”：

### 1. 团队名册与持久化队友 (Team Roster & Teammates)
- **持久化身份**：Agent 不再是调用完即销毁的临时对象（Subagent），而是长驻的、有明确身份和生命周期的队友（Teammate）。
- **名册与邮箱**：系统维护一份**团队名册（Team Roster）**。每个 Agent 都有自己独立的**邮箱（Inbox）**和**独立循环（Independent Loop）**，能够反复接手任务并保持上下文隔离。

### 2. 结构化团队协议 (Team Protocols)
- **协议消息**：团队协作不仅依靠自然语言，还引入了**结构化协议（ProtocolEnvelope）**。
- **请求与响应**：如“计划审批（plan_approval）”或“优雅关机（shutdown）”等关键协作，必须带有唯一的 `request_id`，并被记录在请求追踪表中（RequestRecord）。
- **状态机**：每个请求都具备明确的流转状态（如 pending / approved / rejected），确保多 Agent 协作时的过程可检查、状态可恢复。

### 3. 自主认领与执行 (Autonomous Claiming)
- **自主找活**：Agent 并非总是等待主控者点名分配任务。处于空闲（IDLE）状态的 Agent 会在每轮循环中先检查个人邮箱，随后**带着角色过滤条件**扫描公共任务板（Task Board）。
- **专家优先**：当任务板出现新任务时，带有对应领域标签的专家 Agent（如 `frontend_executor`）会优先触发认领（claim_task）。
- **原子化认领与兜底**：认领动作是原子的，且会被记录到事件日志（Claim Event Log）中。若任务长时间无专家认领，则由通用的 Backup Agent（如 `executor`）兜底认领。在认领后，Agent 会重新注入身份提示，带着明确的目标恢复工作（WORK）。

### 4. 候选专家沉淀与晋升 (Candidate Emergence)
- **模式提取**：Memory Curator 会从高质量成功任务中提取稳定的 prompt、toolchain、领域标签和交付模式。
- **候选生成**：当某类模式连续多次在同一泳道下成功复现时，系统会将其记录为 Candidate Expert，而不是立刻覆盖现有 Backup。
- **双重审查**：Candidate 需要经过 Reviewer 与 Evaluator 的结构化审批后，才能晋升为正式 Expert Agent。
- **渐进演化**：本阶段先在注册表和协议层沉淀这些元数据，后续再把自动晋升和真实 claim loop 接到运行时。

## 工作流程 (基于任务板与协议的异步流转)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          用户提交意图                                  │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 0: 协调 (Coordinator Role)                                      │
│  ├─ 专家或 Backup Coordinator 自主扫描并认领意图处理任务                     │
│  ├─ 澄清模糊需求并输出结构化需求至 Task Board                               │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ 发布 Requirement Task
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 1: 规划 (Planner Role)                                          │
│  ├─ 专家 Planner (如 db_planner) 或 Backup Planner 自主认领需求任务         │
│  ├─ 设计方案并输出执行计划 (Execution Plan) 至 Task Board                   │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ 发起 plan_approval 请求 (Protocol)
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 2: 计划审查 (Reviewer Role)                                     │
│  ├─ 专家 Reviewer 或 Backup Reviewer 从邮箱收到 plan_approval 请求         │
│  ├─ 结构化响应: APPROVED / APPROVED_WITH_SUGGESTIONS / NEEDS_REVISION     │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ 审查通过，发布 Execution Tasks
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 3: 执行 (Executor Role)                                         │
│  ├─ IDLE 状态的专家 Executor (如 frontend_executor) 扫描并认领对应领域的 Task │
│  ├─ (若无专家认领) Backup Executor 兜底认领                                │
│  ├─ 执行代码实现与自测验证                                                  │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ 提交实现结果，发布 Evaluation Task
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 4: 评估 (Evaluator Role)                                        │
│  ├─ 专家/Backup Evaluator 认领评估任务                                     │
│  ├─ 输出评估结论: EXCELLENT / PASS / NEEDS_IMPROVEMENT                     │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│  EXCELLENT/PASS         │    │  NEEDS_IMPROVEMENT      │
│  发布 Memory Task         │    │  返回 Executor 重新处理   │
└─────────────────────────┘    └─────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 5: 知识沉淀 (Memory Curator Role)                               │
│  ├─ 专家/Backup Memory Curator 认领沉淀任务                                │
│  ├─ 提取关键知识、归档成功模式、识别候选专家                                  │
│  ├─ 发起 memory_archive / member_promotion 协议请求                           │
│  └─ 发起 shutdown 请求 (Protocol) 结束协作流程                               │
└────────────────────────────────────────────────────────────────────────┘
```

## 配置落点

- **泳道与成员注册**：`configs/orchestration/agent-registry.yaml`
- **邮箱与协议规范**：`configs/protocols/mailbox-protocol.yaml`
- **Agent 模板配置**：`configs/agents/*.yaml`
- **自组织/协作文档**：`docs/agent-collaboration.md`
- **专题设计说明**：`docs/role-lane-expert-emergence.md`

## Agent 详细说明

### 2. Planner（规划师）

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

### 3. Reviewer（计划审查员）

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

### 4. Executor（执行者）

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

### 5. Evaluator（评估员）

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

### 6. Memory Curator（记忆策展人）

**配置文件**: [`agents/memory-curator.yaml`](agents/memory-curator.yaml)

**类型**: `memory_management`

**职责**:
- 在任务执行结束后整理上下文
- 提取有价值的代码模式、技术决策等
- 压缩冗长对话，保存关键状态
- 控制系统的信息熵，防止退化

**核心能力**:
- context-compression
- summarization
- knowledge-archiving
- signal-extraction

**模型配置**:
```yaml
model:
  provider: anthropic
  model: claude-3-5-sonnet
  temperature: 0.1
  max_tokens: 4096
```

**工具权限**:
- ✅ filesystem_read
- ✅ memory_write
- ❌ execution_run_command

**使用场景**:
```bash
# 评估通过后，自动切换到 Memory Curator 进行知识沉淀
export AHARNESS_AGENT=memory_curator
```

---

### 7. Researcher（研究员）

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
用户提交意图
    ↓
Coordinator 识别并澄清需求
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
Memory Curator        返回 Executor 修复
知识沉淀与归档        或返回 Planner 重新规划
│
任务彻底完成
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

| 工具 | Coordinator | Planner | Reviewer | Executor | Evaluator | Memory Curator | Researcher |
|------|-------------|---------|----------|----------|-----------|----------------|------------|
| filesystem_read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| filesystem_write | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| code_search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| execution_run_tests | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| execution_run_linter | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| execution_run_command | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| network_search | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| network_fetch_documentation | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

## 最佳实践

### 1. 按阶段使用正确的 Agent

- **需求澄清阶段** → 使用 Coordinator
- **需求分析阶段** → 使用 Planner
- **计划审查阶段** → 使用 Reviewer
- **代码实现阶段** → 使用 Executor
- **质量评估阶段** → 使用 Evaluator
- **知识沉淀阶段** → 使用 Memory Curator
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
