#!/bin/bash
# model-call-wrapper.sh - 模型调用包装器
# 包装模型 API 调用，自动采集 Token 指标
#
# 用法:
#   source ./hooks/model-call-wrapper.sh
#   model_call "$prompt" "$system_prompt"
#
# 环境变量:
#   AHARNESS_SESSION_ID       - 会话ID
#   AHARNESS_AGENT_TYPE       - Agent类型
#   AHARNESS_OPERATION_TYPE   - 操作类型
#   AHARNESS_MODEL_PROFILE    - 模型profile (从 config/models.yaml 读取)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 加载模型配置
load_model_config() {
    local config_file="${PROJECT_ROOT}/config/models.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        echo "错误: 模型配置文件不存在: $config_file" >&2
        return 1
    fi
    
    # 获取 Agent 类型对应的模型 profile
    local agent_type="${AHARNESS_AGENT_TYPE:-unknown}"
    local profile_name="${AHARNESS_MODEL_PROFILE:-}"
    
    # 如果没有指定 profile，从 agent_models 映射中查找
    if [[ -z "$profile_name" ]]; then
        # 使用 grep 和 sed 提取 profile 名称
        profile_name=$(grep -A 1 "^  ${agent_type}:" "$config_file" 2>/dev/null | grep "profile:" | sed 's/.*profile: //' | tr -d ' ')
        
        # 如果找不到，使用 balanced 作为默认
        if [[ -z "$profile_name" ]]; then
            profile_name="balanced"
        fi
    fi
    
    echo "$profile_name"
}

# 获取模型配置
get_model_config() {
    local profile_name="$1"
    local config_file="${PROJECT_ROOT}/config/models.yaml"
    
    # 提取 profile 配置（简化版，实际使用可能需要更复杂的 YAML 解析）
    # 这里使用 grep 提取关键信息
    local in_profile=false
    local model=""
    local provider=""
    local temperature="0.2"
    local max_tokens="4096"
    
    while IFS= read -r line; do
        # 检测是否进入目标 profile
        if [[ "$line" =~ ^[[:space:]]*${profile_name}:[[:space:]]*$ ]]; then
            in_profile=true
            continue
        fi
        
        # 检测是否离开当前 profile（遇到下一个 profile 或空行）
        if [[ "$in_profile" == true && "$line" =~ ^[[:space:]]*[a-z-]+:[[:space:]]*$ && ! "$line" =~ ^[[:space:]]*${profile_name} ]]; then
            if [[ ! "$line" =~ description|provider|model|temperature|max_tokens ]]; then
                break
            fi
        fi
        
        # 提取配置项
        if [[ "$in_profile" == true ]]; then
            if [[ "$line" =~ model:[[:space:]]*(.+)$ ]]; then
                model="${BASH_REMATCH[1]}"
                model="$(echo "$model" | tr -d ' ' )"
            elif [[ "$line" =~ provider:[[:space:]]*(.+)$ ]]; then
                provider="${BASH_REMATCH[1]}"
                provider="$(echo "$provider" | tr -d ' ' )"
            elif [[ "$line" =~ temperature:[[:space:]]*(.+)$ ]]; then
                temperature="${BASH_REMATCH[1]}"
                temperature="$(echo "$temperature" | tr -d ' ' )"
            elif [[ "$line" =~ max_tokens:[[:space:]]*(.+)$ ]]; then
                max_tokens="${BASH_REMATCH[1]}"
                max_tokens="$(echo "$max_tokens" | tr -d ' ' )"
            fi
        fi
    done < "$config_file"
    
    # 输出配置
    echo "provider=${provider:-anthropic}"
    echo "model=${model:-claude-3-5-sonnet}"
    echo "temperature=${temperature:-0.2}"
    echo "max_tokens=${max_tokens:-4096}"
}

