#!/bin/bash
set -e

# start-session.sh - 启动新的 Agent 会话

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPACTOR="${PROJECT_ROOT}/runtime/context/context-compactor.sh"

# 生成会话 ID
timestamp=$(date +%Y%m%d_%H%M%S)
session_id="session_${timestamp}"
SESSION_DIR="${PROJECT_ROOT}/.runtime/sessions/${session_id}"

# 初始化上下文压缩器
init_compactor() {
    if [[ -x "$COMPACTOR" ]]; then
        "$COMPACTOR" status > /dev/null 2>&1 || true
    fi
}

# 创建会话目录
mkdir -p "${SESSION_DIR}"
mkdir -p "${SESSION_DIR}/checkpoints"
mkdir -p "${SESSION_DIR}/artifacts"

# 复制模板文件
cp "${PROJECT_ROOT}/.runtime/context/PROGRESS.md" "${SESSION_DIR}/PROGRESS.md"
cp "${PROJECT_ROOT}/.runtime/context/DECISIONS.md" "${SESSION_DIR}/DECISIONS.md"

# 创建任务状态文件
cat > "${SESSION_DIR}/TASK.md" << EOF
# Task State

## Session
- ID: ${session_id}
- Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Status: active

## Goals
<!-- 列出本次会话的主要目标 -->

## Progress
<!-- 记录已完成的工作 -->

## Current Focus
<!-- 当前正在处理的任务 -->

## Blockers
<!-- 阻塞问题 -->

## Next Steps
<!-- 下一步行动 -->
EOF

# 创建会话元数据
cat > "${SESSION_DIR}/meta.json" << EOF
{
  "session_id": "${session_id}",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "active",
  "constraints_level": "confirm_required",
  "context_version": "1.0"
}
EOF

# 设置当前会话链接
ln -sf "${session_id}" "${PROJECT_ROOT}/.runtime/current"

# 初始化上下文压缩器
init_compactor

echo "🚀 Session started: ${session_id}"
echo "📁 Session directory: ${SESSION_DIR}"
echo ""
echo "Next steps:"
echo "  1. Edit ${SESSION_DIR}/TASK.md to define goals"
echo "  2. Run ./scripts/update-context.sh to update state"
echo "  3. Use ./scripts/create-checkpoint.sh to save progress"
echo "  4. Context compression enabled (auto-compact when > 8000 chars)"
