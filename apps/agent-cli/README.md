# Agent CLI

Agent CLI 是面向终端用户的命令行界面，提供完整的 Agent 工作流支持。

## 定位

- **目标用户**: 终端用户（开发者、Agent 使用者）
- **使用场景**: 日常开发工作流
- **交互方式**: 友好的命令行界面

## 脚本说明

| 脚本 | 功能 | 使用示例 |
|------|------|----------|
| `agent-list.sh` | 列出可用 Agent | `./agent-list.sh` |
| `agent-start.sh` | 启动 Agent 会话 | `./agent-start.sh planner` |
| `agent-switch.sh` | 切换当前 Agent | `./agent-switch.sh reviewer` |
| `agent-eval.sh` | 评估 Agent 性能 | `./agent-eval.sh planner` |
| `agent-evolve.sh` | 进化 Agent 配置 | `./agent-evolve.sh analyze planner` |
| `start-session.sh` | 启动新会话 | `./start-session.sh` |
| `checkpoint.sh` | 管理检查点 | `./checkpoint.sh list` |
| `create-checkpoint.sh` | 创建检查点 | `./create-checkpoint.sh "完成登录功能"` |
| `restore-checkpoint.sh` | 恢复检查点 | `./restore-checkpoint.sh checkpoint_001` |

## 典型工作流

```bash
# 1. 查看可用 Agent
./agent-list.sh

# 2. 启动 Planner 进行任务规划
./agent-start.sh planner

# 3. 保存工作进度
./create-checkpoint.sh "完成架构设计"

# 4. 切换到 Executor 执行实现
./agent-switch.sh executor

# 5. 评估实现质量
./agent-eval.sh executor
```

## 与其他目录的关系

- 调用 `scripts/` 管理运行时组件
- 调用 `tooling/scripts/` 进行技能评估
- 依赖 `configs/` 中的 Agent 配置