# 模型调用函数
# 参数:
#   $1 - prompt: 用户提示词
#   $2 - system_prompt: 系统提示词 (可选)
model_call() {
    local prompt="${1:-}"
    local system_prompt="${2:-}"
    
    if [[ -z "$prompt" ]]; then
        echo "错误: 缺少提示词参数" >&2
        echo "用法: model_call <prompt> [system_prompt]" >&2
        return 1
    fi
    
    # 加载模型配置
    local profile_name=$(load_model_config)
    local config=$(get_model_config "$profile_name")
    
    local provider=$(echo "$config" | grep "^provider=" | cut -d'=' -f2)
    local model_name=$(echo "$config" | grep "^model=" | cut -d'=' -f2)
    local temperature=$(echo "$config" | grep "^temperature=" | cut -d'=' -f2)
    local max_tokens=$(echo "$config" | grep "^max_tokens=" | cut -d'=' -f2)
    
    # 计算输入 Token 数
    local input_tokens=$(estimate_tokens "$prompt" "$system_prompt")
    
    # 记录调用前时间
    local start_time=$(date +%s%N | cut -b1-13)
    
    # 调用实际模型
    local response
    local output_tokens=0
    local api_error=""
    
    case "$provider" in
        anthropic)
            response=$(call_provider_api "anthropic" "$model_name" "$prompt" "$system_prompt" "$temperature" "$max_tokens" 2>&1) || api_error="$response"
            ;;
        openai)
            response=$(call_provider_api "openai" "$model_name" "$prompt" "$system_prompt" "$temperature" "$max_tokens" 2>&1) || api_error="$response"
            ;;
        *)
            # 默认使用 mock 模式
            response="[MOCK RESPONSE] Provider: $provider, Model: $model_name"
            output_tokens=$((input_tokens / 2))
            ;;
    esac
    
    # 计算输出 Token 数
    if [[ -z "$api_error" ]]; then
        output_tokens=$(estimate_output_tokens "$response")
    fi
    
    # 计算调用耗时
    local end_time=$(date +%s%N | cut -b1-13)
    local duration_ms=$((end_time - start_time))
    
    # 采集 Token 指标
    capture_token_metrics "$model_name" "$input_tokens" "$output_tokens" "$prompt"
    
    # 返回响应或错误
    if [[ -n "$api_error" ]]; then
        echo "API 调用失败: $api_error" >&2
        return 1
    fi
    
    echo "$response"
    return 0
}

# 估算 Token 数量
estimate_tokens() {
    local prompt="$1"
    local system_prompt="$2"
    
    local total_text="${system_prompt} ${prompt}"
    local char_count=${#total_text}
    
    # 粗略估算：每 4 个字符约 1 个 token
    local estimated=$((char_count / 4))
    
    if [[ $estimated -lt 1 ]]; then
        estimated=1
    fi
    
    echo "$estimated"
}

# 估算输出 Token 数量
estimate_output_tokens() {
    local response="$1"
    local char_count=${#response}
    local estimated=$((char_count / 4))
    
    if [[ $estimated -lt 1 ]]; then
        estimated=1
    fi
    
    echo "$estimated"
}

# 采集 Token 指标
capture_token_metrics() {
    local model="$1"
    local input_tokens="$2"
    local output_tokens="$3"
    local prompt="$4"
    
    # 确定脚本目录（兼容 source 和直接执行）
    local script_dir
    if [[ -n "${BASH_SOURCE[0]}" && -f "${BASH_SOURCE[0]}" ]]; then
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    else
        script_dir="${PROJECT_ROOT}/hooks"
    fi
    
    # 调用 token-metrics.sh
    local token_metrics_script="${script_dir}/token-metrics.sh"
    if [[ -x "$token_metrics_script" ]]; then
        export AHARNESS_MODEL_NAME="$model"
        "$token_metrics_script" "$input_tokens" "$output_tokens" "$prompt"
    elif [[ -f "$token_metrics_script" ]]; then
        export AHARNESS_MODEL_NAME="$model"
        bash "$token_metrics_script" "$input_tokens" "$output_tokens" "$prompt"
    fi
}

# 统一的 Provider API 调用
call_provider_api() {
    local provider="$1"
    local model="$2"
    local prompt="$3"
    local system_prompt="$4"
    local temperature="$5"
    local max_tokens="$6"
    
    case "$provider" in
        anthropic)
            call_anthropic_api "$model" "$prompt" "$system_prompt" "$temperature" "$max_tokens"
            ;;
        openai)
            call_openai_api "$model" "$prompt" "$system_prompt" "$temperature" "$max_tokens"
            ;;
        *)
            echo "错误: 不支持的 provider: $provider" >&2
            return 1
            ;;
    esac
}

