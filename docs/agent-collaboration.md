# Agent 协作流程

本文档描述了 Planner、Reviewer、Executor、Evaluator 四个 Agent 的协作流程，通过职责分离避免自评乐观偏差。

## 设计原则

### 为什么需要分离？

传统的单一 Agent 模式存在以下问题：
- **规划偏差** - 制定计划时过于乐观，低估难度
- **计划审查缺失** - 缺乏独立的计划审查环节，导致问题在后续阶段才暴露
- **执行偏差** - 实现时走捷径，忽略边界情况
- **评估偏差** - 自我评估时宽容，放过问题

通过将四个角色分离，每个 Agent 只专注于自己的职责：
- **Planner** - 只负责规划，不执行
- **Reviewer** - 只负责审查计划，不参与规划和执行
- **Executor** - 只负责执行，不规划
- **Evaluator** - 只负责评估，不参与规划和执行

## 角色定义

### Planner（规划师）

**职责**：
- 需求分析和理解
- 任务拆解和排序
- 技术方案设计
- 风险评估和工时估算
- 输出执行计划

**特点**：
- 使用最强模型（Claude-3 Opus）
- 禁止编写代码（blocked: filesystem_write）
- 强调客观评估，避免过度乐观

**输出**：
- 结构化执行计划
- 任务清单（含验收标准）
- 风险评估报告

### Reviewer（计划审查员）

**职责**：
- 审查 Planner 制定的执行计划
- 识别计划中的风险、遗漏和不合理之处
- 评估技术方案的可行性
- 验证任务分解的合理性
- 确保计划的可执行性

**特点**：
- 作为独立第三方审查计划
- 只读权限，不修改代码（blocked: filesystem_write, execution）
- 不仅指出问题，更要提供改进建议
- 可以要求 Planner 重新规划

**输出**：
- 计划审查报告
- 问题清单（Critical/Warning/Suggestion）
- 审查结论（APPROVED/NEEDS_REVISION）

### Executor（执行者）

**职责**：
- 按照计划实现功能
- 编写高质量代码
- 编写单元测试
- 自测验证

**特点**：
- 专注执行，不关心整体规划
- 发现问题及时反馈，不擅自改变方案
- 严格遵循编码规范

**输出**：
- 实现代码
- 测试代码
- 执行报告

### Evaluator（评估员）

**职责**：
- 独立评估实现质量
- 检查需求满足度
- 评估测试覆盖
- 给出评估结论和改进建议

**特点**：
- 作为独立第三方，客观公正
- 不仅指出问题，更要提供改进建议
- 只读权限，不修改代码

**输出**：
- 评估报告
- 问题清单（Critical/Warning/Suggestion）
- 评估结论和改进建议

## 协作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        任务开始                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 规划 (Planner)                                        │
├─────────────────────────────────────────────────────────────────┤
│  • 分析需求                                                     │
│  • 拆解任务                                                     │
│  • 设计方案                                                     │
│  • 评估风险                                                     │
│  • 输出计划                                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 执行计划
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: 计划审查 (Reviewer)                                   │
├─────────────────────────────────────────────────────────────────┤
│  • 审查需求理解                                                 │
│  • 检查任务分解                                                 │
│  • 评估技术方案                                                 │
│  • 识别潜在风险                                                 │
│  • 给出审查结论                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 审查通过
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 执行 (Executor)                                       │
├─────────────────────────────────────────────────────────────────┤
│  • 理解任务                                                     │
│  • 编写实现                                                     │
│  • 编写测试                                                     │
│  • 自测验证                                                     │
│  • 报告结果                                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 实现结果
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: 评估 (Evaluator)                                      │
├─────────────────────────────────────────────────────────────────┤
│  • 验证需求                                                     │
│  • 检查测试                                                     │
│  • 代码审查                                                     │
│  • 质量评估                                                     │
│  • 给出结论                                                     │
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

## 详细流程

### Phase 1: 规划

**输入**：
- 用户需求
- 相关文档（TASK.md, CLAUDE.md, DECISIONS.md）

**Planner 工作**：
1. 阅读所有相关文档
2. 分析需求，识别显性和隐性需求
3. 将任务拆解为可独立执行的子任务
4. 为每个任务定义验收标准
5. 评估风险和工时
6. 输出执行计划

