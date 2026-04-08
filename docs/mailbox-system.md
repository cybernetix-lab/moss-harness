# 文件邮箱系统 (Mailbox System)

文件邮箱系统是一个基于文件系统的 Agent 通讯机制，为非 Claude Code 环境提供类似 Claude Code 底层邮箱系统的能力。

当前协议规范文件位于 `configs/protocols/mailbox-protocol.yaml`。本阶段已为“角色泳道 + 专家沉淀 + 自组织演化”补充 claim、审批、归档和晋升消息类型，但现有 shell 脚本尚未完整消费这些新增协议字段。

## 概述

文件邮箱系统通过文件系统实现 Agent 之间的异步通讯，具有以下特点：

- **持久化** - 消息自动持久化到文件系统
- **可观测** - 随时查看消息内容和状态
- **可恢复** - 系统崩溃后可从文件恢复
- **去中心化** - 无单点故障，每个 Agent 独立
- **简单可靠** - 利用文件系统原子操作

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    File-based Mailbox System                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Mailbox   │    │   Message   │    │   State     │         │
│  │   (邮箱)     │    │   (消息)     │    │   (状态)     │         │
│  │             │    │             │    │             │         │
│  │ 每个 Agent   │    │  JSON 格式  │    │  共享状态    │         │
│  │ 一个邮箱目录 │    │  标准协议   │    │  原子操作    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
runtime/mailbox/
├── system/                    # 系统级邮箱
│   ├── inbox/                 # 系统收件箱
│   ├── outbox/                # 系统发件箱
│   └── state/                 # 系统状态
│
├── planner/                   # Planner Agent 邮箱
│   ├── inbox/                 # 收件箱
│   ├── outbox/                # 发件箱
│   ├── draft/                 # 草稿箱
│   ├── sent/                  # 已发送
│   └── trash/                 # 回收站
│
├── reviewer/                  # Reviewer Agent 邮箱
├── executor/                  # Executor Agent 邮箱
├── evaluator/                 # Evaluator Agent 邮箱
├── researcher/                # Researcher Agent 邮箱
│
└── shared/                    # 共享空间
    ├── context/               # 共享上下文
    ├── state/                 # 全局状态
    └── logs/                  # 通讯日志
```

## 消息格式

### 标准消息结构

```json
{
  "header": {
    "id": "msg-20240101-120000-abc12345",
    "type": "PLAN_COMPLETED",
    "from": "planner",
    "to": "reviewer",
    "timestamp": "2024-01-01T12:00:00Z",
    "priority": "normal",
    "thread_id": "thread-20240101-001"
  },
  "body": {
    "task_id": "task-001",
    "execution_plan": {
      "summary": "实现用户认证系统",
      "tasks": [...],
      "risks": [...]
    }
  },
  "metadata": {
    "attempt": 1,
    "timeout": 300
  },
  "status": "delivered",
  "created_at": "2024-01-01T12:00:00Z",
  "sent_at": null,
  "delivered_at": "2024-01-01T12:00:01Z",
  "read_at": null,
  "processed_at": null
}
```

### 消息类型

| 类别 | 消息类型 | 说明 |
|------|---------|------|
| **系统** | TASK_CREATED | 任务创建通知 |
| | TASK_CLAIM_REQUESTED | 候选 Agent 请求认领任务 |
| | TASK_CLAIM_GRANTED | 系统授予认领权 |
| | TASK_CLAIM_REJECTED | 认领请求被拒绝 |
| | TASK_CANCELLED | 任务取消通知 |
| | TASK_COMPLETED | 任务完成通知 |
| | ERROR_OCCURRED | 错误通知 |
| **工作流** | PLAN_REQUESTED | 请求制定计划 |
| | PLAN_COMPLETED | 计划已完成 |
| | PLAN_APPROVAL_REQUESTED | 请求结构化计划审批 |
| | PLAN_APPROVAL_COMPLETED | 计划审批完成 |
| | REVIEW_REQUESTED | 请求审查计划 |
| | REVIEW_COMPLETED | 审查已完成 |
| | EXECUTION_REQUESTED | 请求执行任务 |
| | EXECUTION_COMPLETED | 任务执行完成 |
| | EVAL_REQUESTED | 请求评估 |
| | EVAL_COMPLETED | 评估完成 |
| | MEMORY_ARCHIVE_REQUESTED | 请求记忆策展归档与提炼模式 |
| **协作** | CLARIFICATION_REQUESTED | 请求澄清 |
| | CLARIFICATION_PROVIDED | 提供澄清 |
| | FEEDBACK | 反馈 |
| | QUESTION | 问题 |
| | ANSWER | 回答 |
| | MEMBER_PROMOTION_PROPOSED | 提议晋升候选专家 |
| | MEMBER_PROMOTION_APPROVED | 候选专家晋升审批完成 |
| **状态** | PROGRESS_UPDATE | 进度更新 |
| | BLOCKED | 被阻塞 |
| | READY | 就绪 |
| | BUSY | 忙碌 |

### Protocol Envelope

对于 `TASK_CLAIM_*`、`PLAN_APPROVAL_*`、`MEMORY_ARCHIVE_REQUESTED`、`MEMBER_PROMOTION_*` 这类关键协作消息，协议层要求附带结构化 envelope 字段：

- `request_id`：唯一请求标识
- `protocol_type`：协议类型，如 `task_claim`、`plan_approval`
- `lifecycle_state`：状态机节点，如 `pending`、`approved`、`rejected`

这些字段的目标是让多 Agent 协作具备可追踪、可恢复、可审计的请求生命周期。当前阶段主要用于统一规范与文档约束。

### 消息状态

```
draft → pending_delivery → sending → delivered → unread → read → processing → completed → archived
         ↓                    ↓
       failed              failed
         ↓
    (retry) → pending_delivery
