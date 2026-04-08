#!/bin/bash
# post-action.sh - 动作后钩子
# 在每个 Agent 动作执行后记录和更新状态

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ACTION_TYPE="${1:-}"
ACTION_RESULT="${2:-}"  # success 或 error

if [[ -z "$ACTION_TYPE" ]]; then
    exit 0
fi

SESSION_ID="${AHARNESS_SESSION_ID:-unknown}"
SESSION_DIR="${PROJECT_ROOT}/runtime/sessions/${SESSION_ID}"
TELEMETRY_DIR="${PROJECT_ROOT}/runtime/telemetry/${SESSION_ID}"

mkdir -p "$TELEMETRY_DIR"

# 获取当前动作 ID
ACTION_ID="${AHARNESS_CURRENT_ACTION_ID:-unknown}"
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 1. 记录动作结果（增强版）
log_result() {
    local trace_file="${TELEMETRY_DIR}/trace.jsonl"
    local events_file="${TELEMETRY_DIR}/events.jsonl"
    
    # 记录到 trace
    echo "{\"event\": \"post_action\", \"action\": \"${ACTION_TYPE}\", \"action_id\": \"${ACTION_ID}\", \"result\": \"${ACTION_RESULT}\", \"timestamp\": \"${timestamp}\", \"level\": \"INFO\"}" >> "$trace_file"
    
    # 记录结构化事件
    local event_data="{\"type\": \"action.end\", \"action_id\": \"${ACTION_ID}\", \"action_type\": \"${ACTION_TYPE}\", \"timestamp\": \"${timestamp}\", \"data\": {\"result\": \"${ACTION_RESULT}\"}}"
    echo "$event_data" >> "$events_file"
}

# 2. 计算并记录动作持续时间
calculate_duration() {
    local start_file="${TELEMETRY_DIR}/.action_${ACTION_ID}_start"
    
    if [[ -f "$start_file" ]]; then
        local start_time=$(cat "$start_file")
        local end_time=$(date +%s%N | cut -b1-13)
        local duration=$((end_time - start_time))
        
        # 记录持续时间事件
        echo "{\"type\": \"action.duration\", \"action_id\": \"${ACTION_ID}\", \"action_type\": \"${ACTION_TYPE}\", \"timestamp\": \"${timestamp}\", \"data\": {\"duration_ms\": ${duration}, \"result\": \"${ACTION_RESULT}\"}}" >> "${TELEMETRY_DIR}/events.jsonl"
        
        # 清理临时文件
        rm -f "$start_file"
        
        echo "$duration"
    else
        echo "0"
    fi
}

# 3. 更新指标（增强版）
update_metrics() {
    local duration="$1"
    local metrics_file="${TELEMETRY_DIR}/metrics.json"
    
    # 初始化指标文件
    if [[ ! -f "$metrics_file" ]]; then
        cat > "$metrics_file" << 'EOF'
{
  "session": {
    "start_time": null,
    "actions_count": 0,
    "successful_actions": 0,
    "failed_actions": 0,
    "checkpoints_created": 0
  },
  "performance": {
    "avg_action_duration_ms": 0,
    "total_duration_ms": 0,
    "min_duration_ms": 0,
    "max_duration_ms": 0
  },
  "resources": {
    "files_read": 0,
    "files_written": 0,
    "commands_executed": 0
  },
  "actions": {}
}
EOF
    fi
    
    # 更新指标
    python3 << EOF
import json

try:
    with open('${metrics_file}', 'r') as f:
        metrics = json.load(f)
    
    # 更新会话指标
    metrics['session']['actions_count'] += 1
    
    if '${ACTION_RESULT}' == 'success':
        metrics['session']['successful_actions'] += 1
    else:
        metrics['session']['failed_actions'] += 1
    
    # 更新性能指标
    duration = ${duration}
    perf = metrics['performance']
    
    if perf['total_duration_ms'] == 0:
        perf['avg_action_duration_ms'] = duration
        perf['min_duration_ms'] = duration
        perf['max_duration_ms'] = duration
    else:
        total_actions = metrics['session']['actions_count']
        perf['avg_action_duration_ms'] = (perf['avg_action_duration_ms'] * (total_actions - 1) + duration) / total_actions
        perf['min_duration_ms'] = min(perf['min_duration_ms'], duration)
        perf['max_duration_ms'] = max(perf['max_duration_ms'], duration)
    
    perf['total_duration_ms'] += duration
    
    # 更新动作类型统计
    action_type = '${ACTION_TYPE}'
    if 'actions' not in metrics:
        metrics['actions'] = {}
    
    if action_type not in metrics['actions']:
        metrics['actions'][action_type] = {
            'count': 0,
            'success': 0,
            'fail': 0,
            'avg_duration_ms': 0,
            'total_duration_ms': 0
        }
    
    action_stats = metrics['actions'][action_type]
    action_stats['count'] += 1
    action_stats['total_duration_ms'] += duration
    
    if '${ACTION_RESULT}' == 'success':
        action_stats['success'] += 1
    else:
        action_stats['fail'] += 1
    
    action_stats['avg_duration_ms'] = action_stats['total_duration_ms'] / action_stats['count']
    
    # 更新资源指标
    if 'resources' not in metrics:
        metrics['resources'] = {
            'files_read': 0,
            'files_written': 0,
            'commands_executed': 0
        }
    
    if action_type == 'file_read':
        metrics['resources']['files_read'] += 1
    elif action_type == 'file_write':
        metrics['resources']['files_written'] += 1
    elif action_type == 'command_execute':
        metrics['resources']['commands_executed'] += 1
    
    with open('${metrics_file}', 'w') as f:
        json.dump(metrics, f, indent=2)
        
except Exception as e:
    print(f"Error updating metrics: {e}")
EOF
}

