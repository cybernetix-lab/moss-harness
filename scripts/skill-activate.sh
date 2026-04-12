#!/bin/bash
# skill-activate.sh - 激活技能

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SKILL_NAME="${1:-}"

if [[ -z "$SKILL_NAME" ]]; then
    echo "Usage: $0 <skill-name>"
    echo ""
    echo "Available skills:"
    ./scripts/skill-list.sh
    exit 1
fi

# 查找技能
SKILL_FILE=""
if [[ -d "${PROJECT_ROOT}/integrations/skills/${SKILL_NAME}" ]]; then
    SKILL_FILE="${PROJECT_ROOT}/integrations/skills/${SKILL_NAME}/skill.yaml"
fi

if [[ -z "$SKILL_FILE" || ! -f "$SKILL_FILE" ]]; then
    echo "❌ Skill not found: $SKILL_NAME"
    exit 1
fi

# 获取当前会话
CURRENT_LINK="${PROJECT_ROOT}/.runtime/current"
if [[ ! -L "$CURRENT_LINK" ]]; then
    echo "❌ No active session. Run ./scripts/start-session.sh first."
    exit 1
fi

SESSION_DIR=$(readlink "$CURRENT_LINK")
SESSION_PATH="${PROJECT_ROOT}/.runtime/sessions/${SESSION_DIR}"
ACTIVE_SKILLS_FILE="${SESSION_PATH}/active-skills.txt"

# 添加到活跃技能列表
if [[ ! -f "$ACTIVE_SKILLS_FILE" ]]; then
    touch "$ACTIVE_SKILLS_FILE"
fi

# 检查是否已激活
if grep -q "^${SKILL_NAME}$" "$ACTIVE_SKILLS_FILE"; then
    echo "ℹ️  Skill already active: $SKILL_NAME"
else
    echo "$SKILL_NAME" >> "$ACTIVE_SKILLS_FILE"
    echo "✅ Skill activated: $SKILL_NAME"
fi

# 显示技能信息
echo ""
echo "Skill Info:"
grep "^description:" "$SKILL_FILE" | head -1 | sed 's/description:/  /'
echo ""
echo "Available actions:"
grep "^  - type:" "$SKILL_FILE" | sed 's/  - type:/  -/' || echo "  (see skill.yaml for details)"
