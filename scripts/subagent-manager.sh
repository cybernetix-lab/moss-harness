#!/bin/bash
#
# Sub-Agent Manager
# 负责动态创建、管理和销毁子代理
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 默认配置
SUBAGENT_REGISTRY="${PROJECT_ROOT}/runtime/orchestration/registry"
SUBAGENT_RUNTIME_DIR="${PROJECT_ROOT}/runtime/subagents"
MAX_SUBAGENTS="${MAX_SUBAGENTS:-10}"
SUBAGENT_TIMEOUT="${SUBAGENT_TIMEOUT:-300}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 初始化 Sub-Agent 运行时目录
init_subagent_runtime() {
    if [[ ! -d "$SUBAGENT_RUNTIME_DIR" ]]; then
        mkdir -p "$SUBAGENT_RUNTIME_DIR"
        log_info "Created subagent runtime directory: $SUBAGENT_RUNTIME_DIR"
    fi
}

# 生成唯一的 Sub-Agent ID
generate_subagent_id() {
    local parent_id="${1:-}"
    local timestamp
    timestamp=$(date +%s)
    local random_suffix
    random_suffix=$(openssl rand -hex 4)
    
    if [[ -n "$parent_id" ]]; then
        echo "${parent_id}-sub-${timestamp}-${random_suffix}"
    else
        echo "sub-${timestamp}-${random_suffix}"
    fi
}

# 创建 Sub-Agent
create_subagent() {
    local agent_type="$1"
    local task_description="$2"
    local parent_session_id="${3:-}"
    local context_isolation="${4:-partial_isolation}"
    
    log_info "Creating subagent of type: $agent_type"
    
    # 检查当前 Sub-Agent 数量
    local current_count
    current_count=$(count_active_subagents)
    if [[ "$current_count" -ge "$MAX_SUBAGENTS" ]]; then
        log_error "Maximum number of subagents ($MAX_SUBAGENTS) reached"
        return 1
    fi
    
    # 生成 Sub-Agent ID
    local subagent_id
    subagent_id=$(generate_subagent_id "$parent_session_id")
    
    # 创建 Sub-Agent 工作目录
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    mkdir -p "$subagent_dir"/{workspace,context,logs}
    
    # 创建 Sub-Agent 配置
    cat > "$subagent_dir/config.yaml" << EOF
subagent:
  id: "$subagent_id"
  type: "$agent_type"
  parent_session_id: "$parent_session_id"
  context_isolation: "$context_isolation"
  created_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  timeout: $SUBAGENT_TIMEOUT
  status: "pending"
  
task:
  description: |
    $task_description
  status: "pending"
  result: null
EOF
    
    # 如果有父会话，复制必要的上下文
    if [[ -n "$parent_session_id" && "$context_isolation" != "full_isolation" ]]; then
        copy_parent_context "$parent_session_id" "$subagent_id" "$context_isolation"
    fi
    
    # 启动 Sub-Agent
    start_subagent "$subagent_id"
    
    echo "$subagent_id"
}

# 从父会话复制上下文
copy_parent_context() {
    local parent_id="$1"
    local subagent_id="$2"
    local isolation_level="$3"
    
    local parent_dir="${PROJECT_ROOT}/context/sessions/$parent_id"
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    
    if [[ ! -d "$parent_dir" ]]; then
        log_warn "Parent session directory not found: $parent_dir"
        return 0
    fi
    
    case "$isolation_level" in
        partial_isolation)
            # 复制任务描述和必要配置
            if [[ -f "$parent_dir/TASK.md" ]]; then
                cp "$parent_dir/TASK.md" "$subagent_dir/context/"
            fi
            # 复制约束配置
            if [[ -d "$parent_dir/constraints" ]]; then
                cp -r "$parent_dir/constraints" "$subagent_dir/context/"
            fi
            ;;
        shared_context)
            # 创建共享上下文的符号链接
            mkdir -p "$subagent_dir/context/shared"
            ln -sf "$parent_dir/shared" "$subagent_dir/context/shared/parent"
            ;;
        full_isolation)
            # 不复制任何内容
            ;;
    esac
    
    log_info "Copied parent context with isolation level: $isolation_level"
}

