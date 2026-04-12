#!/bin/bash
# telemetry-analyze.sh - 遥测数据分析工具
#
# Usage: telemetry-analyze.sh <command> [options]
# Commands:
#   trends                分析趋势
#   anomalies             检测异常
#   report [session]      生成分析报告
#   export [format]       导出数据 (json|csv|html)
#   insights              生成洞察建议

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TELEMETRY_DIR="${PROJECT_ROOT}/telemetry"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ==================== 工具函数 ====================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

# 获取遥测数据文件
get_telemetry_files() {
    local pattern="${1:-*.jsonl}"
    find "$TELEMETRY_DIR" -name "$pattern" -type f 2>/dev/null
}

# ==================== Trends Command ====================

cmd_trends() {
    log_section "Telemetry Trends Analysis"

    local events_file="${TELEMETRY_DIR}/events.jsonl"

    if [[ ! -f "$events_file" ]]; then
        log_warning "No telemetry events found"
        return
    fi

    log_info "Analyzing trends from: $events_file"

    # 统计事件类型
    echo ""
    echo "Event Type Distribution:"
    grep -o '"type":"[^"]*"' "$events_file" 2>/dev/null | \
        sed 's/"type":"//g; s/"$//g' | \
        sort | uniq -c | sort -rn | head -10 | \
        while read -r count type; do
            printf "  %-20s %5s events\n" "$type" "$count"
        done

    # 时间分布
    echo ""
    echo "Hourly Activity Distribution:"
    grep -o '"timestamp":"[^"]*"' "$events_file" 2>/dev/null | \
        sed 's/"timestamp":"//g; s/"$//g' | \
        cut -d'T' -f2 | cut -d':' -f1 | \
        sort | uniq -c | sort -t'T' -k2 | \
        while read -r count hour; do
            local bar=$(printf '%*s' "$count" '' | tr ' ' '█')
            printf "  %02s:00  %5s  %s\n" "$hour" "$count" "$bar"
        done

    # 成功率趋势
    echo ""
    echo "Success Rate by Day:"
    if command -v python3 &> /dev/null; then
        python3 << 'EOF'
import json
from collections import defaultdict
from datetime import datetime

try:
    with open('${events_file}', 'r') as f:
        daily_stats = defaultdict(lambda: {'success': 0, 'fail': 0})
        
        for line in f:
            try:
                event = json.loads(line)
                timestamp = event.get('timestamp', '')
                day = timestamp[:10] if timestamp else 'unknown'
                
                if event.get('success', False):
                    daily_stats[day]['success'] += 1
                else:
                    daily_stats[day]['fail'] += 1
            except:
                pass
        
        for day in sorted(daily_stats.keys())[-7:]:  # 最近7天
            stats = daily_stats[day]
            total = stats['success'] + stats['fail']
            if total > 0:
                rate = stats['success'] / total * 100
                print(f"  {day}: {rate:.1f}% ({stats['success']}/{total})")
except Exception as e:
    print(f"  Error: {e}")
EOF
    fi
}

# ==================== Anomalies Command ====================

