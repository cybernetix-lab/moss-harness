#!/bin/bash
# lint-rules.sh - 规则检查脚本
# 检查代码是否符合项目定义的规则

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RULES_DIR="${PROJECT_ROOT}/rules"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 统计
TOTAL_RULES=0
PASSED_RULES=0
FAILED_RULES=0
WARNINGS=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_RULES++))
}

# 显示帮助
show_help() {
    cat << 'EOF'
规则检查脚本

用法: ./scripts/lint-rules.sh [选项] [文件...]

选项:
  --rule <rule-name>     只检查特定规则
  --fix                  自动修复问题（如可能）
  --severity <level>     只显示指定严重级别的问题 (error|warning|info)
  --format <format>      输出格式 (text|json)
  --help                 显示此帮助

示例:
  ./scripts/lint-rules.sh                    # 检查所有文件
  ./scripts/lint-rules.sh src/file.ts        # 检查特定文件
  ./scripts/lint-rules.sh --rule no-secrets  # 只检查 no-secrets 规则
  ./scripts/lint-rules.sh --fix              # 自动修复
EOF
}

# 解析规则文件
parse_rule() {
    local rule_file="$1"
    
    if [[ ! -f "$rule_file" ]]; then
        return 1
    fi
    
    local name=$(yq e '.name' "$rule_file" 2>/dev/null || echo "")
    local severity=$(yq e '.severity' "$rule_file" 2>/dev/null || echo "warning")
    local category=$(yq e '.category' "$rule_file" 2>/dev/null || echo "style")
    local language=$(yq e '.language' "$rule_file" 2>/dev/null || echo "common")
    local description=$(yq e '.description' "$rule_file" 2>/dev/null | head -1 || echo "")
    local pattern=$(yq e '.detection.pattern' "$rule_file" 2>/dev/null || echo "")
    
    echo "${name}|${severity}|${category}|${language}|${description}|${pattern}"
}

# 检查单个规则
check_rule() {
    local rule_file="$1"
    local target_file="$2"
    local fix_mode="${3:-false}"
    
    local rule_info=$(parse_rule "$rule_file")
    local name=$(echo "$rule_info" | cut -d'|' -f1)
    local severity=$(echo "$rule_info" | cut -d'|' -f2)
    local category=$(echo "$rule_info" | cut -d'|' -f3)
    local language=$(echo "$rule_info" | cut -d'|' -f4)
    local description=$(echo "$rule_info" | cut -d'|' -f5)
    local pattern=$(echo "$rule_info" | cut -d'|' -f6)
    
    ((TOTAL_RULES++))
    
    # 检查文件类型是否匹配规则语言
    if [[ "$language" != "common" ]]; then
        if [[ ! "$target_file" =~ \.($language)$ ]]; then
            return 0
        fi
    fi
    
    # 如果没有模式，跳过
    if [[ -z "$pattern" ]]; then
        return 0
    fi
    
    # 执行检查
    local matches=$(grep -n "$pattern" "$target_file" 2>/dev/null || true)
    
    if [[ -n "$matches" ]]; then
        local match_count=$(echo "$matches" | wc -l)
        
        if [[ "$severity" == "error" ]]; then
            log_error "$name: $description"
            echo "$matches" | while read -r line; do
                echo "    ${RED}→${NC} $target_file:$line"
            done
        elif [[ "$severity" == "warning" ]]; then
            log_warning "$name: $description"
            echo "$matches" | head -3 | while read -r line; do
                echo "    ${YELLOW}→${NC} $target_file:$line"
            done
            if [[ $match_count -gt 3 ]]; then
                echo "    ... and $((match_count - 3)) more"
            fi
        fi
        
        # 自动修复（简化版）
        if [[ "$fix_mode" == "true" && "$severity" == "warning" ]]; then
            log_info "尝试自动修复..."
            # 这里可以添加具体的修复逻辑
        fi
        
        return 1
    else
        ((PASSED_RULES++))
        return 0
    fi
}

