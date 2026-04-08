#!/bin/bash
# token-metrics.sh - Token 指标采集钩子
# 在 Agent 调用模型后采集 Token 使用数据

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 环境变量
SESSION_ID="${AHARNESS_SESSION_ID:-unknown}"
AGENT_TYPE="${AHARNESS_AGENT_TYPE:-unknown}"
OPERATION_TYPE="${AHARNESS_OPERATION_TYPE:-unknown}"
MODEL_NAME="${AHARNESS_MODEL_NAME:-unknown}"

# Token 数据（从模型 API 响应传入）
TOKEN_INPUT="${1:-0}"
TOKEN_OUTPUT="${2:-0}"
PROMPT_TEXT="${3:-}"

TELEMETRY_DIR="${PROJECT_ROOT}/runtime/telemetry/${SESSION_ID}"
mkdir -p "$TELEMETRY_DIR"

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 计算信息熵
calculate_entropy() {
    local text="$1"
    if [[ -z "$text" ]]; then
        echo "0"
        return
    fi
    
    python3 << EOF
import math
from collections import Counter

text = """${text}"""
if not text:
    print(0)
else:
    # 计算字符频率
    char_counts = Counter(text)
    total = len(text)
    
    # 计算熵
    entropy = 0
    for count in char_counts.values():
        p = count / total
        entropy -= p * math.log2(p)
    
    print(round(entropy, 4))
EOF
}

# 记录 Token 指标
record_token_metrics() {
    local token_total=$((TOKEN_INPUT + TOKEN_OUTPUT))
    local entropy=$(calculate_entropy "$PROMPT_TEXT")
    local density="0"
    
    if [[ "$token_total" -gt 0 ]]; then
        density=$(python3 -c "print(round($entropy / $token_total, 4))")
    fi
    
    # 构建指标数据
    local metrics_data=$(cat << EOF
{
  "timestamp": "${timestamp}",
  "agent_type": "${AGENT_TYPE}",
  "operation_type": "${OPERATION_TYPE}",
  "model_name": "${MODEL_NAME}",
  "token_input_count": ${TOKEN_INPUT},
  "token_output_count": ${TOKEN_OUTPUT},
  "token_total_count": ${token_total},
  "information_entropy": ${entropy},
  "token_information_density": ${density}
}
EOF
)
    
    # 写入指标文件（JSONL 格式）
    echo "$metrics_data" >> "${TELEMETRY_DIR}/token_metrics.jsonl"
    
    # 更新聚合指标
    update_aggregated_metrics "$token_total" "$entropy" "$density"
}

# 更新聚合指标
update_aggregated_metrics() {
    local total="$1"
    local entropy="$2"
    local density="$3"
    
    local agg_file="${TELEMETRY_DIR}/token_metrics_agg.json"
    
    python3 << EOF
import json
import os

agg_file = "${agg_file}"

# 读取或初始化聚合数据
if os.path.exists(agg_file):
    with open(agg_file, 'r') as f:
        agg = json.load(f)
else:
    agg = {
        "session_id": "${SESSION_ID}",
        "start_time": "${timestamp}",
        "total_calls": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_tokens": 0,
        "avg_entropy": 0,
        "avg_density": 0,
        "by_agent": {},
        "by_operation": {},
        "by_model": {}
    }

# 更新总计
agg["total_calls"] += 1
agg["total_input_tokens"] += ${TOKEN_INPUT}
agg["total_output_tokens"] += ${TOKEN_OUTPUT}
agg["total_tokens"] += ${total}

# 更新平均值
calls = agg["total_calls"]
agg["avg_entropy"] = round((agg["avg_entropy"] * (calls - 1) + ${entropy}) / calls, 4)
agg["avg_density"] = round((agg["avg_density"] * (calls - 1) + ${density}) / calls, 4)

# 按 Agent 统计
agent = "${AGENT_TYPE}"
if agent not in agg["by_agent"]:
    agg["by_agent"][agent] = {"calls": 0, "tokens": 0}
agg["by_agent"][agent]["calls"] += 1
agg["by_agent"][agent]["tokens"] += ${total}

# 按操作类型统计
op = "${OPERATION_TYPE}"
if op not in agg["by_operation"]:
    agg["by_operation"][op] = {"calls": 0, "tokens": 0}
agg["by_operation"][op]["calls"] += 1
agg["by_operation"][op]["tokens"] += ${total}

# 按模型统计
model = "${MODEL_NAME}"
if model not in agg["by_model"]:
    agg["by_model"][model] = {"calls": 0, "tokens": 0}
agg["by_model"][model]["calls"] += 1
agg["by_model"][model]["tokens"] += ${total}

# 写入文件
with open(agg_file, 'w') as f:
    json.dump(agg, f, indent=2)
EOF
}

# 计算成本（可选）
calculate_cost() {
    local model="$1"
    local input_tokens="$2"
    local output_tokens="$3"
    
    # 价格表（每 1K tokens）
    case "$model" in
        "claude-3-opus")
            input_price=0.015
            output_price=0.075
            ;;
        "claude-3-5-sonnet")
            input_price=0.003
            output_price=0.015
            ;;
        "gpt-4")
            input_price=0.03
            output_price=0.06
            ;;
        "gpt-3.5-turbo")
            input_price=0.0005
            output_price=0.0015
            ;;
        *)
            input_price=0
            output_price=0
            ;;
    esac
    
    local input_cost=$(python3 -c "print(round($input_tokens / 1000 * $input_price, 6))")
    local output_cost=$(python3 -c "print(round($output_tokens / 1000 * $output_price, 6))")
    local total_cost=$(python3 -c "print(round($input_cost + $output_cost, 6))")
    
    echo "$total_cost"
}

# 记录成本（如果模型已知）
record_cost() {
    if [[ "$MODEL_NAME" != "unknown" && "$MODEL_NAME" != "" ]]; then
        local cost=$(calculate_cost "$MODEL_NAME" "$TOKEN_INPUT" "$TOKEN_OUTPUT")
        
        local cost_data=$(cat << EOF
{
  "timestamp": "${timestamp}",
  "model": "${MODEL_NAME}",
  "input_tokens": ${TOKEN_INPUT},
  "output_tokens": ${TOKEN_OUTPUT},
  "cost_usd": ${cost}
}
EOF
)
        echo "$cost_data" >> "${TELEMETRY_DIR}/cost_metrics.jsonl"
    fi
}

# 主执行
main() {
    # 检查是否有 Token 数据
    if [[ "$TOKEN_INPUT" == "0" && "$TOKEN_OUTPUT" == "0" ]]; then
        # 没有 Token 数据，跳过
        exit 0
    fi
    
    record_token_metrics
    record_cost
}

main

exit 0