cmd_anomalies() {
    log_section "Anomaly Detection"

    local events_file="${TELEMETRY_DIR}/events.jsonl"

    if [[ ! -f "$events_file" ]]; then
        log_warning "No telemetry events found"
        return
    fi

    log_info "Scanning for anomalies..."

    local anomalies_found=0

    # 检测长时间运行的动作
    echo ""
    echo "Long-running Actions (>30s):"
    if command -v python3 &> /dev/null; then
        python3 << EOF
import json

threshold_ms = 30000  # 30 seconds
count = 0

try:
    with open('$events_file', 'r') as f:
        for line in f:
            try:
                event = json.loads(line)
                duration = event.get('duration_ms', 0)
                if duration > threshold_ms:
                    print(f"  {event.get('timestamp', 'N/A')}: {event.get('type', 'unknown')} - {duration}ms")
                    count += 1
            except:
                pass
    
    if count == 0:
        print("  None found")
except Exception as e:
    print(f"  Error: {e}")
EOF
    fi

    # 检测错误峰值
    echo ""
    echo "Error Patterns:"
    grep '"success":false' "$events_file" 2>/dev/null | \
        python3 -c "
import json
import sys
from collections import Counter

errors = []
for line in sys.stdin:
    try:
        event = json.loads(line)
        error_type = event.get('error_type', 'unknown')
        errors.append(error_type)
    except:
        pass

counts = Counter(errors)
for error, count in counts.most_common(5):
    print(f'  {error}: {count} occurrences')

if not errors:
    print('  No errors found')
" 2>/dev/null || echo "  Unable to analyze"

    # 检测异常时间模式
    echo ""
    echo "Unusual Activity Hours:"
    grep -o '"timestamp":"[^"]*"' "$events_file" 2>/dev/null | \
        sed 's/"timestamp":"//g; s/"$//g' | \
        cut -d'T' -f2 | cut -d':' -f1 | \
        sort | uniq -c | \
        awk '$1 < 5 {printf "  Low activity: %02s:00 (%s events)\n", $2, $1}'
}

# ==================== Report Command ====================

cmd_report() {
    local session_id="$1"

    log_section "Telemetry Analysis Report"

    local events_file="${TELEMETRY_DIR}/events.jsonl"
    local config_file="${TELEMETRY_DIR}/config.yaml"

    echo ""
    echo "Report Generated: $(date)"
    echo "=============================================="
    echo ""

    # 基本统计
    if [[ -f "$events_file" ]]; then
        local total_events=$(wc -l < "$events_file")
        echo "Total Events: $total_events"

        # 文件大小
        local file_size=$(du -h "$events_file" | cut -f1)
        echo "Data Size: $file_size"
    fi

    # 配置信息
    if [[ -f "$config_file" ]]; then
        echo ""
        echo "Configuration:"
        cat "$config_file" | grep -E "^  " | head -10 | sed 's/^/  /'
    fi

    # 会话统计
    echo ""
    echo "Session Statistics:"
    local sessions_dir="${RUNTIME_DIR}/sessions"
    if [[ -d "$sessions_dir" ]]; then
        local session_count=$(find "$sessions_dir" -name "session.json" | wc -l)
        echo "  Active Sessions: $session_count"
    fi

    # 技能使用统计
    echo ""
    echo "Skill Usage:"
    if [[ -f "${RUNTIME_DIR}/skill-events.jsonl" ]]; then
        grep -o '"skill":"[^"]*"' "${RUNTIME_DIR}/skill-events.jsonl" 2>/dev/null | \
            sed 's/"skill":"//g; s/"$//g' | \
            sort | uniq -c | sort -rn | head -5 | \
            while read -r count skill; do
                printf "  %-20s %5s uses\n" "$skill" "$count"
            done
    else
        echo "  No skill usage data"
    fi

    # 性能指标
    echo ""
    echo "Performance Summary:"
    if command -v python3 &> /dev/null && [[ -f "$events_file" ]]; then
        python3 << EOF
import json

durations = []
success_count = 0
fail_count = 0

try:
    with open('$events_file', 'r') as f:
        for line in f:
            try:
                event = json.loads(line)
                duration = event.get('duration_ms', 0)
                if duration > 0:
                    durations.append(duration)
                
                if event.get('success', False):
                    success_count += 1
                else:
                    fail_count += 1
            except:
                pass

    if durations:
        avg_duration = sum(durations) / len(durations)
        min_duration = min(durations)
        max_duration = max(durations)
        
        print(f"  Average Duration: {avg_duration:.1f}ms")
        print(f"  Min Duration: {min_duration}ms")
        print(f"  Max Duration: {max_duration}ms")
        print(f"  Success Rate: {success_count/(success_count+fail_count)*100:.1f}%")
    else:
        print("  No duration data available")
except Exception as e:
    print(f"  Error: {e}")
EOF
    fi

    echo ""
    echo "=============================================="
}

