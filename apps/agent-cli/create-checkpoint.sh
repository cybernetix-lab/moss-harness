#!/bin/bash
set -e

# create-checkpoint.sh - 创建状态检查点

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

mkdir -p "$CHECKPOINTS_DIR"

# 生成检查点 ID
timestamp=$(date +%Y%m%d_%H%M%S)
checkpoint_id="checkpoint_${timestamp}"
CHECKPOINT_DIR="${CHECKPOINTS_DIR}/${checkpoint_id}"

mkdir -p "$CHECKPOINT_DIR"

# 保存上下文文件
cp "${SESSION_PATH}/TASK.md" "${CHECKPOINT_DIR}/"
cp "${SESSION_PATH}/PROGRESS.md" "${CHECKPOINT_DIR}/"
cp "${SESSION_PATH}/DECISIONS.md" "${CHECKPOINT_DIR}/"
cp "${SESSION_PATH}/meta.json" "${CHECKPOINT_DIR}/"

# 创建检查点元数据
cat > "${CHECKPOINT_DIR}/checkpoint.json" << EOF
{
  "checkpoint_id": "${checkpoint_id}",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "session_id": "${SESSION_DIR}",
  "description": "$*",
  "files": [
    "TASK.md",
    "PROGRESS.md",
    "DECISIONS.md",
    "meta.json"
  ]
}
EOF

# 更新当前检查点链接
ln -sf "${checkpoint_id}" "${CHECKPOINTS_DIR}/latest"

echo "✅ Checkpoint created: ${checkpoint_id}"
echo "📁 Location: ${CHECKPOINT_DIR}"

if [[ -n "$*" ]]; then
    echo "📝 Description: $*"
fi
