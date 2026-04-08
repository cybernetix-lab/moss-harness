#!/bin/bash
#
# context-compactor.sh - 上下文压缩管理器
# 实现三层压缩机制：大结果持久化、旧结果微压缩、整体历史压缩
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 配置
PERSIST_THRESHOLD=2000  # 超过此字符数则持久化
MICRO_COMPACT_KEEP=3    # 保留最近3个工具结果
CONTEXT_LIMIT=8000      # 上下文字符数上限
OUTPUTS_DIR="${PROJECT_ROOT}/.runtime/outputs"
STATE_FILE="${PROJECT_ROOT}/.runtime/context/compact-state.json"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[COMPACTOR]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 初始化目录
init() {
    mkdir -p "$OUTPUTS_DIR"
    mkdir -p "$(dirname "$STATE_FILE")"
    
    # 初始化状态文件
    if [[ ! -f "$STATE_FILE" ]]; then
        cat > "$STATE_FILE" << 'EOF'
{
    "has_compacted": false,
    "last_summary": "",
    "recent_files": [],
    "compact_count": 0,
    "last_compact_time": ""
}
EOF
    fi
}

# 记录遥测数据
record_telemetry() {
    local event_type="$1"
    local data="$2"
    local timestamp=$(date -Iseconds)
    local telemetry_dir="${PROJECT_ROOT}/.runtime/telemetry"
    local events_file="${telemetry_dir}/events.jsonl"
    
    mkdir -p "$telemetry_dir"
    
    # 构造标准遥测事件
    cat >> "$events_file" << EOF 2>/dev/null || true
{"type":"${event_type}","timestamp":"${timestamp}","id":"compactor_$(date +%s)","data":${data}}
EOF
}

