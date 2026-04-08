#!/bin/bash
#
# Feishu Gateway - 飞书消息网关
# 处理飞书消息接收、解析、转换和响应
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 飞书配置
FEISHU_APP_ID="${FEISHU_APP_ID:-}"
FEISHU_APP_SECRET="${FEISHU_APP_SECRET:-}"
FEISHU_WEBHOOK_URL="${FEISHU_WEBHOOK_URL:-}"
FEISHU_VERIFY_TOKEN="${FEISHU_VERIFY_TOKEN:-}"
FEISHU_ENCRYPT_KEY="${FEISHU_ENCRYPT_KEY:-}"

# 会话配置
SESSION_TTL="${SESSION_TTL:-86400}"  # 24小时

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[FEISHU]${NC} $1"
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

# ==================== Webhook 处理 ====================

# 处理飞书 webhook 请求
handle_webhook() {
    local payload="$1"
    
    log_info "Received webhook request"
    
    # 解析事件类型
    local event_type
    event_type=$(echo "$payload" | jq -r '.header.event_type // .type // "unknown"')
    
    case "$event_type" in
        url_verification)
            # 验证 URL
            handle_url_verification "$payload"
            ;;
        im.message.receive_v1)
            # 接收消息
            handle_message_receive "$payload"
            ;;
        im.chat.member.bot.added_v1)
            # 机器人被添加到群聊
            handle_bot_added "$payload"
            ;;
        *)
            log_warn "Unknown event type: $event_type"
            ;;
    esac
}

# 处理 URL 验证
handle_url_verification() {
    local payload="$1"
    local challenge
    challenge=$(echo "$payload" | jq -r '.challenge')
    
    # 返回 challenge
    cat << EOF
{"challenge": "$challenge"}
EOF
    
    log_success "URL verification completed"
}

# 处理消息接收
handle_message_receive() {
    local payload="$1"
    
    # 提取消息信息
    local message_id chat_id sender open_id msg_type content
    message_id=$(echo "$payload" | jq -r '.event.message.message_id')
    chat_id=$(echo "$payload" | jq -r '.event.message.chat_id')
    sender=$(echo "$payload" | jq -r '.event.sender.sender_id.open_id')
    msg_type=$(echo "$payload" | jq -r '.event.message.message_type')
    content=$(echo "$payload" | jq -r '.event.message.content')
    
    log_info "Received message: $msg_type from $sender in $chat_id"
    
    # 生成会话 ID
    local session_id
    session_id=$(generate_session_id "$chat_id" "$sender")
    
    # 解析消息内容
    local parsed_content
    parsed_content=$(parse_message "$msg_type" "$content")
    
    # 保存消息到会话历史
    save_message_to_session "$session_id" "user" "$parsed_content"
    
    # 转发到 Agent 系统处理
    local response
    response=$(process_with_agent "$session_id" "$parsed_content")
    
    # 发送响应
    send_message "$chat_id" "$response" "$msg_type"
    
    # 保存助手响应
    save_message_to_session "$session_id" "assistant" "$response"
}

# 处理机器人被添加到群聊
handle_bot_added() {
    local payload="$1"
    
    local chat_id chat_name
    chat_id=$(echo "$payload" | jq -r '.event.chat_id')
    chat_name=$(echo "$payload" | jq -r '.event.name')
    
    log_info "Bot added to chat: $chat_name ($chat_id)"
    
    # 发送欢迎消息
    local welcome_msg="你好！我是 Agent Harness 助手。我可以帮助你完成各种任务，包括代码开发、文档编写、问题解答等。请直接 @ 我并描述你的需求。"
    send_message "$chat_id" "$welcome_msg" "text"
}

# ==================== 消息解析 ====================

# 解析飞书消息
parse_message() {
    local msg_type="$1"
    local content="$2"
    
    case "$msg_type" in
        text)
            # 文本消息
            echo "$content" | jq -r '.text // empty'
            ;;
        post)
            # 富文本消息
            parse_rich_text "$content"
            ;;
        image)
            # 图片消息
            log_warn "Image message received, not fully supported yet"
            echo "[图片消息]"
            ;;
        file)
            # 文件消息
            log_warn "File message received, not fully supported yet"
            echo "[文件消息]"
            ;;
        *)
            log_warn "Unknown message type: $msg_type"
            echo "$content"
            ;;
    esac
}

