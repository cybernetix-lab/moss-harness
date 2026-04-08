#!/bin/bash
set -e

# restore-checkpoint.sh - 恢复到指定检查点

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CURRENT_LINK="${PROJECT_ROOT}/.runtime/current"

if [[ ! -L "$CURRENT_LINK" ]]; then
    echo "❌ No active session."
    exit 1
fi

SESSION_DIR=$(readlink "$CURRENT_LINK")
SESSION_PATH="${PROJECT_ROOT}/.runtime/sessions/${SESSION_DIR}"
CHECKPOINTS_DIR="${SESSION_PATH}/checkpoints"

usage() {
    echo "Usage: $0 <checkpoint_id>"
    echo ""
    echo "Available checkpoints:"
    ls -1 "$CHECKPOINTS_DIR" 2>/dev/null | grep -v "latest" || echo "  (none)"
}

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

CHECKPOINT_ID="$1"
CHECKPOINT_DIR="${CHECKPOINTS_DIR}/${CHECKPOINT_ID}"

if [[ ! -d "$CHECKPOINT_DIR" ]]; then
    echo "❌ Checkpoint not found: $CHECKPOINT_ID"
    usage
    exit 1
fi

# 创建恢复前备份
backup_timestamp=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${CHECKPOINTS_DIR}/auto_backup_${backup_timestamp}"
mkdir -p "$BACKUP_DIR"
cp "${SESSION_PATH}/TASK.md" "${BACKUP_DIR}/" 2>/dev/null || true
cp "${SESSION_PATH}/PROGRESS.md" "${BACKUP_DIR}/" 2>/dev/null || true
cp "${SESSION_PATH}/DECISIONS.md" "${BACKUP_DIR}/" 2>/dev/null || true

# 恢复文件
cp "${CHECKPOINT_DIR}/TASK.md" "${SESSION_PATH}/"
cp "${CHECKPOINT_DIR}/PROGRESS.md" "${SESSION_PATH}/"
cp "${CHECKPOINT_DIR}/DECISIONS.md" "${SESSION_PATH}/"
cp "${CHECKPOINT_DIR}/meta.json" "${SESSION_PATH}/"

# 记录恢复操作
cat >> "${SESSION_PATH}/DECISIONS.md" << EOF

### [$(date +"%Y-%m-%d")] Restored Checkpoint

**Context**: Session state recovery

**Decision**: Restored to checkpoint ${CHECKPOINT_ID}

**Rationale**: Rollback to previous state

**Consequences**: All changes after checkpoint are preserved in auto-backup
EOF

echo "✅ Restored checkpoint: ${CHECKPOINT_ID}"
echo "💾 Auto-backup created: auto_backup_${backup_timestamp}"