# 第一步：大工具结果持久化
# 将大输出保存到磁盘，只保留预览
persist_large_output() {
    local tool_name="$1"
    local output="$2"
    local output_len=${#output}
    
    # 如果输出不大，直接返回
    if [[ $output_len -le $PERSIST_THRESHOLD ]]; then
        echo "$output"
        return 0
    fi
    
    # 生成唯一ID
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local hash=$(echo "$output" | md5 | cut -c1-8)
    local filename="${tool_name}_${timestamp}_${hash}.txt"
    local filepath="${OUTPUTS_DIR}/${filename}"
    
    # 保存完整输出
    echo "$output" > "$filepath"
    
    # 生成预览（前2000字符）
    local preview="${output:0:2000}"
    if [[ $output_len -gt 2000 ]]; then
        preview="${preview}..."
    fi
    
    # 返回持久化标记
    cat << EOF
<persisted-output>
Full output saved to: ${filepath}
Size: ${output_len} characters
Preview:
${preview}
</persisted-output>
EOF
    
    log_info "Large output persisted: ${filename} (${output_len} chars)"
    
    # 记录遥测
    record_telemetry "context.persist.large_output" "{\"tool\":\"${tool_name}\",\"size\":${output_len},\"file\":\"${filename}\"}"
}

# 第二步：旧工具结果微压缩
# 只保留最近N个工具结果的完整内容，更旧的改成占位提示
micro_compact() {
    local session_dir="$1"
    local messages_file="${session_dir}/messages.json"
    
    if [[ ! -f "$messages_file" ]]; then
        return 0
    fi
    
    # 使用jq处理（如果可用）
    if command -v jq &> /dev/null; then
        # 保留最近3个完整结果，其他的压缩
        jq '
            def compact_old:
                if type == "array" then
                    . as $arr |
                    length as $len |
                    [range($len) | 
                        if . < ($len - 3) then
                            $arr[.] | 
                            if .role == "tool" then
                                .content = "[Earlier tool result omitted for brevity - use /expand to view]"
                            else
                                .
                            end
                        else
                            $arr[.]
                        end
                    ]
                else
                    .
                end;
            compact_old
        ' "$messages_file" > "${messages_file}.tmp" && mv "${messages_file}.tmp" "$messages_file"
    fi
    
    log_info "Micro-compact completed - kept last $MICRO_COMPACT_KEEP tool results"
    
    # 记录遥测
    record_telemetry "context.micro_compact" "{\"kept\":${MICRO_COMPACT_KEEP},\"session\":\"$(basename "$session_dir")\"}"
}

# 第三步：整体历史压缩
# 生成连续性摘要，保留关键信息
compact_history() {
    local session_dir="$1"
    local task_file="${session_dir}/TASK.md"
    local decisions_file="${session_dir}/DECISIONS.md"
    local progress_file="${session_dir}/PROGRESS.md"
    local start_time=$(date +%s)
    
    log_info "Starting full context compaction..."
    
    # 提取关键信息
    local current_goal=""
    local completed_work=""
    local pending_work=""
    local key_decisions=""
    local modified_files=""
    
    # 从TASK.md读取当前目标
    if [[ -f "$task_file" ]]; then
        current_goal=$(grep -A 5 "## Current Focus" "$task_file" 2>/dev/null | tail -n +2 | head -n 5 || true)
    fi
    
    # 从PROGRESS.md读取已完成工作
    if [[ -f "$progress_file" ]]; then
        completed_work=$(grep -A 10 "## Completed" "$progress_file" 2>/dev/null | tail -n +2 | head -n 10 || true)
    fi
    
    # 从DECISIONS.md读取关键决策
    if [[ -f "$decisions_file" ]]; then
        key_decisions=$(grep -A 3 "### " "$decisions_file" 2>/dev/null | head -n 20 || true)
    fi
    
    # 获取最近修改的文件
    modified_files=$(find "$PROJECT_ROOT" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.yaml" -o -name "*.sh" 2>/dev/null | head -n 10 || true)
    
    # 生成摘要
    local summary_file="${session_dir}/context-summary.md"
    cat > "$summary_file" << EOF
# Context Summary

## Current Goal
${current_goal:-"No specific goal defined"}

## Completed Work
${completed_work:-"No completed work recorded"}

## Key Decisions
${key_decisions:-"No key decisions recorded"}

## Modified Files
${modified_files:-"No files modified"}

## Pending Work
- Review the summary above
- Continue with next steps from TASK.md

---
*This summary was generated by context compaction to maintain continuity while freeing up context space.*
*Original detailed history is preserved in session files.*
EOF
    
    # 更新压缩状态
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    jq --arg time "$timestamp" \
       --arg summary "$summary_file" \
       '.has_compacted = true | 
        .last_compact_time = $time | 
        .compact_count += 1 | 
        .last_summary = $summary' \
       "$STATE_FILE" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"
    
    log_success "History compacted - summary saved to: ${summary_file}"
    
    # 记录遥测
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local context_size=$(estimate_context_size "$session_dir")
    record_telemetry "context.full_compact" "{\"session\":\"$(basename "$session_dir")\",\"duration_s\":${duration},\"context_size_after\":${context_size},\"summary_file\":\"$(basename "$summary_file")\"}"
    
    # 显示摘要
    echo ""
    echo "=== Context Summary ==="
    head -n 30 "$summary_file" || true
    echo "..."
    echo "======================="
}

# 检查上下文大小
estimate_context_size() {
    local session_dir="$1"
    local total_size=0
    
    # 计算所有相关文件的大小
    for file in "${session_dir}"/*.md "${session_dir}"/*.json; do
        if [[ -f "$file" ]]; then
            total_size=$((total_size + $(wc -c < "$file")))
        fi
    done
    
    echo "$total_size"
}

# 自动压缩检查
auto_compact() {
    local session_dir="$1"
    local current_size=$(estimate_context_size "$session_dir")
    
    log_info "Current context size: ${current_size} characters"
    
    # 第一步：微压缩
    micro_compact "$session_dir"
    
    # 检查是否需要完整压缩
    if [[ $current_size -gt $CONTEXT_LIMIT ]]; then
        log_warn "Context size (${current_size}) exceeds limit (${CONTEXT_LIMIT})"
        compact_history "$session_dir"
    else
        log_success "Context size is within limits"
    fi
}

# 展开持久化输出
expand_output() {
    local filepath="$1"
    
    if [[ -f "$filepath" ]]; then
        cat "$filepath"
    else
        log_error "Output file not found: $filepath"
        return 1
    fi
}

# 主函数
main() {
    init
    
    case "${1:-auto}" in
        auto)
            # 自动压缩检查
            local session_dir="${2:-${PROJECT_ROOT}/.runtime/current}"
            if [[ -L "$session_dir" ]]; then
                session_dir=$(readlink "$session_dir")
            fi
            # 如果传入的是相对路径，转换为绝对路径
            if [[ ! "$session_dir" = /* ]]; then
                session_dir="${PROJECT_ROOT}/${session_dir}"
            fi
            auto_compact "$session_dir"
            ;;
        compact)
            # 手动完整压缩
            local session_dir="${2:-${PROJECT_ROOT}/.runtime/current}"
            if [[ -L "$session_dir" ]]; then
                session_dir=$(readlink "$session_dir")
            fi
            # 如果传入的是相对路径，转换为绝对路径
            if [[ ! "$session_dir" = /* ]]; then
                session_dir="${PROJECT_ROOT}/${session_dir}"
            fi
            compact_history "$session_dir"
            ;;
        persist)
            # 持久化大输出
            shift
            local tool_name="$1"
            shift
            local output="$*"
            persist_large_output "$tool_name" "$output"
            ;;
        expand)
            # 展开持久化输出
            shift
            expand_output "$1"
            ;;
        status)
            # 显示压缩状态
            cat "$STATE_FILE" | jq .
            ;;
        *)
            echo "Usage: $0 {auto|compact|persist|expand|status}"
            echo ""
            echo "Commands:"
            echo "  auto     - Auto-check and compact if needed"
            echo "  compact  - Manual full history compaction"
            echo "  persist  - Persist large output to disk"
            echo "  expand   - Expand persisted output"
            echo "  status   - Show compaction status"
            exit 1
            ;;
    esac
}

main "$@"