# 解析富文本消息
parse_rich_text() {
    local content="$1"
    
    # 提取富文本中的文本内容
    echo "$content" | jq -r '
        .content[] |
        select(.tag == "text") |
        .text
    ' | tr '\n' ' '
}

# ==================== 消息发送 ====================

# 发送消息到飞书
send_message() {
    local chat_id="$1"
    local content="$2"
    local msg_type="${3:-text}"
    
    if [[ -z "$FEISHU_WEBHOOK_URL" ]]; then
        log_error "FEISHU_WEBHOOK_URL not configured"
        return 1
    fi
    
    # 构建消息体
    local message_body
    message_body=$(build_message_body "$chat_id" "$content" "$msg_type")
    
    # 发送请求
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $(get_access_token)" \
        -d "$message_body" \
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id" 2>/dev/null)
    
    # 检查响应
    local code
    code=$(echo "$response" | jq -r '.code')
    
    if [[ "$code" == "0" ]]; then
        log_success "Message sent successfully"
    else
        log_error "Failed to send message: $(echo "$response" | jq -r '.msg')"
        return 1
    fi
}

# 构建消息体
build_message_body() {
    local chat_id="$1"
    local content="$2"
    local msg_type="$3"
    
    # 对 chat_id 进行 base64 编码
    local receive_id
    receive_id=$(echo -n "$chat_id" | base64)
    
    case "$msg_type" in
        text)
            jq -n \
                --arg receive_id "$receive_id" \
                --arg content "$content" \
                '{
                    receive_id: $receive_id,
                    msg_type: "text",
                    content: {
                        text: $content
                    } | @json
                }'
            ;;
        interactive)
            # 交互式卡片消息
            build_interactive_card "$chat_id" "$content"
            ;;
        *)
            jq -n \
                --arg receive_id "$receive_id" \
                --arg content "$content" \
                '{
                    receive_id: $receive_id,
                    msg_type: "text",
                    content: {
                        text: $content
                    } | @json
                }'
            ;;
    esac
}

# 构建交互式卡片
build_interactive_card() {
    local chat_id="$1"
    local content="$2"
    
    local receive_id
    receive_id=$(echo -n "$chat_id" | base64)
    
    jq -n \
        --arg receive_id "$receive_id" \
        --arg content "$content" \
        '{
            receive_id: $receive_id,
            msg_type: "interactive",
            card: {
                config: {
                    wide_screen_mode: true
                },
                header: {
                    title: {
                        tag: "plain_text",
                        content: "Agent Harness 响应"
                    }
                },
                elements: [
                    {
                        tag: "div",
                        text: {
                            tag: "lark_md",
                            content: $content
                        }
                    }
                ]
            } | @json
        }'
}

# 获取访问令牌
get_access_token() {
    # 检查缓存的 token
    local token_file="/tmp/feishu_access_token"
    
    if [[ -f "$token_file" ]]; then
        local expiry token
        expiry=$(stat -f %m "$token_file" 2>/dev/null || stat -c %Y "$token_file")
        token=$(cat "$token_file")
        
        # Token 有效期 2 小时，提前 5 分钟刷新
        local now
        now=$(date +%s)
        if [[ $((now - expiry)) -lt 6900 ]]; then
            echo "$token"
            return 0
        fi
    fi
    
    # 获取新 token
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"app_id\":\"$FEISHU_APP_ID\",\"app_secret\":\"$FEISHU_APP_SECRET\"}" \
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" 2>/dev/null)
    
    local token
    token=$(echo "$response" | jq -r '.tenant_access_token')
    
    # 缓存 token
    echo "$token" > "$token_file"
    
    echo "$token"
}

# ==================== 会话管理 ====================

