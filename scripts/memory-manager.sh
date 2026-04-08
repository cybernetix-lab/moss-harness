#!/bin/bash
#
# Memory Manager - 内存管理系统
# 支持工作内存、短期记忆、长期记忆、共享内存四层架构
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 内存存储目录
MEMORY_DIR="${PROJECT_ROOT}/runtime/memory"
WORKING_MEMORY_DIR="$MEMORY_DIR/working"
SHORT_TERM_DIR="$MEMORY_DIR/short-term"
LONG_TERM_DIR="$MEMORY_DIR/long-term"
SHARED_MEMORY_DIR="$MEMORY_DIR/shared"

# 默认配置
DEFAULT_SHORT_TERM_TURNS=10
DEFAULT_LONG_TERM_DEBOUNCE=30

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[MEMORY]${NC} $1"
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

# 初始化内存目录
init_memory_system() {
    log_info "Initializing memory system..."
    
    for dir in "$WORKING_MEMORY_DIR" "$SHORT_TERM_DIR" "$LONG_TERM_DIR" "$SHARED_MEMORY_DIR"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    log_success "Memory system initialized"
}

# ==================== 工作内存 (Working Memory) ====================

# 设置工作内存
set_working_memory() {
    local session_id="$1"
    local key="$2"
    local value="$3"
    
    local session_dir="$WORKING_MEMORY_DIR/$session_id"
    mkdir -p "$session_dir"
    
    # 直接写入，无持久化
    echo "$value" > "$session_dir/$key"
    
    log_info "Working memory set: $session_id/$key"
}

# 获取工作内存
get_working_memory() {
    local session_id="$1"
    local key="$2"
    
    local file="$WORKING_MEMORY_DIR/$session_id/$key"
    if [[ -f "$file" ]]; then
        cat "$file"
    else
        echo ""
    fi
}

# 清除工作内存
clear_working_memory() {
    local session_id="$1"
    local session_dir="$WORKING_MEMORY_DIR/$session_id"
    
    if [[ -d "$session_dir" ]]; then
        rm -rf "$session_dir"
        log_info "Working memory cleared: $session_id"
    fi
}

# ==================== 短期记忆 (Short-term Memory) ====================

# 添加短期记忆
add_short_term_memory() {
    local session_id="$1"
    local role="$2"  # user 或 assistant
    local content="$3"
    
    local memory_file="$SHORT_TERM_DIR/$session_id.json"
    
    # 初始化文件
    if [[ ! -f "$memory_file" ]]; then
        echo '{"messages": []}' > "$memory_file"
    fi
    
    # 添加消息
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local new_message
    new_message=$(jq -n \
        --arg role "$role" \
        --arg content "$content" \
        --arg timestamp "$timestamp" \
        '{role: $role, content: $content, timestamp: $timestamp}')
    
    # 更新文件
    jq --argjson msg "$new_message" '.messages += [$msg]' "$memory_file" > "${memory_file}.tmp"
    mv "${memory_file}.tmp" "$memory_file"
    
    # 应用滑动窗口
    apply_sliding_window "$session_id"
    
    log_info "Short-term memory added: $session_id ($role)"
}

# 应用滑动窗口
apply_sliding_window() {
    local session_id="$1"
    local max_turns="${SHORT_TERM_MAX_TURNS:-$DEFAULT_SHORT_TERM_TURNS}"
    local memory_file="$SHORT_TERM_DIR/$session_id.json"
    
    if [[ ! -f "$memory_file" ]]; then
        return 0
    fi
    
    local current_count
    current_count=$(jq '.messages | length' "$memory_file")
    
    if [[ "$current_count" -gt "$max_turns" ]]; then
        local to_remove=$((current_count - max_turns))
        jq ".messages = .messages[$to_remove:]" "$memory_file" > "${memory_file}.tmp"
        mv "${memory_file}.tmp" "$memory_file"
        log_info "Applied sliding window: removed $to_remove messages"
    fi
}

# 获取短期记忆
get_short_term_memory() {
    local session_id="$1"
    local memory_file="$SHORT_TERM_DIR/$session_id.json"
    
    if [[ -f "$memory_file" ]]; then
        jq '.messages' "$memory_file"
    else
        echo "[]"
    fi
}

# 获取格式化的短期记忆（用于注入）
get_formatted_short_term_memory() {
    local session_id="$1"
    local memory_file="$SHORT_TERM_DIR/$session_id.json"
    
    if [[ ! -f "$memory_file" ]]; then
        echo ""
        return 0
    fi
    
    # 格式化为对话形式
    jq -r '.messages[] | "\(.role | ascii_upcase): \(.content)"' "$memory_file"
}

# 清除短期记忆
clear_short_term_memory() {
    local session_id="$1"
    local memory_file="$SHORT_TERM_DIR/$session_id.json"
    
    if [[ -f "$memory_file" ]]; then
        rm "$memory_file"
        log_info "Short-term memory cleared: $session_id"
    fi
}

