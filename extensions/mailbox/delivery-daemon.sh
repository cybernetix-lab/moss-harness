#!/bin/bash
# delivery-daemon.sh - 投递守护进程
# 后台运行，自动投递 outbox 中的消息

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$EXTENSION_ROOT")"
MAILBOX_DIR="${PROJECT_ROOT}/runtime/mailbox"
PID_FILE="${PROJECT_ROOT}/runtime/delivery-daemon.pid"
LOG_FILE="${PROJECT_ROOT}/runtime/logs/delivery-daemon.log"

# 配置
DELIVERY_INTERVAL=1  # 投递检查间隔（秒）
MAX_RETRY=3          # 最大重试次数
RETRY_DELAY=5        # 重试延迟（秒）

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# 显示帮助
show_help() {
    cat << EOF
Delivery Daemon - 投递守护进程

用法: $0 [命令]

命令:
    start       启动守护进程
    stop        停止守护进程
    restart     重启守护进程
    status      查看守护进程状态
    once        运行一次投递（不启动守护进程）
    -h, --help  显示此帮助

示例:
    $0 start
    $0 status
    $0 stop
EOF
}

# 检查守护进程是否运行
is_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# 启动守护进程
start_daemon() {
    if is_running; then
        log_warning "守护进程已在运行 (PID: $(cat "$PID_FILE"))"
        return 0
    fi
    
    # 创建日志目录
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # 启动后台进程
    (
        echo $$ > "$PID_FILE"
        log_info "投递守护进程已启动 (PID: $$)"
        
        while true; do
            deliver_all_messages
            sleep "$DELIVERY_INTERVAL"
        done
    ) &
    
    log_success "守护进程已启动"
}

# 停止守护进程
stop_daemon() {
    if ! is_running; then
        log_warning "守护进程未运行"
        rm -f "$PID_FILE"
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    
    log_success "守护进程已停止 (PID: $pid)"
}

# 查看状态
show_status() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "守护进程状态: ${GREEN}运行中${NC} (PID: $pid)"
        
        # 显示统计信息
        local pending_count=$(find "$MAILBOX_DIR" -path "*/outbox/*.json" -type f 2>/dev/null | wc -l)
        echo "待投递消息: $pending_count"
        
        # 显示最后几行日志
        if [[ -f "$LOG_FILE" ]]; then
            echo ""
            echo "最近日志:"
            tail -n 5 "$LOG_FILE"
        fi
    else
        echo "守护进程状态: ${RED}未运行${NC}"
    fi
}

# 投递所有待发送消息
deliver_all_messages() {
    # 查找所有 outbox 中的消息
    find "$MAILBOX_DIR" -path "*/outbox/*.json" -type f 2>/dev/null | while read -r msg_file; do
        deliver_message "$msg_file"
    done
}

# 投递单个消息
deliver_message() {
    local msg_file=$1
    
    if [[ ! -f "$msg_file" ]]; then
        return 0
    fi
    
    local msg_content=$(cat "$msg_file")
    local msg_id=$(echo "$msg_content" | jq -r '.header.id')
    local to_agent=$(echo "$msg_content" | jq -r '.header.to')
    local from_agent=$(echo "$msg_content" | jq -r '.header.from')
    local attempt=$(echo "$msg_content" | jq -r '.metadata.attempt // 1')
    
    # 检查目标邮箱是否存在
    if [[ ! -d "${MAILBOX_DIR}/${to_agent}/inbox" ]]; then
        log_error "目标邮箱不存在: $to_agent (消息: $msg_id)"
        
        # 更新重试计数
        if [[ $attempt -lt $MAX_RETRY ]]; then
            jq ".metadata.attempt += 1" "$msg_file" > "${msg_file}.tmp"
            mv "${msg_file}.tmp" "$msg_file"
            log_info "消息 $msg_id 将在 ${RETRY_DELAY} 秒后重试 (尝试 $attempt/$MAX_RETRY)"
        else
            # 移动到失败目录
            local failed_dir="${MAILBOX_DIR}/${from_agent}/failed"
            mkdir -p "$failed_dir"
            mv "$msg_file" "${failed_dir}/${msg_id}.json"
            log_error "消息 $msg_id 投递失败，已移动到失败目录"
        fi
        return 1
    fi
    
    # 原子移动消息到目标收件箱
    local target_file="${MAILBOX_DIR}/${to_agent}/inbox/${msg_id}.json"
    
    if mv "$msg_file" "$target_file" 2>/dev/null; then
        # 更新消息状态
        jq '.status = "delivered" | .delivered_at = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$target_file" > "${target_file}.tmp"
        mv "${target_file}.tmp" "$target_file"
        
        log_success "消息已投递: $msg_id -> $to_agent"
        
        # 记录投递日志
        log_delivery "$msg_id" "$from_agent" "$to_agent" "success"
    else
        log_error "消息投递失败: $msg_id"
        return 1
    fi
}

# 记录投递日志
log_delivery() {
    local msg_id=$1
    local from=$2
    local to=$3
    local status=$4
    
    local log_entry="{
        \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
        \"message_id\": \"$msg_id\",
        \"from\": \"$from\",
        \"to\": \"$to\",
        \"status\": \"$status\"
    }"
    
    echo "$log_entry" >> "${MAILBOX_DIR}/shared/logs/delivery.log"
}

# 运行一次投递
run_once() {
    log_info "运行单次投递..."
    deliver_all_messages
    log_info "单次投递完成"
}

# 清理旧日志
cleanup_logs() {
    local log_dir="${MAILBOX_DIR}/shared/logs"
    
    if [[ -d "$log_dir" ]]; then
        # 删除 7 天前的日志
        find "$log_dir" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    fi
}

# 主函数
main() {
    local command=$1
    
    case "$command" in
        start)
            start_daemon
            ;;
        stop)
            stop_daemon
            ;;
        restart)
            stop_daemon
            sleep 1
            start_daemon
            ;;
        status)
            show_status
            ;;
        once)
            run_once
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"
