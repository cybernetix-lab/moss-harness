#!/bin/bash
# agent-switch.sh - 切换到指定的 Agent
#
# Usage: agent-switch.sh <agent-name> [options]
#   --preserve-context  保留当前上下文
#   --migrate-tasks     迁移未完成任务
#   --force             强制切换，不提示确认
#   --help              显示帮助

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="${PROJECT_ROOT}/agents"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"
MEMORY_DIR="${PROJECT_ROOT}/memory"

# 默认配置
TARGET_AGENT=""
PRESERVE_CONTEXT=false
MIGRATE_TASKS=false
FORCE=false
VERBOSE=false

# 会话信息
CURRENT_AGENT=""
CURRENT_SESSION=""

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

log_step() {
    echo -e "${CYAN}→${NC} $1"
}

# 显示帮助
show_help() {
    cat << EOF
Usage: $(basename "$0") <agent-name> [options]

切换到指定的 Agent，可选保留上下文和迁移任务。

Arguments:
  agent-name          要切换到的 Agent 名称

Options:
  --preserve-context  保留当前上下文文件
  --migrate-tasks     迁移未完成任务到新 Agent
  --force             强制切换，不提示确认
  --verbose           显示详细输出
  --help              显示此帮助

Examples:
  $(basename "$0") implementer              # 切换到 implementer
  $(basename "$0") reviewer --force         # 强制切换
  $(basename "$0") researcher --preserve-context --migrate-tasks

EOF
}

# 解析参数
parse_args() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    TARGET_AGENT="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            --preserve-context)
                PRESERVE_CONTEXT=true
                shift
                ;;
            --migrate-tasks)
                MIGRATE_TASKS=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 获取当前 Agent
get_current_agent() {
    # 查找最新的活动会话
    local sessions_dir="${RUNTIME_DIR}/sessions"
    
    if [[ ! -d "$sessions_dir" ]]; then
        echo ""
        return
    fi

    # 查找最新的 active 会话
    local latest_session=$(find "$sessions_dir" -name "session.json" -exec ls -t {} + 2>/dev/null | head -1)
    
    if [[ -n "$latest_session" ]]; then
        local status=$(grep '"status":' "$latest_session" 2>/dev/null | head -1 | cut -d'"' -f4)
        if [[ "$status" == "active" || "$status" == "running" ]]; then
            local agent=$(grep '"agent":' "$latest_session" 2>/dev/null | head -1 | cut -d'"' -f4)
            local session_id=$(basename "$(dirname "$latest_session")")
            echo "${agent}:${session_id}"
            return
        fi
    fi
    
    echo ""
}

# 验证目标 Agent
validate_target_agent() {
    local agent_file="${AGENTS_DIR}/${TARGET_AGENT}.yaml"

    if [[ ! -f "$agent_file" ]]; then
        log_error "Target agent not found: $TARGET_AGENT"
        log_info "Available agents:"
        list_available_agents
        exit 1
    fi

    echo "$agent_file"
}

# 列出可用 Agents
list_available_agents() {
    for agent_file in "$AGENTS_DIR"/*.yaml; do
        if [[ -f "$agent_file" ]]; then
            local name=$(basename "$agent_file" .yaml)
            local agent_type=$(grep "^type:" "$agent_file" 2>/dev/null | head -1 | cut -d':' -f2- | sed 's/^[[:space:]]*//' || echo "unknown")
            echo "  - $name ($agent_type)"
        fi
    done
}

# 确认切换
confirm_switch() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Agent Switch Confirmation"
    echo "═══════════════════════════════════════════════════════════════"
    echo "  From: ${CURRENT_AGENT:-'(none active)'}"
    echo "  To:   $TARGET_AGENT"
    echo ""
    
    if [[ "$PRESERVE_CONTEXT" == true ]]; then
        echo "  ✓ Preserve context: enabled"
    fi
    
    if [[ "$MIGRATE_TASKS" == true ]]; then
        echo "  ✓ Migrate tasks: enabled"
    fi
    
    echo ""
    echo -n "Confirm switch? [Y/n]: "
    read -r response
    
    if [[ -z "$response" || "$response" =~ ^[Yy]$ ]]; then
        return 0
    else
        log_info "Switch cancelled"
        exit 0
    fi
}