**输出示例**：
```yaml
execution_plan:
  summary: "实现用户认证系统"
  
  tasks:
    - id: 1
      description: "设计数据库用户表结构"
      acceptance_criteria:
        - "包含 id, username, password_hash, email, created_at 字段"
        - "username 有唯一索引"
        - "password_hash 使用 bcrypt"
      estimated_hours: 2
      risk: low
      
    - id: 2
      description: "实现用户注册 API"
      acceptance_criteria:
        - "POST /api/auth/register"
        - "验证输入参数"
        - "密码强度检查"
        - "返回 JWT token"
      estimated_hours: 4
      risk: medium
      dependencies: [1]
      
    - id: 3
      description: "实现用户登录 API"
      acceptance_criteria:
        - "POST /api/auth/login"
        - "验证用户名密码"
        - "返回 JWT token"
        - "错误次数限制"
      estimated_hours: 3
      risk: medium
      dependencies: [1]
  
  risks:
    - "密码加密性能可能影响响应时间"
    - "JWT 密钥管理需要额外考虑"
```

### Phase 2: 计划审查

**输入**：
- Planner 生成的执行计划
- 原始需求
- 相关技术文档

**Reviewer 工作**：
1. 阅读执行计划和原始需求
2. 审查需求理解是否准确
3. 检查任务分解是否合理
4. 评估技术方案的可行性
5. 识别潜在风险和遗漏
6. 给出审查结论

**审查维度**：

| 维度 | 检查项 |
|------|--------|
| **需求理解** | 是否遗漏显性或隐性需求？需求理解是否准确？ |
| **任务分解** | 任务粒度是否合适？依赖关系是否正确？ |
| **技术方案** | 技术选型是否合理？方案是否可行？ |
| **风险评估** | 是否遗漏重要风险？风险应对措施是否充分？ |
| **工时估算** | 估算是否合理？是否过于乐观？ |
| **验收标准** | 验收标准是否明确？是否可验证？ |

**审查结论**：

| 结论 | 条件 |
|------|------|
| **APPROVED** | 计划完整、可行，可以进入执行阶段 |
| **APPROVED_WITH_SUGGESTIONS** | 计划可行，但有小问题建议改进 |
| **NEEDS_REVISION** | 计划有重大缺陷，需要 Planner 重新规划 |

**输出示例**：
```yaml
review_report:
  verdict: APPROVED_WITH_SUGGESTIONS
  
  requirements_review:
    - aspect: "需求完整性"
      status: pass
      comment: "需求理解完整，无遗漏"
    - aspect: "隐性需求"
      status: warning
      comment: "建议考虑密码找回功能"
  
  task_decomposition_review:
    - aspect: "任务粒度"
      status: pass
      comment: "任务粒度合适，2-4小时"
    - aspect: "依赖关系"
      status: pass
      comment: "依赖关系正确"
  
  technical_review:
    - aspect: "技术选型"
      status: pass
      comment: "bcrypt + JWT 方案合理"
    - aspect: "安全性"
      status: suggestion
      comment: "建议添加 rate limiting"
  
  risk_review:
    - aspect: "风险识别"
      status: warning
      comment: "遗漏了 XSS 攻击风险"
  
  effort_review:
    - aspect: "工时估算"
      status: pass
      comment: "估算合理"
  
  issues_found:
    critical: []
    warnings:
      - "遗漏 XSS 攻击风险"
    suggestions:
      - "建议添加密码找回功能"
      - "建议添加 rate limiting"
      - "建议添加登录日志审计"
  
  next_steps:
    - "计划基本可行，可以进入执行阶段"
    - "建议后续迭代考虑 suggestions 中的功能"
```

### Phase 3: 执行

**输入**：
- Reviewer 审查通过的执行计划
- 具体分配的任务

**Executor 工作**：
1. 仔细阅读任务描述和验收标准
2. 查看相关代码，理解上下文
3. 编写实现代码
4. 编写单元测试
5. 运行测试和 linter
6. 报告完成情况和问题

