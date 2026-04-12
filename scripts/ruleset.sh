#!/bin/bash
# ruleset.sh - 规则集配置管理
#
# Usage: ruleset.sh <command> [options]
# Commands:
#   list                列出所有规则
#   show <rule>         显示规则详情
#   enable <rule>       启用规则
#   disable <rule>      禁用规则
#   check <file>        检查文件是否符合规则
#   init                初始化规则集配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RULES_DIR="${PROJECT_ROOT}/configs/rules"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"

# 规则集配置文件
RULESET_CONFIG="${PROJECT_ROOT}/tooling/rules/ruleset.yaml"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# 获取所有规则文件
get_rule_files() {
    find "$RULES_DIR" -name "*.yaml" -type f 2>/dev/null | grep -v "ruleset.yaml" | sort
}

# 解析规则文件
parse_rule() {
    local rule_file="$1"

    if command -v python3 &> /dev/null; then
        python3 -c "
import yaml
try:
    with open('$rule_file', 'r') as f:
        data = yaml.safe_load(f)
        if data:
            print('NAME=' + str(data.get('name', '')))
            print('SEVERITY=' + str(data.get('severity', 'warning')))
            print('CATEGORY=' + str(data.get('category', 'general')))
            print('LANGUAGE=' + str(data.get('language', 'common')))
            desc = data.get('description', '')
            print('DESCRIPTION=' + (desc.split('\n')[0] if desc else ''))
except Exception as e:
    print('NAME=')
    print('SEVERITY=warning')
    print('CATEGORY=general')
    print('LANGUAGE=common')
    print('DESCRIPTION=')
" 2>/dev/null
    else
        # 简单解析
        echo "NAME=$(grep "^name:" "$rule_file" | head -1 | cut -d':' -f2- | xargs || echo '')"
        echo "SEVERITY=$(grep "^severity:" "$rule_file" | head -1 | cut -d':' -f2- | xargs || echo 'warning')"
        echo "CATEGORY=$(grep "^category:" "$rule_file" | head -1 | cut -d':' -f2- | xargs || echo 'general')"
        echo "LANGUAGE=$(grep "^language:" "$rule_file" | head -1 | cut -d':' -f2- | xargs || echo 'common')"
        echo "DESCRIPTION=$(grep "^description:" "$rule_file" | head -1 | cut -d'|' -f2- | xargs || echo '')"
    fi
}

# ==================== List Command ====================

cmd_list() {
    local filter_category="$1"
    local filter_language="$2"

    log_section "Available Rules"

    local rule_files=$(get_rule_files)

    if [[ -z "$rule_files" ]]; then
        log_warning "No rules found"
        return
    fi

    # 按类别分组
    declare -A categories

    for rule_file in $rule_files; do
        eval "$(parse_rule "$rule_file")"

        # 应用过滤器
        if [[ -n "$filter_category" && "$CATEGORY" != "$filter_category" ]]; then
            continue
        fi
        if [[ -n "$filter_language" && "$LANGUAGE" != "$filter_language" ]]; then
            continue
        fi

        # 添加到类别
        if [[ -z "${categories[$CATEGORY]}" ]]; then
            categories[$CATEGORY]=""
        fi
        categories[$CATEGORY]+="$NAME|$SEVERITY|$LANGUAGE|$DESCRIPTION\n"
    done

    # 显示结果
    for category in "${!categories[@]}"; do
        echo ""
        echo -e "${CYAN}[$category]${NC}"
        echo "─────────────────────────────────────────────────────────────"

        echo -e "${categories[$category]}" | while IFS='|' read -r name severity language description; do
            [[ -z "$name" ]] && continue

            # 严重度颜色
            local severity_color="$YELLOW"
            [[ "$severity" == "error" ]] && severity_color="$RED"

            printf "  %-30s %b%-8s%b %-10s %s\n" \
                "$name" "$severity_color" "$severity" "$NC" "[$language]" "$description"
        done
    done

    echo ""
    local total=$(echo "$rule_files" | wc -l)
    log_info "Total: $total rules"
}

# ==================== Show Command ====================