# 4. 更新 OpenTelemetry span
update_span() {
    local duration="$1"
    local spans_file="${TELEMETRY_DIR}/spans.jsonl"
    
    if [[ -f "$spans_file" && "$ACTION_ID" != "unknown" ]]; then
        python3 << EOF
import json

spans = []
updated = False

try:
    with open('${spans_file}', 'r') as f:
        for line in f:
            if line.strip():
                span = json.loads(line.strip())
                if span.get('span_id') == '${ACTION_ID}':
                    span['end_time'] = '${timestamp}'
                    span['status'] = 'OK' if '${ACTION_RESULT}' == 'success' else 'ERROR'
                    span['attributes']['duration_ms'] = ${duration}
                    updated = True
                spans.append(span)
    
    if updated:
        with open('${spans_file}', 'w') as f:
            for span in spans:
                f.write(json.dumps(span) + '\n')
except Exception as e:
    print(f"Error updating span: {e}")
EOF
    fi
}

# 5. 检查是否需要自动检查点
check_auto_checkpoint() {
    local config_file="${PROJECT_ROOT}/telemetry/config.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        return 0
    fi
    
    # 读取检查点配置
    local auto_create=$(grep "auto_create:" "$config_file" -A 3 | grep "on_success:" | awk '{print $2}')
    
    if [[ "$auto_create" == "true" && "$ACTION_RESULT" == "success" ]]; then
        # 检查是否应该创建检查点
        local last_checkpoint_file="${SESSION_DIR}/.last_checkpoint"
        local current_time=$(date +%s)
        local interval_minutes=10
        
        if [[ -f "$last_checkpoint_file" ]]; then
            local last_checkpoint=$(cat "$last_checkpoint_file")
            local elapsed=$(( (current_time - last_checkpoint) / 60 ))
            
            if [[ $elapsed -ge $interval_minutes ]]; then
                echo "  🔄 Creating auto-checkpoint..."
                "${PROJECT_ROOT}/scripts/create-checkpoint.sh" "Auto-checkpoint after ${ACTION_TYPE}"
                echo "$current_time" > "$last_checkpoint_file"
                
                # 记录检查点创建事件
                echo "{\"type\": \"checkpoint.created\", \"action_id\": \"${ACTION_ID}\", \"timestamp\": \"${timestamp}\", \"data\": {\"reason\": \"auto\", \"trigger\": \"${ACTION_TYPE}\"}}" >> "${TELEMETRY_DIR}/events.jsonl"
            fi
        else
            echo "$current_time" > "$last_checkpoint_file"
        fi
    fi
}

# 6. 更新上下文（如果需要）
update_context() {
    # 根据动作类型决定是否需要更新上下文
    case "$ACTION_TYPE" in
        file_write|file_delete)
            # 可能需要更新进度
            ;;
        test_run)
            if [[ "$ACTION_RESULT" == "success" ]]; then
                # 测试通过，可以更新进度
                :
            fi
            ;;
    esac
}

# 7. 记录错误详情（如果失败）
log_error_details() {
    if [[ "$ACTION_RESULT" == "error" ]]; then
        local error_data="${3:-}"
        
        echo "{\"type\": \"action.error\", \"action_id\": \"${ACTION_ID}\", \"action_type\": \"${ACTION_TYPE}\", \"timestamp\": \"${timestamp}\", \"data\": {\"error\": \"${error_data}\"}}" >> "${TELEMETRY_DIR}/events.jsonl"
    fi
}

# 执行钩子
log_result
duration=$(calculate_duration)
update_metrics "$duration"
update_span "$duration"
check_auto_checkpoint
update_context
log_error_details

exit 0