**问题升级**：
如果 Executor 发现以下情况，必须停止并反馈：
- 计划有重大缺陷
- 任务依赖无法满足
- 技术方案不可行
- 预计工时严重超出估算

**输出示例**：
```yaml
execution_report:
  task_id: 2
  status: completed
  
  code_changes:
    - file: "src/auth/register.ts"
      lines_added: 45
      lines_modified: 0
      description: "实现用户注册逻辑"
    - file: "src/auth/validator.ts"
      lines_added: 30
      lines_modified: 0
      description: "输入验证工具"
    - file: "tests/auth/register.test.ts"
      lines_added: 60
      lines_modified: 0
      description: "注册功能单元测试"
  
  test_results:
    total: 8
    passed: 8
    failed: 0
    coverage: 94%
  
  linter_results:
    errors: 0
    warnings: 1
    warning_details:
      - "Line 23: 函数长度接近50行限制"
  
  issues_encountered:
    - "发现原计划的密码强度规则不够详细，已按业界标准实现"
```

### Phase 4: 评估

**输入**：
- 原始需求
- 执行计划
- Executor 的实现结果

**Evaluator 工作**：
1. 阅读需求和验收标准
2. 逐条验证功能实现
3. 运行所有测试
4. 检查代码质量
5. 给出评估结论和改进建议

**评估结论**：

| 结论 | 条件 |
|------|------|
| **EXCELLENT** | 所有需求实现 + 测试通过 + 代码质量高 + 无 Critical/Warning |
| **PASS** | 所有需求实现 + 测试通过 + 代码符合规范 + 无 Critical |
| **PASS_WITH_WARNINGS** | 核心功能实现 + 测试通过 + 有小缺陷 |
| **NEEDS_IMPROVEMENT** | 有需求未实现 或 测试失败 或 有 Critical/Warning 问题 |

**输出示例**：
```yaml
evaluation_report:
  verdict: PASS
  
  requirements_check:
    - requirement: "POST /api/auth/register 端点"
      status: implemented
      evidence: "src/auth/register.ts:15"
    - requirement: "密码强度检查"
      status: implemented
      evidence: "src/auth/validator.ts:42"
    - requirement: "返回 JWT token"
      status: implemented
      evidence: "src/auth/register.ts:38"
  
  test_validation:
    total_tests: 8
    passed: 8
    failed: 0
    coverage: 94%
    coverage_assessment: "满足 90% 要求"
  
  code_quality_review:
    complexity: "良好，最高复杂度 8"
    naming: "符合规范"
    comments: "关键逻辑有注释"
    
  issues_found:
    critical: []
    warnings: []
    suggestions:
      - "建议添加 rate limiting 防止暴力注册"
      - "可考虑添加邮箱验证步骤"
  
  next_steps:
    - "任务通过，可以合并到主分支"
    - "建议后续迭代添加 suggestions 中的功能"
```

## 循环处理

### 计划审查需要修订时

```
Reviewer (NEEDS_REVISION)
      │
      ▼
┌─────────────────┐
│  返回 Planner   │
│  重新规划       │
└─────────────────┘
```

### 评估需要改进时

```
Evaluator (NEEDS_IMPROVEMENT)
      │
      ▼
┌─────────────────┐
│  问题分类        │
├─────────────────┤
│ • 实现问题?     │ ──→ 返回 Executor 修复
│ • 计划问题?     │ ──→ 返回 Planner 重新规划
│ • 需求问题?     │ ──→ 与用户确认
└─────────────────┘
```

### 迭代流程

```
Planner → Reviewer → Executor → Evaluator
      ↑        ↑            │
      │        │            │
      └────────┴────────────┘ (NEEDS_REVISION/NEEDS_IMPROVEMENT 时返回)
```

## 工具权限对比

| 工具 | Planner | Reviewer | Executor | Evaluator |
|------|---------|----------|----------|-----------|
| filesystem_read | ✅ | ✅ | ✅ | ✅ |
| filesystem_write | ❌ | ❌ | ✅ | ❌ |
| code_search | ✅ | ✅ | ✅ | ✅ |
| execution_run_tests | ❌ | ❌ | ✅ | ✅ |
| execution_run_linter | ❌ | ❌ | ✅ | ✅ |
| execution_run_command | ❌ | ❌ | ✅ | ✅ |
| network_search | ✅ | ✅ | ❌ | ❌ |
| network_fetch_documentation | ✅ | ✅ | ❌ | ❌ |

