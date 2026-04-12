#!/bin/bash
# skill-run.sh - 执行指定技能
#
# Usage: skill-run.sh <skill-name> [options]
#   --input <file>      输入文件
#   --output <file>     输出文件
#   --params <json>     JSON格式的参数
#   --dry-run           模拟执行，不实际运行
#   --verbose           显示详细输出
#   --help              显示帮助

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="${PROJECT_ROOT}/skills"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"
MEMORY_DIR="${PROJECT_ROOT}/memory"

# 默认配置
SKILL_NAME=""
INPUT_FILE=""
OUTPUT_FILE=""
PARAMS="{}"
DRY_RUN=false
VERBOSE=false
INTERACTIVE=false

# 执行统计
START_TIME=$(date +%s)
END_TIME=0
EXIT_CODE=0

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

log_step() {
    echo -e "${CYAN}→${NC} $1"
}

# 显示帮助
show_help() {
    cat << EOF
Usage: $(basename "$0") <skill-name> [options]

执行指定的技能，支持参数传递和结果输出。

Arguments:
  skill-name          要执行的技能名称

Options:
  --input <file>      指定输入文件
  --output <file>     指定输出文件
  --params <json>     JSON格式的参数 (例如: '{"key":"value"}')
  --env <key=value>   设置环境变量
  --dry-run           模拟执行，不实际运行
  --interactive       交互式执行，提示输入参数
  --verbose           显示详细输出
  --help              显示此帮助

Examples:
  $(basename "$0") react-hooks                    # 执行 react-hooks 技能
  $(basename "$0") typescript-patterns --dry-run  # 模拟执行
  $(basename "$0") security-scan --input src/     # 带输入目录
  $(basename "$0") documentation-lookup --params '{"topic":"hooks"}'

EOF
}

# 解析参数
parse_args() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    SKILL_NAME="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            --input)
                INPUT_FILE="$2"
                shift 2
                ;;
            --output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --params)
                PARAMS="$2"
                shift 2
                ;;
            --env)
                local env_var="$2"
                export "$env_var"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --interactive)
                INTERACTIVE=true
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
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 验证技能存在
validate_skill() {
    local skill_path="${SKILLS_DIR}/${SKILL_NAME}"
    local skill_yaml="${skill_path}/skill.yaml"

    if [[ ! -d "$skill_path" ]]; then
        log_error "Skill not found: $SKILL_NAME"
        log_info "Available skills:"
        list_available_skills
        exit 1
    fi

    if [[ ! -f "$skill_yaml" ]]; then
        log_error "Skill configuration not found: $skill_yaml"
        exit 1
    fi

    echo "$skill_path"
}