# 生成会话 ID
generate_session_id() {
    local chat_id="$1"
    local sender="$2"
    
    # 组合 chat_id 和 sender 生成唯一会话 ID
    echo "feishu-$(echo -n "${chat_id}:${sender}" | sha256sum | cut -d' ' -f1 | head -c 16)"
}

# 保存消息到会话
save_message_to_session() {
    local session_id="$1"
    local role="$2"
    local content="$3"
    
    # 使用内存管理器保存消息
    if [[ -f "$PROJECT_ROOT/memory/memory-manager.sh" ]]; then
        "$PROJECT_ROOT/memory/memory-manager.sh" short-add "$session_id" "$role" "$content"
    fi
}

# 获取会话历史
get_session_history() {
    local session_id="$1"
    
    if [[ -f "$PROJECT_ROOT/memory/memory-manager.sh" ]]; then
        "$PROJECT_ROOT/memory/memory-manager.sh" short-get "$session_id"
    else
        echo "[]"
    fi
}

# ==================== Agent 集成 ====================

# 使用 Agent 处理消息
process_with_agent() {
    local session_id="$1"
    local content="$2"
    
    log_info "Processing with Agent: $session_id"
    
    # 获取会话历史作为上下文
    local history
    history=$(get_session_history "$session_id")
    
    # 构建请求（简化版，实际应调用 Agent 系统）
    # 这里模拟 Agent 响应
    local response="收到你的消息：$content\n\n我已将任务提交给 Agent 系统处理。这是一个演示响应，实际实现需要集成 Agent 编排系统。"
    
    echo -e "$response"
}

# ==================== 服务器模式 ====================

# 启动 webhook 服务器（简化版，实际应使用 HTTP 服务器）
start_server() {
    local port="${1:-8080}"
    
    log_info "Starting Feishu Gateway server on port $port"
    log_info "Note: This is a simplified version. For production, use a proper HTTP server."
    
    # 模拟服务器运行
    while true; do
        log_info "Server running... (Press Ctrl+C to stop)"
        sleep 10
    done
}

# ==================== 命令行工具 ====================

# 发送测试消息
send_test_message() {
    local chat_id="$1"
    local message="${2:-Hello from Agent Harness!}"
    
    log_info "Sending test message to $chat_id"
    send_message "$chat_id" "$message" "text"
}

# 显示帮助
show_help() {
    cat << EOF
Feishu Gateway - Lark/Feishu Message Gateway

Usage: $0 <command> [options]

Commands:
    webhook <payload>
        Process webhook payload (JSON string or file)
    
    send <chat_id> [message]
        Send test message to chat
    
    server [port]
        Start webhook server (simplified)
    
    parse <msg_type> <content>
        Parse message content
    
    session <chat_id> <user_id>
        Generate and show session ID
    
    help
        Show this help message

Environment Variables:
    FEISHU_APP_ID        Feishu App ID
    FEISHU_APP_SECRET    Feishu App Secret
    FEISHU_WEBHOOK_URL   Feishu Webhook URL
    FEISHU_VERIFY_TOKEN  Feishu Verify Token
    FEISHU_ENCRYPT_KEY   Feishu Encrypt Key (optional)

Examples:
    $0 webhook '{"challenge": "test"}'
    $0 send "oc_1234567890abcdef" "Hello World"
    $0 parse text '{"text": "Hello"}'
    $0 session "oc_123" "ou_456"
EOF
}

# 主函数
main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        webhook)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 webhook <payload>"
                exit 1
            fi
            
            local payload="$1"
            # 检查是否是文件
            if [[ -f "$payload" ]]; then
                payload=$(cat "$payload")
            fi
            
            handle_webhook "$payload"
            ;;
        send)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 send <chat_id> [message]"
                exit 1
            fi
            send_test_message "$1" "${2:-Hello from Agent Harness!}"
            ;;
        server)
            start_server "${1:-8080}"
            ;;
        parse)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 parse <msg_type> <content>"
                exit 1
            fi
            parse_message "$1" "$2"
            ;;
        session)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 session <chat_id> <user_id>"
                exit 1
            fi
            generate_session_id "$1" "$2"
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
