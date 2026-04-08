#!/bin/bash
# session-start.sh - 会话启动钩子
# 在 Agent 会话开始时自动执行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SESSION_ID="${AHARNESS_SESSION_ID:-}"
if [[ -z "$SESSION_ID" ]]; then
    echo "⚠️  No session ID provided"
    exit 0
fi

echo "🔧 Running session-start hooks..."

# 获取系统信息
gather_system_info() {
    local info_file="${PROJECT_ROOT}/runtime/sessions/${SESSION_ID}/system-info.json"
    mkdir -p "$(dirname "$info_file")"
    
    cat > "$info_file" << EOF
{
  "hostname": "$(hostname)",
  "os": "$(uname -s)",
  "arch": "$(uname -m)",
  "shell": "${SHELL:-unknown}",
  "start_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "session_id": "${SESSION_ID}"
}
EOF
}

# 1. 加载上下文记忆
load_context() {
    local memory_dir="${PROJECT_ROOT}/memory/sessions/${SESSION_ID}"
    if [[ -d "$memory_dir" ]]; then
        echo "  📂 Loading previous context..."
        # 恢复上次的任务状态
        if [[ -f "${memory_dir}/TASK.md" ]]; then
            cp "${memory_dir}/TASK.md" "${PROJECT_ROOT}/runtime/sessions/${SESSION_ID}/"
        fi
    fi
}

# 2. 检查约束配置
check_constraints() {
    echo "  🔒 Loading constraints..."
    
    # 加载硬约束
    if [[ -f "${PROJECT_ROOT}/constraints/hard-constraints.yaml" ]]; then
        export AHARNESS_HARD_CONSTRAINTS="${PROJECT_ROOT}/constraints/hard-constraints.yaml"
    fi
    
    # 加载软约束
    if [[ -f "${PROJECT_ROOT}/constraints/soft-constraints.yaml" ]]; then
        export AHARNESS_SOFT_CONSTRAINTS="${PROJECT_ROOT}/constraints/soft-constraints.yaml"
    fi
    
    # 加载工具策略
    if [[ -f "${PROJECT_ROOT}/constraints/tools-policy.yaml" ]]; then
        export AHARNESS_TOOLS_POLICY="${PROJECT_ROOT}/constraints/tools-policy.yaml"
    fi
}

# 3. 初始化遥测（增强版）
init_telemetry() {
    echo "  📊 Initializing telemetry..."
    
    local telemetry_dir="${PROJECT_ROOT}/runtime/telemetry/${SESSION_ID}"
    mkdir -p "$telemetry_dir"
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # 创建会话轨迹文件（JSON Lines 格式）
    cat > "${telemetry_dir}/trace.jsonl" << EOF
{"event": "session_start", "session_id": "${SESSION_ID}", "timestamp": "${timestamp}", "level": "INFO"}
EOF
    
    # 创建结构化日志
    cat > "${telemetry_dir}/events.jsonl" << EOF
{"type": "session.start", "session_id": "${SESSION_ID}", "timestamp": "${timestamp}", "data": {"profile": "${AHARNESS_HOOK_PROFILE:-standard}"}}
EOF
    
    # 初始化指标
    cat > "${telemetry_dir}/metrics.json" << 'EOF'
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
    "total_duration_ms": 0
  },
  "resources": {
    "files_read": 0,
    "files_written": 0,
    "commands_executed": 0
  }
}
EOF
    
    # 更新开始时间
    python3 << EOF
import json
with open('${telemetry_dir}/metrics.json', 'r') as f:
    metrics = json.load(f)
metrics['session']['start_time'] = '${timestamp}'
with open('${telemetry_dir}/metrics.json', 'w') as f:
    json.dump(metrics, f, indent=2)
EOF
    
    # 创建 OpenTelemetry 兼容的 span
    cat > "${telemetry_dir}/spans.jsonl" << EOF
{"trace_id": "${SESSION_ID}", "span_id": "session-root", "parent_span_id": null, "name": "session", "start_time": "${timestamp}", "end_time": null, "status": "UNSET", "attributes": {"session.id": "${SESSION_ID}"}}
EOF
}

# 4. 加载活跃技能
load_skills() {
    echo "  🛠️  Loading active skills..."
    
    local skills_file="${PROJECT_ROOT}/runtime/sessions/${SESSION_ID}/active-skills.txt"
    if [[ -f "$skills_file" ]]; then
        while IFS= read -r skill; do
            echo "     - $skill"
        done < "$skills_file"
    fi
}

# 5. 记录启动事件到中央日志
log_to_central() {
    local central_log="${PROJECT_ROOT}/runtime/telemetry/all-sessions.jsonl"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    echo "{\"event\": \"session_start\", \"session_id\": \"${SESSION_ID}\", \"timestamp\": \"${timestamp}\", \"profile\": \"${AHARNESS_HOOK_PROFILE:-standard}\"}" >> "$central_log"
}

# 6. 显示欢迎信息
show_welcome() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║     🚀 Harness Session Started         ║"
    echo "╠════════════════════════════════════════╣"
    echo "║  Session: ${SESSION_ID:0:30}"
    echo "║  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
    echo "║  Mode:   ${AHARNESS_HOOK_PROFILE:-standard}"
    echo "╚════════════════════════════════════════╝"
    echo ""
}

# 执行钩子
gather_system_info
load_context
check_constraints
init_telemetry
load_skills
log_to_central
show_welcome

echo "✅ Session-start hooks completed"
