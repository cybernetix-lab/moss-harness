# 配置目录

本目录包含与运行环境相关的配置，与 Agent 定义分离。

## 文件说明

### models.yaml

模型配置文件，定义了所有可用的模型 profile 和 Agent 到模型的映射。

**主要配置项：**

- `defaults`: 默认模型配置
- `agent_models`: Agent 类型到模型 profile 的映射
- `profiles`: 具体的模型 profile 定义
- `capabilities`: 各模型的能力定义
- `overrides`: 环境特定的覆盖配置

**使用方式：**

```bash
# 系统会根据 AHARNESS_AGENT_TYPE 自动选择对应的模型 profile
export AHARNESS_AGENT_TYPE="executor"
./hooks/model-call-wrapper.sh "提示词"

# 或强制指定 profile
export AHARNESS_MODEL_PROFILE="high-capability"
./hooks/model-call-wrapper.sh "提示词"
```

**Profile 说明：**

| Profile | 用途 | 默认模型 |
|---------|------|----------|
| `high-capability` | 复杂推理任务 | claude-3-opus |
| `balanced` | 一般任务 | claude-3-5-sonnet |
| `fast` | 简单快速任务 | claude-3-haiku |
| `economical` | 成本敏感场景 | gpt-3.5-turbo |

## 设计原则

1. **配置与代码分离**: Agent 定义中不包含模型配置，便于在不同环境使用不同模型
2. **Profile 抽象**: 使用 profile 概念而非直接指定模型，便于统一调整
3. **环境覆盖**: 支持通过环境变量或本地配置覆盖默认设置
