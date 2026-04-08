#!/bin/bash
# telemetry-view.sh - Telemetry 可视化脚本
# 查看和分析会话遥测数据

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 显示帮助
show_help() {
    cat << EOF
Telemetry Viewer - 遥测数据可视化工具

用法: $0 [命令] [选项]

命令:
    list                    列出所有会话
    show <session_id>       显示指定会话的详细信息
    summary                 显示所有会话的汇总统计
    live [session_id]       实时监控会话（默认当前会话）
    export <session_id>     导出会话数据为 HTML 报告
    compare <id1> <id2>     比较两个会话

选项:
    -h, --help              显示此帮助信息

示例:
    $0 list
    $0 show abc123
    $0 summary
    $0 live
    $0 export abc123
EOF
}

# 列出所有会话
list_sessions() {
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    会话列表                                  ${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    local telemetry_dir="${PROJECT_ROOT}/runtime/telemetry"
    
    if [[ ! -d "$telemetry_dir" ]]; then
        echo -e "${YELLOW}⚠ 没有可用的遥测数据${NC}"
        return
    fi
    
    printf "%-30s %-20s %-10s\n" "Session ID" "Start Time" "Actions"
    echo "───────────────────────────────────────────────────────────────"
    
    for session_dir in "$telemetry_dir"/*; do
        if [[ -d "$session_dir" ]]; then
            local session_id=$(basename "$session_dir")
            local metrics_file="${session_dir}/metrics.json"
            
            local start_time="N/A"
            local actions_count=0
            
            if [[ -f "$metrics_file" ]]; then
                start_time=$(cat "$metrics_file" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['session']['start_time'][:19] if d['session']['start_time'] else 'N/A')" 2>/dev/null)
                actions_count=$(cat "$metrics_file" | python3 -c "import json,sys; print(json.load(sys.stdin)['session']['actions_count'])" 2>/dev/null || echo 0)
            fi
            
            printf "%-30s %-20s %-10s\n" "${session_id:0:30}" "$start_time" "$actions_count"
        fi
    done
}

# 显示会话详情
show_session() {
    local session_id="$1"
    
    if [[ -z "$session_id" ]]; then
        echo -e "${RED}✗ 请提供会话 ID${NC}"
        return 1
    fi
    
    local telemetry_dir="${PROJECT_ROOT}/runtime/telemetry/${session_id}"
    
    if [[ ! -d "$telemetry_dir" ]]; then
        echo -e "${RED}✗ 会话不存在: $session_id${NC}"
        return 1
    fi
    
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  会话详情: ${session_id:0:20}              ${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    # 显示指标
    local metrics_file="${telemetry_dir}/metrics.json"
    if [[ -f "$metrics_file" ]]; then
        echo -e "\n${CYAN}📊 会话指标${NC}"
        python3 << EOF
import json

try:
    with open('${metrics_file}', 'r') as f:
        metrics = json.load(f)
    
    session = metrics.get('session', {})
    perf = metrics.get('performance', {})
    resources = metrics.get('resources', {})
    
    print(f"  开始时间: {session.get('start_time', 'N/A')}")
    print(f"  总动作数: {session.get('actions_count', 0)}")
    print(f"  成功: {session.get('successful_actions', 0)}")
    print(f"  失败: {session.get('failed_actions', 0)}")
    
    if session.get('actions_count', 0) > 0:
        success_rate = session.get('successful_actions', 0) / session.get('actions_count', 0) * 100
        print(f"  成功率: {success_rate:.1f}%")
    
    print(f"\n  平均动作耗时: {perf.get('avg_action_duration_ms', 0):.1f}ms")
    print(f"  最小耗时: {perf.get('min_duration_ms', 0)}ms")
    print(f"  最大耗时: {perf.get('max_duration_ms', 0)}ms")
    
    print(f"\n  文件读取: {resources.get('files_read', 0)}")
    print(f"  文件写入: {resources.get('files_written', 0)}")
    print(f"  命令执行: {resources.get('commands_executed', 0)}")
    
    # 动作类型统计
    actions = metrics.get('actions', {})
    if actions:
        print(f"\n  动作类型统计:")
        for action_type, stats in sorted(actions.items(), key=lambda x: x[1]['count'], reverse=True):
            print(f"    {action_type}: {stats['count']} (成功: {stats['success']}, 失败: {stats['fail']})")
except Exception as e:
    print(f"  读取指标失败: {e}")
EOF
    fi
    
    # 显示最近事件
    local events_file="${telemetry_dir}/events.jsonl"
    if [[ -f "$events_file" ]]; then
        echo -e "\n${CYAN}📋 最近事件 (最近 10 条)${NC}"
        tail -10 "$events_file" | python3 -c "
import json
import sys

for line in sys.stdin:
    if line.strip():
        try:
            event = json.loads(line)
            event_type = event.get('type', 'unknown')
            timestamp = event.get('timestamp', 'N/A')
            action = event.get('action_type', '')
            print(f'  [{timestamp[11:19]}] {event_type} {action}')
        except:
            pass
"
    fi
    
    # 显示轨迹
    local trace_file="${telemetry_dir}/trace.jsonl"
    if [[ -f "$trace_file" ]]; then
        echo -e "\n${CYAN}📝 轨迹日志 (最近 5 条)${NC}"
        tail -5 "$trace_file" | python3 -c "
import json
import sys

for line in sys.stdin:
    if line.strip():
        try:
            trace = json.loads(line)
            event = trace.get('event', 'unknown')
            level = trace.get('level', 'INFO')
            timestamp = trace.get('timestamp', 'N/A')
            print(f'  [{timestamp[11:19]}] [{level}] {event}')
        except:
            pass
"
    fi
}

# 显示汇总统计
show_summary() {
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    汇总统计                                  ${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    local stats_file="${PROJECT_ROOT}/memory/stats.json"
    
    if [[ -f "$stats_file" ]]; then
        python3 << EOF
import json

try:
    with open('${stats_file}', 'r') as f:
        stats = json.load(f)
    
    print(f"\n📈 总体统计")
    print(f"  总会话数: {stats.get('total_sessions', 0)}")
    print(f"  总动作数: {stats.get('total_actions', 0)}")
    
    if stats.get('total_sessions', 0) > 0:
        avg_actions = stats.get('total_actions', 0) / stats.get('total_sessions', 0)
        print(f"  平均每会话动作数: {avg_actions:.1f}")
except Exception as e:
    print(f"  读取统计失败: {e}")
EOF
    else
        echo -e "${YELLOW}⚠ 暂无统计数据${NC}"
    fi
    
    # 显示所有会话的简要信息
    echo -e "\n${CYAN}📊 会话概览${NC}"
    list_sessions
}

# 实时监控
live_monitor() {
    local session_id="${1:-$AHARNESS_SESSION_ID}"
    
    if [[ -z "$session_id" ]]; then
        # 尝试获取最新的会话
        session_id=$(ls -t "${PROJECT_ROOT}/runtime/telemetry" 2>/dev/null | head -1)
    fi
    
    if [[ -z "$session_id" ]]; then
        echo -e "${RED}✗ 没有找到活动会话${NC}"
        return 1
    fi
    
    local telemetry_dir="${PROJECT_ROOT}/runtime/telemetry/${session_id}"
    
    if [[ ! -d "$telemetry_dir" ]]; then
        echo -e "${RED}✗ 会话不存在: $session_id${NC}"
        return 1
    fi
    
    echo -e "${BLUE}实时监控会话: ${session_id}${NC}"
    echo -e "${YELLOW}按 Ctrl+C 退出${NC}\n"
    
    # 使用 watch 或循环显示
    while true; do
        clear
        echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}               实时监控: ${session_id:0:20}              ${NC}"
        echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
        echo -e "更新时间: $(date '+%Y-%m-%d %H:%M:%S')\n"
        
        # 显示当前指标
        local metrics_file="${telemetry_dir}/metrics.json"
        if [[ -f "$metrics_file" ]]; then
            python3 << EOF
import json

try:
    with open('${metrics_file}', 'r') as f:
        metrics = json.load(f)
    
    session = metrics.get('session', {})
    perf = metrics.get('performance', {})
    
    print(f"📊 动作统计")
    print(f"  总计: {session.get('actions_count', 0)}")
    print(f"  ✅ 成功: {session.get('successful_actions', 0)}")
    print(f"  ❌ 失败: {session.get('failed_actions', 0)}")
    
    if session.get('actions_count', 0) > 0:
        success_rate = session.get('successful_actions', 0) / session.get('actions_count', 0) * 100
        print(f"  📈 成功率: {success_rate:.1f}%")
    
    print(f"\n⏱️  性能")
    print(f"  平均耗时: {perf.get('avg_action_duration_ms', 0):.1f}ms")
    print(f"  总耗时: {perf.get('total_duration_ms', 0) / 1000:.1f}s")
except:
    pass
EOF
        fi
        
        # 显示最近事件
        local events_file="${telemetry_dir}/events.jsonl"
        if [[ -f "$events_file" ]]; then
            echo -e "\n📋 最近事件"
            tail -5 "$events_file" | python3 -c "
import json
import sys

for line in sys.stdin:
    if line.strip():
        try:
            event = json.loads(line)
            event_type = event.get('type', 'unknown')
            timestamp = event.get('timestamp', 'N/A')
            print(f'  [{timestamp[11:19]}] {event_type}')
        except:
            pass
"
        fi
        
        echo -e "\n${YELLOW}按 Ctrl+C 退出${NC}"
        sleep 2
    done
}

# 导出 HTML 报告
export_report() {
    local session_id="$1"
    
    if [[ -z "$session_id" ]]; then
        echo -e "${RED}✗ 请提供会话 ID${NC}"
        return 1
    fi
    
    local telemetry_dir="${PROJECT_ROOT}/runtime/telemetry/${session_id}"
    
    if [[ ! -d "$telemetry_dir" ]]; then
        echo -e "${RED}✗ 会话不存在: $session_id${NC}"
        return 1
    fi
    
    local output_file="${PROJECT_ROOT}/runtime/telemetry-${session_id}-report.html"
    
    cat > "$output_file" << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Telemetry Report - SESSION_ID</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; }
        .metric-value { font-size: 32px; font-weight: bold; color: #4CAF50; }
        .metric-label { color: #666; margin-top: 5px; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: 600; }
        tr:hover { background: #f9f9f9; }
        .timestamp { color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Harness Telemetry Report</h1>
        <p class="timestamp">Session: SESSION_ID | Generated: TIMESTAMP</p>
        
        <h2>📊 Session Metrics</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value" id="total-actions">0</div>
                <div class="metric-label">Total Actions</div>
            </div>
            <div class="metric-card">
                <div class="metric-value success" id="success-actions">0</div>
                <div class="metric-label">Successful</div>
            </div>
            <div class="metric-card">
                <div class="metric-value error" id="failed-actions">0</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="success-rate">0%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>
        
        <h2>📋 Action Types</h2>
        <table id="action-types">
            <thead>
                <tr>
                    <th>Action Type</th>
                    <th>Count</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Avg Duration</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        
        <h2>📈 Performance</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value" id="avg-duration">0ms</div>
                <div class="metric-label">Avg Duration</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="min-duration">0ms</div>
                <div class="metric-label">Min Duration</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="max-duration">0ms</div>
                <div class="metric-label">Max Duration</div>
            </div>
        </div>
        
        <h2>📝 Recent Events</h2>
        <table id="events">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
    
    <script>
        // Data will be embedded here
        const telemetryData = TELEMETRY_DATA;
        
        // Populate metrics
        document.getElementById('total-actions').textContent = telemetryData.session.actions_count;
        document.getElementById('success-actions').textContent = telemetryData.session.successful_actions;
        document.getElementById('failed-actions').textContent = telemetryData.session.failed_actions;
        
        const successRate = telemetryData.session.actions_count > 0 
            ? (telemetryData.session.successful_actions / telemetryData.session.actions_count * 100).toFixed(1) + '%'
            : '0%';
        document.getElementById('success-rate').textContent = successRate;
        
        document.getElementById('avg-duration').textContent = telemetryData.performance.avg_action_duration_ms.toFixed(1) + 'ms';
        document.getElementById('min-duration').textContent = telemetryData.performance.min_duration_ms + 'ms';
        document.getElementById('max-duration').textContent = telemetryData.performance.max_duration_ms + 'ms';
        
        // Populate action types
        const actionTypesBody = document.querySelector('#action-types tbody');
        for (const [type, stats] of Object.entries(telemetryData.actions)) {
            const row = actionTypesBody.insertRow();
            row.innerHTML = `
                <td>${type}</td>
                <td>${stats.count}</td>
                <td class="success">${stats.success}</td>
                <td class="error">${stats.fail}</td>
                <td>${stats.avg_duration_ms.toFixed(1)}ms</td>
            `;
        }
    </script>
</body>
</html>
HTMLEOF

    # 替换占位符
    sed -i '' "s/SESSION_ID/$session_id/g" "$output_file"
    sed -i '' "s/TIMESTAMP/$(date)/g" "$output_file"
    
    # 嵌入数据
    local metrics_file="${telemetry_dir}/metrics.json"
    if [[ -f "$metrics_file" ]]; then
        local json_data=$(cat "$metrics_file")
        sed -i '' "s|TELEMETRY_DATA|$json_data|g" "$output_file"
    fi
    
    echo -e "${GREEN}✓ 报告已导出: $output_file${NC}"
}

# 主函数
main() {
    case "${1:-}" in
        list)
            list_sessions
            ;;
        show)
            show_session "$2"
            ;;
        summary)
            show_summary
            ;;
        live)
            live_monitor "$2"
            ;;
        export)
            export_report "$2"
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            show_help
            ;;
    esac
}

main "$@"
