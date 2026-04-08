#!/bin/bash
#
# local-ci.sh - 本地运行完整 CI/CD 流水线
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERRORS++))
}

log_step() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo "─────────────────────────────────────────"
}

# 检查依赖
check_dependencies() {
    log_step "检查依赖"
    
    local deps=("yamllint" "bats" "shellcheck")
    for dep in "${deps[@]}"; do
        if command -v "$dep" &> /dev/null; then
            log_success "$dep 已安装"
        else
            log_error "$dep 未安装"
            echo "  安装命令:"
            echo "    macOS: brew install $dep"
            echo "    Linux: sudo apt-get install $dep"
        fi
    done
    
    if [[ $ERRORS -gt 0 ]]; then
        echo ""
        echo "请先安装缺失的依赖"
        exit 1
    fi
}

# 1. 健康检查
run_health_check() {
    log_step "1/7 健康检查"
    if ./tooling/scripts/health-check.sh; then
        log_success "健康检查通过"
    else
        log_error "健康检查失败"
    fi
}

# 2. 验证 YAML 文件
validate_yaml() {
    log_step "2/7 验证 YAML 文件"
    
    local yaml_files=$(find . \( -name "*.yaml" -o -name "*.yml" \) | grep -v node_modules | grep -v ".git" | grep -v "deployments/helm/templates")
    local yaml_errors=0
    
    for file in $yaml_files; do
        # 跳过 Helm 模板文件（包含 Go 模板语法）
        if [[ "$file" == *"/templates/"* ]]; then
            continue
        fi
        if ! yamllint -d relaxed "$file" 2>/dev/null; then
            log_error "YAML 验证失败: $file"
            ((yaml_errors++))
        fi
    done
    
    if [[ $yaml_errors -eq 0 ]]; then
        log_success "所有 YAML 文件验证通过"
    else
        log_error "$yaml_errors 个 YAML 文件验证失败"
    fi
}

# 3. 验证技能定义
validate_skills() {
    log_step "3/7 验证技能定义"
    
    local skill_errors=0
    for skill in integrations/skills/*/skill.yaml; do
        if [[ -f "$skill" ]]; then
            if ! yamllint -d relaxed "$skill" 2>/dev/null; then
                log_error "技能定义验证失败: $skill"
                ((skill_errors++))
            fi
        fi
    done
    
    if [[ $skill_errors -eq 0 ]]; then
        log_success "所有技能定义验证通过"
    else
        log_error "$skill_errors 个技能定义验证失败"
    fi
}

# 4. 验证 Agent 定义
validate_agents() {
    log_step "4/7 验证 Agent 定义"
    
    local agent_errors=0
    for agent in configs/agents/*.yaml; do
        if [[ -f "$agent" ]]; then
            if ! yamllint -d relaxed "$agent" 2>/dev/null; then
                log_error "Agent 定义验证失败: $agent"
                ((agent_errors++))
            fi
        fi
    done
    
    if [[ $agent_errors -eq 0 ]]; then
        log_success "所有 Agent 定义验证通过"
    else
        log_error "$agent_errors 个 Agent 定义验证失败"
    fi
}

# 5. ShellCheck 检查
run_shellcheck() {
    log_step "5/7 ShellCheck 检查"
    
    local shell_scripts=$(find . -name "*.sh" | grep -v node_modules | grep -v ".git")
    local shell_errors=0
    
    for script in $shell_scripts; do
        # 只检查错误，不检查警告（避免样式问题导致 CI 失败）
        if ! shellcheck --severity=error "$script" 2>/dev/null; then
            log_error "ShellCheck 错误: $script"
            ((shell_errors++))
        fi
    done
    
    if [[ $shell_errors -eq 0 ]]; then
        log_success "ShellCheck 检查通过（无错误）"
    else
        log_error "$shell_errors 个脚本有错误"
    fi
}

# 6. Bats 测试
run_bats_tests() {
    log_step "6/7 Bats 单元测试"
    
    if bats tests/apps/*.bats tests/scripts/*.bats tests/tooling/*.bats; then
        log_success "Bats 测试通过"
    else
        log_error "Bats 测试失败"
    fi
}

# 7. 功能测试
run_functional_tests() {
    log_step "7/7 功能测试"
    
    # 测试技能列表
    if ./tooling/scripts/skill-list.sh > /dev/null 2>&1; then
        log_success "skill-list.sh 运行正常"
    else
        log_error "skill-list.sh 运行失败"
    fi
    
    # 测试 Agent 列表
    if ./apps/agent-cli/agent-list.sh > /dev/null 2>&1; then
        log_success "agent-list.sh 运行正常"
    else
        log_error "agent-list.sh 运行失败"
    fi
    
    # 测试健康检查
    if ./tooling/scripts/health-check.sh > /dev/null 2>&1; then
        log_success "health-check.sh 运行正常"
    else
        log_error "health-check.sh 运行失败"
    fi
}

# 生成报告
generate_report() {
    echo ""
    echo "═══════════════════════════════════════════"
    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}🎉 所有 CI 检查通过！${NC}"
        echo "═══════════════════════════════════════════"
        exit 0
    else
        echo -e "${RED}⚠️  发现 $ERRORS 个问题${NC}"
        echo "═══════════════════════════════════════════"
        exit 1
    fi
}

# 主流程
main() {
    echo "🚀 启动本地 CI/CD 流水线"
    echo "═══════════════════════════════════════════"
    
    check_dependencies
    run_health_check
    validate_yaml
    validate_skills
    validate_agents
    run_shellcheck
    run_bats_tests
    run_functional_tests
    generate_report
}

main "$@"
