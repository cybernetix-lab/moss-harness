#!/bin/bash
# message-handler.sh - 消息处理器
# 处理消息的解析、路由和转换

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$EXTENSION_ROOT")"
MAILBOX_DIR="${PROJECT_ROOT}/runtime/mailbox"
PROTOCOL_FILE="${PROJECT_ROOT}/protocols/mailbox-protocol.yaml"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
Message Handler - 消息处理器

用法: $0 [命令] [选项]

命令:
    parse <msg_file>                解析消息文件
    validate <msg_file>             验证消息格式
    route <msg_file>                路由消息到目标 Agent
    transform <msg_file> <format>   转换消息格式
    reply <msg_file> <body>         创建回复消息
    forward <msg_file> <to_agent>   转发消息
    broadcast <msg_type> <body>     广播消息给所有 Agent

选项:
    --from <agent>                  指定发送方
    --to <agent>                    指定接收方
    --type <type>                   指定消息类型
    --priority <priority>           指定优先级
    --thread <thread_id>            指定线程ID
    -h, --help                      显示此帮助

示例:
    $0 parse runtime/mailbox/planner/inbox/msg-001.json
    $0 validate runtime/mailbox/planner/inbox/msg-001.json
    $0 route runtime/mailbox/planner/outbox/msg-002.json
    $0 reply runtime/mailbox/planner/inbox/msg-001.json '{"status":"approved"}'
EOF
}

# 解析消息
parse_message() {
    local msg_file=$1
    
    if [[ ! -f "$msg_file" ]]; then
        log_error "消息文件不存在: $msg_file"
        return 1
    fi
    
    local msg_content=$(cat "$msg_file")
    
    # 提取关键字段
    local msg_id=$(echo "$msg_content" | jq -r '.header.id')
    local msg_type=$(echo "$msg_content" | jq -r '.header.type')
    local from_agent=$(echo "$msg_content" | jq -r '.header.from')
    local to_agent=$(echo "$msg_content" | jq -r '.header.to')
    local timestamp=$(echo "$msg_content" | jq -r '.header.timestamp')
    local priority=$(echo "$msg_content" | jq -r '.header.priority')
    local thread_id=$(echo "$msg_content" | jq -r '.header.thread_id')
    local status=$(echo "$msg_content" | jq -r '.status')
    
    # 输出解析结果
    cat << EOF
{
  "parsed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "message": {
    "id": "$msg_id",
    "type": "$msg_type",
    "from": "$from_agent",
    "to": "$to_agent",
    "timestamp": "$timestamp",
    "priority": "$priority",
    "thread_id": "$thread_id",
    "status": "$status"
  },
  "body_preview": $(echo "$msg_content" | jq -r '.body | tostring | .[0:200]'),
  "is_valid": true
}
EOF
}

# 验证消息格式
validate_message() {
    local msg_file=$1
    
    if [[ ! -f "$msg_file" ]]; then
        log_error "消息文件不存在: $msg_file"
        return 1
    fi
    
    local errors="[]"
    local warnings="[]"
    
    # 检查 JSON 格式
    if ! jq empty "$msg_file" 2>/dev/null; then
        errors=$(echo "$errors" | jq '. + ["Invalid JSON format"]')
    fi
    
    local msg_content=$(cat "$msg_file")
    
    # 检查必需字段
    local required_fields=("header" "body" "status" "created_at")
    for field in "${required_fields[@]}"; do
        if ! echo "$msg_content" | jq -e ".$field" > /dev/null 2>&1; then
            errors=$(echo "$errors" | jq ". + [\"Missing required field: $field\"]")
        fi
    done
    
    # 检查 header 字段
    local header_fields=("id" "type" "from" "to" "timestamp")
    for field in "${header_fields[@]}"; do
        if ! echo "$msg_content" | jq -e ".header.$field" > /dev/null 2>&1; then
            errors=$(echo "$errors" | jq ". + [\"Missing header field: $field\"]")
        fi
    done
    
    # 验证消息类型
    local msg_type=$(echo "$msg_content" | jq -r '.header.type // "UNKNOWN"')
    # 这里可以添加类型白名单检查
    
    # 验证 Agent 存在
    local from_agent=$(echo "$msg_content" | jq -r '.header.from // ""')
    local to_agent=$(echo "$msg_content" | jq -r '.header.to // ""')
    
    if [[ -n "$from_agent" && ! -d "${MAILBOX_DIR}/${from_agent}" ]]; then
        warnings=$(echo "$warnings" | jq ". + [\"Sender mailbox not found: $from_agent\"]")
    fi
    
    if [[ -n "$to_agent" && ! -d "${MAILBOX_DIR}/${to_agent}" ]]; then
        errors=$(echo "$errors" | jq ". + [\"Target mailbox not found: $to_agent\"]")
    fi
    
    # 验证时间戳格式
    local timestamp=$(echo "$msg_content" | jq -r '.header.timestamp // ""')
    if [[ -n "$timestamp" ]]; then
        if ! date -d "$timestamp" > /dev/null 2>&1; then
            warnings=$(echo "$warnings" | jq '. + ["Invalid timestamp format"]')
        fi
    fi
    
    # 输出验证结果
    local is_valid=$(echo "$errors" | jq 'length == 0')
    
    cat << EOF
{
  "validated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "file": "$msg_file",
  "is_valid": $is_valid,
  "errors": $errors,
  "warnings": $warnings
}
EOF
    
    if [[ "$is_valid" == "false" ]]; then
        return 1
    fi
}

