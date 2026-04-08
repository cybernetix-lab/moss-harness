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

## Token 指标采集

### 调用时机

`token-metrics.sh` 在 **模型调用后** 被调用，用于采集 Token 使用数据。

### 使用方式

#### 方式 1: 直接调用（手动采集）

```bash
# 设置环境变量
export AHARNESS_SESSION_ID="session-001"
export AHARNESS_AGENT_TYPE="executor"
export AHARNESS_OPERATION_TYPE="code-implementation"
export AHARNESS_MODEL_NAME="claude-3-5-sonnet"

# 调用 token-metrics.sh
./hooks/token-metrics.sh <input_tokens> <output_tokens> "<prompt_text>"
```

#### 方式 2: 通过模型调用包装器（自动采集）

```bash
# 设置环境变量
export AHARNESS_SESSION_ID="session-001"
export AHARNESS_AGENT_TYPE="planner"
export AHARNESS_OPERATION_TYPE="requirement-analysis"

# 方式 2a: 直接执行
./hooks/model-call-wrapper.sh "claude-3-opus" "分析用户需求" "你是专业的需求分析师"

# 方式 2b: Source 后调用
source ./hooks/model-call-wrapper.sh
model_call "claude-3-opus" "分析用户需求" "你是专业的需求分析师"
```

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `AHARNESS_SESSION_ID` | 当前会话 ID | 是 |
| `AHARNESS_AGENT_TYPE` | Agent 类型 (planner/reviewer/executor/evaluator/orchestrator) | 是 |
| `AHARNESS_OPERATION_TYPE` | 操作类型 | 是 |
| `AHARNESS_MODEL_NAME` | 模型名称 | 是 |

### 采集的指标

| 指标 | 说明 |
|------|------|
| `token_input_count` | 输入 Token 数 |
| `token_output_count` | 输出 Token 数 |
| `token_total_count` | 总 Token 数 |
| `information_entropy` | 信息熵（基于提示文本计算） |
| `token_information_density` | Token 信息密度 = 信息熵 / Token 总数 |

### 输出文件

```
runtime/telemetry/{session_id}/
├── token_metrics.jsonl      # 原始指标数据（每行一个 JSON 对象）
├── token_metrics_agg.json   # 聚合统计
└── cost_metrics.jsonl       # 成本数据（可选）
```

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
AHARNESS_HOOK_PROFILE=minimal|standard|strict  # 钩子执行模式
AHARNESS_DISABLED_HOOKS=session-start,error     # 禁用的钩子
AHARNESS_SESSION_ID=xxx                         # 当前会话ID
AHARNESS_CHECKPOINT_INTERVAL=10                 # 检查点间隔（分钟）
```

## 创建自定义钩子

```bash
# 创建钩子脚本
./hooks/custom/my-hook.sh

# 注册钩子
./scripts/hook-register.sh my-hook session-start
```