cmd_show() {
    local rule_name="$1"

    if [[ -z "$rule_name" ]]; then
        log_error "Rule name required"
        echo "Usage: ruleset.sh show <rule-name>"
        exit 1
    fi

    # 查找规则文件
    local rule_file=$(find "$RULES_DIR" -name "*.yaml" -exec grep -l "^name: $rule_name" {} \; 2>/dev/null | head -1)

    if [[ -z "$rule_file" ]]; then
        log_error "Rule not found: $rule_name"
        exit 1
    fi

    log_section "Rule: $rule_name"
    cat "$rule_file"
}

# ==================== Enable/Disable Commands ====================

cmd_enable() {
    local rule_name="$1"
    cmd_toggle_rule "$rule_name" "enabled"
}

cmd_disable() {
    local rule_name="$1"
    cmd_toggle_rule "$rule_name" "disabled"
}

cmd_toggle_rule() {
    local rule_name="$1"
    local status="$2"

    if [[ -z "$rule_name" ]]; then
        log_error "Rule name required"
        exit 1
    fi

    # 确保规则集配置存在
    if [[ ! -f "$RULESET_CONFIG" ]]; then
        cmd_init
    fi

    # 更新规则集配置
    if command -v python3 &> /dev/null; then
        python3 << EOF
import yaml
import os

config_file = '$RULESET_CONFIG'
rule_name = '$rule_name'
status = '$status'

try:
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f) or {}
except:
    config = {}

if 'rules' not in config:
    config['rules'] = {}

config['rules'][rule_name] = {'enabled': status == 'enabled'}

with open(config_file, 'w') as f:
    yaml.dump(config, f, default_flow_style=False)

print(f'Rule {rule_name} {status}')
EOF
    else
        # 简单实现
        echo "# RuleSet Configuration" > "$RULESET_CONFIG"
        echo "rules:" >> "$RULESET_CONFIG"
        echo "  $rule_name:" >> "$RULESET_CONFIG"
        echo "    enabled: $([[ "$status" == "enabled" ]] && echo "true" || echo "false")" >> "$RULESET_CONFIG"
    fi

    log_success "Rule '$rule_name' is now $status"
}

# ==================== Check Command ====================

cmd_check() {
    local target="$1"

    if [[ -z "$target" ]]; then
        log_error "Target file or directory required"
        echo "Usage: ruleset.sh check <file|directory>"
        exit 1
    fi

    if [[ ! -e "$target" ]]; then
        log_error "Target not found: $target"
        exit 1
    fi

    log_section "Checking Rules: $target"

    local violations=0
    local warnings=0
    local errors=0

    # 获取要检查的文件列表
    local files=()
    if [[ -d "$target" ]]; then
        while IFS= read -r file; do
            files+=("$file")
        done < <(find "$target" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" -o -name "*.json" -o -name "*.md" \) 2>/dev/null)
    else
        files+=("$target")
    fi

    log_info "Checking ${#files[@]} files..."
    echo ""

    # 加载所有规则
    local rule_files=$(get_rule_files)

    for file in "${files[@]}"; do
        local file_violations=0

        for rule_file in $rule_files; do
            eval "$(parse_rule "$rule_file")"

            # 检查规则是否启用
            if [[ -f "$RULESET_CONFIG" ]]; then
                local rule_enabled=$(grep -A1 "^  $NAME:" "$RULESET_CONFIG" 2>/dev/null | grep "enabled:" | grep -q "true" && echo "true" || echo "true")
                # 默认启用
            fi

            # 检查文件类型匹配
            local file_ext="${file##*.}"
            local should_check=false

            case "$LANGUAGE" in
                typescript)
                    [[ "$file_ext" == "ts" || "$file_ext" == "tsx" ]] && should_check=true
                    ;;
                javascript)
                    [[ "$file_ext" == "js" || "$file_ext" == "jsx" ]] && should_check=true
                    ;;
                shell)
                    [[ "$file_ext" == "sh" ]] && should_check=true
                    ;;
                common)
                    should_check=true
                    ;;
                *)
                    should_check=true
                    ;;
            esac

            if [[ "$should_check" == true ]]; then
                # 执行规则检查
                local result=$(check_rule "$rule_file" "$file")
                if [[ -n "$result" ]]; then
                    local severity_color="$YELLOW"
                    [[ "$SEVERITY" == "error" ]] && severity_color="$RED"

                    echo -e "  ${severity_color}[$SEVERITY]${NC} $NAME in $(basename "$file")"
                    echo "    $result"

                    violations=$((violations + 1))
                    [[ "$SEVERITY" == "error" ]] && errors=$((errors + 1))
                    [[ "$SEVERITY" == "warning" ]] && warnings=$((warnings + 1))
                fi
            fi
        done
    done

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Check Complete"
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Files checked: ${#files[@]}"
    echo "  Violations: $violations"
    echo "    Errors: $errors"
    echo "    Warnings: $warnings"
    echo "═══════════════════════════════════════════════════════════════"

    if [[ $errors -gt 0 ]]; then
        exit 1
    fi
}

