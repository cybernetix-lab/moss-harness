#!/bin/bash
# pre-action.sh - 动作前钩子
# 在每个 Agent 动作执行前验证

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ACTION_TYPE="${1:-}"
ACTION_DATA="${2:-}"

if [[ -z "$ACTION_TYPE" ]]; then
    exit 0
fi

SESSION_ID="${ECC_SESSION_ID:-unknown}"
TELEMETRY_DIR="${PROJECT_ROOT}/runtime/telemetry/${SESSION_ID}"
mkdir -p "$TELEMETRY_DIR"

# 生成唯一的动作 ID
ACTION_ID="action-$(date +%s%N | cut -b1-16)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
export ECC_CURRENT_ACTION_ID="$ACTION_ID"

# 记录动作开始时间
echo "$(date +%s%N | cut -b1-13)" > "${TELEMETRY_DIR}/.action_${ACTION_ID}_start"

# 1. 检查硬约束
check_hard_constraints() {
    local constraints_file="${PROJECT_ROOT}/constraints/hard-constraints.yaml"
    
    if [[ ! -f "$constraints_file" ]]; then
        return 0
    fi
    
    # 检查文件系统约束
    if [[ "$ACTION_TYPE" == "file_write" ]]; then
        local target_path=$(echo "$ACTION_DATA" | grep -o '"path": "[^"]*"' | cut -d'"' -f4)
        
        # 检查阻塞模式
        if echo "$target_path" | grep -qE "(\.ssh|\.aws|\.env|/etc/passwd|\.pem|\.key)"; then
            log_blocked_action "$ACTION_TYPE" "Path '$target_path' matches hard constraint pattern"
            echo "❌ BLOCKED: Path '$target_path' matches hard constraint pattern"
            exit 1
        fi
    fi
    
    # 检查网络约束
    if [[ "$ACTION_TYPE" == "network_request" ]]; then
        local target_host=$(echo "$ACTION_DATA" | grep -o '"host": "[^"]*"' | cut -d'"' -f4)
        
        if echo "$target_host" | grep -qE "(localhost|127\.0\.0\.1|\.local)"; then
            log_blocked_action "$ACTION_TYPE" "Host '$target_host' is blocked by hard constraints"
            echo "❌ BLOCKED: Host '$target_host' is blocked by hard constraints"
            exit 1
        fi
    fi
}

# 2. 检查权限级别
check_permissions() {
    local constraints_file="${PROJECT_ROOT}/constraints/hard-constraints.yaml"
    local current_level="confirm_required"
    
    if [[ -f "$constraints_file" ]]; then
        current_level=$(grep "current_level:" "$constraints_file" | awk '{print $2}')
    fi
    
    case "$current_level" in
        read_only)
            if [[ "$ACTION_TYPE" =~ ^(file_write|file_delete|execute)$ ]]; then
                log_blocked_action "$ACTION_TYPE" "Action requires higher permission level (read_only)"
                echo "❌ BLOCKED: Action '$ACTION_TYPE' requires higher permission level"
                exit 1
            fi
            ;;
        confirm_required)
            if [[ "$ACTION_TYPE" =~ ^(file_write|file_delete|execute|permission_change)$ ]]; then
                # 需要确认，但这里只是记录
                log_warning "$ACTION_TYPE" "Action requires confirmation"
                echo "⚠️  WARNING: Action '$ACTION_TYPE' requires confirmation"
            fi
            ;;
        autonomous)
            # 允许所有操作
            ;;
    esac
}

# 3. 检查工具策略
check_tool_policy() {
    local policy_file="${PROJECT_ROOT}/constraints/tools-policy.yaml"
    
    if [[ ! -f "$policy_file" ]]; then
        return 0
    fi
    
    # 根据动作类型检查策略
    case "$ACTION_TYPE" in
        file_write)
            # 检查是否需要备份
            ;;
        code_execution)
            # 检查是否允许执行
            ;;
    esac
}

# 4. 记录动作日志（增强版）
log_action() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local trace_file="${TELEMETRY_DIR}/trace.jsonl"
    local events_file="${TELEMETRY_DIR}/events.jsonl"
    local spans_file="${TELEMETRY_DIR}/spans.jsonl"
    
    mkdir -p "$TELEMETRY_DIR"
    
    # 记录到 trace
    echo "{\"event\": \"pre_action\", \"action\": \"${ACTION_TYPE}\", \"action_id\": \"${ACTION_ID}\", \"timestamp\": \"${timestamp}\", \"level\": \"INFO\"}" >> "$trace_file"
    
    # 记录结构化事件
    local event_data="{\"type\": \"action.start\", \"action_id\": \"${ACTION_ID}\", \"action_type\": \"${ACTION_TYPE}\", \"timestamp\": \"${timestamp}\", \"data\": {}}"
    echo "$event_data" >> "$events_file"
    
    # 创建 OpenTelemetry span
    local span_data="{\"trace_id\": \"${SESSION_ID}\", \"span_id\": \"${ACTION_ID}\", \"parent_span_id\": \"session-root\", \"name\": \"${ACTION_TYPE}\", \"start_time\": \"${timestamp}\", \"end_time\": null, \"status\": \"UNSET\", \"attributes\": {\"action.type\": \"${ACTION_TYPE}\", \"action.id\": \"${ACTION_ID}\"}}"
    echo "$span_data" >> "$spans_file"
}

# 记录被阻止的动作
log_blocked_action() {
    local action="$1"
    local reason="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local events_file="${TELEMETRY_DIR}/events.jsonl"
    
    echo "{\"type\": \"action.blocked\", \"action_id\": \"${ACTION_ID}\", \"action_type\": \"${action}\", \"timestamp\": \"${timestamp}\", \"data\": {\"reason\": \"${reason}\"}}" >> "$events_file"
    
    # 更新指标
    update_blocked_metrics
}

# 记录警告
log_warning() {
    local action="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local events_file="${TELEMETRY_DIR}/events.jsonl"
    
    echo "{\"type\": \"action.warning\", \"action_id\": \"${ACTION_ID}\", \"action_type\": \"${action}\", \"timestamp\": \"${timestamp}\", \"data\": {\"message\": \"${message}\"}}" >> "$events_file"
}

# 更新被阻止动作的指标
update_blocked_metrics() {
    local metrics_file="${TELEMETRY_DIR}/metrics.json"
    
    if [[ -f "$metrics_file" ]]; then
        python3 << EOF
import json

try:
    with open('${metrics_file}', 'r') as f:
        metrics = json.load(f)
    
    if 'security' not in metrics:
        metrics['security'] = {'blocked_actions': 0, 'warnings': 0}
    
    metrics['security']['blocked_actions'] += 1
    
    with open('${metrics_file}', 'w') as f:
        json.dump(metrics, f, indent=2)
except:
    pass
EOF
    fi
}

# 执行检查
check_hard_constraints
check_permissions
check_tool_policy
log_action

exit 0
