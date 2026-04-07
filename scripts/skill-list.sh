#!/bin/bash
# skill-list.sh - 列出所有可用技能

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SKILLS_DIR="${PROJECT_ROOT}/skills"

echo "🛠️  Available Skills"
echo ""

# 遍历技能目录
for category_dir in "$SKILLS_DIR"/*; do
    if [[ -d "$category_dir" ]]; then
        category=$(basename "$category_dir")
        echo "📁 $category/"
        
        for skill_dir in "$category_dir"/*; do
            if [[ -d "$skill_dir" ]]; then
                skill_name=$(basename "$skill_dir")
                skill_file="${skill_dir}/skill.yaml"
                
                if [[ -f "$skill_file" ]]; then
                    # 提取描述
                    description=$(grep "^description:" "$skill_file" | head -1 | cut -d':' -f2- | sed 's/^[[:space:]]*//')
                    echo "   • $skill_name - $description"
                else
                    echo "   • $skill_name"
                fi
            fi
        done
        echo ""
    fi
done

echo ""
echo "Usage:"
echo "  ./scripts/skill-activate.sh <skill-name>"
echo "  ./scripts/skill-run.sh <skill-name> '<task>'"