# 路由消息
route_message() {
    local msg_file=$1
    
    if [[ ! -f "$msg_file" ]]; then
        log_error "消息文件不存在: $msg_file"
        return 1
    fi
    
    # 验证消息
    local validation=$(validate_message "$msg_file")
    if [[ $(echo "$validation" | jq -r '.is_valid') == "false" ]]; then
        log_error "消息验证失败"
        echo "$validation" | jq '.errors'
        return 1
    fi
    
    local msg_content=$(cat "$msg_file")
    local to_agent=$(echo "$msg_content" | jq -r '.header.to')
    local msg_id=$(echo "$msg_content" | jq -r '.header.id')
    
    # 检查目标邮箱
    if [[ ! -d "${MAILBOX_DIR}/${to_agent}/inbox" ]]; then
        log_error "目标邮箱不存在: $to_agent"
        return 1
    fi
    
    # 移动消息到目标收件箱
    local target_file="${MAILBOX_DIR}/${to_agent}/inbox/${msg_id}.json"
    
    # 更新状态
    jq '.status = "delivered" | .delivered_at = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$msg_file" > "$target_file"
    rm "$msg_file"
    
    log_success "消息已路由: $msg_id -> $to_agent"
    
    # 输出路由信息
    cat << EOF
{
  "routed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "message_id": "$msg_id",
  "from": "$(echo "$msg_content" | jq -r '.header.from')",
  "to": "$to_agent",
  "target_file": "$target_file"
}
EOF
}

# 转换消息格式
transform_message() {
    local msg_file=$1
    local target_format=$2  # json, yaml, compact
    
    if [[ ! -f "$msg_file" ]]; then
        log_error "消息文件不存在: $msg_file"
        return 1
    fi
    
    local msg_content=$(cat "$msg_file")
    
    case "$target_format" in
        json)
            echo "$msg_content" | jq '.'
            ;;
        yaml)
            if command -v yq > /dev/null 2>&1; then
                echo "$msg_content" | yq -P
            else
                log_error "yq 未安装，无法转换为 YAML"
                return 1
            fi
            ;;
        compact)
            echo "$msg_content" | jq -c '.'
            ;;
        summary)
            local msg_id=$(echo "$msg_content" | jq -r '.header.id')
            local msg_type=$(echo "$msg_content" | jq -r '.header.type')
            local from_agent=$(echo "$msg_content" | jq -r '.header.from')
            local to_agent=$(echo "$msg_content" | jq -r '.header.to')
            local status=$(echo "$msg_content" | jq -r '.status')
            
            cat << EOF
Message Summary:
  ID: $msg_id
  Type: $msg_type
  From: $from_agent
  To: $to_agent
  Status: $status
EOF
            ;;
        *)
            log_error "未知格式: $target_format"
            return 1
            ;;
    esac
}

# 创建回复消息
create_reply() {
    local original_msg_file=$1
    local reply_body=$2
    local priority=${3:-normal}
    
    if [[ ! -f "$original_msg_file" ]]; then
        log_error "原始消息文件不存在: $original_msg_file"
        return 1
    fi
    
    local original_msg=$(cat "$original_msg_file")
    local original_id=$(echo "$original_msg" | jq -r '.header.id')
    local original_from=$(echo "$original_msg" | jq -r '.header.from')
    local original_to=$(echo "$original_msg" | jq -r '.header.to')
    local thread_id=$(echo "$original_msg" | jq -r '.header.thread_id')
    
    # 交换发送方和接收方
    local from_agent="$original_to"
    local to_agent="$original_from"
    
    # 生成新消息ID
    local msg_id="msg-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    
    # 推断回复类型
    local original_type=$(echo "$original_msg" | jq -r '.header.type')
    local reply_type="REPLY"
    
    case "$original_type" in
        PLAN_REQUESTED)
            reply_type="PLAN_COMPLETED"
            ;;
        REVIEW_REQUESTED)
            reply_type="REVIEW_COMPLETED"
            ;;
        EXECUTION_REQUESTED)
            reply_type="EXECUTION_COMPLETED"
            ;;
        EVAL_REQUESTED)
            reply_type="EVAL_COMPLETED"
            ;;
        QUESTION)
            reply_type="ANSWER"
            ;;
    esac
    
    # 创建回复消息
    local msg_file="${MAILBOX_DIR}/${from_agent}/outbox/${msg_id}.json"
    
    cat > "$msg_file" << EOF
{
  "header": {
    "id": "$msg_id",
    "type": "$reply_type",
    "from": "$from_agent",
    "to": "$to_agent",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "priority": "$priority",
    "thread_id": "$thread_id",
    "in_reply_to": "$original_id"
  },
  "body": $reply_body,
  "metadata": {
    "attempt": 1,
    "timeout": 300,
    "original_message": "$original_id"
  },
  "status": "pending_delivery",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "sent_at": null,
  "delivered_at": null,
  "read_at": null,
  "processed_at": null
}
EOF
    
    log_success "回复消息已创建: $msg_id"
    echo "$msg_file"
}

