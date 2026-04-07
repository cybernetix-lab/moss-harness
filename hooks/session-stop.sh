#!/bin/bash
# session-stop.sh - 会话结束钩子
# 在 Agent 会话结束时自动执行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SESSION_ID="${ECC_SESSION_ID:-}"
if [[ -z "$SESSION_ID" ]]; then
    echo "⚠️  No session ID provided"
    exit 0
fi

echo "🔧 Running session-stop hooks..."

SESSION_DIR="${PROJECT_ROOT}/runtime/sessions/${SESSION_ID}"
MEMORY_DIR="${PROJECT_ROOT}/memory/sessions/${SESSION_ID}"
TELEMETRY_DIR="${PROJECT_ROOT}/runtime/telemetry/${SESSION_ID}"

end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 1. 保存上下文记忆
save_context() {
    echo "  💾 Saving context to memory..."
    
    mkdir -p "$MEMORY_DIR"
    
    # 保存任务状态
    if [[ -f "${SESSION_DIR}/TASK.md" ]]; then
        cp "${SESSION_DIR}/TASK.md" "${MEMORY_DIR}/"
    fi
    
    # 保存决策记录
    if [[ -f "${SESSION_DIR}/DECISIONS.md" ]]; then
        cp "${SESSION_DIR}/DECISIONS.md" "${MEMORY_DIR}/"
    fi
    
    # 保存进度
    if [[ -f "${SESSION_DIR}/PROGRESS.md" ]]; then
        cp "${SESSION_DIR}/PROGRESS.md" "${MEMORY_DIR}/"
    fi
    
    # 保存元数据
    if [[ -f "${SESSION_DIR}/meta.json" ]]; then
        cp "${SESSION_DIR}/meta.json" "${MEMORY_DIR}/"
    fi
}

# 2. 生成会话摘要（增强版）
generate_summary() {
    echo "  📝 Generating session summary..."
    
    local summary_file="${MEMORY_DIR}/summary.md"
    local start_time=""
    
    # 读取开始时间
    if [[ -f "${SESSION_DIR}/meta.json" ]]; then
        start_time=$(cat "${SESSION_DIR}/meta.json" | grep -o '"started_at": "[^"]*"' | cut -d'"' -f4)
    fi
    
    # 读取指标
    local metrics_file="${TELEMETRY_DIR}/metrics.json"
    local actions_count=0
    local successful_actions=0
    local failed_actions=0
    
    if [[ -f "$metrics_file" ]]; then
        actions_count=$(cat "$metrics_file" | python3 -c "import json,sys; print(json.load(sys.stdin)['session']['actions_count'])" 2>/dev/null || echo 0)
        successful_actions=$(cat "$metrics_file" | python3 -c "import json,sys; print(json.load(sys.stdin)['session']['successful_actions'])" 2>/dev/null || echo 0)
        failed_actions=$(cat "$metrics_file" | python3 -c "import json,sys; print(json.load(sys.stdin)['session']['failed_actions'])" 2>/dev/null || echo 0)
    fi
    
    cat > "$summary_file" << EOF
# Session Summary

## Session Info
- ID: ${SESSION_ID}
- Started: ${start_time}
- Ended: ${end_time}

## Statistics
- Total Actions: ${actions_count}
- Successful: ${successful_actions}
- Failed: ${failed_actions}
- Success Rate: $(if [[ $actions_count -gt 0 ]]; then echo "$(( successful_actions * 100 / actions_count ))%"; else echo "N/A"; fi)

## Goals Achieved
<!-- 完成的目标 -->

## Key Decisions
<!-- 关键决策 -->

## Code Changes
<!-- 代码变更摘要 -->

## Learnings
<!-- 学到的经验 -->

## Next Session
<!-- 下次会话建议 -->
EOF
}

# 3. 提取技能模式
extract_patterns() {
    echo "  🔍 Extracting reusable patterns..."
    
    local patterns_file="${PROJECT_ROOT}/memory/extracted-patterns/${SESSION_ID}.yaml"
    mkdir -p "$(dirname "$patterns_file")"
    
    # 分析会话中的成功模式
    cat > "$patterns_file" << EOF
# Extracted Patterns from ${SESSION_ID}
extraction_date: ${end_time}
patterns: []
# 这里可以存储从会话中提取的可复用模式
EOF
}

