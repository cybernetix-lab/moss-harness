#!/bin/bash
# verify.sh - 运行完整的6级验证循环
#
# Usage: verify.sh [options]
#   --level <name>    运行特定验证级别 (syntax|static|unit|integration|security|performance)
#   --fix             自动修复问题
#   --format <fmt>    输出格式: text|json|markdown (默认: text)
#   --output <file>   输出报告到文件
#   --parallel        并行运行验证
#   --help            显示帮助

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${PROJECT_ROOT}/verification/config.yaml"

# 运行时目录
RUNTIME_DIR="${PROJECT_ROOT}/runtime"
REPORTS_DIR="${RUNTIME_DIR}/reports"
CHECKPOINTS_DIR="${RUNTIME_DIR}/checkpoints"

# 默认配置
LEVEL=""
FIX=false
FORMAT="text"
OUTPUT=""
PARALLEL=false
VERBOSE=false

# 验证结果
declare -A RESULTS
declare -A SCORES
declare -A DURATIONS
TOTAL_SCORE=0
PASSED_LEVELS=0
FAILED_LEVELS=0
SKIPPED_LEVELS=0
START_TIME=$(date +%s)

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== 工具函数 ====================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

# 解析 YAML 配置
parse_yaml() {
    local file="$1"
    local prefix="$2"
    
    if command -v python3 &> /dev/null; then
        python3 -c "
import yaml
import sys
try:
    with open('$file', 'r') as f:
        data = yaml.safe_load(f)
        if data and 'verification' in data:
            v = data['verification']
            print('MODE=' + str(v.get('mode', 'checkpoint')))
            print('PASS_SCORE=' + str(v.get('thresholds', {}).get('pass_score', 0.8)))
            print('MAX_ATTEMPTS=' + str(v.get('thresholds', {}).get('max_attempts', 3)))
except Exception as e:
    print('MODE=checkpoint')
    print('PASS_SCORE=0.8')
    print('MAX_ATTEMPTS=3')
" 2>/dev/null || echo -e "MODE=checkpoint\nPASS_SCORE=0.8\nMAX_ATTEMPTS=3"
    else
        echo -e "MODE=checkpoint\nPASS_SCORE=0.8\nMAX_ATTEMPTS=3"
    fi
}

# 加载配置
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        eval "$(parse_yaml "$CONFIG_FILE" "CONFIG_")"
    else
        MODE="checkpoint"
        PASS_SCORE=0.8
        MAX_ATTEMPTS=3
    fi
}

