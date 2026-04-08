#!/bin/bash
set -e

echo "🚀 Initializing Harness Project..."

# 创建运行时目录
mkdir -p .runtime/{sessions,logs,checkpoints}
mkdir -p .runtime/telemetry/{traces,metrics}
mkdir -p .runtime/memory

# 创建当前会话
timestamp=$(date +%Y%m%d_%H%M%S)
session_id="session_${timestamp}"
mkdir -p ".runtime/sessions/${session_id}"

# 初始化任务状态
cat > ".runtime/sessions/${session_id}/TASK.md" << 'EOF'
# Current Task State

## Session Info
- ID: ${session_id}
- Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Status: initialized

## Goals
<!-- 在此列出主要目标 -->

## Progress
<!-- 记录已完成的工作 -->

## Decisions
<!-- 记录关键决策 -->

## Blockers
<!-- 记录阻塞问题 -->

## Next Steps
<!-- 下一步行动 -->
EOF

echo "✅ Session initialized: ${session_id}"
echo "📁 Working directory: .runtime/sessions/${session_id}/"

# 运行健康检查
echo "🔍 Running health checks..."
./tooling/scripts/health-check.sh

echo "🎉 Harness ready!"
echo ""
echo "Next steps:"
echo "  1. ./apps/agent-cli/agent-list.sh       # 查看可用 Agent"
echo "  2. ./apps/agent-cli/agent-start.sh <agent>  # 启动 Agent"
echo "  3. ./local-ci.sh                        # 运行 CI 检查"