# 4. 归档遥测数据（增强版）
archive_telemetry() {
    echo "  📊 Archiving telemetry..."
    
    local archive_dir="${PROJECT_ROOT}/memory/telemetry/${SESSION_ID}"
    
    if [[ -d "$TELEMETRY_DIR" ]]; then
        mkdir -p "$archive_dir"
        cp -r "$TELEMETRY_DIR"/* "$archive_dir/" 2>/dev/null || true
    fi
    
    # 记录会话结束事件到 trace
    echo "{\"event\": \"session_end\", \"session_id\": \"${SESSION_ID}\", \"timestamp\": \"${end_time}\", \"level\": \"INFO\"}" >> "${archive_dir}/trace.jsonl"
    
    # 记录结构化事件
    echo "{\"type\": \"session.end\", \"session_id\": \"${SESSION_ID}\", \"timestamp\": \"${end_time}\", \"data\": {}}" >> "${archive_dir}/events.jsonl"
    
    # 更新 span 结束时间
    if [[ -f "${archive_dir}/spans.jsonl" ]]; then
        python3 << EOF
import json

spans = []
with open('${archive_dir}/spans.jsonl', 'r') as f:
    for line in f:
        span = json.loads(line.strip())
        if span['span_id'] == 'session-root':
            span['end_time'] = '${end_time}'
            span['status'] = 'OK'
        spans.append(span)

with open('${archive_dir}/spans.jsonl', 'w') as f:
    for span in spans:
        f.write(json.dumps(span) + '\n')
EOF
    fi
    
    # 生成最终报告
    generate_telemetry_report "$archive_dir"
}

# 生成遥测报告
generate_telemetry_report() {
    local archive_dir="$1"
    local report_file="${archive_dir}/report.json"
    
    python3 << EOF
import json
from datetime import datetime

# 读取指标
metrics = {}
try:
    with open('${archive_dir}/metrics.json', 'r') as f:
        metrics = json.load(f)
except:
    pass

# 读取事件统计
events = []
try:
    with open('${archive_dir}/events.jsonl', 'r') as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
except:
    pass

# 计算会话时长
start_time = metrics.get('session', {}).get('start_time', '')
duration_seconds = 0
if start_time:
    try:
        start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end = datetime.fromisoformat('${end_time}'.replace('Z', '+00:00'))
        duration_seconds = (end - start).total_seconds()
    except:
        pass

report = {
    "session_id": "${SESSION_ID}",
    "start_time": start_time,
    "end_time": "${end_time}",
    "duration_seconds": duration_seconds,
    "summary": {
        "total_actions": metrics.get('session', {}).get('actions_count', 0),
        "successful_actions": metrics.get('session', {}).get('successful_actions', 0),
        "failed_actions": metrics.get('session', {}).get('failed_actions', 0),
        "success_rate": 0
    },
    "performance": metrics.get('performance', {}),
    "resources": metrics.get('resources', {}),
    "event_count": len(events)
}

# 计算成功率
if report['summary']['total_actions'] > 0:
    report['summary']['success_rate'] = round(
        report['summary']['successful_actions'] / report['summary']['total_actions'] * 100, 2
    )

with open('${report_file}', 'w') as f:
    json.dump(report, f, indent=2)

print(f"    📄 Report generated: {report_file}")
EOF
}

# 5. 更新统计信息
update_stats() {
    echo "  📈 Updating statistics..."
    
    local stats_file="${PROJECT_ROOT}/memory/stats.json"
    
    # 读取当前指标
    local actions_count=0
    if [[ -f "${TELEMETRY_DIR}/metrics.json" ]]; then
        actions_count=$(cat "${TELEMETRY_DIR}/metrics.json" | python3 -c "import json,sys; print(json.load(sys.stdin)['session']['actions_count'])" 2>/dev/null || echo 0)
    fi
    
    # 初始化或更新统计
    python3 << EOF
import json
import os

stats_file = '${stats_file}'
stats = {"total_sessions": 0, "total_actions": 0, "total_duration_seconds": 0}

if os.path.exists(stats_file):
    try:
        with open(stats_file, 'r') as f:
            stats = json.load(f)
    except:
        pass

stats['total_sessions'] += 1
stats['total_actions'] += ${actions_count}

with open(stats_file, 'w') as f:
    json.dump(stats, f, indent=2)
EOF
}

# 6. 记录到中央日志
log_to_central() {
    local central_log="${PROJECT_ROOT}/runtime/telemetry/all-sessions.jsonl"
    
    echo "{\"event\": \"session_end\", \"session_id\": \"${SESSION_ID}\", \"timestamp\": \"${end_time}\"}" >> "$central_log"
}

# 7. 清理临时文件
cleanup() {
    echo "  🧹 Cleaning up temporary files..."
    
    # 保留检查点，但清理临时文件
    find "$SESSION_DIR" -name "*.tmp" -delete 2>/dev/null || true
}

# 执行钩子
save_context
generate_summary
extract_patterns
archive_telemetry
update_stats
log_to_central
cleanup

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     👋 Harness Session Ended           ║"
echo "╠════════════════════════════════════════╣"
echo "║  Session: ${SESSION_ID:0:30}"
echo "║  Memory:  ${MEMORY_DIR}"
echo "╚════════════════════════════════════════╝"
echo ""

echo "✅ Session-stop hooks completed"