# 检查单个规则
check_rule() {
    local rule_file="$1"
    local target_file="$2"

    # 读取规则模式
    local patterns=$(grep -A10 "^patterns:" "$rule_file" 2>/dev/null | grep "pattern:" | cut -d':' -f2- | xargs || true)

    if [[ -z "$patterns" ]]; then
        # 尝试其他检测方式
        local max_lines=$(grep "max_lines:" "$rule_file" | cut -d':' -f2 | xargs || echo "")
        if [[ -n "$max_lines" ]]; then
            # 函数大小检查
            local actual_lines=$(wc -l < "$target_file")
            if [[ $actual_lines -gt $max_lines ]]; then
                echo "File too long: $actual_lines lines (max: $max_lines)"
            fi
        fi
        return
    fi

    # 检查模式匹配
    for pattern in $patterns; do
        if grep -qE "$pattern" "$target_file" 2>/dev/null; then
            echo "Pattern matched: $pattern"
            return
        fi
    done
}

# ==================== Init Command ====================

cmd_init() {
    log_section "Initializing RuleSet Configuration"

    # 创建默认规则集配置
    cat > "$RULESET_CONFIG" << 'EOF'
# RuleSet Configuration
# 规则集配置文件

# 全局设置
global:
  # 默认规则行为
  default_severity: warning
  # 是否启用所有规则
  enable_all: true
  # 排除的文件模式
  exclude:
    - "node_modules/**"
    - ".git/**"
    - "runtime/**"
    - "*.min.js"
    - "*.test.ts"

# 规则配置
rules:
  # TypeScript 规则
  function-size-limit:
    enabled: true
    severity: warning
    parameters:
      max_lines: 50
      max_statements: 30

  type-safety:
    enabled: true
    severity: error

  # 安全规则
  no-hardcoded-secrets:
    enabled: true
    severity: error

  no-eval:
    enabled: true
    severity: error

# 规则集组合
sets:
  strict:
    description: "严格模式 - 所有规则都作为错误"
    rules:
      - function-size-limit
      - type-safety
      - no-hardcoded-secrets
    severity_override: error

  relaxed:
    description: "宽松模式 - 仅关键错误检查"
    rules:
      - no-hardcoded-secrets
      - no-eval

  security:
    description: "安全模式 - 仅安全检查"
    rules:
      - no-hardcoded-secrets
      - no-eval
EOF

    log_success "RuleSet configuration created: $RULESET_CONFIG"
}

# ==================== Main ====================

show_help() {
    cat << EOF
Usage: ruleset.sh <command> [options]

RuleSet management commands:

  list                  List all available rules
    --category <cat>    Filter by category
    --language <lang>   Filter by language

  show <rule>           Show rule details

  enable <rule>         Enable a rule

  disable <rule>        Disable a rule

  check <target>        Check file/directory against rules

  init                  Initialize ruleset configuration

Examples:
  ruleset.sh list
  ruleset.sh list --category security
  ruleset.sh show no-hardcoded-secrets
  ruleset.sh enable type-safety
  ruleset.sh check ./src
  ruleset.sh init

EOF
}

main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    local command="$1"
    shift

    # 确保目录存在
    mkdir -p "$RULES_DIR"

    case "$command" in
        list)
            local category=""
            local language=""

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --category)
                        category="$2"
                        shift 2
                        ;;
                    --language)
                        language="$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            cmd_list "$category" "$language"
            ;;

        show)
            cmd_show "$1"
            ;;

        enable)
            cmd_enable "$1"
            ;;

        disable)
            cmd_disable "$1"
            ;;

        check)
            cmd_check "$1"
            ;;

        init)
            cmd_init
            ;;

        help|--help|-h)
            show_help
            ;;

        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
