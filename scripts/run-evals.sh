#!/bin/bash

# run-evals.sh - 运行评估套件

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

EVAL_DIR="${PROJECT_ROOT}/evals"

usage() {
    echo "Usage: $0 [type]"
    echo ""
    echo "Types:"
    echo "  all       Run all evaluations (default)"
    echo "  unit      Run unit tests"
    echo "  harness   Run harness-specific tests"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 harness"
}

run_harness_evals() {
    echo "🧪 Running Harness Evaluations..."
    echo ""
    
    local harness_dir="${EVAL_DIR}/harness"
    
    if [[ ! -d "$harness_dir" ]]; then
        echo "❌ Harness evals directory not found"
        return 1
    fi
    
    for eval_file in "$harness_dir"/*.yaml; do
        if [[ -f "$eval_file" ]]; then
            local name=$(basename "$eval_file" .yaml)
            echo "  📋 Running: $name"
            
            # 这里可以集成实际的测试运行器
            # 目前只是验证 YAML 格式
            if python3 -c "import yaml; yaml.safe_load(open('$eval_file'))" 2>/dev/null; then
                echo "     ✅ Valid YAML format"
            else
                echo "     ❌ Invalid YAML format"
            fi
        fi
    done
}

run_unit_tests() {
    echo "🧪 Running Unit Tests..."
    echo ""
    
    # 检查是否有单元测试目录
    if [[ -d "${EVAL_DIR}/unit" ]]; then
        echo "  (Unit tests would run here)"
    else
        echo "  ℹ️  No unit tests configured"
    fi
}

# 主逻辑
TYPE="${1:-all}"

case "$TYPE" in
    all)
        run_unit_tests
        echo ""
        run_harness_evals
        ;;
    unit)
        run_unit_tests
        ;;
    harness)
        run_harness_evals
        ;;
    help|--help|-h)
        usage
        exit 0
        ;;
    *)
        echo "❌ Unknown type: $TYPE"
        usage
        exit 1
        ;;
esac

echo ""

# 运行评估反馈处理，形成闭环
echo "🔄 Processing evaluation feedback..."
"${SCRIPT_DIR}/eval-feedback.sh" process

echo ""
echo "✅ Evaluation complete"