# ==================== 长期记忆 (Long-term Memory) ====================

# 提取并保存长期记忆
extract_long_term_memory() {
    local session_id="$1"
    local extraction_type="$2"
    local content="$3"
    
    local memory_file="$LONG_TERM_DIR/$session_id.json"
    
    # 初始化文件
    if [[ ! -f "$memory_file" ]]; then
        echo '{"memories": []}' > "$memory_file"
    fi
    
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local memory_entry
    memory_entry=$(jq -n \
        --arg type "$extraction_type" \
        --arg content "$content" \
        --arg timestamp "$timestamp" \
        --arg session_id "$session_id" \
        '{
            id: ($session_id + "-" + $timestamp),
            type: $type,
            content: $content,
            timestamp: $timestamp,
            access_count: 0,
            last_accessed: $timestamp
        }')
    
    # 检查是否已存在相似记忆（简单去重）
    local existing
    existing=$(jq --arg content "$content" '.memories[] | select(.content == $content) | .id' "$memory_file" | head -1)
    
    if [[ -n "$existing" ]]; then
        # 更新访问计数
        jq --arg id "$existing" \
           --arg timestamp "$timestamp" \
           '(.memories[] | select(.id == $id) | .access_count) += 1 | 
            (.memories[] | select(.id == $id) | .last_accessed) = $timestamp' \
           "$memory_file" > "${memory_file}.tmp"
        mv "${memory_file}.tmp" "$memory_file"
        log_info "Updated existing long-term memory: $existing"
    else
        # 添加新记忆
        jq --argjson entry "$memory_entry" '.memories += [$entry]' "$memory_file" > "${memory_file}.tmp"
        mv "${memory_file}.tmp" "$memory_file"
        log_info "Extracted long-term memory: $extraction_type"
    fi
}

# 获取长期记忆
get_long_term_memory() {
    local session_id="$1"
    local filter_type="${2:-all}"
    local memory_file="$LONG_TERM_DIR/$session_id.json"
    
    if [[ ! -f "$memory_file" ]]; then
        echo "[]"
        return 0
    fi
    
    if [[ "$filter_type" == "all" ]]; then
        jq '.memories' "$memory_file"
    else
        jq --arg type "$filter_type" '.memories | map(select(.type == $type))' "$memory_file"
    fi
}

# 搜索长期记忆
search_long_term_memory() {
    local session_id="$1"
    local query="$2"
    local memory_file="$LONG_TERM_DIR/$session_id.json"
    
    if [[ ! -f "$memory_file" ]]; then
        echo "[]"
        return 0
    fi
    
    # 简单的文本搜索（未来可集成向量搜索）
    jq --arg query "$query" \
       '.memories | map(select(.content | contains($query)))' \
       "$memory_file"
}

# 获取用户画像
get_user_profile() {
    local session_id="$1"
    local memory_file="$LONG_TERM_DIR/$session_id.json"
    
    if [[ ! -f "$memory_file" ]]; then
        echo "{}"
        return 0
    fi
    
    # 提取用户偏好和画像信息
    jq '{
        preferences: [.memories[] | select(.type == "user_preference") | .content],
        knowledge: [.memories[] | select(.type == "domain_knowledge") | .content],
        patterns: [.memories[] | select(.type == "task_pattern") | .content]
    }' "$memory_file"
}

# ==================== 共享内存 (Shared Memory) ====================

# 设置共享内存
set_shared_memory() {
    local shared_key="$1"
    local key="$2"
    local value="$3"
    
    local shared_dir="$SHARED_MEMORY_DIR/$shared_key"
    mkdir -p "$shared_dir"
    
    # 写入共享内存
    echo "$value" > "$shared_dir/$key"
    
    # 记录访问日志
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "$timestamp: write $key" >> "$shared_dir/.access_log"
    
    log_info "Shared memory set: $shared_key/$key"
}

# 获取共享内存
get_shared_memory() {
    local shared_key="$1"
    local key="$2"
    
    local file="$SHARED_MEMORY_DIR/$shared_key/$key"
    if [[ -f "$file" ]]; then
        # 记录访问日志
        local timestamp
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        echo "$timestamp: read $key" >> "$SHARED_MEMORY_DIR/$shared_key/.access_log"
        
        cat "$file"
    else
        echo ""
    fi
}

# 列出共享内存键
list_shared_memory_keys() {
    local shared_key="$1"
    local shared_dir="$SHARED_MEMORY_DIR/$shared_key"
    
    if [[ -d "$shared_dir" ]]; then
        ls -1 "$shared_dir" | grep -v '^\.' || true
    fi
}