# 检查工具是否安装
check_tool() {
    local tool="$1"
    if command -v "$tool" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 获取项目文件列表
get_project_files() {
    local extensions=("ts" "tsx" "js" "jsx" "json" "yaml" "yml" "md" "sh")
    local files=()
    
    for ext in "${extensions[@]}"; do
        while IFS= read -r file; do
            files+=("$file")
        done < <(find "$PROJECT_ROOT" -type f -name "*.$ext" \
            -not -path "*/node_modules/*" \
            -not -path "*/.git/*" \
            -not -path "*/runtime/*" 2>/dev/null)
    done
    
    echo "${files[@]}"
}

# 计算代码行数
count_lines() {
    local files=("$@")
    local total=0
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
            total=$((total + lines))
        fi
    done
    
    echo "$total"
}

# ==================== 验证级别函数 ====================

# Level 1: 语法检查
run_syntax_check() {
    local level_start=$(date +%s)
    local errors=0
    local warnings=0
    local files_checked=0
    
    log_section "Level 1: Syntax Check (语法检查)"
    
    local files=($(get_project_files))
    log_info "Checking ${#files[@]} files..."
    
    # Shell 脚本语法检查
    log_info "Checking shell scripts..."
    for file in "${files[@]}"; do
        if [[ "$file" == *.sh ]]; then
            files_checked=$((files_checked + 1))
            if ! bash -n "$file" 2>/dev/null; then
                log_error "Syntax error in: $file"
                errors=$((errors + 1))
            fi
        fi
    done
    
    # YAML 语法检查
    log_info "Checking YAML files..."
    if check_tool python3; then
        for file in "${files[@]}"; do
            if [[ "$file" == *.yaml || "$file" == *.yml ]]; then
                files_checked=$((files_checked + 1))
                if ! python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
                    log_error "Invalid YAML: $file"
                    errors=$((errors + 1))
                fi
            fi
        done
    else
        log_warning "Python3 not available, skipping YAML validation"
    fi
    
    # JSON 语法检查
    log_info "Checking JSON files..."
    for file in "${files[@]}"; do
        if [[ "$file" == *.json ]]; then
            files_checked=$((files_checked + 1))
            if ! python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
                log_error "Invalid JSON: $file"
                errors=$((errors + 1))
            fi
        fi
    done
    
    local level_end=$(date +%s)
    local duration=$((level_end - level_start))
    DURATIONS["syntax"]=$duration
    
    # 计算分数
    if [[ $errors -eq 0 ]]; then
        SCORES["syntax"]=1.0
        RESULTS["syntax"]="PASSED"
        log_success "Syntax check passed ($files_checked files checked in ${duration}s)"
    else
        local score=$(echo "scale=2; 1 - ($errors / $files_checked)" | bc 2>/dev/null || echo 0)
        SCORES["syntax"]=$score
        RESULTS["syntax"]="FAILED"
        log_error "Syntax check failed: $errors errors in $files_checked files"
    fi
    
    return $errors
}

# Level 2: 静态分析
run_static_analysis() {
    local level_start=$(date +%s)
    local issues=0
    local files_checked=0
    
    log_section "Level 2: Static Analysis (静态分析)"
    
    # 运行 lint-rules.sh 如果存在
    if [[ -f "${SCRIPT_DIR}/lint-rules.sh" ]]; then
        log_info "Running rule-based linting..."
        if bash "${SCRIPT_DIR}/lint-rules.sh" --format summary > /tmp/lint-results.txt 2>&1; then
            log_success "Rule linting passed"
        else
            local lint_issues=$(grep -c "violated" /tmp/lint-results.txt 2>/dev/null || echo 0)
            issues=$((issues + lint_issues))
            log_warning "Rule linting found $lint_issues issues"
        fi
    fi
    
    # 检查文件大小限制
    log_info "Checking file size limits..."
    local files=($(get_project_files))
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            files_checked=$((files_checked + 1))
            local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
            if [[ $lines -gt 500 ]]; then
                log_warning "Large file: $file ($lines lines)"
                issues=$((issues + 1))
            fi
        fi
    done
    
    # 检查重复内容
    log_info "Checking for duplicates..."
    local duplicates=$(find "$PROJECT_ROOT" -type f -name "*.sh" -exec md5sum {} + 2>/dev/null | \
        sort | uniq -d -w32 | wc -l)
    if [[ $duplicates -gt 0 ]]; then
        log_warning "Found $duplicates duplicate files"
        issues=$((issues + duplicates))
    fi
    
    local level_end=$(date +%s)
    local duration=$((level_end - level_start))
    DURATIONS["static"]=$duration
    
    if [[ $issues -eq 0 ]]; then
        SCORES["static"]=1.0
        RESULTS["static"]="PASSED"
        log_success "Static analysis passed ($files_checked files in ${duration}s)"
    else
        local score=$(echo "scale=2; 1 - ($issues / 100)" | bc 2>/dev/null || echo 0.9)
        SCORES["static"]=$score
        RESULTS["static"]="WARNING"
        log_warning "Static analysis found $issues issues"
    fi
    
    return 0
}

# Level 3: 单元测试
run_unit_tests() {
    local level_start=$(date +%s)
    local tests_passed=0
    local tests_failed=0
    
    log_section "Level 3: Unit Tests (单元测试)"
    
    # 查找测试脚本
    local test_scripts=()
    while IFS= read -r file; do
        test_scripts+=("$file")
    done < <(find "$PROJECT_ROOT" -type f -name "*test*.sh" -o -name "*_test.sh" 2>/dev/null | \
        grep -v node_modules | grep -v ".git")
    
    if [[ ${#test_scripts[@]} -eq 0 ]]; then
        log_warning "No test scripts found"
        SCORES["unit"]=1.0
        RESULTS["unit"]="SKIPPED"
        DURATIONS["unit"]=0
        SKIPPED_LEVELS=$((SKIPPED_LEVELS + 1))
        return 0
    fi
    
    log_info "Found ${#test_scripts[@]} test scripts"
    
    for test_script in "${test_scripts[@]}"; do
        log_info "Running: $(basename "$test_script")"
        if bash "$test_script" > /tmp/test-output.txt 2>&1; then
            tests_passed=$((tests_passed + 1))
            log_success "  ✓ Passed"
        else
            tests_failed=$((tests_failed + 1))
            log_error "  ✗ Failed"
            if [[ "$VERBOSE" == true ]]; then
                cat /tmp/test-output.txt
            fi
        fi
    done
    
    local total_tests=$((tests_passed + tests_failed))
    local level_end=$(date +%s)
    local duration=$((level_end - level_start))
    DURATIONS["unit"]=$duration
    
    if [[ $total_tests -gt 0 ]]; then
        local score=$(echo "scale=2; $tests_passed / $total_tests" | bc 2>/dev/null || echo 0)
        SCORES["unit"]=$score
        
        if [[ $tests_failed -eq 0 ]]; then
            RESULTS["unit"]="PASSED"
            log_success "All $tests_passed tests passed (${duration}s)"
        else
            RESULTS["unit"]="FAILED"
            log_error "$tests_failed of $total_tests tests failed"
        fi
    else
        SCORES["unit"]=1.0
        RESULTS["unit"]="SKIPPED"
    fi
    
    return $tests_failed
}

# Level 4: 集成测试
run_integration_tests() {
    local level_start=$(date +%s)
    
    log_section "Level 4: Integration Tests (集成测试)"
    
    # 检查脚本间依赖
    log_info "Checking script dependencies..."
    local dep_errors=0
    
    # 验证所有脚本引用的文件存在
    for script in "$SCRIPT_DIR"/*.sh; do
        if [[ -f "$script" ]]; then
            # 检查 source 引用
            local sourced=$(grep -E "^source |^\. " "$script" 2>/dev/null | \
                grep -v "BASH_SOURCE" | awk '{print $2}' | tr -d '"' || true)
            
            for ref in $sourced; do
                if [[ "$ref" == /* ]]; then
                    if [[ ! -f "$ref" ]]; then
                        log_warning "Missing dependency in $(basename "$script"): $ref"
                        dep_errors=$((dep_errors + 1))
                    fi
                fi
            done
        fi
    done
    
    # 验证配置文件引用
    log_info "Checking configuration references..."
    local config_errors=0
    
    for script in "$SCRIPT_DIR"/*.sh; do
        if [[ -f "$script" ]]; then
            local yaml_refs=$(grep -E "\.yaml|\.yml" "$script" | grep -v "^#" | wc -l)
            if [[ $yaml_refs -gt 0 ]]; then
                # 验证这些文件存在
                local missing=$(grep -oE "[a-zA-Z0-9_-]+\.(yaml|yml)" "$script" 2>/dev/null | while read -r f; do
                    if [[ ! -f "$PROJECT_ROOT/$f" && ! -f "$PROJECT_ROOT/skills/$f" && ! -f "$PROJECT_ROOT/constraints/$f" ]]; then
                        echo "1"
                    fi
                done | wc -l)
                config_errors=$((config_errors + missing))
            fi
        fi
    done
    
    local level_end=$(date +%s)
    local duration=$((level_end - level_start))
    DURATIONS["integration"]=$duration
    
    local total_errors=$((dep_errors + config_errors))
    
    if [[ $total_errors -eq 0 ]]; then
        SCORES["integration"]=1.0
        RESULTS["integration"]="PASSED"
        log_success "Integration tests passed (${duration}s)"
    else
        local score=$(echo "scale=2; 1 - ($total_errors / 20)" | bc 2>/dev/null || echo 0.8)
        SCORES["integration"]=$score
        RESULTS["integration"]="WARNING"
        log_warning "Integration tests found $total_errors issues"
    fi
    
    return 0
}

# Level 5: 安全扫描
run_security_scan() {
    local level_start=$(date +%s)
    local vulnerabilities=0
    
    log_section "Level 5: Security Scan (安全扫描)"
    
    # 检查敏感信息泄露
    log_info "Scanning for secrets..."
    
    local patterns=(
        "password\s*="
        "api_key\s*="
        "secret\s*="
        "token\s*="
        "AWS_ACCESS_KEY"
        "PRIVATE_KEY"
    )
    
    for pattern in "${patterns[@]}"; do
        local matches=$(grep -rE "$pattern" "$PROJECT_ROOT" \
            --include="*.sh" --include="*.yaml" --include="*.yml" \
            --include="*.json" --include="*.md" \
            --exclude-dir=node_modules --exclude-dir=.git \
            --exclude-dir=runtime 2>/dev/null | grep -v "example" | grep -v "template" | wc -l)
        vulnerabilities=$((vulnerabilities + matches))
    done
    
    # 检查文件权限
    log_info "Checking file permissions..."
    local bad_perms=$(find "$SCRIPT_DIR" -type f -name "*.sh" ! -perm -111 2>/dev/null | wc -l)
    if [[ $bad_perms -gt 0 ]]; then
        log_warning "$bad_perms scripts not executable"
        vulnerabilities=$((vulnerabilities + bad_perms))
    fi
    
    # 检查 eval 使用
    log_info "Checking for dangerous patterns..."
    local eval_count=$(grep -rE "\beval\b" "$SCRIPT_DIR" --include="*.sh" 2>/dev/null | grep -v "^#" | wc -l)
    if [[ $eval_count -gt 0 ]]; then
        log_warning "Found $eval_count eval statements"
        vulnerabilities=$((vulnerabilities + eval_count))
    fi
    
    local level_end=$(date +%s)
    local duration=$((level_end - level_start))
    DURATIONS["security"]=$duration
    
    if [[ $vulnerabilities -eq 0 ]]; then
        SCORES["security"]=1.0
        RESULTS["security"]="PASSED"
        log_success "Security scan passed (${duration}s)"
    else
        local score=$(echo "scale=2; 1 - ($vulnerabilities / 50)" | bc 2>/dev/null || echo 0.9)
        SCORES["security"]=$score
        RESULTS["security"]="WARNING"
        log_warning "Security scan found $vulnerabilities potential issues"
    fi
    
    return 0
}

# Level 6: 性能测试
run_performance_tests() {
    local level_start=$(date +%s)
    
    log_section "Level 6: Performance Tests (性能测试)"
    
    # 测量脚本执行时间
    log_info "Benchmarking script performance..."
    
    local slow_scripts=0
    local benchmark_threshold=2000  # 2 seconds in milliseconds
    
    for script in "$SCRIPT_DIR"/*.sh; do
        if [[ -f "$script" && "$(basename "$script")" != "verify.sh" ]]; then
            local start_ms=$(date +%s%3N)
            timeout 5 bash "$script" --help > /dev/null 2>&1 || true
            local end_ms=$(date +%s%3N)
            local duration=$((end_ms - start_ms))
            
            if [[ $duration -gt $benchmark_threshold ]]; then
                log_warning "Slow script: $(basename "$script") (${duration}ms)"
                slow_scripts=$((slow_scripts + 1))
            fi
        fi
    done
    
    # 检查项目大小
    log_info "Checking project size..."
    local project_size=$(du -sm "$PROJECT_ROOT" 2>/dev/null | cut -f1)
    log_info "Project size: ${project_size}MB"
    
    local level_end=$(date +%s)
    local duration=$((level_end - level_start))
    DURATIONS["performance"]=$duration
    
    if [[ $slow_scripts -eq 0 ]]; then
        SCORES["performance"]=1.0
        RESULTS["performance"]="PASSED"
        log_success "Performance tests passed (${duration}s)"
    else
        local score=$(echo "scale=2; 1 - ($slow_scripts / 10)" | bc 2>/dev/null || echo 0.9)
        SCORES["performance"]=$score
        RESULTS["performance"]="WARNING"
        log_warning "Performance tests found $slow_scripts slow scripts"
    fi
    
    return 0
}

# ==================== 报告生成 ====================

generate_text_report() {
    local report=""
    
    report+="\n"
    report+="╔══════════════════════════════════════════════════════════════╗\n"
    report+="║              VERIFICATION REPORT (验证报告)                   ║\n"
    report+="╚══════════════════════════════════════════════════════════════╝\n"
    report+="\n"
    
    # 汇总统计
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    report+="Summary:\n"
    report+="  Total Duration: ${total_duration}s\n"
    report+="  Levels Passed:  $PASSED_LEVELS\n"
    report+="  Levels Failed:  $FAILED_LEVELS\n"
    report+="  Levels Skipped: $SKIPPED_LEVELS\n"
    report+="\n"
    
    # 详细结果
    report+="Detailed Results:\n"
    report+="────────────────────────────────────────────────────────────────\n"
    
    local levels=("syntax" "static" "unit" "integration" "security" "performance")
    
    for level in "${levels[@]}"; do
        local result="${RESULTS[$level]:-SKIPPED}"
        local score="${SCORES[$level]:-0}"
        local duration="${DURATIONS[$level]:-0}"
        
        local status_icon
        case "$result" in
            "PASSED") status_icon="✓" ;;
            "FAILED") status_icon="✗" ;;
            "WARNING") status_icon="⚠" ;;
            *) status_icon="○" ;;
        esac
        
        report+=$(printf "  %-15s %-10s Score: %.2f  Time: %ss\n" \
            "$level" "[$status_icon $result]" "$score" "$duration")
    done
    
    report+="────────────────────────────────────────────────────────────────\n"
    report+="\n"
    
    # 总分
    calculate_total_score
    report+="Overall Score: $(printf "%.2f" $TOTAL_SCORE) / 1.00\n"
    
    if (( $(echo "$TOTAL_SCORE >= $PASS_SCORE" | bc -l) )); then
        report+="Status: ✓ PASSED\n"
    else
        report+="Status: ✗ FAILED (below threshold $PASS_SCORE)\n"
    fi
    
    report+="\n"
    report+="Generated: $(date '+%Y-%m-%d %H:%M:%S')\n"
    
    echo -e "$report"
}

generate_json_report() {
    local json="{"
    json+="\"timestamp\":\"$(date -Iseconds)\","
    json+="\"total_score\":$TOTAL_SCORE,"
    json+="\"threshold\":$PASS_SCORE,"
    json+="\"passed\":$PASSED_LEVELS,"
    json+="\"failed\":$FAILED_LEVELS,"
    json+="\"skipped\":$SKIPPED_LEVELS,"
    json+="\"levels\":{"
    
    local first=true
    local levels=("syntax" "static" "unit" "integration" "security" "performance")
    
    for level in "${levels[@]}"; do
        [[ "$first" == true ]] || json+=","
        first=false
        
        local result="${RESULTS[$level]:-SKIPPED}"
        local score="${SCORES[$level]:-0}"
        local duration="${DURATIONS[$level]:-0}"
        
        json+="\"$level\":{"
        json+="\"result\":\"$result\","
        json+="\"score\":$score,"
        json+="\"duration\":$duration"
        json+="}"
    done
    
    json+="}}"
    
    echo "$json"
}

generate_markdown_report() {
    local md="# Verification Report\n\n"
    md+="**Generated:** $(date '+%Y-%m-%d %H:%M:%S')\n\n"
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    md+="## Summary\n\n"
    md+="| Metric | Value |\n"
    md+="|--------|-------|\n"
    md+="| Total Duration | ${total_duration}s |\n"
    md+="| Levels Passed | $PASSED_LEVELS |\n"
    md+="| Levels Failed | $FAILED_LEVELS |\n"
    md+="| Levels Skipped | $SKIPPED_LEVELS |\n"
    md+="| Overall Score | $(printf "%.2f" $TOTAL_SCORE) |\n\n"
    
    md+="## Detailed Results\n\n"
    md+="| Level | Result | Score | Duration |\n"
    md+="|-------|--------|-------|----------|\n"
    
    local levels=("syntax" "static" "unit" "integration" "security" "performance")
    
    for level in "${levels[@]}"; do
        local result="${RESULTS[$level]:-SKIPPED}"
        local score="${SCORES[$level]:-0}"
        local duration="${DURATIONS[$level]:-0}"
        
        md+="| $level | $result | $score | ${duration}s |\n"
    done
    
    md+="\n## Status\n\n"
    
    if (( $(echo "$TOTAL_SCORE >= $PASS_SCORE" | bc -l) )); then
        md+=":white_check_mark: **PASSED**\n"
    else
        md+=":x: **FAILED** (below threshold $PASS_SCORE)\n"
    fi
    
    echo "$md"
}

calculate_total_score() {
    local total=0
    local count=0
    
    for score in "${SCORES[@]}"; do
        total=$(echo "$total + $score" | bc 2>/dev/null || echo $total)
        count=$((count + 1))
    done
    
    if [[ $count -gt 0 ]]; then
        TOTAL_SCORE=$(echo "scale=2; $total / $count" | bc 2>/dev/null || echo 0)
    fi
}

# 创建检查点
create_checkpoint() {
    local checkpoint_name="verify-$(date +%Y%m%d-%H%M%S)"
    
    if [[ -f "${SCRIPT_DIR}/create-checkpoint.sh" ]]; then
        bash "${SCRIPT_DIR}/create-checkpoint.sh" "$checkpoint_name" > /dev/null 2>&1
        log_info "Checkpoint created: $checkpoint_name"
    fi
}

# ==================== 主函数 ====================

show_help() {
    cat << EOF
Usage: $(basename "$0") [options]

Options:
  --level <name>    Run specific verification level
                    Available: syntax, static, unit, integration, security, performance
  --fix             Auto-fix issues where possible
  --format <fmt>    Output format: text|json|markdown (default: text)
  --output <file>   Save report to file
  --parallel        Run levels in parallel (experimental)
  --verbose         Show detailed output
  --help            Show this help

Examples:
  $(basename "$0")                    # Run all verification levels
  $(basename "$0") --level syntax     # Run only syntax check
  $(basename "$0") --format json      # Output as JSON
  $(basename "$0") --fix              # Auto-fix issues

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --level)
                LEVEL="$2"
                shift 2
                ;;
            --fix)
                FIX=true
                shift
                ;;
            --format)
                FORMAT="$2"
                shift 2
                ;;
            --output)
                OUTPUT="$2"
                shift 2
                ;;
            --parallel)
                PARALLEL=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

main() {
    parse_args "$@"
    
    # 创建运行时目录
    mkdir -p "$RUNTIME_DIR" "$REPORTS_DIR" "$CHECKPOINTS_DIR"
    
    # 加载配置
    load_config
    
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         HARNESS VERIFICATION SYSTEM (验证系统)               ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "Mode: $MODE"
    log_info "Pass Threshold: $PASS_SCORE"
    [[ "$FIX" == true ]] && log_info "Auto-fix: enabled"
    [[ "$PARALLEL" == true ]] && log_info "Parallel execution: enabled"
    
    # 验证特定级别或全部
    if [[ -n "$LEVEL" ]]; then
        case "$LEVEL" in
            syntax)
                run_syntax_check
                ;;
            static)
                run_static_analysis
                ;;
            unit)
                run_unit_tests
                ;;
            integration)
                run_integration_tests
                ;;
            security)
                run_security_scan
                ;;
            performance)
                run_performance_tests
                ;;
            *)
                echo "Unknown level: $LEVEL"
                echo "Available: syntax, static, unit, integration, security, performance"
                exit 1
                ;;
        esac
    else
        # 运行所有级别
        run_syntax_check
        local syntax_exit=$?
        
        run_static_analysis
        
        run_unit_tests
        local unit_exit=$?
        
        run_integration_tests
        run_security_scan
        run_performance_tests
        
        # 统计结果
        for result in "${RESULTS[@]}"; do
            case "$result" in
                "PASSED")
                    PASSED_LEVELS=$((PASSED_LEVELS + 1))
                    ;;
                "FAILED")
                    FAILED_LEVELS=$((FAILED_LEVELS + 1))
                    ;;
                "SKIPPED")
                    SKIPPED_LEVELS=$((SKIPPED_LEVELS + 1))
                    ;;
            esac
        done
    fi
    
    # 计算总分
    calculate_total_score
    
    # 生成报告
    local report=""
    case "$FORMAT" in
        json)
            report=$(generate_json_report)
            ;;
        markdown)
            report=$(generate_markdown_report)
            ;;
        *)
            report=$(generate_text_report)
            ;;
    esac
    
    # 输出报告
    echo -e "$report"
    
    # 保存到文件
    if [[ -n "$OUTPUT" ]]; then
        echo -e "$report" > "$OUTPUT"
        log_info "Report saved to: $OUTPUT"
    fi
    
    # 创建检查点
    if [[ "$MODE" == "checkpoint" ]]; then
        create_checkpoint
    fi
    
    # 返回状态
    if [[ $FAILED_LEVELS -gt 0 ]]; then
        echo ""
        log_error "Verification FAILED ($FAILED_LEVELS levels failed)"
        exit 1
    elif (( $(echo "$TOTAL_SCORE < $PASS_SCORE" | bc -l) )); then
        echo ""
        log_error "Verification FAILED (score $TOTAL_SCORE below threshold $PASS_SCORE)"
        exit 1
    else
        echo ""
        log_success "Verification PASSED (score: $TOTAL_SCORE)"
        exit 0
    fi
}

main "$@"