```

| 状态 | 说明 |
|------|------|
| draft | 草稿 |
| pending_delivery | 待投递 |
| sending | 发送中 |
| delivered | 已送达 |
| unread | 未读 |
| read | 已读 |
| processing | 处理中 |
| completed | 已完成 |
| failed | 失败 |
| archived | 已归档 |

## 核心组件

### 1. 邮箱管理器 (integrations/extensions/mailbox/mailbox.sh)

管理邮箱的创建、消息的发送和接收。

```bash
# 创建邮箱
./integrations/extensions/mailbox/mailbox.sh create --agent planner

# 发送消息
./integrations/extensions/mailbox/mailbox.sh send \
  --from planner \
  --to reviewer \
  --type PLAN_COMPLETED \
  --body '{"plan":{}}' \
  --thread task-001

# 接收消息
./integrations/extensions/mailbox/mailbox.sh receive --agent reviewer --unread

# 标记已读
./integrations/extensions/mailbox/mailbox.sh mark-read --agent reviewer --msg msg-001

# 查询线程状态
./integrations/extensions/mailbox/mailbox.sh status --thread task-001

# 列出消息
./integrations/extensions/mailbox/mailbox.sh list --agent planner --box inbox

# 归档消息
./integrations/extensions/mailbox/mailbox.sh archive --agent planner --older-than 7

# 清理回收站
./integrations/extensions/mailbox/mailbox.sh cleanup --agent planner
```

### 2. 消息处理器 (integrations/extensions/mailbox/message-handler.sh)

处理消息的解析、验证、路由和转换。

```bash
# 解析消息
./integrations/extensions/mailbox/message-handler.sh parse runtime/mailbox/planner/inbox/msg-001.json

# 验证消息
./integrations/extensions/mailbox/message-handler.sh validate runtime/mailbox/planner/inbox/msg-001.json

# 路由消息
./integrations/extensions/mailbox/message-handler.sh route runtime/mailbox/planner/outbox/msg-002.json

# 转换格式
./integrations/extensions/mailbox/message-handler.sh transform msg-001.json yaml
./integrations/extensions/mailbox/message-handler.sh transform msg-001.json summary

# 创建回复
./integrations/extensions/mailbox/message-handler.sh reply msg-001.json '{"status":"approved"}'

# 转发消息
./integrations/extensions/mailbox/message-handler.sh forward msg-001.json executor

# 广播消息
./integrations/extensions/mailbox/message-handler.sh broadcast SYSTEM_NOTIFICATION '{"message":"系统维护"}'
```

### 3. 投递守护进程 (integrations/extensions/mailbox/delivery-daemon.sh)

后台运行，自动投递 outbox 中的消息。

```bash
# 启动守护进程
./integrations/extensions/mailbox/delivery-daemon.sh start

# 查看状态
./integrations/extensions/mailbox/delivery-daemon.sh status

# 运行一次投递
./integrations/extensions/mailbox/delivery-daemon.sh once

# 停止守护进程
./integrations/extensions/mailbox/delivery-daemon.sh stop

# 重启守护进程
./integrations/extensions/mailbox/delivery-daemon.sh restart
```

## 使用示例

### 完整工作流程

```bash
# 1. 创建所有 Agent 邮箱
./integrations/extensions/mailbox/mailbox.sh create --agent planner
./integrations/extensions/mailbox/mailbox.sh create --agent reviewer
./integrations/extensions/mailbox/mailbox.sh create --agent executor
./integrations/extensions/mailbox/mailbox.sh create --agent evaluator

# 2. 启动投递守护进程
./integrations/extensions/mailbox/delivery-daemon.sh start

# 3. 创建任务线程
./integrations/extensions/mailbox/mailbox.sh create-thread --thread task-001

# 4. 系统发送任务给 Planner
./integrations/extensions/mailbox/mailbox.sh send \
  --from system \
  --to planner \
  --type TASK_CREATED \
  --body '{
    "task_id": "task-001",
    "requirements": "实现用户认证系统",
    "constraints": ["使用 TypeScript", "包含单元测试"]
  }' \
  --thread task-001

# 5. Planner 接收任务
./integrations/extensions/mailbox/mailbox.sh receive --agent planner --unread