# Anthropic API 调用
call_anthropic_api() {
    local model="$1"
    local prompt="$2"
    local system_prompt="$3"
    local temperature="${4:-0.2}"
    local max_tokens="${5:-4096}"
    
    if [[ -z "$ANTHROPIC_API_KEY" ]]; then
        echo "错误: 未设置 ANTHROPIC_API_KEY" >&2
        return 1
    fi
    
    local request_body
    if [[ -n "$system_prompt" ]]; then
        request_body=$(cat <<EOF
{
  "model": "$model",
  "max_tokens": $max_tokens,
  "temperature": $temperature,
  "system": "$system_prompt",
  "messages": [
    {"role": "user", "content": "$prompt"}
  ]
}
EOF
)
    else
        request_body=$(cat <<EOF
{
  "model": "$model",
  "max_tokens": $max_tokens,
  "temperature": $temperature,
  "messages": [
    {"role": "user", "content": "$prompt"}
  ]
}
EOF
)
    fi
    
    curl -s -X POST "https://api.anthropic.com/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -d "$request_body" 2>/dev/null
}

# OpenAI API 调用
call_openai_api() {
    local model="$1"
    local prompt="$2"
    local system_prompt="$3"
    local temperature="${4:-0.2}"
    local max_tokens="${5:-4096}"
    
    if [[ -z "$OPENAI_API_KEY" ]]; then
        echo "错误: 未设置 OPENAI_API_KEY" >&2
        return 1
    fi
    
    local messages
    if [[ -n "$system_prompt" ]]; then
        messages="[{\"role\": \"system\", \"content\": \"$system_prompt\"}, {\"role\": \"user\", \"content\": \"$prompt\"}]"
    else
        messages="[{\"role\": \"user\", \"content\": \"$prompt\"}]"
    fi
    
    curl -s -X POST "https://api.openai.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d "{
            \"model\": \"$model\",
            \"messages\": $messages,
            \"temperature\": $temperature,
            \"max_tokens\": $max_tokens
        }" 2>/dev/null
}

# 显示帮助信息
show_help() {
    echo "模型调用包装器"
    echo ""
    echo "用法:"
    echo "  source $0"
    echo "  model_call <prompt> [system_prompt]"
    echo ""
    echo "或直接执行:"
    echo "  $0 <prompt> [system_prompt]"
    echo ""
    echo "示例:"
    echo '  model_call "Hello, how are you?" "You are a helpful assistant"'
    echo ""
    echo "环境变量:"
    echo "  AHARNESS_SESSION_ID       - 会话ID (必需)"
    echo "  AHARNESS_AGENT_TYPE       - Agent类型 (必需，用于选择模型profile)"
    echo "  AHARNESS_OPERATION_TYPE   - 操作类型 (必需)"
    echo "  AHARNESS_MODEL_PROFILE    - 强制指定模型profile (可选)"
    echo "  ANTHROPIC_API_KEY    - Anthropic API Key"
    echo "  OPENAI_API_KEY       - OpenAI API Key"
    echo ""
    echo "模型配置:"
    echo "  模型配置已从脚本中剥离，现在从 config/models.yaml 读取"
    echo "  根据 AHARNESS_AGENT_TYPE 自动选择对应的模型 profile"
}

# 主入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -ge 1 ]]; then
        model_call "$@"
    else
        show_help
    fi
fi
