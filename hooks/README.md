# Session Hooks

会话钩子系统允许在 Agent 会话的关键节点自动执行操作。

## 钩子类型

| 钩子 | 触发时机 | 用途 |
|------|----------|------|
| `session-start` | 会话开始时 | 加载上下文、初始化环境 |
| `session-stop` | 会话结束时 | 保存状态、生成摘要 |
| `pre-action` | 每个动作前 | 权限检查、约束验证 |
| `post-action` | 每个动作后 | 日志记录、状态更新 |
| `checkpoint` | 检查点时 | 自动备份、验证 |
| `error` | 发生错误时 | 错误处理、恢复 |

## 钩子配置

```yaml
# hooks/config.yaml
hooks:
  session-start:
    enabled: true
    scripts:
      - load-context.sh
      - check-constraints.sh
    
  session-stop:
    enabled: true
    scripts:
      - save-context.sh
      - generate-summary.sh
    
  pre-action:
    enabled: true
    scripts:
      - validate-action.sh
    
  post-action:
    enabled: true
    scripts:
      - log-action.sh
      - update-metrics.sh
```

## 钩子环境变量

```bash
ECC_HOOK_PROFILE=minimal|standard|strict  # 钩子执行模式
ECC_DISABLED_HOOKS=session-start,error     # 禁用的钩子
ECC_SESSION_ID=xxx                         # 当前会话ID
ECC_CHECKPOINT_INTERVAL=10                 # 检查点间隔（分钟）
```

## 创建自定义钩子

```bash
# 创建钩子脚本
./hooks/custom/my-hook.sh

# 注册钩子
./scripts/hook-register.sh my-hook session-start
```
