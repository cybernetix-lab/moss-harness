#!/bin/bash

# health-check.sh - 运行健康检查

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔍 Running Harness Health Checks..."
echo ""

ERRORS=0

# 检查目录结构
check_directory() {
    local dir="$1"
    local name="$2"
    if [[ -d "$dir" ]]; then
        echo "  ✅ $name"
        return 0
    else
        echo "  ❌ $name (missing: $dir)"
        ((ERRORS++))
        return 1
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
check_directory "${PROJECT_ROOT}/context" "Context directory"
check_directory "${PROJECT_ROOT}/constraints" "Constraints directory"
check_directory "${PROJECT_ROOT}/evals" "Evals directory"
check_directory "${PROJECT_ROOT}/telemetry" "Telemetry directory"
check_directory "${PROJECT_ROOT}/tools" "Tools directory"
check_directory "${PROJECT_ROOT}/scripts" "Scripts directory"
check_directory "${PROJECT_ROOT}/runtime" "Runtime directory"

echo ""
echo "📄 Core Files:"
check_file "${PROJECT_ROOT}/CLAUDE.md" "CLAUDE.md"
check_file "${PROJECT_ROOT}/init.sh" "init.sh"
check_file "${PROJECT_ROOT}/constraints/hard-constraints.yaml" "Hard constraints"
check_file "${PROJECT_ROOT}/constraints/soft-constraints.yaml" "Soft constraints"
check_file "${PROJECT_ROOT}/telemetry/config.yaml" "Telemetry config"

echo ""
echo "🔧 Scripts:"
check_file "${PROJECT_ROOT}/scripts/start-session.sh" "Start session script"
check_file "${PROJECT_ROOT}/scripts/update-context.sh" "Update context script"
check_file "${PROJECT_ROOT}/scripts/create-checkpoint.sh" "Create checkpoint script"
check_file "${PROJECT_ROOT}/scripts/restore-checkpoint.sh" "Restore checkpoint script"

echo ""
echo "🛠️ Tools:"
check_file "${PROJECT_ROOT}/tools/filesystem/read.yaml" "Read tool"
check_file "${PROJECT_ROOT}/tools/filesystem/write.yaml" "Write tool"
check_file "${PROJECT_ROOT}/tools/code/search.yaml" "Search tool"
check_file "${PROJECT_ROOT}/tools/execution/run-tests.yaml" "Run tests tool"

echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo "🎉 All health checks passed!"
    exit 0
else
    echo "⚠️  Found $ERRORS issue(s). Run ./init.sh to fix."
    exit 1
fi