## 最佳实践

### 1. 规划阶段

- Planner 应该花足够时间理解需求
- 任务粒度控制在 2-8 小时
- 每个任务必须有明确的验收标准
- 高风险任务要标注并制定应对方案

### 2. 计划审查阶段

- Reviewer 必须独立客观，不妥协
- 严格按照审查维度检查
- 问题要分类（Critical/Warning/Suggestion）
- 不仅指出问题，更要提供改进建议
- 给出明确的审查结论

### 3. 执行阶段

- Executor 严格按计划执行，不轻易改变方案
- 发现问题立即反馈，不隐瞒
- 每个函数必须有单元测试
- 保持代码风格一致

### 4. 评估阶段

- Evaluator 必须独立客观，不妥协
- 严格按照验收标准检查
- 问题要分类（Critical/Warning/Suggestion）
- 不仅指出问题，更要提供改进建议
- 给出明确的结论和下一步建议

### 5. 沟通规范

- Planner → Reviewer: 提供清晰的执行计划
- Reviewer → Planner: 反馈审查问题和改进建议
- Planner → Executor: 提供审查通过的计划和验收标准
- Executor → Planner: 反馈问题和偏差
- Executor → Evaluator: 提供实现和测试报告
- Evaluator → Executor: 提供问题清单和修复建议

## 示例场景

### 场景 1: 正常流程

```
用户: "实现用户登录功能"

Planner:
  → 分析需求，拆解为3个任务
  → 输出执行计划

Reviewer:
  → 审查计划
  → 发现一个小问题（建议添加 rate limiting）
  → 结论: APPROVED_WITH_SUGGESTIONS

Executor (任务2):
  → 实现登录 API
  → 编写测试
  → 自测通过
  → 提交实现

Evaluator:
  → 验证功能完整
  → 测试全部通过
  → 代码质量良好
  → 结论: PASS
```

### 场景 2: 计划审查发现问题

```
Planner 输出执行计划

Reviewer:
  → 发现任务分解粒度过大（单个任务预计16小时）
  → 发现遗漏了密码找回需求
  → 结论: NEEDS_REVISION

Planner:
  → 重新分解任务（每个任务2-4小时）
  → 补充密码找回任务
  → 输出新计划

Reviewer:
  → 审查通过
  → 结论: APPROVED
```

### 场景 3: 评估发现问题

```
Executor 提交实现

Evaluator:
  → 发现密码加密使用了 MD5（不安全）
  → 结论: NEEDS_IMPROVEMENT
  → 问题分级: Critical

Executor:
  → 修复为 bcrypt
  → 重新提交

Evaluator:
  → 验证通过
  → 结论: PASS
```

### 场景 4: 计划问题

```
Executor:
  → 发现原计划的 JWT 库已弃用
  → 停止执行，反馈 Planner

Planner:
  → 调研替代方案
  → 更新执行计划
  → 重新提交 Reviewer 审查

Reviewer:
  → 审查通过
  → 结论: APPROVED

Executor:
  → 按新计划执行
```

## 配置文件

四个 Agent 的配置文件：

- [`agents/planner.yaml`](file:///Users/bytedance/Documents/trae_projects/awesome-agent-harness/agents/planner.yaml) - 规划 Agent
- [`agents/reviewer.yaml`](file:///Users/bytedance/Documents/trae_projects/awesome-agent-harness/agents/reviewer.yaml) - 计划审查 Agent
- [`agents/executor.yaml`](file:///Users/bytedance/Documents/trae_projects/awesome-agent-harness/agents/executor.yaml) - 执行 Agent
- [`agents/evaluator.yaml`](file:///Users/bytedance/Documents/trae_projects/awesome-agent-harness/agents/evaluator.yaml) - 评估 Agent

原有的 [`agents/implementer.yaml`](file:///Users/bytedance/Documents/trae_projects/awesome-agent-harness/agents/implementer.yaml) 已移除。
