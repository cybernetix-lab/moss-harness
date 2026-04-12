#!/bin/bash
# telemetry-prometheus-exporter.sh - Prometheus Metrics 导出器
# 将 Harness 遥测数据暴露为 Prometheus 格式

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 配置
PORT="${MOSS_PROMETHEUS_PORT:-9090}"
TELEMETRY_DIR="${PROJECT_ROOT}/.runtime/telemetry"

# 显示帮助
show_help() {
    cat << EOF
Harness Telemetry Prometheus Exporter

用法: $0 [命令] [选项]

命令:
    start                   启动 HTTP 服务器暴露 metrics
    export                  一次性导出 metrics 到 stdout
    stop                    停止运行中的服务器
    status                  检查服务器状态

选项:
    -p, --port PORT         指定端口 (默认: 9090)
    -h, --help              显示此帮助

环境变量:
    MOSS_PROMETHEUS_PORT     服务器端口
    MOSS_TELEMETRY_DIR       遥测数据目录

示例:
    $0 start
    $0 start -p 8080
    $0 export
    curl http://localhost:9090/metrics
EOF
}

# 生成 Prometheus 格式的 metrics
generate_metrics() {
    local output=""
    
    # 添加帮助信息
    output="# HELP harness_sessions_total Total number of sessions\n"
    output="# TYPE harness_sessions_total gauge\n"
    
    # 统计会话数量
    local session_count=0
    if [[ -d "$TELEMETRY_DIR" ]]; then
        session_count=$(find "$TELEMETRY_DIR" -maxdepth 1 -type d | wc -l)
        session_count=$((session_count - 1))  # 减去目录本身
    fi
    output+="harness_sessions_total ${session_count}\n"
    
    # 活跃会话数
    output+="# HELP harness_sessions_active Active sessions\n"
    output+="# TYPE harness_sessions_active gauge\n"
    local active_sessions=0
    if [[ -d "$TELEMETRY_DIR" ]]; then
        for session_dir in "$TELEMETRY_DIR"/*; do
            if [[ -d "$session_dir" ]]; then
                local session_id=$(basename "$session_dir")
                local metrics_file="${session_dir}/metrics.json"
                if [[ -f "$metrics_file" ]]; then
                    # 检查会话是否活跃（没有结束标记）
                    if ! grep -q "session_end" "${session_dir}/trace.jsonl" 2>/dev/null; then
                        active_sessions=$((active_sessions + 1))
                    fi
                fi
            fi
        done
    fi
    output+="harness_sessions_active ${active_sessions}\n"
    
    # 遍历每个会话的指标
    if [[ -d "$TELEMETRY_DIR" ]]; then
        for session_dir in "$TELEMETRY_DIR"/*; do
            if [[ -d "$session_dir" ]]; then
                local session_id=$(basename "$session_dir")
                local metrics_file="${session_dir}/metrics.json"
                
                if [[ -f "$metrics_file" ]]; then
                    # 使用 Python 解析 JSON 并生成 metrics
                    local session_metrics=$(python3 << EOF
import json
import sys

try:
    with open('${metrics_file}', 'r') as f:
        data = json.load(f)
    
    session = data.get('session', {})
    perf = data.get('performance', {})
    resources = data.get('resources', {})
    actions = data.get('actions', {})
    security = data.get('security', {})
    
    metrics = []
    session_label = 'session_id="' + '${session_id}' + '"'
    
    # 会话指标
    metrics.append(f'harness_session_actions_total{{{session_label}}} {session.get("actions_count", 0)}')
    metrics.append(f'harness_session_actions_successful{{{session_label}}} {session.get("successful_actions", 0)}')
    metrics.append(f'harness_session_actions_failed{{{session_label}}} {session.get("failed_actions", 0)}')
    metrics.append(f'harness_session_checkpoints{{{session_label}}} {session.get("checkpoints_created", 0)}')
    
    # 性能指标
    metrics.append(f'harness_session_avg_duration_ms{{{session_label}}} {perf.get("avg_action_duration_ms", 0)}')
    metrics.append(f'harness_session_total_duration_ms{{{session_label}}} {perf.get("total_duration_ms", 0)}')
    metrics.append(f'harness_session_min_duration_ms{{{session_label}}} {perf.get("min_duration_ms", 0)}')
    metrics.append(f'harness_session_max_duration_ms{{{session_label}}} {perf.get("max_duration_ms", 0)}')
    
    # 资源指标
    metrics.append(f'harness_session_files_read{{{session_label}}} {resources.get("files_read", 0)}')
    metrics.append(f'harness_session_files_written{{{session_label}}} {resources.get("files_written", 0)}')
    metrics.append(f'harness_session_commands_executed{{{session_label}}} {resources.get("commands_executed", 0)}')
    
    # 安全指标
    metrics.append(f'harness_session_blocked_actions{{{session_label}}} {security.get("blocked_actions", 0)}')
    metrics.append(f'harness_session_warnings{{{session_label}}} {security.get("warnings", 0)}')
    
    # 动作类型指标
    for action_type, stats in actions.items():
        action_label = f'{session_label},action_type="{action_type}"'
        metrics.append(f'harness_action_count{{{action_label}}} {stats.get("count", 0)}')
        metrics.append(f'harness_action_success{{{action_label}}} {stats.get("success", 0)}')
        metrics.append(f'harness_action_fail{{{action_label}}} {stats.get("fail", 0)}')
        metrics.append(f'harness_action_avg_duration_ms{{{action_label}}} {stats.get("avg_duration_ms", 0)}')
    
    print('\n'.join(metrics))
    
except Exception as e:
    print(f"# Error parsing ${session_id}: {e}", file=sys.stderr)
EOF
)
                    output+="# HELP harness_session_actions_total Total actions in session\n"
                    output+="# TYPE harness_session_actions_total gauge\n"
                    output+="# HELP harness_session_actions_successful Successful actions in session\n"
                    output+="# TYPE harness_session_actions_successful gauge\n"
                    output+="# HELP harness_session_actions_failed Failed actions in session\n"
                    output+="# TYPE harness_session_actions_failed gauge\n"
                    output+="# HELP harness_session_avg_duration_ms Average action duration in ms\n"
                    output+="# TYPE harness_session_avg_duration_ms gauge\n"
                    output+="# HELP harness_action_count Action count by type\n"
                    output+="# TYPE harness_action_count gauge\n"
                    output+="${session_metrics}\n"
                fi
            fi
        done
    fi
    
    # 全局统计
    local stats_file="${PROJECT_ROOT}/runtime/memory/stats.json"
    if [[ -f "$stats_file" ]]; then
        local global_metrics=$(python3 << EOF
import json

try:
    with open('${stats_file}', 'r') as f:
        stats = json.load(f)
    
    print(f"# HELP harness_global_sessions_total Total sessions ever created")
    print(f"# TYPE harness_global_sessions_total counter")
    print(f"harness_global_sessions_total {stats.get('total_sessions', 0)}")
    print(f"# HELP harness_global_actions_total Total actions ever performed")
    print(f"# TYPE harness_global_actions_total counter")
    print(f"harness_global_actions_total {stats.get('total_actions', 0)}")
except:
    pass
EOF
)
        output+="${global_metrics}\n"
    fi
    
    # 添加时间戳
    output+="# HELP harness_metrics_timestamp Last metrics update timestamp\n"
    output+="# TYPE harness_metrics_timestamp gauge\n"
    output+="harness_metrics_timestamp $(date +%s)\n"
    
    echo -e "$output"
}

# 启动 HTTP 服务器
start_server() {
    local port="$1"
    
    # 检查是否已有服务器在运行
    if [[ -f "/tmp/harness-prometheus-exporter.pid" ]]; then
        local pid=$(cat /tmp/harness-prometheus-exporter.pid)
        if kill -0 "$pid" 2>/dev/null; then
            echo "⚠️  Server already running on PID $pid"
            echo "   Use '$0 stop' to stop it first"
            return 1
        fi
    fi
    
    echo "🚀 Starting Prometheus exporter on port ${port}..."
    
    # 使用 Python 启动简单的 HTTP 服务器
    python3 << EOF &
import http.server
import socketserver
import subprocess
import sys

PORT = ${port}

class MetricsHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.end_headers()
            
            # 调用生成函数
            result = subprocess.run(
                ['${SCRIPT_DIR}/telemetry-prometheus-exporter.sh', 'export'],
                capture_output=True,
                text=True
            )
            self.wfile.write(result.stdout.encode())
        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b'''
                <html>
                <body>
                    <h1>Harness Telemetry Prometheus Exporter</h1>
                    <p><a href="/metrics">Metrics</a></p>
                </body>
                </html>
            ''')
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "healthy"}')
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # 减少日志输出
        pass

with socketserver.TCPServer(("", PORT), MetricsHandler) as httpd:
    print(f"Server running on port {PORT}")
    httpd.serve_forever()
EOF
    
    local server_pid=$!
    echo $server_pid > /tmp/harness-prometheus-exporter.pid
    
    sleep 1
    
    if kill -0 "$server_pid" 2>/dev/null; then
        echo "✅ Server started successfully"
        echo "   PID: $server_pid"
        echo "   URL: http://localhost:${port}/metrics"
        echo ""
        echo "   Test with: curl http://localhost:${port}/metrics"
    else
        echo "❌ Server failed to start"
        rm -f /tmp/harness-prometheus-exporter.pid
        return 1
    fi
}

# 停止服务器
stop_server() {
    if [[ -f "/tmp/harness-prometheus-exporter.pid" ]]; then
        local pid=$(cat /tmp/harness-prometheus-exporter.pid)
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f /tmp/harness-prometheus-exporter.pid
            echo "✅ Server stopped"
        else
            echo "⚠️  Server not running"
            rm -f /tmp/harness-prometheus-exporter.pid
        fi
    else
        echo "⚠️  No server PID file found"
    fi
}

# 检查状态
check_status() {
    if [[ -f "/tmp/harness-prometheus-exporter.pid" ]]; then
        local pid=$(cat /tmp/harness-prometheus-exporter.pid)
        if kill -0 "$pid" 2>/dev/null; then
            echo "✅ Server is running (PID: $pid)"
            echo "   URL: http://localhost:${PORT}/metrics"
        else
            echo "❌ Server not running (stale PID file)"
            rm -f /tmp/harness-prometheus-exporter.pid
        fi
    else
        echo "❌ Server not running"
    fi
}

# 主函数
main() {
    local port="$PORT"
    local command=""
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            start|export|stop|status)
                command="$1"
                shift
                ;;
            -p|--port)
                port="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    case "$command" in
        start)
            start_server "$port"
            ;;
        export)
            generate_metrics
            ;;
        stop)
            stop_server
            ;;
        status)
            check_status
            ;;
        *)
            show_help
            ;;
    esac
}

main "$@"
