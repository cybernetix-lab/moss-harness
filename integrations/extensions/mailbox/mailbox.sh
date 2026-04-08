#!/bin/bash
# mailbox.sh - 文件邮箱系统管理器
# 为 Agent 提供基于文件的通讯机制

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$EXTENSION_ROOT")"
MAILBOX_DIR="${PROJECT_ROOT}/runtime/mailbox"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助
show_help() {
    cat << EOF
Mailbox System - 文件邮箱系统管理器

用法: $0 [命令] [选项]

命令:
    create --agent <name>           为指定 Agent 创建邮箱
    send --from <agent> --to <agent> --type <type> --body <json>
                                    发送消息
    receive --agent <name> [--unread|--all]
                                    接收消息
    mark-read --agent <name> --msg <id>
                                    标记消息为已读
    status --thread <id>            查询线程状态
    list --agent <name> [--box <inbox|outbox|sent>]
                                    列出消息
    archive --agent <name> [--older-than <days>]
                                    归档旧消息
    cleanup --agent <name>          清理回收站
    
选项:
    --priority <low|normal|high>    消息优先级
    --thread <id>                   线程ID
    --timeout <seconds>             超时时间
    -v, --verbose                   显示详细信息
    -h, --help                      显示此帮助

示例:
    $0 create --agent planner
    $0 send --from planner --to reviewer --type PLAN_COMPLETED --body '{"plan":{}}'
    $0 receive --agent reviewer --unread
    $0 status --thread task-001
EOF
}

# 生成消息ID
generate_msg_id() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local random=$(openssl rand -hex 4)
    echo "msg-${timestamp}-${random}"
}

# 生成线程ID
generate_thread_id() {
    local timestamp=$(date +%Y%m%d)
    local random=$(openssl rand -hex 2)
    echo "thread-${timestamp}-${random}"
}

# 创建邮箱
create_mailbox() {
    local agent_name=$1
    local agent_mailbox="${MAILBOX_DIR}/${agent_name}"
    
    if [[ -d "$agent_mailbox" ]]; then
        log_warning "邮箱已存在: $agent_name"
        return 0
    fi
    
    mkdir -p "${agent_mailbox}"/{inbox,outbox,draft,sent,trash}
    
    # 创建邮箱元数据
    cat > "${agent_mailbox}/.metadata.json" << EOF
{
  "agent_name": "$agent_name",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_activity": null,
  "message_count": {
    "inbox": 0,
    "outbox": 0,
    "sent": 0,
    "draft": 0,
    "trash": 0
  }
}
EOF
    
    log_success "邮箱创建成功: $agent_name"
}

# 发送消息
send_message() {
    local from_agent=$1
    local to_agent=$2
    local msg_type=$3
    local body=$4
    local priority=${5:-normal}
    local thread_id=${6:-}
    local in_reply_to=${7:-}
    
    # 验证发送方邮箱
    if [[ ! -d "${MAILBOX_DIR}/${from_agent}" ]]; then
        log_error "发送方邮箱不存在: $from_agent"
        return 1
    fi
    
    # 验证接收方邮箱
    if [[ ! -d "${MAILBOX_DIR}/${to_agent}" ]]; then
        log_error "接收方邮箱不存在: $to_agent"
        return 1
    fi
    
    # 生成消息ID
    local msg_id=$(generate_msg_id)
    
    # 如果没有线程ID，创建新的
    if [[ -z "$thread_id" ]]; then
        thread_id=$(generate_thread_id)
    fi
    
    # 创建消息
    local msg_file="${MAILBOX_DIR}/${from_agent}/outbox/${msg_id}.json"
    
    cat > "$msg_file" << EOF
{
  "header": {
    "id": "$msg_id",
    "type": "$msg_type",
    "from": "$from_agent",
    "to": "$to_agent",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "priority": "$priority",
    "thread_id": "$thread_id"
    $(if [[ -n "$in_reply_to" ]]; then echo ",\"in_reply_to\": \"$in_reply_to\""; fi)
  },
  "body": $body,
  "metadata": {
    "attempt": 1,
    "timeout": 300
  },
  "status": "pending_delivery",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "sent_at": null,
  "delivered_at": null,
  "read_at": null,
  "processed_at": null
}
EOF
    
    log_success "消息已创建: $msg_id"
    echo "$msg_id"
    
    # 触发投递（异步）
    trigger_delivery "$msg_id" "$from_agent" "$to_agent" &
}

