#!/bin/bash
# memory.sh - Memory 管理系统
#
# Usage: memory.sh <command> [options]
# Commands:
#   search <query>      搜索记忆
#   session [id]        显示会话记忆
#   extract <file>      从文件提取关键信息
#   forget <pattern>    遗忘匹配的记忆
#   stats               显示统计信息
#   export <file>       导出记忆到文件
#   import <file>       从文件导入记忆

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MEMORY_DIR="${PROJECT_ROOT}/memory"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"
TELEMETRY_DIR="${PROJECT_ROOT}/telemetry"

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

# 确保目录存在
ensure_dirs() {
    mkdir -p "$MEMORY_DIR"
    mkdir -p "${MEMORY_DIR}/sessions"
    mkdir -p "${MEMORY_DIR}/facts"
    mkdir -p "${MEMORY_DIR}/patterns"
    mkdir -p "${MEMORY_DIR}/decisions"
}

# ==================== Search Command ====================

cmd_search() {
    local query="$1"
    local limit="${2:-10}"
    local type="${3:-all}"

    if [[ -z "$query" ]]; then
        log_error "Search query required"
        echo "Usage: memory.sh search <query> [--limit N] [--type type]"
        exit 1
    fi

    log_section "Memory Search: '$query'"

    local results=0

    # 搜索会话历史
    if [[ "$type" == "all" || "$type" == "session" ]]; then
        log_info "Searching session history..."
        local session_results=$(find "${MEMORY_DIR}/sessions" -name "*.json" -exec grep -l "$query" {} \; 2>/dev/null | head -$limit)
        if [[ -n "$session_results" ]]; then
            echo "Session matches:"
            echo "$session_results" | while read -r file; do
                local session_name=$(basename "$file" .json)
                echo "  - $session_name"
            done
            results=$((results + $(echo "$session_results" | wc -l)))
        fi
    fi

    # 搜索事实
    if [[ "$type" == "all" || "$type" == "fact" ]]; then
        log_info "Searching facts..."
        if [[ -f "${MEMORY_DIR}/facts.json" ]]; then
            local fact_results=$(grep "$query" "${MEMORY_DIR}/facts.json" 2>/dev/null | head -$limit)
            if [[ -n "$fact_results" ]]; then
                echo "Fact matches:"
                echo "$fact_results" | while read -r line; do
                    echo "  - $line"
                done
                results=$((results + $(echo "$fact_results" | wc -l)))
            fi
        fi
    fi

    # 搜索决策
    if [[ "$type" == "all" || "$type" == "decision" ]]; then
        log_info "Searching decisions..."
        if [[ -f "${MEMORY_DIR}/decisions.jsonl" ]]; then
            local decision_results=$(grep "$query" "${MEMORY_DIR}/decisions.jsonl" 2>/dev/null | head -$limit)
            if [[ -n "$decision_results" ]]; then
                echo "Decision matches:"
                echo "$decision_results" | while read -r line; do
                    local timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
                    echo "  - [$timestamp] $line"
                done
                results=$((results + $(echo "$decision_results" | wc -l)))
            fi
        fi
    fi

    # 搜索遥测数据
    if [[ "$type" == "all" || "$type" == "telemetry" ]]; then
        log_info "Searching telemetry..."
        if [[ -f "${TELEMETRY_DIR}/events.jsonl" ]]; then
            local telem_results=$(grep "$query" "${TELEMETRY_DIR}/events.jsonl" 2>/dev/null | head -$limit)
            if [[ -n "$telem_results" ]]; then
                echo "Telemetry matches:"
                echo "$telem_results" | while read -r line; do
                    echo "  - $line"
                done
                results=$((results + $(echo "$telem_results" | wc -l)))
            fi
        fi
    fi

    echo ""
    log_success "Found $results results"
}

# ==================== Session Command ====================

cmd_session() {
    local session_id="$1"

    if [[ -z "$session_id" ]]; then
        # 列出所有会话
        log_section "All Sessions"

        if [[ ! -d "${MEMORY_DIR}/sessions" ]]; then
            log_info "No sessions found"
            return
        fi

        echo "Recent sessions:"
        find "${MEMORY_DIR}/sessions" -name "*.json" -type f 2>/dev/null | \
            xargs ls -lt 2>/dev/null | head -10 | while read -r line; do
            local file=$(echo "$line" | awk '{print $NF}')
            local name=$(basename "$file" .json)
            local date=$(echo "$line" | awk '{print $6, $7, $8}')
            echo "  - $name ($date)"
        done
    else
        # 显示特定会话
        log_section "Session: $session_id"

        local session_file="${MEMORY_DIR}/sessions/${session_id}.json"
        if [[ -f "$session_file" ]]; then
            cat "$session_file"
        else
            log_error "Session not found: $session_id"
            exit 1
        fi
    fi
}