# 启动 Sub-Agent
start_subagent() {
    local subagent_id="$1"
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    local config_file="$subagent_dir/config.yaml"
    
    log_info "Starting subagent: $subagent_id"
    
    # 更新状态为运行中
    sed -i '' 's/status: "pending"/status: "running"/' "$config_file"
    
    # 记录启动时间
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" > "$subagent_dir/started_at"
    
    # 启动后台监控进程
    (
        sleep "$SUBAGENT_TIMEOUT"
        if [[ -d "$subagent_dir" ]]; then
            local status
            status=$(grep "status:" "$config_file" | head -1 | awk '{print $2}')
            if [[ "$status" == "\"running\"" ]]; then
                log_warn "Subagent $subagent_id timed out after ${SUBAGENT_TIMEOUT}s"
                terminate_subagent "$subagent_id" "timeout"
            fi
        fi
    ) &
    
    log_success "Subagent $subagent_id started"
}

# 终止 Sub-Agent
terminate_subagent() {
    local subagent_id="$1"
    local reason="${2:-manual}"
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    
    if [[ ! -d "$subagent_dir" ]]; then
        log_error "Subagent not found: $subagent_id"
        return 1
    fi
    
    log_info "Terminating subagent $subagent_id (reason: $reason)"
    
    # 更新状态
    local config_file="$subagent_dir/config.yaml"
    sed -i '' "s/status: \"running\"/status: \"terminated\"/" "$config_file"
    sed -i '' "s/status: \"pending\"/status: \"terminated\"/" "$config_file"
    
    # 记录终止信息
    cat >> "$config_file" << EOF
termination:
  reason: "$reason"
  terminated_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
EOF
    
    # 归档日志
    if [[ -d "$subagent_dir/logs" ]]; then
        tar -czf "$subagent_dir/logs.tar.gz" -C "$subagent_dir" logs/
        rm -rf "$subagent_dir/logs"
    fi
    
    log_success "Subagent $subagent_id terminated"
}

# 获取 Sub-Agent 状态
get_subagent_status() {
    local subagent_id="$1"
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    
    if [[ ! -d "$subagent_dir" ]]; then
        echo "not_found"
        return 1
    fi
    
    grep "status:" "$subagent_dir/config.yaml" | head -1 | awk '{print $2}' | tr -d '"'
}

# 更新 Sub-Agent 结果
update_subagent_result() {
    local subagent_id="$1"
    local result="$2"
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    
    if [[ ! -d "$subagent_dir" ]]; then
        log_error "Subagent not found: $subagent_id"
        return 1
    fi
    
    local config_file="$subagent_dir/config.yaml"
    
    # 更新任务结果
    sed -i '' 's/status: "running"/status: "completed"/' "$config_file"
    
    # 追加结果到配置
    cat >> "$config_file" << EOF
  result: |
    $result
  completed_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
EOF
    
    log_success "Updated result for subagent $subagent_id"
}

