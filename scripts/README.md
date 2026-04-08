# Scripts

运行时管理脚本，负责管理 Agent Harness 平台的核心运行时组件。

## 定位

- **目标用户**: 系统管理员、运维人员
- **使用场景**: 平台运维管理
- **交互方式**: 后台管理脚本

## 脚本说明

| 脚本 | 功能 | 管理对象 |
|------|------|----------|
| `memory-manager.sh` | 内存管理系统 | 工作内存、短期/长期记忆、共享内存 |
| `router.sh` | 任务路由决策引擎 | 任务分发和负载均衡 |
| `sandbox-manager.sh` | 沙箱执行系统 | Local/Docker/K8s 沙箱 |
| `subagent-manager.sh` | 子代理生命周期管理 | 子代理创建、调度、销毁 |
| `storage-manager.sh` | 存储系统管理 | 数据持久化和检索 |
| `feishu-gateway.sh` | 飞书网关集成 | 消息通知和交互 |
| `task-board.sh` | 按 lane 管理任务状态队列 | `.runtime/task-board/` |
| `roster-loader.sh` | 从 registry 读取 lane 成员清单 | `configs/orchestration/agent-registry.yaml` |
| `claim-engine.sh` | 在 lane 内执行 expert-first claim | `.runtime/task-board/`、`.runtime/claims/` |
| `presence-manager.sh` | 记录 lane 成员 presence | `.runtime/teammates/` |
| `evolution-candidate.sh` | 从 completed task 生成候选专家 raw proposal | `.runtime/evolution/candidates/` |

## Executor Lane PoC

- `task-board.sh` 负责创建与迁移 lane 任务状态
- `roster-loader.sh` 负责读取 `members` 作为唯一成员真相源
- `claim-engine.sh` 负责专家优先、backup 兜底的任务认领
- `evolution-candidate.sh` 只生成 raw proposal 和 telemetry，不做自动 promotion

## 使用示例

```bash
# 内存管理
./memory-manager.sh working create session_001
./memory-manager.sh short-term store session_001 "关键信息"
./memory-manager.sh long-term retrieve session_001 "模式"

# 沙箱管理
./sandbox-manager.sh create local --cpu 2 --memory 1g
./sandbox-manager.sh create docker --image node:18
./sandbox-manager.sh list

# 子代理管理
./subagent-manager.sh create --parent session_001 --task "子任务"
./subagent-manager.sh list --parent session_001
./subagent-manager.sh destroy subagent_001
```

## 与其他目录的关系

- 被 `apps/agent-cli/` 调用，提供底层能力
- 操作 `runtime/` 中的 TypeScript 运行时
- 管理 `.runtime/` 中的运行时数据