# 检查所有规则
check_all_rules() {
    local target_file="$1"
    local specific_rule="${2:-}"
    local fix_mode="${3:-false}"
    
    # 遍历所有规则文件
    for rule_file in "${RULES_DIR}"/**/*.yaml; do
        if [[ -f "$rule_file" ]]; then
            local rule_name=$(basename "$rule_file" .yaml)
            
            # 如果指定了特定规则，只检查该规则
            if [[ -n "$specific_rule" && "$rule_name" != "$specific_rule" ]]; then
                continue
            fi
            
            check_rule "$rule_file" "$target_file" "$fix_mode"
        fi
    done
}

# 检查单个文件
check_file() {
    local file="$1"
    local specific_rule="${2:-}"
    local fix_mode="${3:-false}"
    
    if [[ ! -f "$file" ]]; then
        log_error "文件不存在: $file"
        return 1
    fi
    
    log_info "检查文件: $file"
    check_all_rules "$file" "$specific_rule" "$fix_mode"
}

# 检查目录
check_directory() {
    local dir="$1"
    local specific_rule="${2:-}"
    local fix_mode="${3:-false}"
    
    log_info "检查目录: $dir"
    
    # 查找所有代码文件和 YAML 文件
    find "$dir" -type f \( \
        -name "*.ts" -o \
        -name "*.tsx" -o \
        -name "*.js" -o \
        -name "*.jsx" -o \
        -name "*.py" -o \
        -name "*.sh" -o \
        -name "*.yaml" -o \
        -name "*.yml" \
    \) -not -path "*/node_modules/*" -not -path "*/.git/*" | while read -r file; do
        check_file "$file" "$specific_rule" "$fix_mode"
    done
}

# 列出所有规则
list_rules() {
    echo "📋 可用规则列表:"
    echo ""
    
    printf "%-30s %-10s %-15s %-10s\n" "规则名称" "严重级别" "类别" "语言"
    printf "%-30s %-10s %-15s %-10s\n" "--------" "--------" "----" "------"
    
    for rule_file in "${RULES_DIR}"/**/*.yaml; do
        if [[ -f "$rule_file" ]]; then
            local rule_info=$(parse_rule "$rule_file")
            local name=$(echo "$rule_info" | cut -d'|' -f1)
            local severity=$(echo "$rule_info" | cut -d'|' -f2)
            local category=$(echo "$rule_info" | cut -d'|' -f3)
            local language=$(echo "$rule_info" | cut -d'|' -f4)
            
            printf "%-30s %-10s %-15s %-10s\n" "$name" "$severity" "$category" "$language"
        fi
    done
}

# 生成报告
generate_report() {
    echo ""
    echo "================================"
    echo "📊 检查报告"
    echo "================================"
    echo "总规则数: $TOTAL_RULES"
    log_success "通过: $PASSED_RULES"
    
    if [[ $WARNINGS -gt 0 ]]; then
        log_warning "警告: $WARNINGS"
    fi
    
    if [[ $FAILED_RULES -gt 0 ]]; then
        log_error "失败: $FAILED_RULES"
        return 1
    else
        log_success "所有检查通过!"
        return 0
    fi
}

# 主函数
main() {
    local targets=()
    local specific_rule=""
    local fix_mode="false"
    local severity_filter=""
    local output_format="text"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --rule)
                specific_rule="$2"
                shift 2
                ;;
            --fix)
                fix_mode="true"
                shift
                ;;
            --severity)
                severity_filter="$2"
                shift 2
                ;;
            --format)
                output_format="$2"
                shift 2
                ;;
            --list)
                list_rules
                exit 0
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            -*)
                echo "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                targets+=("$1")
                shift
                ;;
        esac
    done
    
    # 如果没有指定目标，检查当前目录
    if [[ ${#targets[@]} -eq 0 ]]; then
        targets=("${PROJECT_ROOT}")
    fi
    
    # 检查依赖
    if ! command -v yq &> /dev/null; then
        log_error "yq 未安装。请安装 yq: https://github.com/mikefarah/yq"
        exit 1
    fi
    
    echo "🔍 开始规则检查..."
    echo ""
    
    # 处理每个目标
    for target in "${targets[@]}"; do
        if [[ -f "$target" ]]; then
            check_file "$target" "$specific_rule" "$fix_mode"
        elif [[ -d "$target" ]]; then
            check_directory "$target" "$specific_rule" "$fix_mode"
        else
            log_error "无效的目标: $target"
        fi
    done
    
    # 生成报告
    generate_report
}

main "$@"