# 列出可用技能
list_available_skills() {
    for dir in "$SKILLS_DIR"/*/; do
        if [[ -f "${dir}skill.yaml" ]]; then
            local name=$(basename "$dir")
            echo "  - $name"
        fi
    done
}

# 解析技能配置
parse_skill_config() {
    local skill_yaml="$1"

    if command -v python3 &> /dev/null; then
        python3 -c "
import yaml
import json
try:
    with open('$skill_yaml', 'r') as f:
        data = yaml.safe_load(f)
        if data:
            print('NAME=' + str(data.get('name', '')))
            print('DESCRIPTION=' + str(data.get('description', '')))
            print('VERSION=' + str(data.get('version', '1.0.0')))
            print('TYPE=' + str(data.get('type', 'script')))
            # 获取入口点
            exec = data.get('execution', {})
            print('ENTRY=' + str(exec.get('entry', '')))
            print('LANGUAGE=' + str(exec.get('language', 'bash')))
            # 获取参数定义
            params = data.get('parameters', [])
            print('PARAMS_COUNT=' + str(len(params)))
except Exception as e:
    print('NAME=')
    print('DESCRIPTION=')
    print('VERSION=1.0.0')
    print('TYPE=script')
    print('ENTRY=')
    print('LANGUAGE=bash')
    print('PARAMS_COUNT=0')
" 2>/dev/null
    else
        echo "NAME="
        echo "DESCRIPTION="
        echo "VERSION=1.0.0"
        echo "TYPE=script"
        echo "ENTRY="
        echo "LANGUAGE=bash"
        echo "PARAMS_COUNT=0"
    fi
}

# 交互式收集参数
interactive_params() {
    local skill_yaml="$1"

    if ! command -v python3 &> /dev/null; then
        log_warning "Python3 not available, skipping interactive parameter collection"
        return
    fi

    log_info "Interactive parameter collection"
    echo ""

    local params_json="{"
    local first=true

    python3 -c "
import yaml
try:
    with open('$skill_yaml', 'r') as f:
        data = yaml.safe_load(f)
        params = data.get('parameters', [])
        for p in params:
            name = p.get('name', '')
            desc = p.get('description', '')
            required = p.get('required', False)
            default = p.get('default', '')
            print(f'PARAM:{name}:{desc}:{required}:{default}')
except Exception as e:
    pass
" 2>/dev/null | while IFS=: read -r prefix name desc required default; do
        if [[ "$prefix" == "PARAM" ]]; then
            echo ""
            echo -n "  $name"
            [[ "$required" == "True" ]] && echo -n " (required)"
            [[ -n "$default" ]] && echo -n " [default: $default]"
            echo ""
            echo "  $desc"
            echo -n "  Value: "
            read -r value

            if [[ -z "$value" && -n "$default" ]]; then
                value="$default"
            fi

            if [[ -n "$value" ]]; then
                if [[ "$first" == true ]]; then
                    first=false
                else
                    params_json+=","
                fi
                params_json+="\"$name\":\"$value\""
            fi
        fi
    done

    params_json+="}"
    PARAMS="$params_json"
}

# 执行技能
execute_skill() {
    local skill_path="$1"
    local skill_yaml="${skill_path}/skill.yaml"

    # 加载配置
    log_step "Loading skill configuration..."
    eval "$(parse_skill_config "$skill_yaml")"

    if [[ "$VERBOSE" == true ]]; then
        log_info "Skill: $NAME"
        log_info "Description: $DESCRIPTION"
        log_info "Version: $VERSION"
        log_info "Type: $TYPE"
        log_info "Entry: $ENTRY"
        log_info "Language: $LANGUAGE"
    fi

    # 检查入口文件
    local entry_path="${skill_path}/${ENTRY}"
    if [[ ! -f "$entry_path" ]]; then
        log_error "Entry file not found: $entry_path"
        exit 1
    fi

    # 模拟执行
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN MODE - No actual execution"
        echo ""
        echo "Would execute:"
        echo "  Skill: $NAME"
        echo "  Entry: $entry_path"
        echo "  Params: $PARAMS"
        [[ -n "$INPUT_FILE" ]] && echo "  Input: $INPUT_FILE"
        [[ -n "$OUTPUT_FILE" ]] && echo "  Output: $OUTPUT_FILE"
        return 0
    fi

    # 记录遥测
    record_telemetry "start"

    # 执行技能
    log_step "Executing skill: $NAME..."
    echo ""

    local output_temp="${RUNTIME_DIR}/skill-output-$$.txt"
    mkdir -p "$RUNTIME_DIR"

    # 设置环境变量
    export SKILL_NAME="$NAME"
    export SKILL_PARAMS="$PARAMS"
    export SKILL_INPUT="$INPUT_FILE"
    export SKILL_OUTPUT="$OUTPUT_FILE"
    export SKILL_PATH="$skill_path"

    case "$LANGUAGE" in
        bash|sh)
            if [[ -n "$OUTPUT_FILE" ]]; then
                bash "$entry_path" > "$output_temp" 2>&1
                EXIT_CODE=$?
                cp "$output_temp" "$OUTPUT_FILE"
            else
                bash "$entry_path"
                EXIT_CODE=$?
            fi
            ;;
        python|python3)
            if ! command -v python3 &> /dev/null; then
                log_error "Python3 not available"
                exit 1
            fi
            if [[ -n "$OUTPUT_FILE" ]]; then
                python3 "$entry_path" > "$output_temp" 2>&1
                EXIT_CODE=$?
                cp "$output_temp" "$OUTPUT_FILE"
            else
                python3 "$entry_path"
                EXIT_CODE=$?
            fi
            ;;
        node|javascript)
            if ! command -v node &> /dev/null; then
                log_error "Node.js not available"
                exit 1
            fi
            if [[ -n "$OUTPUT_FILE" ]]; then
                node "$entry_path" > "$output_temp" 2>&1
                EXIT_CODE=$?
                cp "$output_temp" "$OUTPUT_FILE"
            else
                node "$entry_path"
                EXIT_CODE=$?
            fi
            ;;
        *)
            # 尝试直接执行
            chmod +x "$entry_path"
            if [[ -n "$OUTPUT_FILE" ]]; then
                "$entry_path" > "$output_temp" 2>&1
                EXIT_CODE=$?
                cp "$output_temp" "$OUTPUT_FILE"
            else
                "$entry_path"
                EXIT_CODE=$?
            fi
            ;;
    esac

    # 清理临时文件
    rm -f "$output_temp"

    # 记录遥测
    record_telemetry "end"

    return $EXIT_CODE
}

# 记录遥测
record_telemetry() {
    local event="$1"

    if [[ -f "${PROJECT_ROOT}/hooks/skill-usage.sh" ]]; then
        local timestamp=$(date -Iseconds)

        if [[ "$event" == "start" ]]; then
            # 记录开始
            echo "{\"event\":\"skill_start\",\"skill\":\"$SKILL_NAME\",\"timestamp\":\"$timestamp\",\"params\":$PARAMS}" >> \
                "${RUNTIME_DIR}/skill-events.jsonl" 2>/dev/null || true
        else
            # 记录结束
            local duration=$(($(date +%s) - START_TIME))
            echo "{\"event\":\"skill_end\",\"skill\":\"$SKILL_NAME\",\"timestamp\":\"$timestamp\",\"duration\":$duration,\"exit_code\":$EXIT_CODE}" >> \
                "${RUNTIME_DIR}/skill-events.jsonl" 2>/dev/null || true
        fi
    fi
}

# 显示执行结果
show_result() {
    local exit_code=$1
    END_TIME=$(date +%s)
    local duration=$((END_TIME - START_TIME))

    echo ""
    echo "═══════════════════════════════════════════════════════════════"

    if [[ $exit_code -eq 0 ]]; then
        log_success "Skill execution completed successfully"
    else
        log_error "Skill execution failed (exit code: $exit_code)"
    fi

    echo "  Skill:      $SKILL_NAME"
    echo "  Duration:   ${duration}s"
    [[ -n "$INPUT_FILE" ]] && echo "  Input:      $INPUT_FILE"
    [[ -n "$OUTPUT_FILE" ]] && echo "  Output:     $OUTPUT_FILE"
    echo "═══════════════════════════════════════════════════════════════"
}

# 主函数
main() {
    parse_args "$@"

    # 验证并获取技能路径
    local skill_path=$(validate_skill)
    local skill_yaml="${skill_path}/skill.yaml"

    # 交互式参数收集
    if [[ "$INTERACTIVE" == true ]]; then
        interactive_params "$skill_yaml"
    fi

    # 执行技能
    execute_skill "$skill_path"
    local exit_code=$?

    # 显示结果
    show_result $exit_code

    exit $exit_code
}

main "$@"