# 统计活跃 Sub-Agent 数量
count_active_subagents() {
    if [[ ! -d "$SUBAGENT_RUNTIME_DIR" ]]; then
        echo "0"
        return 0
    fi
    
    local count=0
    for subagent_dir in "$SUBAGENT_RUNTIME_DIR"/*; do
        if [[ -d "$subagent_dir" ]]; then
            local status
            status=$(grep "status:" "$subagent_dir/config.yaml" 2>/dev/null | head -1 | awk '{print $2}' | tr -d '"')
            if [[ "$status" == "running" || "$status" == "pending" ]]; then
                ((count++))
            fi
        fi
    done
    
    echo "$count"
}

# 列出所有 Sub-Agent
list_subagents() {
    local filter_status="${1:-all}"
    
    if [[ ! -d "$SUBAGENT_RUNTIME_DIR" ]]; then
        log_info "No subagents found"
        return 0
    fi
    
    printf "%-40s %-15s %-20s %-10s\n" "SUBAGENT_ID" "TYPE" "CREATED_AT" "STATUS"
    printf "%-40s %-15s %-20s %-10s\n" "----------------------------------------" "---------------" "--------------------" "----------"
    
    for subagent_dir in "$SUBAGENT_RUNTIME_DIR"/*; do
        if [[ -d "$subagent_dir" ]]; then
            local config_file="$subagent_dir/config.yaml"
            if [[ -f "$config_file" ]]; then
                local id type created_at status
                id=$(grep "^  id:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                type=$(grep "^  type:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                created_at=$(grep "^  created_at:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                status=$(grep "^  status:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                
                if [[ "$filter_status" == "all" || "$filter_status" == "$status" ]]; then
                    printf "%-40s %-15s %-20s %-10s\n" "$id" "$type" "$created_at" "$status"
                fi
            fi
        fi
    done
}

# 清理已完成的 Sub-Agent
cleanup_subagents() {
    local max_age_hours="${1:-24}"
    local max_age_seconds=$((max_age_hours * 3600))
    local current_time
    current_time=$(date +%s)
    
    log_info "Cleaning up subagents older than $max_age_hours hours"
    
    local cleaned=0
    for subagent_dir in "$SUBAGENT_RUNTIME_DIR"/*; do
        if [[ -d "$subagent_dir" ]]; then
            local config_file="$subagent_dir/config.yaml"
            if [[ -f "$config_file" ]]; then
                local status created_at created_timestamp
                status=$(grep "status:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                created_at=$(grep "created_at:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                
                if [[ "$status" == "completed" || "$status" == "terminated" || "$status" == "failed" ]]; then
                    created_timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$created_at" +%s 2>/dev/null || date -d "$created_at" +%s)
                    local age=$((current_time - created_timestamp))
                    
                    if [[ "$age" -gt "$max_age_seconds" ]]; then
                        local subagent_id
                        subagent_id=$(basename "$subagent_dir")
                        rm -rf "$subagent_dir"
                        log_info "Cleaned up subagent: $subagent_id"
                        ((cleaned++))
                    fi
                fi
            fi
        fi
    done
    
    log_success "Cleaned up $cleaned subagents"
}

# 显示帮助信息
show_help() {
    cat << EOF
Sub-Agent Manager

Usage: $0 <command> [options]

Commands:
    create <agent_type> <task_description> [parent_session] [isolation_level]
        Create a new subagent
        agent_type: planner, reviewer, executor, evaluator, researcher
        isolation_level: full_isolation, partial_isolation, shared_context (default: partial_isolation)
    
    terminate <subagent_id> [reason]
        Terminate a subagent
    
    status <subagent_id>
        Get subagent status
    
    result <subagent_id> <result_text>
        Update subagent result
    
    list [status_filter]
        List all subagents (optionally filter by status)
    
    count
        Count active subagents
    
    cleanup [max_age_hours]
        Clean up completed/terminated subagents (default: 24 hours)
    
    help
        Show this help message

Environment Variables:
    MAX_SUBAGENTS       Maximum number of concurrent subagents (default: 10)
    SUBAGENT_TIMEOUT    Subagent timeout in seconds (default: 300)

Examples:
    $0 create executor "Implement user authentication" session-123
    $0 list running
    $0 terminate sub-1234567890-abcdef12 timeout
    $0 cleanup 48
EOF
}

# 主函数
main() {
    # 初始化运行时目录
    init_subagent_runtime
    
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        create)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 create <agent_type> <task_description> [parent_session] [isolation_level]"
                exit 1
            fi
            create_subagent "$1" "$2" "${3:-}" "${4:-partial_isolation}"
            ;;
        terminate)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 terminate <subagent_id> [reason]"
                exit 1
            fi
            terminate_subagent "$1" "${2:-manual}"
            ;;
        status)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 status <subagent_id>"
                exit 1
            fi
            get_subagent_status "$1"
            ;;
        result)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 result <subagent_id> <result_text>"
                exit 1
            fi
            update_subagent_result "$1" "$2"
            ;;
        list)
            list_subagents "${1:-all}"
            ;;
        count)
            count_active_subagents
            ;;
        cleanup)
            cleanup_subagents "${1:-24}"
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