# ==================== Export Command ====================

cmd_export() {
    local format="${1:-json}"
    local output_file="${2:-${RUNTIME_DIR}/telemetry-export.$(date +%Y%m%d-%H%M%S).$format}"

    log_section "Exporting Telemetry Data"
    log_info "Format: $format"
    log_info "Output: $output_file"

    local events_file="${TELEMETRY_DIR}/events.jsonl"

    if [[ ! -f "$events_file" ]]; then
        log_error "No telemetry data to export"
        exit 1
    fi

    case "$format" in
        json)
            # 转换为 JSON 数组
            echo "[" > "$output_file"
            local first=true
            while IFS= read -r line; do
                [[ "$first" == true ]] || echo "," >> "$output_file"
                first=false
                echo "$line" >> "$output_file"
            done < "$events_file"
            echo "" >> "$output_file"
            echo "]" >> "$output_file"
            ;;

        csv)
            # 转换为 CSV
            if command -v python3 &> /dev/null; then
                python3 << EOF > "$output_file"
import json
import csv

print('timestamp,type,success,duration_ms,skill,error_type')

try:
    with open('$events_file', 'r') as f:
        for line in f:
            try:
                event = json.loads(line)
                print(f"{event.get('timestamp','')},{event.get('type','')},{event.get('success',False)},{event.get('duration_ms',0)},{event.get('skill','')},{event.get('error_type','')}")
            except:
                pass
except Exception as e:
    print(f'Error: {e}')
