#!/bin/bash
# skill-eval.sh - 技能评估执行器
# 自动执行技能评估并生成结果

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 数据目录
EVAL_DIR="${PROJECT_ROOT}/evals"
SKILLS_DIR="${PROJECT_ROOT}/skills"
RESULTS_DIR="${PROJECT_ROOT}/runtime/memory/eval-results"

mkdir -p "$RESULTS_DIR"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    if ! command -v yq &> /dev/null; then
        log_error "yq 未安装。请安装 yq: https://github.com/mikefarah/yq"
        exit 1
    fi
}

# 获取技能评估文件
get_skill_eval_file() {
    local skill_name="$1"
    local eval_file="${EVAL_DIR}/integrations/skills/${skill_name}-eval.yaml"
    
    if [[ -f "$eval_file" ]]; then
        echo "$eval_file"
    else
        echo ""
    fi
}

# 执行单个测试用例
run_test_case() {
    local eval_file="$1"
    local category="$2"
    local test_name="$3"
    local skill_name="$4"
    
    log_info "执行测试: $category/$test_name"
    
    # 读取测试配置
    local test_config=$(yq e ".test_cases.${category}[] | select(.name == \"${test_name}\")" "$eval_file")
    
    if [[ -z "$test_config" ]]; then
        log_error "测试配置不存在: $test_name"
        return 1
    fi
    
    # 获取测试参数
    local description=$(echo "$test_config" | yq e '.description' -)
    local weight=$(echo "$test_config" | yq e '.weight // 1.0' -)
    local input_query=$(echo "$test_config" | yq e '.input.query' -)
    
    log_info "  描述: $description"
    log_info "  权重: $weight"
    
    # 模拟技能执行（实际应该调用真实的技能执行）
    # 这里简化处理，假设技能输出存储在临时文件
    local output_file="/tmp/skill_output_${skill_name}_$(date +%s).txt"
    
    # 模拟执行（实际项目中应该调用技能）
    simulate_skill_execution "$skill_name" "$input_query" "$output_file"
    
    # 验证输出
    local test_result=$(validate_test_output "$eval_file" "$category" "$test_name" "$output_file")
    local exit_code=$?
    
    # 清理
    rm -f "$output_file"
    
    return $exit_code
}

# 模拟技能执行（简化版）
simulate_skill_execution() {
    local skill_name="$1"
    local query="$2"
    local output_file="$3"
    
    # 读取技能定义
    local skill_file="${SKILLS_DIR}/${skill_name}/skill.yaml"
    
    if [[ ! -f "$skill_file" ]]; then
        echo "Skill not found: $skill_name" > "$output_file"
        return 1
    fi
    
    # 简化：输出技能的模板内容作为模拟结果
    local patterns=$(yq e '.patterns[].template' "$skill_file" 2>/dev/null | head -1)
    
    if [[ -n "$patterns" ]]; then
        echo "$patterns" > "$output_file"
    else
        echo "// Simulated output for: $query" > "$output_file"
        echo "function useExample() {" >> "$output_file"
        echo "  // Implementation" >> "$output_file"
        echo "}" >> "$output_file"
    fi
    
    return 0
}

# 验证测试输出
validate_test_output() {
    local eval_file="$1"
    local category="$2"
    local test_name="$3"
    local output_file="$4"
    
    local test_config=$(yq e ".test_cases.${category}[] | select(.name == \"${test_name}\")" "$eval_file")
    local expected=$(echo "$test_config" | yq e '.expected' -)
    
    local passed=true
    local score=1.0
    local messages=()
    
    # 检查 output_contains
    local contains=$(echo "$expected" | yq e '.output_contains[]' - 2>/dev/null)
    if [[ -n "$contains" ]]; then
        while IFS= read -r pattern; do
            if ! grep -q "$pattern" "$output_file"; then
                passed=false
                messages+=("缺少期望内容: $pattern")
            fi
        done <<< "$contains"
    fi
    
    # 检查 output_not_contains
    local not_contains=$(echo "$expected" | yq e '.output_not_contains[]' - 2>/dev/null)
    if [[ -n "$not_contains" ]]; then
        while IFS= read -r pattern; do
            if grep -q "$pattern" "$output_file"; then
                passed=false
                messages+=("包含不期望内容: $pattern")
            fi
        done <<< "$not_contains"
    fi
    
    # 检查 code_patterns
    local code_patterns=$(echo "$expected" | yq e '.code_patterns[]' - 2>/dev/null)
    if [[ -n "$code_patterns" ]]; then
        while IFS= read -r pattern; do
            if ! grep -Eq "$pattern" "$output_file"; then
                passed=false
                messages+=("缺少代码模式: $pattern")
            fi
        done <<< "$code_patterns"
    fi
    
    # 输出结果
    if [[ "$passed" == "true" ]]; then
        log_success "  ✅ 通过"
        return 0
    else
        log_error "  ❌ 失败"
        for msg in "${messages[@]}"; do
            echo "     - $msg"
        done
        return 1
    fi
}