# 删除共享内存
delete_shared_memory() {
    local shared_key="$1"
    local key="${2:-}"
    
    local shared_dir="$SHARED_MEMORY_DIR/$shared_key"
    
    if [[ -z "$key" ]]; then
        # 删除整个共享内存空间
        if [[ -d "$shared_dir" ]]; then
            rm -rf "$shared_dir"
            log_info "Shared memory deleted: $shared_key"
        fi
    else
        # 删除特定键
        local file="$shared_dir/$key"
        if [[ -f "$file" ]]; then
            rm "$file"
            log_info "Shared memory key deleted: $shared_key/$key"
        fi
    fi
}

# ==================== 记忆注入 (Memory Injection) ====================

# 注入记忆到上下文
inject_memory() {
    local session_id="$1"
    local injection_point="$2"
    
    log_info "Injecting memory at point: $injection_point"
    
    case "$injection_point" in
        conversation_start)
            # 注入用户画像
            local user_profile
            user_profile=$(get_user_profile "$session_id")
            if [[ "$user_profile" != "{}" ]]; then
                echo "=== User Profile ==="
                echo "$user_profile" | jq -r '.preferences[]' 2>/dev/null || true
                echo ""
            fi
            ;;
            
        task_start)
            # 注入相关历史
            local relevant_history
            relevant_history=$(get_formatted_short_term_memory "$session_id")
            if [[ -n "$relevant_history" ]]; then
                echo "=== Conversation History ==="
                echo "$relevant_history"
                echo ""
            fi
            ;;
            
        context_overflow)
            # 注入压缩摘要
            local summary
            summary=$(generate_memory_summary "$session_id")
            if [[ -n "$summary" ]]; then
                echo "=== Context Summary ==="
                echo "$summary"
                echo ""
            fi
            ;;
    esac
}

# 生成记忆摘要
generate_memory_summary() {
    local session_id="$1"
    local memory_file="$SHORT_TERM_DIR/$session_id.json"
    
    if [[ ! -f "$memory_file" ]]; then
        return 0
    fi
    
    # 提取关键信息生成摘要
    jq -r '
        .messages |
        group_by(.role) |
        map({
            role: .[0].role,
            count: length,
            first_message: first.content[:100],
            last_message: last.content[:100]
        }) |
        .[] |
        "\(.role): \(.count) messages"
    ' "$memory_file"
}

# ==================== 记忆提取 (Memory Extraction) ====================

# 从对话中提取记忆
extract_memories_from_conversation() {
    local session_id="$1"
    local role="$2"
    local content="$3"
    
    # 提取用户偏好
    if [[ "$role" == "user" ]]; then
        # 检测偏好声明
        if echo "$content" | grep -qiE "(prefer|like|want|need|always|never)"; then
            extract_long_term_memory "$session_id" "user_preference" "$content"
        fi
    fi
    
    # 提取领域知识（简化版）
    if echo "$content" | grep -qiE "(is a|are used for|means|refers to)"; then
        extract_long_term_memory "$session_id" "domain_knowledge" "$content"
    fi
}

# ==================== 清理和维护 ====================