# 触发投递
trigger_delivery() {
    local msg_id=$1
    local from_agent=$2
    local to_agent=$3
    
    local msg_file="${MAILBOX_DIR}/${from_agent}/outbox/${msg_id}.json"
    local target_file="${MAILBOX_DIR}/${to_agent}/inbox/${msg_id}.json"
    
    # 模拟网络延迟
    sleep 0.1
    
    # 原子移动文件
    if mv "$msg_file" "$target_file" 2>/dev/null; then
        # 更新消息状态
        jq '.status = "delivered" | .delivered_at = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$target_file" > "${target_file}.tmp"
        mv "${target_file}.tmp" "$target_file"
        
        # 更新发送方元数据
        update_mailbox_metadata "$from_agent" "sent"
        
        log_info "消息已投递: $msg_id -> $to_agent"
    else
        log_error "消息投递失败: $msg_id"
    fi
}

# 接收消息
receive_messages() {
    local agent_name=$1
    local filter=${2:-all}  # all, unread
    local agent_inbox="${MAILBOX_DIR}/${agent_name}/inbox"
    
    if [[ ! -d "$agent_inbox" ]]; then
        log_error "邮箱不存在: $agent_name"
        return 1
    fi
    
    local messages="[]"
    
    for msg_file in "$agent_inbox"/*.json; do
        [[ -f "$msg_file" ]] || continue
        
        local msg_content=$(cat "$msg_file")
        local msg_status=$(echo "$msg_content" | jq -r '.status')
        
        # 根据过滤条件筛选
        if [[ "$filter" == "unread" && "$msg_status" != "delivered" ]]; then
            continue
        fi
        
        messages=$(echo "$messages" | jq --argjson msg "$msg_content" '. + [$msg]')
        
        # 标记为已读
        if [[ "$msg_status" == "delivered" ]]; then
            jq '.status = "read" | .read_at = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$msg_file" > "${msg_file}.tmp"
            mv "${msg_file}.tmp" "$msg_file"
        fi
    done
    
    # 输出结果
    echo "$messages" | jq '.'
}

# 标记消息为已读
mark_read() {
    local agent_name=$1
    local msg_id=$2
    local msg_file="${MAILBOX_DIR}/${agent_name}/inbox/${msg_id}.json"
    
    if [[ ! -f "$msg_file" ]]; then
        log_error "消息不存在: $msg_id"
        return 1
    fi
    
    jq '.status = "read" | .read_at = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$msg_file" > "${msg_file}.tmp"
    mv "${msg_file}.tmp" "$msg_file"
    
    log_success "消息已标记为已读: $msg_id"
}

# 查询线程状态
query_thread_status() {
    local thread_id=$1
    local state_file="${MAILBOX_DIR}/shared/state/${thread_id}.json"
    
    if [[ ! -f "$state_file" ]]; then
        log_error "线程不存在: $thread_id"
        return 1
    fi
    
    cat "$state_file" | jq '.'
}

# 列出消息
list_messages() {
    local agent_name=$1
    local box=${2:-inbox}
    local box_dir="${MAILBOX_DIR}/${agent_name}/${box}"
    
    if [[ ! -d "$box_dir" ]]; then
        log_error "邮箱不存在: $agent_name/$box"
        return 1
    fi
    
    echo "=== $agent_name 的 $box 消息 ==="
    
    for msg_file in "$box_dir"/*.json; do
        [[ -f "$msg_file" ]] || continue
        
        local msg_id=$(basename "$msg_file" .json)
        local msg_content=$(cat "$msg_file")
        local msg_type=$(echo "$msg_content" | jq -r '.header.type')
        local msg_from=$(echo "$msg_content" | jq -r '.header.from')
        local msg_status=$(echo "$msg_content" | jq -r '.status')
        local msg_timestamp=$(echo "$msg_content" | jq -r '.header.timestamp')
        
        printf "  %-30s %-20s %-15s %-10s %s\n" "$msg_id" "$msg_type" "$msg_from" "$msg_status" "$msg_timestamp"
    done
}

# 归档消息
archive_messages() {
    local agent_name=$1
    local older_than_days=${2:-7}
    local agent_inbox="${MAILBOX_DIR}/${agent_name}/inbox"
    local agent_archive="${MAILBOX_DIR}/${agent_name}/archive"
    
    mkdir -p "$agent_archive"
    
    local cutoff_date=$(date -d "-${older_than_days} days" +%s)
    local archived_count=0
    
    for msg_file in "$agent_inbox"/*.json; do
        [[ -f "$msg_file" ]] || continue
        
        local msg_date=$(stat -c %Y "$msg_file")
        
        if [[ $msg_date -lt $cutoff_date ]]; then
            local msg_id=$(basename "$msg_file")
            mv "$msg_file" "${agent_archive}/${msg_id}"
            ((archived_count++))
        fi
    done
    
    log_success "已归档 $archived_count 条消息"
}

# 清理回收站
cleanup_trash() {
    local agent_name=$1
    local trash_dir="${MAILBOX_DIR}/${agent_name}/trash"
    
    if [[ ! -d "$trash_dir" ]]; then
        log_warning "回收站不存在: $agent_name"
        return 0
    fi
    
    local deleted_count=$(find "$trash_dir" -name "*.json" -type f | wc -l)
    rm -f "$trash_dir"/*.json
    
    log_success "已清理 $deleted_count 条消息"
}

# 更新邮箱元数据
update_mailbox_metadata() {
    local agent_name=$1
    local box_type=$2
    local metadata_file="${MAILBOX_DIR}/${agent_name}/.metadata.json"
    
    if [[ ! -f "$metadata_file" ]]; then
        return 0
    fi
    
    jq ".message_count.${box_type} += 1 | .last_activity = \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" "$metadata_file" > "${metadata_file}.tmp"
    mv "${metadata_file}.tmp" "$metadata_file"
}

# 创建线程状态
create_thread_state() {
    local thread_id=$1
    local task_id=$2
    local requirements=$3
    local state_file="${MAILBOX_DIR}/shared/state/${thread_id}.json"
    
    mkdir -p "$(dirname "$state_file")"
    
    cat > "$state_file" << EOF
{
  "thread_id": "$thread_id",
  "task_id": "$task_id",
  "status": "created",
  "current_phase": "planning",
  "assigned_agents": {
    "planner": "pending",
    "reviewer": "pending",
    "executor": "pending",
    "evaluator": "pending"
  },
  "context": {
    "requirements": "$requirements",
    "plan": null,
    "review_report": null,
    "execution_result": null,
    "evaluation_report": null
  },
  "history": [
    {
      "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "event": "thread_created",
      "agent": "system"
    }
  ],
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "completed_at": null
}
EOF
    
    log_success "线程状态已创建: $thread_id"
}

# 更新线程状态
update_thread_state() {
    local thread_id=$1
    local agent=$2
    local status=$3
    local context_update=${4:-null}
    local state_file="${MAILBOX_DIR}/shared/state/${thread_id}.json"
    
    if [[ ! -f "$state_file" ]]; then
        log_error "线程不存在: $thread_id"
        return 1
    fi
    
    # 更新 Agent 状态
    jq ".assigned_agents.${agent} = \"$status\" | .updated_at = \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" "$state_file" > "${state_file}.tmp"
    mv "${state_file}.tmp" "$state_file"
    
    # 如果有上下文更新
    if [[ "$context_update" != "null" ]]; then
        jq ".context += $context_update" "$state_file" > "${state_file}.tmp"
        mv "${state_file}.tmp" "$state_file"
    fi
    
    # 添加历史记录
    local history_entry="{\"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"event\": \"${agent}_${status}\", \"agent\": \"$agent\"}"
    jq ".history += [$history_entry]" "$state_file" > "${state_file}.tmp"
    mv "${state_file}.tmp" "$state_file"
}

# 主函数
main() {
    local command=$1
    shift || true
    
    # 解析参数
    local agent=""
    local from_agent=""
    local to_agent=""
    local msg_type=""
    local body=""
    local priority="normal"
    local thread_id=""
    local msg_id=""
    local box="inbox"
    local older_than=7
    local unread=false
    local verbose=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --agent)
                agent=$2
                shift 2
                ;;
            --from)
                from_agent=$2
                shift 2
                ;;
            --to)
                to_agent=$2
                shift 2
                ;;
            --type)
                msg_type=$2
                shift 2
                ;;
            --body)
                body=$2
                shift 2
                ;;
            --priority)
                priority=$2
                shift 2
                ;;
            --thread)
                thread_id=$2
                shift 2
                ;;
            --msg)
                msg_id=$2
                shift 2
                ;;
            --box)
                box=$2
                shift 2
                ;;
            --older-than)
                older_than=$2
                shift 2
                ;;
            --unread)
                unread=true
                shift
                ;;
            --all)
                unread=false
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    case "$command" in
        create)
            if [[ -z "$agent" ]]; then
                log_error "请指定 --agent"
                exit 1
            fi
            create_mailbox "$agent"
            ;;
        send)
            if [[ -z "$from_agent" || -z "$to_agent" || -z "$msg_type" || -z "$body" ]]; then
                log_error "请指定 --from, --to, --type, --body"
                exit 1
            fi
            send_message "$from_agent" "$to_agent" "$msg_type" "$body" "$priority" "$thread_id"
            ;;
        receive)
            if [[ -z "$agent" ]]; then
                log_error "请指定 --agent"
                exit 1
            fi
            local filter="all"
            [[ "$unread" == "true" ]] && filter="unread"
            receive_messages "$agent" "$filter"
            ;;
        mark-read)
            if [[ -z "$agent" || -z "$msg_id" ]]; then
                log_error "请指定 --agent 和 --msg"
                exit 1
            fi
            mark_read "$agent" "$msg_id"
            ;;
        status)
            if [[ -z "$thread_id" ]]; then
                log_error "请指定 --thread"
                exit 1
            fi
            query_thread_status "$thread_id"
            ;;
        list)
            if [[ -z "$agent" ]]; then
                log_error "请指定 --agent"
                exit 1
            fi
            list_messages "$agent" "$box"
            ;;
        archive)
            if [[ -z "$agent" ]]; then
                log_error "请指定 --agent"
                exit 1
            fi
            archive_messages "$agent" "$older_than"
            ;;
        cleanup)
            if [[ -z "$agent" ]]; then
                log_error "请指定 --agent"
                exit 1
            fi
            cleanup_trash "$agent"
            ;;
        create-thread)
            if [[ -z "$thread_id" ]]; then
                log_error "请指定 --thread"
                exit 1
            fi
            create_thread_state "$thread_id" "${task_id:-$thread_id}" "${requirements:-}"
            ;;
        update-thread)
            if [[ -z "$thread_id" || -z "$agent" ]]; then
                log_error "请指定 --thread 和 --agent"
                exit 1
            fi
            update_thread_state "$thread_id" "$agent" "${status:-completed}"
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"