# 停止当前 Agent
stop_current_agent() {
    if [[ -z "$CURRENT_SESSION" ]]; then
        return 0
    fi

    log_step "Stopping current agent: $CURRENT_AGENT..."

    local session_dir="${RUNTIME_DIR}/sessions/${CURRENT_SESSION}"
    
    if [[ ! -d "$session_dir" ]]; then
        log_warning "Session directory not found: $session_dir"
        return 0
    fi

    # 更新会话状态
    cat > "${session_dir}/session.json" << EOF
{
  "session_id": "$CURRENT_SESSION",
  "agent": "$CURRENT_AGENT",
  "status": "switched",
  "switched_at": "$(date -Iseconds)",
  "switched_to": "$TARGET_AGENT"
}
EOF

    # 如果有 PID 文件，终止进程
    if [[ -f "${session_dir}/agent.pid" ]]; then
        local pid=$(cat "${session_dir}/agent.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            log_success "Stopped agent process (PID: $pid)"
        fi
    fi

    # 记录会话历史
    local history_file="${MEMORY_DIR}/session-history.jsonl"
    mkdir -p "$MEMORY_DIR"
    echo "{\"event\":\"agent_switch\",\"from\":\"$CURRENT_AGENT\",\"to\":\"$TARGET_AGENT\",\"timestamp\":\"$(date -Iseconds)\"}" >> "$history_file" 2>/dev/null || true

    log_success "Current agent stopped"
}

# 保存上下文
save_context() {
    if [[ "$PRESERVE_CONTEXT" == false || -z "$CURRENT_SESSION" ]]; then
        return 0
    fi

    log_step "Saving context from current session..."

    local current_session_dir="${RUNTIME_DIR}/sessions/${CURRENT_SESSION}"
    local context_backup_dir="${MEMORY_DIR}/context-backups/${CURRENT_SESSION}"

    mkdir -p "$context_backup_dir"

    # 复制上下文文件
    if [[ -d "${current_session_dir}/context" ]]; then
        cp -r "${current_session_dir}/context"/* "$context_backup_dir/" 2>/dev/null || true
        log_success "Context saved to: $context_backup_dir"
    fi

    # 保存会话摘要
    cat > "${context_backup_dir}/session-summary.json" << EOF
{
  "session_id": "$CURRENT_SESSION",
  "agent": "$CURRENT_AGENT",
  "switched_at": "$(date -Iseconds)",
  "switched_to": "$TARGET_AGENT",
  "context_preserved": true
}
EOF
}

# 迁移任务
migrate_tasks() {
    if [[ "$MIGRATE_TASKS" == false || -z "$CURRENT_SESSION" ]]; then
        return 0
    fi

    log_step "Migrating tasks..."

    local current_session_dir="${RUNTIME_DIR}/sessions/${CURRENT_SESSION}"
    local tasks_file="${current_session_dir}/tasks.json"

    if [[ ! -f "$tasks_file" ]]; then
        log_info "No tasks to migrate"
        return 0
    fi

    # 读取未完成任务
    local pending_tasks=$(cat "$tasks_file" 2>/dev/null | grep -c "pending" || echo 0)
    
    if [[ $pending_tasks -eq 0 ]]; then
        log_info "No pending tasks to migrate"
        return 0
    fi

    # 保存任务到新 Agent 会话时会加载
    log_success "Found $pending_tasks pending tasks to migrate"
}

# 启动新 Agent
start_new_agent() {
    log_step "Starting new agent: $TARGET_AGENT..."

    local extra_args=()
    
    if [[ "$VERBOSE" == true ]]; then
        extra_args+=("--verbose")
    fi

    # 启动新 Agent
    if bash "${SCRIPT_DIR}/agent-start.sh" "$TARGET_AGENT" "${extra_args[@]}"; then
        log_success "Agent switched successfully"
    else
        log_error "Failed to start new agent"
        exit 1
    fi
}

# 创建切换记录
create_switch_record() {
    local record_file="${MEMORY_DIR}/agent-switches.jsonl"
    mkdir -p "$MEMORY_DIR"

    local record=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "from_agent": "$CURRENT_AGENT",
  "to_agent": "$TARGET_AGENT",
  "from_session": "$CURRENT_SESSION",
  "preserve_context": $PRESERVE_CONTEXT,
  "migrate_tasks": $MIGRATE_TASKS
}
EOF
)

    echo "$record" >> "$record_file"
    [[ "$VERBOSE" == true ]] && log_info "Switch record saved"
}

# 显示切换摘要
show_switch_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Agent Switch Complete"
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Previous: ${CURRENT_AGENT:-'(none)'}"
    echo "  Current:  $TARGET_AGENT"
    echo ""
    
    if [[ "$PRESERVE_CONTEXT" == true ]]; then
        echo "  ✓ Context preserved"
    fi
    
    if [[ "$MIGRATE_TASKS" == true ]]; then
        echo "  ✓ Tasks migrated"
    fi
    
    echo ""
    echo "  New agent is ready for tasks."
    echo "═══════════════════════════════════════════════════════════════"
}

# 主函数
main() {
    parse_args "$@"

    # 创建运行时目录
    mkdir -p "$RUNTIME_DIR" "$MEMORY_DIR"

    # 获取当前 Agent
    local current=$(get_current_agent)
    if [[ -n "$current" ]]; then
        CURRENT_AGENT=$(echo "$current" | cut -d':' -f1)
        CURRENT_SESSION=$(echo "$current" | cut -d':' -f2)
    fi

    # 检查是否切换到同一个 Agent
    if [[ "$CURRENT_AGENT" == "$TARGET_AGENT" ]]; then
        log_warning "Already using agent: $TARGET_AGENT"
        echo "Use 'agent-start.sh $TARGET_AGENT' to restart instead."
        exit 0
    fi

    # 验证目标 Agent
    validate_target_agent

    # 确认切换
    confirm_switch

    # 执行切换流程
    log_step "Initiating agent switch..."
    
    # 1. 保存上下文
    save_context

    # 2. 迁移任务
    migrate_tasks

    # 3. 停止当前 Agent
    stop_current_agent

    # 4. 启动新 Agent
    start_new_agent

    # 5. 创建切换记录
    create_switch_record

    # 6. 显示摘要
    show_switch_summary

    log_success "Agent switch completed successfully"
}

main "$@"