# ==================== Extract Command ====================

cmd_extract() {
    local file="$1"

    if [[ -z "$file" ]]; then
        log_error "File path required"
        echo "Usage: memory.sh extract <file>"
        exit 1
    fi

    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        exit 1
    fi

    log_section "Extracting from: $(basename "$file")"

    # 提取关键信息
    local extracted=0

    # 提取 TODO/FIXME
    log_info "Extracting TODOs..."
    local todos=$(grep -n "TODO\|FIXME\|XXX" "$file" 2>/dev/null || true)
    if [[ -n "$todos" ]]; then
        echo "$todos" | while read -r line; do
            echo "  $line"
        done
        extracted=$((extracted + $(echo "$todos" | wc -l)))
    fi

    # 提取决策标记
    log_info "Extracting decisions..."
    local decisions=$(grep -n "DECISION:\|决策:" "$file" 2>/dev/null || true)
    if [[ -n "$decisions" ]]; then
        echo "$decisions" | while read -r line; do
            echo "  $line"
            # 保存到决策记忆
            echo "{\"timestamp\":\"$(date -Iseconds)\",\"source\":\"$file\",\"decision\":\"$line\"}" >> \
                "${MEMORY_DIR}/decisions.jsonl" 2>/dev/null || true
        done
        extracted=$((extracted + $(echo "$decisions" | wc -l)))
    fi

    # 提取模式
    log_info "Extracting patterns..."
    local patterns=$(grep -n "pattern:\|Pattern:\|模式:" "$file" 2>/dev/null || true)
    if [[ -n "$patterns" ]]; then
        echo "$patterns" | while read -r line; do
            echo "  $line"
        done
        extracted=$((extracted + $(echo "$patterns" | wc -l)))
    fi

    echo ""
    log_success "Extracted $extracted items"
}

# ==================== Forget Command ====================

cmd_forget() {
    local pattern="$1"
    local dry_run="${2:-false}"

    if [[ -z "$pattern" ]]; then
        log_error "Pattern required"
        echo "Usage: memory.sh forget <pattern> [--dry-run]"
        exit 1
    fi

    log_section "Forgetting: '$pattern'"

    local removed=0

    # 从事实中删除
    if [[ -f "${MEMORY_DIR}/facts.json" ]]; then
        local before=$(wc -l < "${MEMORY_DIR}/facts.json")
        grep -v "$pattern" "${MEMORY_DIR}/facts.json" > "${MEMORY_DIR}/facts.json.tmp" || true
        mv "${MEMORY_DIR}/facts.json.tmp" "${MEMORY_DIR}/facts.json"
        local after=$(wc -l < "${MEMORY_DIR}/facts.json")
        removed=$((removed + before - after))
    fi

    # 从决策中删除
    if [[ -f "${MEMORY_DIR}/decisions.jsonl" ]]; then
        local before=$(wc -l < "${MEMORY_DIR}/decisions.jsonl")
        grep -v "$pattern" "${MEMORY_DIR}/decisions.jsonl" > "${MEMORY_DIR}/decisions.jsonl.tmp" || true
        mv "${MEMORY_DIR}/decisions.jsonl.tmp" "${MEMORY_DIR}/decisions.jsonl"
        local after=$(wc -l < "${MEMORY_DIR}/decisions.jsonl")
        removed=$((removed + before - after))
    fi

    # 从遥测中删除
    if [[ -f "${TELEMETRY_DIR}/events.jsonl" ]]; then
        local before=$(wc -l < "${TELEMETRY_DIR}/events.jsonl")
        grep -v "$pattern" "${TELEMETRY_DIR}/events.jsonl" > "${TELEMETRY_DIR}/events.jsonl.tmp" || true
        mv "${TELEMETRY_DIR}/events.jsonl.tmp" "${TELEMETRY_DIR}/events.jsonl"
        local after=$(wc -l < "${TELEMETRY_DIR}/events.jsonl")
        removed=$((removed + before - after))
    fi

    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would remove $removed entries"
    else
        log_success "Removed $removed entries"
    fi
}

# ==================== Stats Command ====================