# 6. Planner 完成任务，发送给 Reviewer
./integrations/extensions/mailbox/mailbox.sh send \
  --from planner \
  --to reviewer \
  --type PLAN_COMPLETED \
  --body '{
    "task_id": "task-001",
    "execution_plan": {
      "summary": "实现用户认证系统",
      "tasks": [...]
    }
  }' \
  --thread task-001

# 7. Reviewer 审查通过，发送给 Executor
./integrations/extensions/mailbox/mailbox.sh send \
  --from reviewer \
  --to executor \
  --type EXECUTION_REQUESTED \
  --body '{
    "task_id": "task-001",
    "plan": {...}
  }' \
  --thread task-001

# 8. 查询任务状态
./integrations/extensions/mailbox/mailbox.sh status --thread task-001
```

## 协议定义

完整的协议定义见 [`protocols/mailbox-protocol.yaml`](../protocols/mailbox-protocol.yaml)。

### 关键协议内容

- **消息格式** - JSON Schema 定义
- **消息类型** - 系统、工作流、协作、状态
- **通讯规则** - 投递保证、重试策略、超时设置
- **状态转换** - 消息生命周期
- **Agent 权限** - 谁可以发送/接收什么消息
- **性能配置** - 消息大小限制、保留策略

## 与 Claude Code 的区别

| 特性 | Claude Code | 文件邮箱系统 |
|------|-------------|-------------|
| 通讯机制 | 内置邮箱系统 | 基于文件系统 |
| 部署方式 | 云服务 | 本地/自托管 |
| 依赖 | Claude API | 仅文件系统 |
| 可观测性 | 有限 | 完全透明 |
| 可调试性 | 受限 | 完全可控 |
| 适用场景 | Claude 环境 | 任何环境 |

## 最佳实践

### 1. 启动时初始化

```bash
# init.sh 中添加
./integrations/extensions/mailbox/mailbox.sh create --agent planner
./integrations/extensions/mailbox/mailbox.sh create --agent reviewer
./integrations/extensions/mailbox/mailbox.sh create --agent executor
./integrations/extensions/mailbox/mailbox.sh create --agent evaluator
./integrations/extensions/mailbox/delivery-daemon.sh start
```

### 2. 定期清理

```bash
# crontab 中添加
0 0 * * * cd /path/to/project && ./integrations/extensions/mailbox/mailbox.sh archive --agent planner --older-than 30
0 0 * * * cd /path/to/project && ./integrations/extensions/mailbox/mailbox.sh cleanup --agent planner
```

### 3. 监控投递状态

```bash
# 检查待投递消息
find runtime/mailbox -path "*/outbox/*.json" | wc -l

# 查看投递日志
tail -f runtime/mailbox/shared/logs/delivery.log
```

### 4. 错误处理

```bash
# 检查失败消息
ls runtime/mailbox/planner/failed/

# 手动重试失败消息
for msg in runtime/mailbox/planner/failed/*.json; do
  mv "$msg" runtime/mailbox/planner/outbox/
done
```

## 故障排除

### 消息未投递

```bash
# 检查守护进程状态
./integrations/extensions/mailbox/delivery-daemon.sh status

# 检查目标邮箱是否存在
ls -la runtime/mailbox/reviewer/

# 手动运行投递
./integrations/extensions/mailbox/delivery-daemon.sh once
```

### 消息格式错误

```bash
# 验证消息格式
./integrations/extensions/mailbox/message-handler.sh validate msg-file.json

# 查看详细错误
./integrations/extensions/mailbox/message-handler.sh validate msg-file.json | jq '.errors'
```

### 邮箱损坏

```bash
# 重新创建邮箱
./integrations/extensions/mailbox/mailbox.sh create --agent planner

# 恢复消息（如果有备份）
cp backup/planner/inbox/* runtime/mailbox/planner/inbox/
```

## 扩展开发

### 添加新的消息类型

1. 在 `protocols/mailbox-protocol.yaml` 中添加类型定义
2. 在 `core/message-handler.sh` 中添加处理逻辑
3. 更新相关 Agent 的权限配置

### 自定义投递策略

修改 `core/delivery-daemon.sh` 中的配置：

```bash
DELIVERY_INTERVAL=1  # 投递检查间隔（秒）
MAX_RETRY=3          # 最大重试次数
RETRY_DELAY=5        # 重试延迟（秒）
```

### 集成外部系统

```bash
# 从外部系统接收消息
curl -X POST http://api.example.com/webhook | \
  ./integrations/extensions/mailbox/mailbox.sh send --from system --to planner --type EXTERNAL_EVENT --body -

# 发送消息到外部系统
./integrations/extensions/mailbox/mailbox.sh receive --agent evaluator --unread | \
  curl -X POST http://api.example.com/callback -d @-
```

## 参考文档

- [协议定义](../protocols/mailbox-protocol.yaml) - 完整的协议规范
- [Agent 协作流程](agent-collaboration.md) - Agent 之间的协作流程
- [Agent 配置](../AGENTS.md) - Agent 配置说明
