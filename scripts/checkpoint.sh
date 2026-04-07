#!/bin/bash
# checkpoint.sh - 检查点管理系统
#
# Usage: checkpoint.sh <command> [options]
# Commands:
#   create [desc]       创建检查点
#   list                列出所有检查点
#   show <id>           显示检查点详情
#   restore <id>        恢复到检查点
#   compare <id1> <id2> 比较两个检查点
#   delete <id>         删除检查点
#   prune               清理旧检查点

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"
CHECKPOINTS_DIR="${RUNTIME_DIR}/checkpoints"

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
    mkdir -p "$CHECKPOINTS_DIR"
}

# 生成检查点 ID
generate_checkpoint_id() {
    echo "checkpoint-$(date +%Y%m%d-%H%M%S)"
}

# ==================== Create Command ====================

cmd_create() {
    local description="${1:-Manual checkpoint}"
    local checkpoint_id=$(generate_checkpoint_id)
    local checkpoint_path="${CHECKPOINTS_DIR}/${checkpoint_id}"

    log_section "Creating Checkpoint"

    mkdir -p "$checkpoint_path"

    # 保存项目状态
    log_info "Saving project state..."

    # 1. 保存上下文文件
    local context_files=("CLAUDE.md" "DECISIONS.md" "PROGRESS.md" "context/DECISIONS.md" "context/PROGRESS.md")
    for file in "${context_files[@]}"; do
        if [[ -f "${PROJECT_ROOT}/${file}" ]]; then
            cp "${PROJECT_ROOT}/${file}" "$checkpoint_path/"
            log_success "  Saved: $file"
        fi
    done

    # 2. 保存会话信息
    local session_info="${checkpoint_path}/session-info.json"
    cat > "$session_info" << EOF
{
  "checkpoint_id": "$checkpoint_id",
  "created_at": "$(date -Iseconds)",
  "description": "$description",
  "hostname": "$(hostname)",
  "user": "$(whoami)",
  "working_dir": "$(pwd)"
}
EOF

    # 3. 保存 Git 状态（如果在 Git 仓库中）
    if [[ -d "${PROJECT_ROOT}/.git" ]]; then
        git -C "$PROJECT_ROOT" status --porcelain > "${checkpoint_path}/git-status.txt" 2>/dev/null || true
        git -C "$PROJECT_ROOT" log --oneline -5 > "${checkpoint_path}/git-log.txt" 2>/dev/null || true
        log_success "  Saved: git status"
    fi

    # 4. 保存文件列表
    find "$PROJECT_ROOT" -type f \
        -not -path "*/.git/*" \
        -not -path "*/runtime/*" \
        -not -path "*/node_modules/*" \
        > "${checkpoint_path}/file-list.txt" 2>/dev/null || true

    # 5. 创建元数据
    local metadata="${checkpoint_path}/metadata.json"
    cat > "$metadata" << EOF
{
  "checkpoint_id": "$checkpoint_id",
  "created_at": "$(date -Iseconds)",
  "description": "$description",
  "files_count": $(find "$checkpoint_path" -type f | wc -l),
  "size_bytes": $(du -sb "$checkpoint_path" | cut -f1)
}
EOF

    # 更新最新检查点链接
    ln -sfn "$checkpoint_id" "${CHECKPOINTS_DIR}/latest"

    echo ""
    log_success "Checkpoint created: $checkpoint_id"
    log_info "Location: $checkpoint_path"

    echo "$checkpoint_id"
}

# ==================== List Command ====================