# 评估单个技能
eval_skill() {
    local skill_name="$1"
    local verbose="${2:-false}"
    
    log_info "评估技能: $skill_name"
    echo ""
    
    # 获取评估文件
    local eval_file=$(get_skill_eval_file "$skill_name")
    
    if [[ -z "$eval_file" ]]; then
        log_warning "技能 '$skill_name' 没有评估文件"
        return 1
    fi
    
    # 读取评估配置
    local skill_version=$(yq e '.version' "$eval_file")
    local pass_threshold=$(yq e '.scoring.pass_threshold' "$eval_file")
    
    log_info "版本: $skill_version"
    log_info "通过阈值: $pass_threshold"
    echo ""
    
    # 执行各类测试
    local total_score=0
    local total_weight=0
    local results=()
    
    # 正确性测试
    log_info "=== 正确性测试 ==="
    local correctness_tests=$(yq e '.test_cases.correctness[].name' "$eval_file" 2>/dev/null)
    if [[ -n "$correctness_tests" ]]; then
        while IFS= read -r test_name; do
            if run_test_case "$eval_file" "correctness" "$test_name" "$skill_name"; then
                local weight=$(yq e ".test_cases.correctness[] | select(.name == \"${test_name}\") | .weight" "$eval_file")
                total_score=$(echo "$total_score + $weight" | bc)
            fi
            total_weight=$(echo "$total_weight + $(yq e ".test_cases.correctness[] | select(.name == \"${test_name}\") | .weight" "$eval_file")" | bc)
        done <<< "$correctness_tests"
    fi
    echo ""
    
    # 性能测试
    log_info "=== 性能测试 ==="
    local performance_tests=$(yq e '.test_cases.performance[].name' "$eval_file" 2>/dev/null)
    if [[ -n "$performance_tests" ]]; then
        while IFS= read -r test_name; do
            if run_test_case "$eval_file" "performance" "$test_name" "$skill_name"; then
                local weight=$(yq e ".test_cases.performance[] | select(.name == \"${test_name}\") | .weight" "$eval_file")
                total_score=$(echo "$total_score + $weight" | bc)
            fi
            total_weight=$(echo "$total_weight + $(yq e ".test_cases.performance[] | select(.name == \"${test_name}\") | .weight" "$eval_file")" | bc)
        done <<< "$performance_tests"
    fi
    echo ""
    
    # 安全测试
    log_info "=== 安全测试 ==="
    local security_tests=$(yq e '.test_cases.security[].name' "$eval_file" 2>/dev/null)
    if [[ -n "$security_tests" ]]; then
        while IFS= read -r test_name; do
            if run_test_case "$eval_file" "security" "$test_name" "$skill_name"; then
                local weight=$(yq e ".test_cases.security[] | select(.name == \"${test_name}\") | .weight" "$eval_file")
                total_score=$(echo "$total_score + $weight" | bc)
            fi
            total_weight=$(echo "$total_weight + $(yq e ".test_cases.security[] | select(.name == \"${test_name}\") | .weight" "$eval_file")" | bc)
        done <<< "$security_tests"
    fi
    echo ""
    
    # 可维护性测试
    log_info "=== 可维护性测试 ==="
    local maintainability_tests=$(yq e '.test_cases.maintainability[].name' "$eval_file" 2>/dev/null)
    if [[ -n "$maintainability_tests" ]]; then
        while IFS= read -r test_name; do
            if run_test_case "$eval_file" "maintainability" "$test_name" "$skill_name"; then
                local weight=$(yq e ".test_cases.maintainability[] | select(.name == \"${test_name}\") | .weight" "$eval_file")
                total_score=$(echo "$total_score + $weight" | bc)
            fi
            total_weight=$(echo "$total_weight + $(yq e ".test_cases.maintainability[] | select(.name == \"${test_name}\") | .weight" "$eval_file")" | bc)
        done <<< "$maintainability_tests"
    fi
    echo ""
    
    # 计算最终得分
    local final_score=0
    if (( $(echo "$total_weight > 0" | bc -l) )); then
        final_score=$(echo "scale=2; $total_score / $total_weight" | bc)
    fi
    
    # 保存结果
    save_eval_result "$skill_name" "$skill_version" "$final_score" "$pass_threshold"
    
    # 显示结果
    echo "================================"
    log_info "评估结果:"
    echo "  得分: $final_score"
    echo "  阈值: $pass_threshold"
    
    if (( $(echo "$final_score >= $pass_threshold" | bc -l) )); then
        log_success "  状态: ✅ 通过"
        return 0
    else
        log_error "  状态: ❌ 未通过"
        return 1
    fi
}

# 保存评估结果
save_eval_result() {
    local skill_name="$1"
    local version="$2"
    local score="$3"
    local threshold="$4"
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local result_file="${RESULTS_DIR}/${skill_name}-$(date +%s).json"
    
    local passed=false
    if (( $(echo "$score >= $threshold" | bc -l) )); then
        passed=true
    fi
    
    python3 << EOF
import json

result = {
    "skill_name": "${skill_name}",
    "version": "${version}",
    "timestamp": "${timestamp}",
    "score": ${score},
    "threshold": ${threshold},
    "passed": ${passed},
    "eval_type": "skill"
}

with open('${result_file}', 'w') as f:
    json.dump(result, f, indent=2)

print(f"结果已保存: ${result_file}")
EOF
}

# 评估所有技能
eval_all_skills() {
    log_info "评估所有技能..."
    echo ""
    
    local total=0
    local passed=0
    local failed=0
    
    # 遍历所有技能评估文件
    for eval_file in "${EVAL_DIR}/skills"/*-eval.yaml; do
        if [[ -f "$eval_file" ]]; then
            local skill_name=$(yq e '.skill_name' "$eval_file")
            
            if eval_skill "$skill_name"; then
                ((passed++))
            else
                ((failed++))
            fi
            ((total++))
            
            echo ""
            echo "────────────────────────────────────"
            echo ""
        fi
    done
    
    # 生成汇总报告
    echo "================================"
    log_info "评估汇总:"
    echo "  总计: $total"
    log_success "  通过: $passed"
    if [[ $failed -gt 0 ]]; then
        log_error "  失败: $failed"
    fi
    
    return $failed
}

# 显示帮助
show_help() {
    cat << 'EOF'
技能评估执行器

用法: ./scripts/skill-eval.sh <命令> [参数]

命令:
  eval <skill-name>    评估指定技能
  eval-all             评估所有技能
  list                 列出可评估的技能
  result <skill-name>  查看技能评估结果
  help                 显示此帮助

示例:
  ./scripts/skill-eval.sh eval react-hooks
  ./scripts/skill-eval.sh eval-all
  ./scripts/skill-eval.sh list
EOF
}

# 列出可评估的技能
list_evaluable_skills() {
    log_info "可评估的技能列表:"
    echo ""
    
    printf "%-30s %-10s %-20s\n" "技能名称" "版本" "评估文件"
    printf "%-30s %-10s %-20s\n" "--------" "----" "--------"
    
    for eval_file in "${EVAL_DIR}/skills"/*-eval.yaml; do
        if [[ -f "$eval_file" ]]; then
            local skill_name=$(yq e '.skill_name' "$eval_file")
            local version=$(yq e '.version' "$eval_file")
            local filename=$(basename "$eval_file")
            
            printf "%-30s %-10s %-20s\n" "$skill_name" "$version" "$filename"
        fi
    done
}

# 查看评估结果
view_results() {
    local skill_name="$1"
    
    log_info "技能 '$skill_name' 的评估结果:"
    echo ""
    
    local found=false
    for result_file in "${RESULTS_DIR}/${skill_name}"-*.json; do
        if [[ -f "$result_file" ]]; then
            found=true
            local filename=$(basename "$result_file")
            local timestamp=$(python3 -c "import json; print(json.load(open('${result_file}'))['timestamp'])")
            local score=$(python3 -c "import json; print(json.load(open('${result_file}'))['score'])")
            local passed=$(python3 -c "import json; print('✅' if json.load(open('${result_file}'))['passed'] else '❌')")
            
            echo "  ${passed} ${timestamp} - 得分: ${score}"
        fi
    done
    
    if [[ "$found" == "false" ]]; then
        log_warning "没有找到评估结果"
    fi
}

# 主函数
main() {
    check_dependencies
    
    case "${1:-help}" in
        eval)
            if [[ -z "${2:-}" ]]; then
                log_error "请提供技能名称"
                exit 1
            fi
            eval_skill "$2"
            ;;
        eval-all)
            eval_all_skills
            ;;
        list)
            list_evaluable_skills
            ;;
        result)
            if [[ -z "${2:-}" ]]; then
                log_error "请提供技能名称"
                exit 1
            fi
            view_results "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
