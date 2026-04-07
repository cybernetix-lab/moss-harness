#!/bin/bash
# skill-usage.sh - 技能使用追踪钩子
# 在技能被使用时记录性能数据

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 参数
SKILL_NAME="${1:-}"
ACTION="${2:-}"  # start, success, failure
QUERY="${3:-}"

if [[ -z "$SKILL_NAME" || -z "$ACTION" ]]; then
    exit 0
fi

# 确保统计目录存在
STATS_DIR="${PROJECT_ROOT}/memory/skill-stats"
mkdir -p "$STATS_DIR"

HISTORY_DIR="${PROJECT_ROOT}/memory/skill-history"
mkdir -p "$HISTORY_DIR"

STATS_FILE="${STATS_DIR}/${SKILL_NAME}.json"
HISTORY_FILE="${HISTORY_DIR}/${SKILL_NAME}.jsonl"

# 初始化统计文件
init_stats() {
    if [[ ! -f "$STATS_FILE" ]]; then
        cat > "$STATS_FILE" << 'EOF'
{
  "skill_name": "",
  "usage_count": 0,
  "success_count": 0,
  "failure_count": 0,
  "patterns_extracted": 0,
  "first_used": null,
  "last_used": null,
  "avg_duration_ms": 0,
  "total_duration_ms": 0,
  "performance_history": []
}
EOF
        # 设置技能名称
        python3 << EOF
import json
with open('${STATS_FILE}', 'r') as f:
    data = json.load(f)
data['skill_name'] = '${SKILL_NAME}'
with open('${STATS_FILE}', 'w') as f:
    json.dump(data, f, indent=2)
EOF
    fi
}

# 记录使用开始
record_start() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # 记录开始时间
    echo "$(date +%s%N | cut -b1-13)" > "/tmp/skill_${SKILL_NAME}_start"
    
    # 记录历史
    echo "{\"event\": \"start\", \"timestamp\": \"${timestamp}\", \"query\": \"${QUERY}\"}" >> "$HISTORY_FILE"
}

# 记录成功
record_success() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local start_file="/tmp/skill_${SKILL_NAME}_start"
    local duration=0
    
    if [[ -f "$start_file" ]]; then
        local start_time=$(cat "$start_file")
        local end_time=$(date +%s%N | cut -b1-13)
        duration=$((end_time - start_time))
        rm -f "$start_file"
    fi
    
    # 更新统计
    python3 << EOF
import json
from datetime import datetime

try:
    with open('${STATS_FILE}', 'r') as f:
        stats = json.load(f)
    
    # 更新计数
    stats['usage_count'] += 1
    stats['success_count'] += 1
    
    # 更新时间
    if stats['first_used'] is None:
        stats['first_used'] = '${timestamp}'
    stats['last_used'] = '${timestamp}'
    
    # 更新性能指标
    duration = ${duration}
    stats['total_duration_ms'] += duration
    if stats['usage_count'] > 0:
        stats['avg_duration_ms'] = stats['total_duration_ms'] / stats['usage_count']
    
    # 添加到历史
    stats['performance_history'].append({
        'timestamp': '${timestamp}',
        'duration_ms': duration,
        'success': True
    })
    
    # 只保留最近 100 条记录
    if len(stats['performance_history']) > 100:
        stats['performance_history'] = stats['performance_history'][-100:]
    
    with open('${STATS_FILE}', 'w') as f:
        json.dump(stats, f, indent=2)
        
except Exception as e:
    print(f"Error updating stats: {e}")
EOF
    
    # 记录历史
    echo "{\"event\": \"success\", \"timestamp\": \"${timestamp}\", \"duration_ms\": ${duration}, \"query\": \"${QUERY}\"}" >> "$HISTORY_FILE"
}

# 记录失败
record_failure() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local error_reason="${4:-unknown}"
    
    # 更新统计
    python3 << EOF
import json

try:
    with open('${STATS_FILE}', 'r') as f:
        stats = json.load(f)
    
    # 更新计数
    stats['usage_count'] += 1
    stats['failure_count'] += 1
    stats['last_used'] = '${timestamp}'
    
    # 添加到历史
    stats['performance_history'].append({
        'timestamp': '${timestamp}',
        'success': False,
        'reason': '${error_reason}'
    })
    
    # 只保留最近 100 条记录
    if len(stats['performance_history']) > 100:
        stats['performance_history'] = stats['performance_history'][-100:]
    
    with open('${STATS_FILE}', 'w') as f:
        json.dump(stats, f, indent=2)
        
except Exception as e:
    print(f"Error updating stats: {e}")
EOF
    
    # 记录历史
    echo "{\"event\": \"failure\", \"timestamp\": \"${timestamp}\", \"reason\": \"${error_reason}\", \"query\": \"${QUERY}\"}" >> "$HISTORY_FILE"
}

# 提取成功模式
extract_pattern() {
    local output="${4:-}"
    
    if [[ -z "$output" ]]; then
        return
    fi
    
    # 提取代码模式（简化版）
    local skill_dir="${PROJECT_ROOT}/skills"
    local pattern_dir="${skill_dir}/extracted-patterns"
    mkdir -p "$pattern_dir"
    
    # 保存成功输出作为潜在模式
    local pattern_file="${pattern_dir}/${SKILL_NAME}-$(date +%s).txt"
    echo "$output" > "$pattern_file"
    
    # 更新统计
    python3 << EOF
import json

try:
    with open('${STATS_FILE}', 'r') as f:
        stats = json.load(f)
    
    stats['patterns_extracted'] += 1
    
    with open('${STATS_FILE}', 'w') as f:
        json.dump(stats, f, indent=2)
except:
    pass
EOF
}

# 主逻辑
case "$ACTION" in
    start)
        init_stats
        record_start
        ;;
    success)
        init_stats
        record_success
        # 如果有输出，提取模式
        if [[ -n "$QUERY" ]]; then
            extract_pattern "$QUERY"
        fi
        ;;
    failure)
        init_stats
        record_failure
        ;;
    *)
        exit 0
        ;;
esac
