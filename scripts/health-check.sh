#!/bin/bash

# health-check.sh - 运行健康检查

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🔍 Running Harness Health Checks..."
echo ""

ERRORS=0

# 检查目录结构（如果不存在则自动创建）
check_directory() {
    local dir="$1"
    local name="$2"
    local auto_create="${3:-false}"
    
    if [[ -d "$dir" ]]; then
        echo "  ✅ $name"
        return 0
    else
        if [[ "$auto_create" == "true" ]]; then
            mkdir -p "$dir"
            echo "  ✅ $name (created)"
            return 0
        else
            echo "  ❌ $name (missing: $dir)"
            ((ERRORS++))
            return 1
        fi
    fi
}

# 检查文件
check_file() {
    local file="$1"
    local name="$2"
    if [[ -f "$file" ]]; then
        echo "  ✅ $name"
        return 0
    else
        echo "  ❌ $name (missing: $file)"
        ((ERRORS++))
        return 1
    fi
}

echo "📁 Directory Structure:"
check_directory "${PROJECT_ROOT}/.runtime/context" "Context directory" "true"
check_directory "${PROJECT_ROOT}/configs/constraints" "Constraints directory"
check_directory "${PROJECT_ROOT}/evals" "Evals directory"
check_directory "${PROJECT_ROOT}/.runtime/moss-harness" "Observability directory"
check_directory "${PROJECT_ROOT}/configs/rules" "Rules directory"
check_directory "${PROJECT_ROOT}/scripts" "Scripts directory"
check_directory "${PROJECT_ROOT}/configs/agents" "Agent configs directory"
check_directory "${PROJECT_ROOT}/configs/skills" "Skill registry directory"
check_directory "${PROJECT_ROOT}/integrations/skills" "Skill definitions directory"

echo ""
echo "📄 Core Files:"
check_file "${PROJECT_ROOT}/CLAUDE.md" "CLAUDE.md"
check_file "${PROJECT_ROOT}/init.sh" "init.sh"
check_file "${PROJECT_ROOT}/configs/constraints/hard-constraints.yaml" "Hard constraints"
check_file "${PROJECT_ROOT}/configs/constraints/soft-constraints.yaml" "Soft constraints"
check_file "${PROJECT_ROOT}/configs/telemetry/token-telemetry.yaml" "Telemetry config"

echo ""
echo "🔧 Scripts:"
check_file "${PROJECT_ROOT}/apps/agent-cli/start-session.sh" "Start session script"
check_file "${PROJECT_ROOT}/scripts/update-context.sh" "Update context script"
check_file "${PROJECT_ROOT}/apps/agent-cli/create-checkpoint.sh" "Create checkpoint script"
check_file "${PROJECT_ROOT}/apps/agent-cli/restore-checkpoint.sh" "Restore checkpoint script"

echo ""
echo "🛠️ Tools:"
check_file "${PROJECT_ROOT}/configs/rules/filesystem/read.yaml" "Read tool"
check_file "${PROJECT_ROOT}/configs/rules/filesystem/write.yaml" "Write tool"
check_file "${PROJECT_ROOT}/configs/rules/code/search.yaml" "Search tool"
check_file "${PROJECT_ROOT}/configs/rules/execution/run-tests.yaml" "Run tests tool"

echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo "🎉 All health checks passed!"
    exit 0
else
    echo "⚠️  Found $ERRORS issue(s). Run ./init.sh to fix."
    exit 1
fi