# 清理过期记忆
cleanup_memories() {
    local max_age_days="${1:-30}"
    local current_time
    current_time=$(date +%s)
    local max_age_seconds=$((max_age_days * 24 * 3600))
    
    log_info "Cleaning up memories older than $max_age_days days"
    
    local cleaned=0
    
    # 清理短期记忆
    for file in "$SHORT_TERM_DIR"/*.json; do
        if [[ -f "$file" ]]; then
            local file_time
            file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file")
            local age=$((current_time - file_time))
            
            if [[ "$age" -gt "$max_age_seconds" ]]; then
                rm "$file"
                ((cleaned++))
            fi
        fi
    done
    
    # 清理工作内存
    for dir in "$WORKING_MEMORY_DIR"/*; do
        if [[ -d "$dir" ]]; then
            local dir_time
            dir_time=$(stat -f %m "$dir" 2>/dev/null || stat -c %Y "$dir")
            local age=$((current_time - dir_time))
            
            if [[ "$age" -gt "$max_age_seconds" ]]; then
                rm -rf "$dir"
                ((cleaned++))
            fi
        fi
    done
    
    log_success "Cleaned up $cleaned memory entries"
}

# 显示内存统计
show_memory_stats() {
    log_info "Memory System Statistics"
    echo "=========================="
    
    # 工作内存统计
    local working_count=0
    if [[ -d "$WORKING_MEMORY_DIR" ]]; then
        working_count=$(find "$WORKING_MEMORY_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)
    fi
    echo "Working Memory Sessions: $working_count"
    
    # 短期记忆统计
    local short_term_count=0
    if [[ -d "$SHORT_TERM_DIR" ]]; then
        short_term_count=$(find "$SHORT_TERM_DIR" -name "*.json" | wc -l)
    fi
    echo "Short-term Memory Sessions: $short_term_count"
    
    # 长期记忆统计
    local long_term_count=0
    local total_memories=0
    if [[ -d "$LONG_TERM_DIR" ]]; then
        long_term_count=$(find "$LONG_TERM_DIR" -name "*.json" | wc -l)
        for file in "$LONG_TERM_DIR"/*.json; do
            if [[ -f "$file" ]]; then
                local count
                count=$(jq '.memories | length' "$file" 2>/dev/null || echo 0)
                ((total_memories+=count))
            fi
        done
    fi
    echo "Long-term Memory Sessions: $long_term_count"
    echo "Total Long-term Memories: $total_memories"
    
    # 共享内存统计
    local shared_count=0
    if [[ -d "$SHARED_MEMORY_DIR" ]]; then
        shared_count=$(find "$SHARED_MEMORY_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)
    fi
    echo "Shared Memory Spaces: $shared_count"
}

# 显示帮助
show_help() {
    cat << EOF
Memory Manager - Multi-layer Memory System

Usage: $0 <command> [options]

Commands:
    # Working Memory
    working-set <session_id> <key> <value>
        Set working memory
    working-get <session_id> <key>
        Get working memory
    working-clear <session_id>
        Clear working memory for session
    
    # Short-term Memory
    short-add <session_id> <role> <content>
        Add short-term memory
    short-get <session_id>
        Get short-term memory
    short-clear <session_id>
        Clear short-term memory
    
    # Long-term Memory
    long-extract <session_id> <type> <content>
        Extract long-term memory
    long-get <session_id> [type]
        Get long-term memory (optionally filter by type)
    long-search <session_id> <query>
        Search long-term memory
    profile <session_id>
        Get user profile
    
    # Shared Memory
    shared-set <shared_key> <key> <value>
        Set shared memory
    shared-get <shared_key> <key>
        Get shared memory
    shared-list <shared_key>
        List shared memory keys
    shared-delete <shared_key> [key]
        Delete shared memory
    
    # Injection
    inject <session_id> <point>
        Inject memory at point (conversation_start, task_start, context_overflow)
    
    # Maintenance
    cleanup [max_age_days]
        Clean up old memories (default: 30 days)
    stats
        Show memory statistics
    
    help
        Show this help message

Examples:
    $0 working-set session-123 task "Implement auth"
    $0 short-add session-123 user "I prefer TypeScript"
    $0 long-extract session-123 user_preference "Prefers dark mode"
    $0 inject session-123 conversation_start
EOF
}

# 主函数
main() {
    # 初始化内存系统
    init_memory_system
    
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        # Working Memory
        working-set)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 working-set <session_id> <key> <value>"
                exit 1
            fi
            set_working_memory "$1" "$2" "$3"
            ;;
        working-get)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 working-get <session_id> <key>"
                exit 1
            fi
            get_working_memory "$1" "$2"
            ;;
        working-clear)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 working-clear <session_id>"
                exit 1
            fi
            clear_working_memory "$1"
            ;;
            
        # Short-term Memory
        short-add)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 short-add <session_id> <role> <content>"
                exit 1
            fi
            add_short_term_memory "$1" "$2" "$3"
            ;;
        short-get)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 short-get <session_id>"
                exit 1
            fi
            get_short_term_memory "$1"
            ;;
        short-clear)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 short-clear <session_id>"
                exit 1
            fi
            clear_short_term_memory "$1"
            ;;
            
        # Long-term Memory
        long-extract)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 long-extract <session_id> <type> <content>"
                exit 1
            fi
            extract_long_term_memory "$1" "$2" "$3"
            ;;
        long-get)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 long-get <session_id> [type]"
                exit 1
            fi
            get_long_term_memory "$1" "${2:-all}"
            ;;
        long-search)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 long-search <session_id> <query>"
                exit 1
            fi
            search_long_term_memory "$1" "$2"
            ;;
        profile)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 profile <session_id>"
                exit 1
            fi
            get_user_profile "$1"
            ;;
            
        # Shared Memory
        shared-set)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 shared-set <shared_key> <key> <value>"
                exit 1
            fi
            set_shared_memory "$1" "$2" "$3"
            ;;
        shared-get)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 shared-get <shared_key> <key>"
                exit 1
            fi
            get_shared_memory "$1" "$2"
            ;;
        shared-list)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 shared-list <shared_key>"
                exit 1
            fi
            list_shared_memory_keys "$1"
            ;;
        shared-delete)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 shared-delete <shared_key> [key]"
                exit 1
            fi
            delete_shared_memory "$1" "${2:-}"
            ;;
            
        # Injection
        inject)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 inject <session_id> <point>"
                exit 1
            fi
            inject_memory "$1" "$2"
            ;;
            
        # Maintenance
        cleanup)
            cleanup_memories "${1:-30}"
            ;;
        stats)
            show_memory_stats
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