cmd_list() {
    log_section "Available Checkpoints"

    if [[ ! -d "$CHECKPOINTS_DIR" ]]; then
        log_info "No checkpoints found"
        return
    fi

    local checkpoints=$(find "$CHECKPOINTS_DIR" -maxdepth 1 -type d -name "checkpoint-*" | sort -r)

    if [[ -z "$checkpoints" ]]; then
        log_info "No checkpoints found"
        return
    fi

    echo "  ID                           Created              Description"
    echo "  ─────────────────────────────────────────────────────────────"

    for checkpoint_path in $checkpoints; do
        local checkpoint_id=$(basename "$checkpoint_path")
        local metadata="${checkpoint_path}/metadata.json"

        if [[ -f "$metadata" ]]; then
            local created=$(grep '"created_at"' "$metadata" | cut -d'"' -f4 | cut -d'T' -f1)
            local description=$(grep '"description"' "$metadata" | cut -d'"' -f4 | cut -c1-30)
            printf "  %-28s %-20s %s\n" "$checkpoint_id" "$created" "$description"
        else
            local created=$(stat -c %y "$checkpoint_path" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
            printf "  %-28s %-20s %s\n" "$checkpoint_id" "$created" "(no metadata)"
        fi
    done

    # 显示最新检查点
    if [[ -L "${CHECKPOINTS_DIR}/latest" ]]; then
        local latest=$(readlink "${CHECKPOINTS_DIR}/latest")
        echo ""
        log_info "Latest checkpoint: $latest"
    fi
}

# ==================== Show Command ====================

cmd_show() {
    local checkpoint_id="$1"

    if [[ -z "$checkpoint_id" ]]; then
        log_error "Checkpoint ID required"
        echo "Usage: checkpoint.sh show <checkpoint-id>"
        exit 1
    fi

    local checkpoint_path="${CHECKPOINTS_DIR}/${checkpoint_id}"

    if [[ ! -d "$checkpoint_path" ]]; then
        log_error "Checkpoint not found: $checkpoint_id"
        exit 1
    fi

    log_section "Checkpoint: $checkpoint_id"

    # 显示元数据
    local metadata="${checkpoint_path}/metadata.json"
    if [[ -f "$metadata" ]]; then
        echo "Metadata:"
        cat "$metadata" | python3 -m json.tool 2>/dev/null || cat "$metadata"
    fi

    # 显示会话信息
    local session_info="${checkpoint_path}/session-info.json"
    if [[ -f "$session_info" ]]; then
        echo ""
        echo "Session Info:"
        cat "$session_info" | python3 -m json.tool 2>/dev/null || cat "$session_info"
    fi

    # 显示保存的文件
    echo ""
    echo "Saved files:"
    ls -la "$checkpoint_path" | tail -n +4 | awk '{print "  " $9 " (" $5 " bytes)"}'
}

# ==================== Restore Command ====================

cmd_restore() {
    local checkpoint_id="$1"

    if [[ -z "$checkpoint_id" ]]; then
        log_error "Checkpoint ID required"
        echo "Usage: checkpoint.sh restore <checkpoint-id>"
        exit 1
    fi

    # 支持 "latest" 别名
    if [[ "$checkpoint_id" == "latest" ]]; then
        if [[ -L "${CHECKPOINTS_DIR}/latest" ]]; then
            checkpoint_id=$(readlink "${CHECKPOINTS_DIR}/latest")
        else
            log_error "No latest checkpoint found"
            exit 1
        fi
    fi

    local checkpoint_path="${CHECKPOINTS_DIR}/${checkpoint_id}"

    if [[ ! -d "$checkpoint_path" ]]; then
        log_error "Checkpoint not found: $checkpoint_id"
        exit 1
    fi

    log_section "Restoring Checkpoint: $checkpoint_id"

    # 创建恢复前备份
    local backup_id="pre-restore-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${CHECKPOINTS_DIR}/${backup_id}"

    log_info "Creating pre-restore backup: $backup_id"
    mkdir -p "$backup_path"

    local context_files=("CLAUDE.md" "DECISIONS.md" "PROGRESS.md")
    for file in "${context_files[@]}"; do
        if [[ -f "${PROJECT_ROOT}/${file}" ]]; then
            cp "${PROJECT_ROOT}/${file}" "$backup_path/"
        fi
    done

    # 恢复文件
    log_info "Restoring files..."
    for file in "${context_files[@]}"; do
        if [[ -f "${checkpoint_path}/${file}" ]]; then
            cp "${checkpoint_path}/${file}" "${PROJECT_ROOT}/${file}"
            log_success "  Restored: $file"
        fi
    done

    # 记录恢复操作
    local decisions_file="${PROJECT_ROOT}/DECISIONS.md"
    if [[ -f "$decisions_file" ]]; then
        cat >> "$decisions_file" << EOF

### [$(date +"%Y-%m-%d")] Checkpoint Restored

**Context**: Manual state recovery

**Decision**: Restored to checkpoint \`$checkpoint_id\`

**Rationale**: Rollback to previous known good state

**Consequences**:
- Pre-restore backup created: \`$backup_id\`
- All changes after checkpoint are preserved in backup
EOF
    fi

    echo ""
    log_success "Checkpoint restored: $checkpoint_id"
    log_info "Pre-restore backup: $backup_id"
}

# ==================== Compare Command ====================

cmd_compare() {
    local checkpoint_id1="$1"
    local checkpoint_id2="$2"

    if [[ -z "$checkpoint_id1" || -z "$checkpoint_id2" ]]; then
        log_error "Two checkpoint IDs required"
        echo "Usage: checkpoint.sh compare <checkpoint-id1> <checkpoint-id2>"
        exit 1
    fi

    local path1="${CHECKPOINTS_DIR}/${checkpoint_id1}"
    local path2="${CHECKPOINTS_DIR}/${checkpoint_id2}"

    if [[ ! -d "$path1" ]]; then
        log_error "Checkpoint not found: $checkpoint_id1"
        exit 1
    fi

    if [[ ! -d "$path2" ]]; then
        log_error "Checkpoint not found: $checkpoint_id2"
        exit 1
    fi

    log_section "Comparing Checkpoints"
    echo "  $checkpoint_id1  vs  $checkpoint_id2"
    echo ""

    # 比较文件列表
    echo "File differences:"
    diff -q "$path1" "$path2" 2>/dev/null | while read -r line; do
        echo "  $line"
    done || echo "  (files are identical or only in one checkpoint)"

    # 比较 DECISIONS.md
    if [[ -f "${path1}/DECISIONS.md" && -f "${path2}/DECISIONS.md" ]]; then
        echo ""
        echo "DECISIONS.md diff:"
        diff "${path1}/DECISIONS.md" "${path2}/DECISIONS.md" 2>/dev/null | head -20 || echo "  (no differences)"
    fi
}

# ==================== Delete Command ====================

cmd_delete() {
    local checkpoint_id="$1"

    if [[ -z "$checkpoint_id" ]]; then
        log_error "Checkpoint ID required"
        echo "Usage: checkpoint.sh delete <checkpoint-id>"
        exit 1
    fi

    local checkpoint_path="${CHECKPOINTS_DIR}/${checkpoint_id}"

    if [[ ! -d "$checkpoint_path" ]]; then
        log_error "Checkpoint not found: $checkpoint_id"
        exit 1
    fi

    log_section "Deleting Checkpoint: $checkpoint_id"

    # 确认删除
    echo -n "Are you sure? [y/N]: "
    read -r confirm

    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        rm -rf "$checkpoint_path"
        log_success "Checkpoint deleted: $checkpoint_id"
    else
        log_info "Deletion cancelled"
    fi
}

# ==================== Prune Command ====================

cmd_prune() {
    local keep_count="${1:-10}"

    log_section "Pruning Old Checkpoints"
    log_info "Keeping last $keep_count checkpoints"

    if [[ ! -d "$CHECKPOINTS_DIR" ]]; then
        log_info "No checkpoints to prune"
        return
    fi

    local all_checkpoints=$(find "$CHECKPOINTS_DIR" -maxdepth 1 -type d -name "checkpoint-*" | sort -r)
    local total_count=$(echo "$all_checkpoints" | grep -c "checkpoint-" || echo 0)

    if [[ $total_count -le $keep_count ]]; then
        log_info "No checkpoints to prune ($total_count total, keeping $keep_count)"
        return
    fi

    local to_delete=$(echo "$all_checkpoints" | tail -n +$((keep_count + 1)))
    local delete_count=$(echo "$to_delete" | grep -c "checkpoint-" || echo 0)

    echo "Will delete $delete_count checkpoints:"
    echo "$to_delete" | while read -r path; do
        [[ -n "$path" ]] && echo "  - $(basename "$path")"
    done

    echo ""
    echo -n "Proceed? [y/N]: "
    read -r confirm

    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "$to_delete" | while read -r path; do
            if [[ -n "$path" && -d "$path" ]]; then
                rm -rf "$path"
                log_success "Deleted: $(basename "$path")"
            fi
        done
        log_success "Pruned $delete_count checkpoints"
    else
        log_info "Pruning cancelled"
    fi
}

# ==================== Main ====================

show_help() {
    cat << EOF
Usage: checkpoint.sh <command> [options]

Checkpoint management commands:

  create [description]  Create a new checkpoint
  list                  List all checkpoints
  show <id>             Show checkpoint details
  restore <id>          Restore to checkpoint (use 'latest' for most recent)
  compare <id1> <id2>   Compare two checkpoints
  delete <id>           Delete a checkpoint
  prune [N]             Keep only N most recent checkpoints (default: 10)

Examples:
  checkpoint.sh create "Before major refactoring"
  checkpoint.sh list
  checkpoint.sh show checkpoint-20240101-120000
  checkpoint.sh restore latest
  checkpoint.sh restore checkpoint-20240101-120000
  checkpoint.sh compare checkpoint-001 checkpoint-002
  checkpoint.sh prune 5

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
        create)
            cmd_create "$*"
            ;;
        list|ls)
            cmd_list
            ;;
        show|info)
            cmd_show "$1"
            ;;
        restore|revert)
            cmd_restore "$1"
            ;;
        compare|diff)
            cmd_compare "$1" "$2"
            ;;
        delete|rm|remove)
            cmd_delete "$1"
            ;;
        prune|cleanup)
            cmd_prune "$1"
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
