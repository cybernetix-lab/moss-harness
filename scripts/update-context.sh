#!/bin/bash

# update-context.sh - 更新上下文状态

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CURRENT_LINK="${PROJECT_ROOT}/.runtime/current"

if [[ ! -L "$CURRENT_LINK" ]]; then
    echo "❌ No active session. Run ./scripts/start-session.sh first."
    exit 1
fi

SESSION_DIR=$(readlink "$CURRENT_LINK")
SESSION_PATH="${PROJECT_ROOT}/.runtime/sessions/${SESSION_DIR}"

if [[ ! -d "$SESSION_PATH" ]]; then
    echo "❌ Session directory not found: $SESSION_PATH"
    exit 1
fi

usage() {
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  task <description>       Add/update task"
    echo "  progress <description>   Mark progress"
    echo "  decision <description>   Record decision"
    echo "  blocker <description>    Add blocker"
    echo "  resolve <blocker_id>     Resolve blocker"
    echo "  next <description>       Set next steps"
    echo "  status <status>          Update status"
    echo ""
    echo "Examples:"
    echo "  $0 task 'Implement user auth'"
    echo "  $0 progress 'Login form created'"
    echo "  $0 decision 'Use JWT for tokens'"
}

update_task() {
    local key="$1"
    local value="$2"
    local task_file="${SESSION_PATH}/TASK.md"
    
    # 添加时间戳
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local entry="- [${timestamp}] ${value}"
    
    # 根据 key 更新不同部分
    case "$key" in
        task)
            # 更新 Goals
            sed -i '' "/## Goals/a\\
${entry}" "$task_file"
            ;;
        progress)
            # 更新 Progress
            sed -i '' "/## Progress/a\\
${entry}" "$task_file"
            ;;
        next)
            # 更新 Next Steps
            sed -i '' "/## Next Steps/a\\
${entry}" "$task_file"
            ;;
        blocker)
            # 更新 Blockers
            sed -i '' "/## Blockers/a\\
${entry}" "$task_file"
            ;;
        *)
            echo "Unknown key: $key"
            exit 1
            ;;
    esac
    
    echo "✅ Updated $key in TASK.md"
}

record_decision() {
    local description="$1"
    local decisions_file="${SESSION_PATH}/DECISIONS.md"
    local timestamp=$(date +"%Y-%m-%d")
    
    cat >> "$decisions_file" << EOF

### [${timestamp}] ${description}

**Context**: 

**Decision**: ${description}

**Rationale**: 

**Consequences**: 
EOF
    
    echo "✅ Recorded decision in DECISIONS.md"
}

update_status() {
    local status="$1"
    local meta_file="${SESSION_PATH}/meta.json"
    
    # 更新 JSON 文件
    tmp=$(mktemp)
    jq ".status = \"$status\"" "$meta_file" > "$tmp" && mv "$tmp" "$meta_file"
    
    echo "✅ Updated status to: $status"
}

# 主逻辑
if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
    task|progress|next|blocker)
        if [[ $# -lt 1 ]]; then
            echo "❌ Missing description"
            usage
            exit 1
        fi
        update_task "$COMMAND" "$*"
        ;;
    decision)
        if [[ $# -lt 1 ]]; then
            echo "❌ Missing description"
            usage
            exit 1
        fi
        record_decision "$*"
        ;;
    status)
        if [[ $# -lt 1 ]]; then
            echo "❌ Missing status"
            usage
            exit 1
        fi
        update_status "$1"
        ;;
    help|--help|-h)
        usage
        exit 0
        ;;
    *)
        echo "❌ Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac
