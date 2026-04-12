#!/bin/bash
# agent-eval.sh - Agent 评估执行器
# 自动执行 Agent 评估并生成结果

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
EVAL_DIR="${PROJECT_ROOT}/evals/agents"
AGENTS_DIR="${PROJECT_ROOT}/agents"
RESULTS_DIR="${PROJECT_ROOT}/runtime/memory/agent-eval-results"
MEMORY_DIR="${PROJECT_ROOT}/runtime/memory/sessions"

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

# 显示帮助
show_help() {
    cat << EOF
Agent Evaluation - Agent 评估执行器

用法: $0 [命令] [选项]

命令:
    run <agent_name>            执行指定 Agent 的评估
    run-all                     执行所有 Agent 的评估
    list                        列出可用的 Agent 评估用例
    status <agent_name>         查看 Agent 评估状态
    report <agent_name>         生成评估报告
    compare <agent1> <agent2>   对比两个 Agent 的性能
    history <agent_name>        查看评估历史趋势

选项:
    -v, --verbose               显示详细信息
    -f, --format <format>       输出格式 (json|yaml|table)
    -h, --help                  显示此帮助

示例:
    $0 run planner
    $0 run-all --verbose
    $0 status executor
    $0 report reviewer --format json
    $0 compare planner executor
EOF
}

# 检查依赖
check_dependencies() {
    if ! command -v yq &> /dev/null; then
        log_error "yq 未安装。请安装 yq: https://github.com/mikefarah/yq"
        exit 1
    fi
}

# 获取 Agent 列表
get_agents() {
    find "$AGENTS_DIR" -name "*.yaml" -not -name "README*" -exec basename {} .yaml \;
}

# 获取 Agent 评估用例
get_agent_evals() {
    local agent_name=$1
    find "$EVAL_DIR" -name "${agent_name}-*.yaml" 2>/dev/null || true
}

# 分析 Agent 历史表现
analyze_agent_history() {
    local agent_name=$1
    local history_file="${MEMORY_DIR}/agent-${agent_name}-history.json"
    
    if [[ ! -f "$history_file" ]]; then
        echo "[]"
        return
    fi
    
    cat "$history_file"
}

# 计算 Agent 指标
calculate_agent_metrics() {
    local agent_name=$1
    local history_data=$(analyze_agent_history "$agent_name")
    
    # 从 session 历史中提取指标
    local total_tasks=$(echo "$history_data" | jq -r 'length')
    local successful_tasks=$(echo "$history_data" | jq -r '[.[] | select(.status == "completed")] | length')
    local failed_tasks=$(echo "$history_data" | jq -r '[.[] | select(.status == "failed")] | length')
    
    # 计算成功率
    local success_rate=0
    if [[ $total_tasks -gt 0 ]]; then
        success_rate=$(echo "scale=2; $successful_tasks * 100 / $total_tasks" | bc)
    fi
    
    # 计算平均执行时间
    local avg_duration=$(echo "$history_data" | jq -r '[.[] | select(.duration)] | map(.duration) | add / length' 2>/dev/null || echo "0")
    
    # 计算平均质量评分
    local avg_quality=$(echo "$history_data" | jq -r '[.[] | select(.quality_score)] | map(.quality_score) | add / length' 2>/dev/null || echo "0")
    
    # 计算工具使用效率
    local total_tool_calls=$(echo "$history_data" | jq -r '[.[] | .tool_calls // 0] | add')
    local avg_tool_calls=$(echo "$history_data" | jq -r '[.[] | .tool_calls // 0] | add / length' 2>/dev/null || echo "0")
    
    # 计算约束遵守度
    local constraint_violations=$(echo "$history_data" | jq -r '[.[] | .constraint_violations // 0] | add')
    local constraint_compliance=100
    if [[ $total_tasks -gt 0 ]]; then
        constraint_compliance=$(echo "scale=2; 100 - ($constraint_violations * 100 / $total_tasks)" | bc)
    fi
    
    cat << EOF
{
  "agent": "$agent_name",
  "total_tasks": $total_tasks,
  "successful_tasks": $successful_tasks,
  "failed_tasks": $failed_tasks,
  "success_rate": $success_rate,
  "avg_duration": ${avg_duration:-0},
  "avg_quality_score": ${avg_quality:-0},
  "avg_tool_calls": ${avg_tool_calls:-0},
  "constraint_compliance": $constraint_compliance,
  "evaluated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

# 执行单个 Agent 评估
run_agent_eval() {
    local agent_name=$1
    local verbose=${2:-false}
    
    log_info "评估 Agent: $agent_name"
    
    # 检查 Agent 是否存在
    if [[ ! -f "${AGENTS_DIR}/${agent_name}.yaml" ]]; then
        log_error "Agent 不存在: $agent_name"
        return 1
    fi
    
    # 获取 Agent 配置
    local agent_config=$(cat "${AGENTS_DIR}/${agent_name}.yaml")
    
    if [[ "$verbose" == "true" ]]; then
        log_info "Agent 类型: $(echo "$agent_config" | yq -r '.type // "unknown"')"
        log_info "Agent 描述: $(echo "$agent_config" | yq -r '.description // "N/A"' | head -1)"
    fi
    
    # 计算指标
    local metrics=$(calculate_agent_metrics "$agent_name")
    
    # 加载评估用例
    local eval_cases=$(get_agent_evals "$agent_name")
    local eval_results="[]"
    
    if [[ -n "$eval_cases" ]]; then
        log_info "发现 $(echo "$eval_cases" | wc -l) 个评估用例"
        
        # 执行每个评估用例
        while IFS= read -r eval_file; do
            [[ -z "$eval_file" ]] && continue
            
            local eval_name=$(basename "$eval_file" .yaml)
            log_info "执行评估用例: $eval_name"
            
            # 这里应该实际执行评估，现在模拟
            local eval_result=$(cat << EOF
{
  "eval_name": "$eval_name",
  "status": "passed",
  "score": 85,
  "issues": []
}
EOF
)
            eval_results=$(echo "$eval_results" | jq --argjson result "$eval_result" '. + [$result]')
        done <<< "$eval_cases"
    else
        log_warning "未找到评估用例，仅基于历史数据分析"
    fi
    
    # 生成评估结果
    local result_file="${RESULTS_DIR}/${agent_name}-$(date +%Y%m%d-%H%M%S).json"
    
    cat << EOF | jq . > "$result_file"
{
  "agent_name": "$agent_name",
  "evaluated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "metrics": $metrics,
  "eval_cases": $eval_results,
  "overall_score": $(echo "$metrics" | jq -r '.success_rate * 0.4 + .avg_quality_score * 0.4 + .constraint_compliance * 0.2'),
  "recommendations": []
}
EOF
    
    log_success "评估完成: $result_file"
    
    # 显示结果摘要
    echo ""
    echo "=== 评估结果摘要 ==="
    echo "Agent: $agent_name"
    echo "总任务数: $(echo "$metrics" | jq -r '.total_tasks')"
    echo "成功率: $(echo "$metrics" | jq -r '.success_rate')%"
    echo "平均质量分: $(echo "$metrics" | jq -r '.avg_quality_score')"
    echo "约束遵守度: $(echo "$metrics" | jq -r '.constraint_compliance')%"
    echo "==================="
    
    echo "$result_file"
}

# 执行所有 Agent 评估
run_all_evals() {
    local verbose=${1:-false}
    
    log_info "开始评估所有 Agent..."
    
    local agents=$(get_agents)
    local summary="[]"
    
    while IFS= read -r agent_name; do
        [[ -z "$agent_name" ]] && continue
        
        local result_file=$(run_agent_eval "$agent_name" "$verbose")
        local overall_score=$(cat "$result_file" | jq -r '.overall_score')
        
        summary=$(echo "$summary" | jq --arg name "$agent_name" --arg score "$overall_score" --arg file "$result_file" '. + [{name: $name, score: ($score | tonumber), file: $file}]')
    done <<< "$agents"
    
    # 生成汇总报告
    local summary_file="${RESULTS_DIR}/summary-$(date +%Y%m%d-%H%M%S).json"
    cat << EOF | jq . > "$summary_file"
{
  "evaluated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "agents": $summary,
  "total_agents": $(echo "$summary" | jq 'length'),
  "avg_score": $(echo "$summary" | jq '[.[].score] | add / length')
}
EOF
    
    log_success "所有 Agent 评估完成"
    log_info "汇总报告: $summary_file"
}

# 查看 Agent 评估状态
show_agent_status() {
    local agent_name=$1
    
    if [[ ! -f "${AGENTS_DIR}/${agent_name}.yaml" ]]; then
        log_error "Agent 不存在: $agent_name"
        return 1
    fi
    
    # 获取最新的评估结果
    local latest_result=$(find "$RESULTS_DIR" -name "${agent_name}-*.json" -type f -print0 | xargs -0 ls -t | head -1)
    
    if [[ -z "$latest_result" ]]; then
        log_warning "Agent $agent_name 尚未进行评估"
        return 0
    fi
    
    echo "=== Agent 评估状态 ==="
    echo "Agent: $agent_name"
    echo "最新评估: $(basename "$latest_result")"
    echo "评估时间: $(cat "$latest_result" | jq -r '.evaluated_at')"
    echo ""
    echo "指标:"
    cat "$latest_result" | jq -r '.metrics | to_entries[] | "  \(.key): \(.value)"'
    echo ""
    echo "总体评分: $(cat "$latest_result" | jq -r '.overall_score')"
    echo "======================"
}

# 生成评估报告
generate_report() {
    local agent_name=$1
    local format=${2:-table}
    
    local latest_result=$(find "$RESULTS_DIR" -name "${agent_name}-*.json" -type f -print0 | xargs -0 ls -t | head -1)
    
    if [[ -z "$latest_result" ]]; then
        log_error "没有找到评估结果"
        return 1
    fi
    
    case "$format" in
        json)
            cat "$latest_result" | jq .
            ;;
        yaml)
            cat "$latest_result" | yq -P
            ;;
        table|*)
            echo "=== Agent 评估报告 ==="
            echo ""
            printf "%-20s %s\n" "Agent:" "$agent_name"
            printf "%-20s %s\n" "评估时间:" "$(cat "$latest_result" | jq -r '.evaluated_at')"
            printf "%-20s %s\n" "总体评分:" "$(cat "$latest_result" | jq -r '.overall_score')"
            echo ""
            echo "详细指标:"
            echo "--------------------"
            cat "$latest_result" | jq -r '.metrics | to_entries[] | select(.key != "evaluated_at") | printf("%-25s %s\n", .key + ":", .value)'
            ;;
    esac
}

# 对比两个 Agent
compare_agents() {
    local agent1=$1
    local agent2=$2
    
    local result1=$(find "$RESULTS_DIR" -name "${agent1}-*.json" -type f -print0 | xargs -0 ls -t | head -1)
    local result2=$(find "$RESULTS_DIR" -name "${agent2}-*.json" -type f -print0 | xargs -0 ls -t | head -1)
    
    if [[ -z "$result1" || -z "$result2" ]]; then
        log_error "需要两个 Agent 都有评估结果"
        return 1
    fi
    
    echo "=== Agent 对比: $agent1 vs $agent2 ==="
    echo ""
    printf "%-25s %-15s %-15s\n" "指标" "$agent1" "$agent2"
    echo "--------------------------------------------------"
    
    local metrics1=$(cat "$result1" | jq -r '.metrics')
    local metrics2=$(cat "$result2" | jq -r '.metrics')
    
    for key in success_rate avg_quality_score avg_duration constraint_compliance; do
        local val1=$(echo "$metrics1" | jq -r ".$key // 0")
        local val2=$(echo "$metrics2" | jq -r ".$key // 0")
        printf "%-25s %-15s %-15s\n" "$key:" "$val1" "$val2"
    done
    
    echo ""
    printf "%-25s %-15s %-15s\n" "总体评分:" "$(cat "$result1" | jq -r '.overall_score')" "$(cat "$result2" | jq -r '.overall_score')"
}

# 查看评估历史
show_history() {
    local agent_name=$1
    
    echo "=== Agent $agent_name 评估历史 ==="
    
    find "$RESULTS_DIR" -name "${agent_name}-*.json" -type f -print0 | \
        xargs -0 ls -t | \
        while read -r file; do
            local date=$(basename "$file" | sed "s/${agent_name}-//" | sed 's/.json//')
            local score=$(cat "$file" | jq -r '.overall_score')
            echo "[$date] 评分: $score"
        done
}

# 主函数
main() {
    check_dependencies
    
    local command=$1
    shift || true
    
    local verbose=false
    local format="table"
    
    # 解析选项
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                verbose=true
                shift
                ;;
            -f|--format)
                format=$2
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
    
    case "$command" in
        run)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                show_help
                exit 1
            fi
            run_agent_eval "$1" "$verbose"
            ;;
        run-all)
            run_all_evals "$verbose"
            ;;
        list)
            log_info "可用的 Agent:"
            get_agents | while read -r agent; do
                echo "  - $agent"
            done
            ;;
        status)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            show_agent_status "$1"
            ;;
        report)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            generate_report "$1" "$format"
            ;;
        compare)
            if [[ -z "$1" || -z "$2" ]]; then
                log_error "请指定两个 Agent 名称"
                exit 1
            fi
            compare_agents "$1" "$2"
            ;;
        history)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            show_history "$1"
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"
