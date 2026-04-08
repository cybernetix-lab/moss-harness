# Role Lane Expert Emergence

## 背景

当前项目已经形成六角色协作框架，但如果每个角色都只有一个固定 Agent，系统会逐渐碰到两个问题：

- 不同场景下的任务差异很大，通用角色 Agent 的性能会被拉平到“平均但不尖锐”。
- 系统虽然能完成任务，却无法把高质量成功经验沉淀成长期可复用的专家能力。

因此，本阶段把六角色重新定义为**职责泳道（Role Lanes）**，并将 Agent 角色实例分成 Backup、Expert、Candidate 三层，形成“稳定制衡 + 局部专业化 + 渐进演化”的结构。

## 目标

- 保持六角色制衡链路不变。
- 允许每条泳道内部持续沉淀专家 Agent。
- 建立专家优先、通用兜底的任务认领规则。
- 为后续运行时接入 Task Board、Independent Loop、Team Roster 提供统一配置与协议。

## 非目标

- 本阶段不实现真实的 Task Board 调度器。
- 本阶段不修改 `runtime/subagent/` 类型或数据库 schema。
- 本阶段不让现有 mailbox shell 脚本自动消费全部新增协议字段。

## 核心概念

### 1. Role Lane

Role Lane 是稳定职责边界，不是单个 Agent 实例。当前核心泳道包括：

- Coordinator
- Planner
- Reviewer
- Executor
- Evaluator
- Memory Curator

Researcher 保留为辅助研究能力，可按需服务于协调、规划或审查泳道，但不进入核心六泳道制衡链路。

### 2. Backup Agent

每条泳道至少有一个 Backup Agent，用于：

- 提供稳定可用的通用能力
- 在专家 Agent 不可用时兜底
- 作为新专家沉淀前的默认执行者

### 3. Expert Agent

Expert Agent 是在特定领域上长期表现稳定的泳道成员，例如：

- `db_planner`
- `sec_reviewer`
- `frontend_executor`
- `perf_evaluator`
- `doc_curator`

它们不改变六角色链路，只改变泳道内部“谁来处理这项任务”。

### 4. Candidate Agent

Candidate Agent 是系统涌现能力的过渡态：

- 来源于重复成功的任务模式
- 由 Memory Curator 提取和归档
- 需要 Reviewer 与 Evaluator 的结构化审批后才能晋升

## 路由与认领流程

### 路由原则

第一层先锁定职责泳道，第二层再在泳道内部选成员。

推荐评分公式：

```text
route_score = role_fit * domain_fit * capability_score * recent_success * availability
```

### 认领顺序

1. Task 进入指定泳道
2. 同泳道 Expert 成员根据 `domain_tags` 与评分竞争 claim
3. 若专家超时未认领、不可用或置信度不足，则由 Backup 接管
4. 关键认领动作通过结构化协议记录 `request_id` 和生命周期状态

### 结构化协作协议

协议层新增四类关键动作：

- `TASK_CLAIM_*`
- `PLAN_APPROVAL_*`
- `MEMORY_ARCHIVE_REQUESTED`
- `MEMBER_PROMOTION_*`

这些动作通过 Protocol Envelope 提供：

- `request_id`
- `protocol_type`
- `lifecycle_state`

### Raw Proposal 边界

当前 PoC 只实现候选专家的原始提案生成：

- `scripts/evolution-candidate.sh propose` 从已完成任务提取领域标签、质量分数与执行者证据
- 提案写入 `.runtime/evolution/candidates/<lane>/`
- 遥测仅记录 `member.promotion.proposed`
- 不自动触发 `MEMBER_PROMOTION_APPROVED`
- 不直接修改 `configs/orchestration/agent-registry.yaml`

## 演化闭环

系统的专家沉淀不依赖手工一次性配置，而通过以下闭环形成：

1. **执行成功**：Executor 与 Evaluator 完成一次高质量交付。
2. **模式提炼**：Memory Curator 提取领域标签、prompt 模式、工具链组合、质量信号。
3. **候选生成**：若同类模式重复成功，生成 Candidate Agent。
4. **双重审批**：Reviewer 与 Evaluator 通过 `member_promotion` 协议审批。
5. **正式晋升**：审批通过后成为 Expert Agent；否则继续观察或归档。

当前仓库中的 shell PoC 停在第 3 步：只产出 raw proposal，为后续审批流预留证据文件与协议外壳。

## 配置落点

- `configs/orchestration/agent-registry.yaml`
  - `lanes` 定义流程规则与选择策略
  - `members` 作为成员唯一真相源
  - `evolution` 定义候选专家晋升与降级元数据
- `configs/protocols/mailbox-protocol.yaml`
  - 定义 claim、approval、archive、promotion 的消息语义
- `AGENTS.md`
  - 描述六角色 lane 化与自组织协作
- `docs/agent-collaboration.md`
  - 描述任务板认领状态机与候选专家涌现闭环

## 后续运行时落点

第二阶段建议接入以下位置：

- `runtime/subagent/types.ts`
- `runtime/subagent/registry.ts`
- `scripts/subagent-manager.sh`

建议新增的运行时成员接口示意：

```ts
interface LaneMemberProfile {
  lane: string;
  mode: 'backup' | 'expert' | 'candidate';
  domainTags: string[];
  recentSuccess: number;
  availability: number;
}
```

## 第二阶段收敛结果

为避免 `lanes` 与 `members` 同时维护成员列表导致配置漂移，第二阶段采用以下约束：

- `lanes` 不再直接维护 `backup_agent` 与 `expert_agents` 列表
- `members` 成为唯一成员真相源
- `lanes.member_source` 指向对应的 roster 分组
- 编排器或加载器在运行时根据 `member_source + selection_policy` 解析有效成员集合

## 阶段结论

本阶段的重点不是“让所有自治能力立刻上线”，而是先把系统的组织原则从“固定角色实例”升级为“职责泳道 + 成员演化”。这样后续无论接 Task Board、持久化队友、独立循环还是协议驱动调度，都能沿着同一条模型继续扩展，而不是重复推倒重来。