# 转发消息
forward_message() {
    local msg_file=$1
    local to_agent=$2
    local note=${3:-""}
    
    if [[ ! -f "$msg_file" ]]; then
        log_error "消息文件不存在: $msg_file"
        return 1
    fi
    
    local original_msg=$(cat "$msg_file")
    local original_id=$(echo "$original_msg" | jq -r '.header.id')
    local from_agent=$(echo "$original_msg" | jq -r '.header.to')
    local thread_id=$(echo "$original_msg" | jq -r '.header.thread_id')
    local original_body=$(echo "$original_msg" | jq -r '.body')
    
    # 生成新消息ID
    local msg_id="msg-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    
    # 创建转发消息
    local msg_file="${MAILBOX_DIR}/${from_agent}/outbox/${msg_id}.json"
    
    cat > "$msg_file" << EOF
{
  "header": {
    "id": "$msg_id",
    "type": "FORWARDED",
    "from": "$from_agent",
    "to": "$to_agent",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "priority": "normal",
    "thread_id": "$thread_id",
    "forwarded_from": "$original_id"
  },
  "body": {
    "forward_note": "$note",
    "original_message": $original_body
  },
  "metadata": {
    "attempt": 1,
    "timeout": 300,
    "original_message": "$original_id"
  },
  "status": "pending_delivery",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "sent_at": null,
  "delivered_at": null,
  "read_at": null,
  "processed_at": null
}
EOF
    
    log_success "转发消息已创建: $msg_id -> $to_agent"
    echo "$msg_file"
}

# 广播消息
broadcast_message() {
    local msg_type=$1
    local body=$2
    local from_agent=${3:-system}
    local priority=${4:-normal}
    
    # 获取所有 Agent
    local agents=$(find "$MAILBOX_DIR" -maxdepth 1 -type d ! -name "shared" ! -name "mailbox" -exec basename {} \;)
    
    local broadcast_id="broadcast-$(date +%Y%m%d-%H%M%S)"
    local sent_count=0
    
    while IFS= read -r agent; do
        [[ -z "$agent" ]] && continue
        [[ "$agent" == "$from_agent" ]] && continue
        
        local msg_id="msg-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
        local msg_file="${MAILBOX_DIR}/${from_agent}/outbox/${msg_id}.json"
        
        cat > "$msg_file" << EOF
{
  "header": {
    "id": "$msg_id",
    "type": "$msg_type",
    "from": "$from_agent",
    "to": "$agent",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "priority": "$priority",
    "thread_id": "$broadcast_id",
    "broadcast": true
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
        
        ((sent_count++))
    done <<< "$agents"
    
    log_success "广播消息已创建: $broadcast_id -> $sent_count agents"
    
    cat << EOF
{
  "broadcast_id": "$broadcast_id",
  "type": "$msg_type",
  "from": "$from_agent",
  "recipients_count": $sent_count,
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

# 主函数
main() {
    local command=$1
    shift || true
    
    case "$command" in
        parse)
            if [[ -z "$1" ]]; then
                log_error "请指定消息文件"
                exit 1
            fi
            parse_message "$1"
            ;;
        validate)
            if [[ -z "$1" ]]; then
                log_error "请指定消息文件"
                exit 1
            fi
            validate_message "$1"
            ;;
        route)
            if [[ -z "$1" ]]; then
                log_error "请指定消息文件"
                exit 1
            fi
            route_message "$1"
            ;;
        transform)
            if [[ -z "$1" || -z "$2" ]]; then
                log_error "请指定消息文件和目标格式"
                exit 1
            fi
            transform_message "$1" "$2"
            ;;
        reply)
            if [[ -z "$1" || -z "$2" ]]; then
                log_error "请指定原始消息文件和回复内容"
                exit 1
            fi
            create_reply "$1" "$2"
            ;;
        forward)
            if [[ -z "$1" || -z "$2" ]]; then
                log_error "请指定消息文件和目标 Agent"
                exit 1
            fi
            forward_message "$1" "$2"
            ;;
        broadcast)
            if [[ -z "$1" || -z "$2" ]]; then
                log_error "请指定消息类型和内容"
                exit 1
            fi
            broadcast_message "$1" "$2"
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
