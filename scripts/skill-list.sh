#!/bin/bash
# skill-list.sh - List all available skills

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SKILLS_DIR="${PROJECT_ROOT}/skills"
REGISTRY_FILE="${SKILLS_DIR}/skill-registry.yaml"

echo "🛠️  Available Skills"
echo ""

# Check if yq is available and registry exists
if command -v yq &> /dev/null && [[ -f "$REGISTRY_FILE" ]]; then
    # Use registry to list skills
    skill_count=$(yq e '.skills | length' "$REGISTRY_FILE" 2>/dev/null || echo "0")
    
    if [[ "$skill_count" -gt 0 ]]; then
        for i in $(seq 0 $((skill_count - 1))); do
            name=$(yq e ".skills[$i].name" "$REGISTRY_FILE" 2>/dev/null)
            version=$(yq e ".skills[$i].version" "$REGISTRY_FILE" 2>/dev/null)
            description=$(yq e ".skills[$i].description" "$REGISTRY_FILE" 2>/dev/null)
            
            if [[ -n "$name" && "$name" != "null" ]]; then
                echo "   • $name (v$version) - $description"
            fi
        done
    else
        echo "   No skills found in registry"
    fi
else
    # Fallback: scan directory directly
    for skill_dir in "$SKILLS_DIR"/*; do
        if [[ -d "$skill_dir" && ! "$skill_dir" == *"/evolution"* ]]; then
            skill_name=$(basename "$skill_dir")
            skill_file="${skill_dir}/skill.yaml"
            
            if [[ -f "$skill_file" ]]; then
                # Extract description
                description=$(grep "^description:" "$skill_file" | head -1 | cut -d':' -f2- | sed 's/^[[:space:]]*//')
                echo "   • $skill_name - $description"
            fi
        fi
    done
fi

echo ""
echo "Usage:"
echo "  ./scripts/skill-activate.sh <skill-name>"
echo "  ./scripts/skill-run.sh <skill-name> '<task>'"
