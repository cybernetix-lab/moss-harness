#!/bin/bash
# agent-list.sh - 列出所有可用 Agent

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

AGENTS_DIR="${PROJECT_ROOT}/configs/agents"

echo "🤖 Available Agents"
echo ""

for agent_file in "$AGENTS_DIR"/*.yaml; do
    if [[ -f "$agent_file" ]]; then
        agent_name=$(basename "$agent_file" .yaml)
        
        # 提取信息
        description=$(grep "^description:" "$agent_file" | head -1 | cut -d'|' -f2- | sed 's/^[[:space:]]*//')
        agent_type=$(grep "^type:" "$agent_file" | head -1 | cut -d':' -f2- | sed 's/^[[:space:]]*//')
        
        echo "┌────────────────────────────────────────"
        echo "│ 📌 $agent_name"
        echo "│    Type: $agent_type"
        echo "│    $description"
        echo "└────────────────────────────────────────"
        echo ""
    fi
done

echo "Usage:"
echo "  ./scripts/agent-start.sh <agent-name>"
echo "  ./scripts/agent-switch.sh <agent-name>"