EOF
            else
                log_error "Python3 required for CSV export"
                exit 1
            fi
            ;;

        html)
            # 生成 HTML 报告
            cat > "$output_file" << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Harness Telemetry Report</title>
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
        <p class="timestamp">Generated: GENERATED_AT</p>

        <h2>📊 Overview</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value" id="total-events">0</div>
                <div class="metric-label">Total Events</div>
            </div>
            <div class="metric-card">
                <div class="metric-value success" id="success-events">0</div>
                <div class="metric-label">Successful</div>
            </div>
            <div class="metric-card">
                <div class="metric-value error" id="error-events">0</div>
                <div class="metric-label">Errors</div>
            </div>
        </div>

        <h2>📋 Recent Events</h2>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody id="events-tbody"></tbody>
        </table>
    </div>

    <script>
        const events = EVENTS_DATA;

        // Update metrics
        document.getElementById('total-events').textContent = events.length;
        const successCount = events.filter(e => e.success).length;
        document.getElementById('success-events').textContent = successCount;
        document.getElementById('error-events').textContent = events.length - successCount;

        // Populate events table
        const tbody = document.getElementById('events-tbody');
        events.slice(-50).forEach(event => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${event.timestamp || 'N/A'}</td>
                <td>${event.type || 'unknown'}</td>
                <td class="${event.success ? 'success' : 'error'}">${event.success ? '✓' : '✗'}</td>
                <td>${event.duration_ms || 0}ms</td>
            `;
        });
    </script>
</body>
</html>
HTMLEOF
            # 嵌入数据
            local events_json=$(python3 -c "
import json
events = []
with open('$events_file', 'r') as f:
    for line in f:
        try:
            events.append(json.loads(line))
        except:
            pass
print(json.dumps(events[-100:]))  # 最近100条
" 2>/dev/null || echo "[]")

            sed -i '' "s|EVENTS_DATA|$events_json|g" "$output_file"
            sed -i '' "s|GENERATED_AT|$(date)|g" "$output_file"
            ;;

        *)
            log_error "Unknown format: $format"
            echo "Supported formats: json, csv, html"
            exit 1
            ;;
    esac

    log_success "Exported to: $output_file"
}

# ==================== Insights Command ====================

cmd_insights() {
    log_section "Telemetry Insights"

    local events_file="${TELEMETRY_DIR}/events.jsonl"

    if [[ ! -f "$events_file" ]]; then
        log_warning "No telemetry data available"
        return
    fi

    log_info "Generating insights..."

    echo ""
    echo "📈 Performance Insights:"

    if command -v python3 &> /dev/null; then
        python3 << EOF
import json
from collections import defaultdict

events_by_type = defaultdict(list)
success_by_type = defaultdict(lambda: {'success': 0, 'fail': 0})

try:
    with open('$events_file', 'r') as f:
        for line in f:
            try:
                event = json.loads(line)
                event_type = event.get('type', 'unknown')
                events_by_type[event_type].append(event)
                
                if event.get('success', False):
                    success_by_type[event_type]['success'] += 1
                else:
                    success_by_type[event_type]['fail'] += 1
            except:
                pass

    # 识别最慢的操作类型
    print("\n1. Slowest Operation Types:")
    avg_durations = {}
    for event_type, events in events_by_type.items():
        durations = [e.get('duration_ms', 0) for e in events if e.get('duration_ms', 0) > 0]
        if durations:
            avg_durations[event_type] = sum(durations) / len(durations)
    
    for event_type, avg_duration in sorted(avg_durations.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"   - {event_type}: {avg_duration:.1f}ms average")

    # 识别成功率低的操作
    print("\n2. Low Success Rate Operations:")
    for event_type, stats in success_by_type.items():
        total = stats['success'] + stats['fail']
        if total > 5:  # 至少5次才统计
            rate = stats['success'] / total
            if rate < 0.8:
                print(f"   - {event_type}: {rate*100:.1f}% success rate ({stats['success']}/{total})")

    # 使用建议
    print("\n3. Recommendations:")
    if avg_durations:
        slowest = max(avg_durations.items(), key=lambda x: x[1])
        if slowest[1] > 5000:
            print(f"   ⚠️  {slowest[0]} is slow ({slowest[1]:.0f}ms). Consider optimization.")
    
    low_success = [(t, s) for t, s in success_by_type.items() 
                   if (s['success'] + s['fail']) > 5 and s['success'] / (s['success'] + s['fail']) < 0.8]
    if low_success:
        print(f"   ⚠️  {len(low_success)} operation types have low success rates. Review error handling.")
    
    if not low_success and all(v < 5000 for v in avg_durations.values()):
        print("   ✓ All metrics look healthy!")

except Exception as e:
    print(f"Error generating insights: {e}")
EOF
    fi

    echo ""
    echo "💡 Usage Recommendations:"
    echo "   1. Review slow operations for optimization opportunities"
    echo "   2. Investigate operations with <80% success rate"
    echo "   3. Consider caching for frequently accessed data"
    echo "   4. Monitor error patterns for systematic issues"
}

# ==================== Main ====================

show_help() {
    cat << EOF
Usage: telemetry-analyze.sh <command> [options]

Telemetry analysis commands:

  trends                Analyze usage trends
  anomalies             Detect anomalies in telemetry data
  report [session]      Generate analysis report
  export [format]       Export telemetry data (json|csv|html)
  insights              Generate insights and recommendations

Examples:
  telemetry-analyze.sh trends
  telemetry-analyze.sh anomalies
  telemetry-analyze.sh report
  telemetry-analyze.sh export json
  telemetry-analyze.sh export html ./report.html
  telemetry-analyze.sh insights

EOF
}

main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    local command="$1"
    shift

    # 确保目录存在
    mkdir -p "$TELEMETRY_DIR" "$RUNTIME_DIR"

    case "$command" in
        trends)
            cmd_trends
            ;;
        anomalies)
            cmd_anomalies
            ;;
        report)
            cmd_report "$1"
            ;;
        export)
            cmd_export "$1" "$2"
            ;;
        insights)
            cmd_insights
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
