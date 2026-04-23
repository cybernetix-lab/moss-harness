#!/bin/bash
#
# local-ci.sh - 本地运行完整 CI/CD 流水线 (对齐四层架构)
#

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

source "${SCRIPT_DIR}/scripts/ci-shellcheck-targets.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
FAILED_STAGES=()

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_step() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo "─────────────────────────────────────────"
}

# 检查依赖
check_dependencies() {
    log_step "检查依赖"
    
    local deps=("yamllint" "bats" "shellcheck" "npm")
    local missing_deps=0
    for dep in "${deps[@]}"; do
        if command -v "$dep" &> /dev/null; then
            log_success "$dep 已安装"
        else
            log_error "$dep 未安装"
            missing_deps=$((missing_deps + 1))
            echo "  请先安装 $dep"
        fi
    done
    
    if [[ $missing_deps -gt 0 ]]; then
        echo ""
        echo "请先安装缺失的依赖"
        exit 1
    fi
}

record_stage_failure() {
    local stage_name="$1"

    ERRORS=$((ERRORS + 1))
    FAILED_STAGES+=("$stage_name")
}

run_stage() {
    local stage_name="$1"
    shift

    if "$@"; then
        return 0
    fi

    record_stage_failure "$stage_name"
    return 1
}

run_check() {
    local label="$1"
    shift

    log_info "$label"
    if "$@"; then
        log_success "$label"
        return 0
    fi

    log_error "$label"
    return 1
}

# 1. 验证 Strategy 层 (YAML 配置文件)
validate_strategy_configs() {
    log_step "1/4 验证 Strategy 与 Integrations 层的 YAML 文件"

    local yaml_files
    local yaml_errors=0

    yaml_files=$(find . \( -name "*.yaml" -o -name "*.yml" \) 2>/dev/null \
        | grep -v '/node_modules/' \
        | grep -v '^./deployments/helm/templates/')
    
    for file in $yaml_files; do
        if ! yamllint -d relaxed "$file" 2>/dev/null; then
            log_error "YAML 验证失败: $file"
            ((yaml_errors++))
        fi
    done
    
    if [[ $yaml_errors -eq 0 ]]; then
        log_success "所有 YAML 策略配置验证通过"
        return 0
    fi

    log_error "$yaml_errors 个 YAML 文件验证失败"
    return 1
}

# 2. ShellCheck 检查 (CI 直接涉及脚本)
run_shellcheck() {
    log_step "2/4 ShellCheck 检查 (warning 级)"

    local shell_errors=0

    for script in "${SHELLCHECK_TARGETS[@]}"; do
        if ! shellcheck --severity=warning "$script" 2>/dev/null; then
            log_error "ShellCheck 错误: $script"
            shell_errors=$((shell_errors + 1))
        fi
    done

    if [[ $shell_errors -eq 0 ]]; then
        log_success "ShellCheck 检查通过"
        return 0
    fi

    log_error "$shell_errors 个脚本存在 ShellCheck warning/error"
    return 1
}

# 3. 运行 Bats 自动化测试
run_bats_tests() {
    log_step "3/4 Bats 单元测试"

    local bats_files
    bats_files=$(find tests/apps tests/scripts tests/tooling -name "*.bats" 2>/dev/null)

    if [ -n "$bats_files" ]; then
        if bats $bats_files; then
            log_success "Bats 测试通过"
            return 0
        else
            log_error "Bats 测试失败"
            return 1
        fi
    else
        log_info "未找到 Bats 测试文件"
        return 0
    fi
}

# 4. 运行 TypeScript gate
run_typescript_gate() {
    log_step "4/4 运行 TypeScript gate"

    local stage_failed=0

    run_check "npm test" npm test || stage_failed=1
    run_check "apps/mosscli build" npm --prefix apps/mosscli run build || stage_failed=1
    run_check "apps/mossclaw/server build" npm --prefix apps/mossclaw/server run build || stage_failed=1
    run_check "apps/mossclaw/server test" npm --prefix apps/mossclaw/server test || stage_failed=1
    run_check "apps/mossclaw/web build" npm --prefix apps/mossclaw/web run build || stage_failed=1

    return "$stage_failed"
}

# 生成报告
generate_report() {
    echo ""
    echo "═══════════════════════════════════════════"
    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}🎉 所有 CI 检查通过！符合事实先于广播原则。${NC}"
        echo "═══════════════════════════════════════════"
        exit 0
    else
        echo -e "${RED}⚠️  发现 $ERRORS 个问题，请修复后再推送。${NC}"
        for stage in "${FAILED_STAGES[@]}"; do
            echo "  - $stage"
        done
        echo "═══════════════════════════════════════════"
        exit 1
    fi
}

# 主流程
main() {
    echo "🚀 启动本地 CI/CD 流水线"
    echo "═══════════════════════════════════════════"
    
    check_dependencies
    run_stage "YAML 验证" validate_strategy_configs || true
    run_stage "ShellCheck" run_shellcheck || true
    run_stage "Bats 测试" run_bats_tests || true
    run_stage "TypeScript gate" run_typescript_gate || true
    generate_report
}

main "$@"