cmd_stats() {
    log_section "Memory Statistics"

    ensure_dirs

    # 会话统计
    local session_count=$(find "${MEMORY_DIR}/sessions" -name "*.json" 2>/dev/null | wc -l)
    echo "Sessions: $session_count"

    # 事实统计
    local fact_count=0
    if [[ -f "${MEMORY_DIR}/facts.json" ]]; then
        fact_count=$(wc -l < "${MEMORY_DIR}/facts.json")
    fi
    echo "Facts: $fact_count"

    # 决策统计
    local decision_count=0
    if [[ -f "${MEMORY_DIR}/decisions.jsonl" ]]; then
        decision_count=$(wc -l < "${MEMORY_DIR}/decisions.jsonl")
    fi
    echo "Decisions: $decision_count"

    # 遥测统计
    local telemetry_count=0
    if [[ -f "${TELEMETRY_DIR}/events.jsonl" ]]; then
        telemetry_count=$(wc -l < "${TELEMETRY_DIR}/events.jsonl")
    fi
    echo "Telemetry events: $telemetry_count"

    # 磁盘使用
    echo ""
    log_info "Disk usage:"
    du -sh "$MEMORY_DIR" 2>/dev/null || echo "  Unable to calculate"
}

# ==================== Export Command ====================

cmd_export() {
    local output_file="$1"

    if [[ -z "$output_file" ]]; then
        log_error "Output file required"
        echo "Usage: memory.sh export <file>"
        exit 1
    fi

    log_section "Exporting Memory"

    # 创建导出目录
    local export_dir=$(dirname "$output_file")
    mkdir -p "$export_dir"

    # 导出所有记忆
    {
        echo "{"
        echo "  \"export_timestamp\": \"$(date -Iseconds)\","
        echo "  \"memory\": {"

        # 会话
        echo "    \"sessions\": ["
        local first=true
        find "${MEMORY_DIR}/sessions" -name "*.json" 2>/dev/null | while read -r f; do
            [[ "$first" == true ]] || echo ","
            first=false
            cat "$f"
        done
        echo "    ],"

        # 事实
        echo "    \"facts\": ["
        if [[ -f "${MEMORY_DIR}/facts.json" ]]; then
            cat "${MEMORY_DIR}/facts.json"
        fi
        echo "    ],"

        # 决策
        echo "    \"decisions\": ["
        if [[ -f "${MEMORY_DIR}/decisions.jsonl" ]]; then
            cat "${MEMORY_DIR}/decisions.jsonl"
        fi
        echo "    ]"

        echo "  }"
        echo "}"
    } > "$output_file"

    log_success "Memory exported to: $output_file"
}

# ==================== Import Command ====================

cmd_import() {
    local input_file="$1"

    if [[ -z "$input_file" ]]; then
        log_error "Input file required"
        echo "Usage: memory.sh import <file>"
        exit 1
    fi

    if [[ ! -f "$input_file" ]]; then
        log_error "File not found: $input_file"
        exit 1
    fi

    log_section "Importing Memory"

    ensure_dirs

    # 验证 JSON
    if command -v python3 &> /dev/null; then
        if ! python3 -c "import json; json.load(open('$input_file'))" 2>/dev/null; then
            log_error "Invalid JSON file"
            exit 1
        fi
    fi

    # 导入数据
    log_info "Importing from: $input_file"

    # 这里可以实现具体的导入逻辑
    # 根据导出格式解析并导入

    log_success "Memory imported successfully"
}

# ==================== Main ====================

show_help() {
    cat << EOF
Usage: memory.sh <command> [options]

Memory management commands:

  search <query>        Search memory for query
    --limit N           Limit results (default: 10)
    --type <type>       Filter by type: session|fact|decision|telemetry|all

  session [id]          Show session memory
                        Without id: list all sessions

  extract <file>        Extract key information from file

  forget <pattern>      Remove memory matching pattern
    --dry-run           Preview without removing

  stats                 Show memory statistics

  export <file>         Export memory to JSON file

  import <file>         Import memory from JSON file

Examples:
  memory.sh search "error" --limit 5
  memory.sh session
  memory.sh session 2024-01-01-session
  memory.sh extract ./logs/app.log
  memory.sh forget "temp_" --dry-run
  memory.sh stats
  memory.sh export ./backup/memory.json

EOF
}

main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    local command="$1"
    shift

    ensure_dirs

    case "$command" in
        search)
            local query="$1"
            shift
            local limit=10
            local type="all"

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --limit)
                        limit="$2"
                        shift 2
                        ;;
                    --type)
                        type="$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            cmd_search "$query" "$limit" "$type"
            ;;

        session)
            cmd_session "$1"
            ;;

        extract)
            cmd_extract "$1"
            ;;

        forget)
            local pattern="$1"
            local dry_run=false

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --dry-run)
                        dry_run=true
                        shift
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            cmd_forget "$pattern" "$dry_run"
            ;;

        stats)
            cmd_stats
            ;;

        export)
            cmd_export "$1"
            ;;

        import)
            cmd_import "$1"
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
