#!/bin/bash
#
# Task Router - 动态路由决策引擎
# 基于任务特征选择最优的 Sub-Agent 编排策略
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 引入 Sub-Agent Manager
source "${PROJECT_ROOT}/runtime/orchestration/subagents/subagent-manager.sh"

# 路由配置
ROUTING_CONFIG="${PROJECT_ROOT}/runtime/orchestration/routing/routing-config.yaml"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[ROUTER]${NC} $1"
}

log_decision() {
    echo -e "${CYAN}[DECISION]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 分析任务特征
analyze_task() {
    local task_description="$1"
    
    log_info "Analyzing task characteristics..."
    
    # 初始化特征分数
    local complexity=0
    local has_dependencies=false
    local requires_specialization=false
    local scope="small"
    
    # 复杂度分析（基于关键词）
    local complexity_keywords=("implement" "design" "architecture" "refactor" "integrate" "migrate")
    for keyword in "${complexity_keywords[@]}"; do
        if echo "$task_description" | grep -qi "$keyword"; then
            ((complexity+=2))
        fi
    done
    
    # 依赖分析
    local dep_keywords=("after" "before" "depends" "prerequisite" "following")
    for keyword in "${dep_keywords[@]}"; do
        if echo "$task_description" | grep -qi "$keyword"; then
            has_dependencies=true
            break
        fi
    done
    
    # 专业化需求分析
    local spec_keywords=("security" "performance" "database" "frontend" "backend" "devops")
    for keyword in "${spec_keywords[@]}"; do
        if echo "$task_description" | grep -qi "$keyword"; then
            requires_specialization=true
            break
        fi
    done
    
    # 范围分析（基于任务长度和关键词数量）
    local word_count
    word_count=$(echo "$task_description" | wc -w)
    if [[ $word_count -gt 50 ]]; then
        scope="large"
    elif [[ $word_count -gt 20 ]]; then
        scope="medium"
    fi
    
    # 输出分析结果
    cat << EOF
{
  "complexity": $complexity,
  "has_dependencies": $has_dependencies,
  "requires_specialization": $requires_specialization,
  "scope": "$scope",
  "word_count": $word_count
}
EOF
}

# 选择路由策略
select_routing_strategy() {
    local task_analysis="$1"
    
    local complexity
    complexity=$(echo "$task_analysis" | grep "complexity" | sed 's/.*: \([0-9]*\).*/\1/')
    
    local has_dependencies
    has_dependencies=$(echo "$task_analysis" | grep "has_dependencies" | grep -q "true" && echo "true" || echo "false")
    
    local requires_specialization
    requires_specialization=$(echo "$task_analysis" | grep "requires_specialization" | grep -q "true" && echo "true" || echo "false")
    
    local scope
    scope=$(echo "$task_analysis" | grep "scope" | sed 's/.*: "\([^"]*\)".*/\1/')
    
    log_info "Selecting routing strategy based on analysis..."
    
    # 决策逻辑
    if [[ "$requires_specialization" == "true" ]]; then
        echo "specialized_agent"
        return 0
    fi
    
    if [[ "$has_dependencies" == "true" ]]; then
        echo "sequential_pipeline"
        return 0
    fi
    
    if [[ "$scope" == "large" ]] && [[ $complexity -gt 5 ]]; then
        echo "hierarchical_delegation"
        return 0
    fi
    
    if [[ $complexity -gt 3 ]] || [[ "$scope" == "medium" ]]; then
        echo "parallel_decomposition"
        return 0
    fi
    
    # 默认策略
    echo "single_agent"
}

# 并行分解策略
execute_parallel_decomposition() {
    local task_description="$1"
    local parent_session_id="$2"
    
    log_decision "Using PARALLEL DECOMPOSITION strategy"
    
    # 分解任务（简化版，实际应由 LLM 完成）
    local subtasks=(
        "Analyze requirements for: $task_description"
        "Design solution for: $task_description"
        "Implement core logic for: $task_description"
        "Write tests for: $task_description"
    )
    
    local subagent_ids=()
    
    # 并行创建 Sub-Agent
    for subtask in "${subtasks[@]}"; do
        local agent_type="executor"
        if [[ "$subtask" == *"Analyze"* ]]; then
            agent_type="planner"
        elif [[ "$subtask" == *"Design"* ]]; then
            agent_type="planner"
        fi
        
        local subagent_id
        subagent_id=$(create_subagent "$agent_type" "$subtask" "$parent_session_id" "partial_isolation")
        subagent_ids+=("$subagent_id")
        log_info "Created subagent: $subagent_id"
    done
    
    # 返回所有 Sub-Agent ID
    echo "${subagent_ids[*]}"
}

# 顺序管道策略
execute_sequential_pipeline() {
    local task_description="$1"
    local parent_session_id="$2"
    
    log_decision "Using SEQUENTIAL PIPELINE strategy"
    
    # 定义管道阶段
    local stages=(
        "planner:Analyze and plan: $task_description"
        "reviewer:Review the plan for: $task_description"
        "executor:Implement: $task_description"
        "evaluator:Evaluate implementation of: $task_description"
    )
    
    local subagent_ids=()
    local prev_subagent_id=""
    
    for stage in "${stages[@]}"; do
        IFS=':' read -r agent_type task <<< "$stage"
        
        local isolation="partial_isolation"
        if [[ -n "$prev_subagent_id" ]]; then
            # 顺序执行时，后续阶段可以访问前一个阶段的结果
            isolation="shared_context"
        fi
        
        local subagent_id
        subagent_id=$(create_subagent "$agent_type" "$task" "$parent_session_id" "$isolation")
        subagent_ids+=("$subagent_id")
        prev_subagent_id="$subagent_id"
        
        log_info "Created pipeline stage: $agent_type -> $subagent_id"
        
        # 在实际实现中，这里应该等待前一个阶段完成
        # 简化版：仅记录依赖关系
    done
    
    echo "${subagent_ids[*]}"
}

# 层级委托策略
execute_hierarchical_delegation() {
    local task_description="$1"
    local parent_session_id="$2"
    
    log_decision "Using HIERARCHICAL DELEGATION strategy"
    
    # 创建主 Sub-Agent（Lead）
    local lead_subagent_id
    lead_subagent_id=$(create_subagent "planner" "Lead coordination for: $task_description" "$parent_session_id" "partial_isolation")
    log_info "Created lead subagent: $lead_subagent_id"
    
    # 主 Sub-Agent 会进一步分解任务并创建子 Sub-Agent
    # 这里简化处理，直接创建几个子任务
    local subtasks=(
        "Handle data layer for: $task_description"
        "Handle business logic for: $task_description"
        "Handle presentation layer for: $task_description"
    )
    
    local child_ids=()
    for subtask in "${subtasks[@]}"; do
        local child_id
        child_id=$(create_subagent "executor" "$subtask" "$lead_subagent_id" "shared_context")
        child_ids+=("$child_id")
        log_info "Created child subagent: $child_id"
    done
    
    echo "$lead_subagent_id ${child_ids[*]}"
}

# 专业化代理策略
execute_specialized_agent() {
    local task_description="$1"
    local parent_session_id="$2"
    
    log_decision "Using SPECIALIZED AGENT strategy"
    
    # 识别专业化领域
    local specialization="general"
    
    if echo "$task_description" | grep -qi "security"; then
        specialization="security"
    elif echo "$task_description" | grep -qi "performance"; then
        specialization="performance"
    elif echo "$task_description" | grep -qi "database\|sql"; then
        specialization="database"
    elif echo "$task_description" | grep -qi "frontend\|ui\|react\|vue"; then
        specialization="frontend"
    elif echo "$task_description" | grep -qi "backend\|api\|server"; then
        specialization="backend"
    fi
    
    log_info "Detected specialization: $specialization"
    
    # 创建专业化 Sub-Agent
    local subagent_id
    subagent_id=$(create_subagent "executor" "[$specialization] $task_description" "$parent_session_id" "partial_isolation")
    
    # 记录专业化信息
    local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
    cat >> "$subagent_dir/config.yaml" << EOF
specialization:
  domain: "$specialization"
  confidence: 0.85
EOF
    
    echo "$subagent_id"
}

# 单代理策略（默认）
execute_single_agent() {
    local task_description="$1"
    local parent_session_id="$2"
    
    log_decision "Using SINGLE AGENT strategy"
    
    local subagent_id
    subagent_id=$(create_subagent "executor" "$task_description" "$parent_session_id" "partial_isolation")
    
    echo "$subagent_id"
}

# 主路由函数
route_task() {
    local task_description="$1"
    local parent_session_id="${2:-}"
    
    log_info "Routing task: ${task_description:0:50}..."
    
    # 1. 分析任务特征
    local task_analysis
    task_analysis=$(analyze_task "$task_description")
    log_info "Task analysis: $task_analysis"
    
    # 2. 选择路由策略
    local strategy
    strategy=$(select_routing_strategy "$task_analysis")
    log_decision "Selected strategy: $strategy"
    
    # 3. 执行选定的策略
    case "$strategy" in
        parallel_decomposition)
            execute_parallel_decomposition "$task_description" "$parent_session_id"
            ;;
        sequential_pipeline)
            execute_sequential_pipeline "$task_description" "$parent_session_id"
            ;;
        hierarchical_delegation)
            execute_hierarchical_delegation "$task_description" "$parent_session_id"
            ;;
        specialized_agent)
            execute_specialized_agent "$task_description" "$parent_session_id"
            ;;
        single_agent|*)
            execute_single_agent "$task_description" "$parent_session_id"
            ;;
    esac
}

# 等待 Sub-Agent 完成并收集结果
wait_for_subagents() {
    local subagent_ids=("$@")
    local timeout="${WAIT_TIMEOUT:-300}"
    local poll_interval=5
    local elapsed=0
    
    log_info "Waiting for ${#subagent_ids[@]} subagents to complete..."
    
    while [[ $elapsed -lt $timeout ]]; do
        local all_completed=true
        
        for subagent_id in "${subagent_ids[@]}"; do
            local status
            status=$(get_subagent_status "$subagent_id")
            
            if [[ "$status" == "running" || "$status" == "pending" ]]; then
                all_completed=false
                break
            elif [[ "$status" == "failed" ]]; then
                log_error "Subagent $subagent_id failed"
                return 1
            fi
        done
        
        if [[ "$all_completed" == "true" ]]; then
            log_success "All subagents completed"
            return 0
        fi
        
        sleep $poll_interval
        ((elapsed+=poll_interval))
        log_info "Waiting... (${elapsed}s / ${timeout}s)"
    done
    
    log_error "Timeout waiting for subagents"
    return 1
}

# 汇总 Sub-Agent 结果
aggregate_results() {
    local subagent_ids=("$@")
    
    log_info "Aggregating results from ${#subagent_ids[@]} subagents..."
    
    local aggregated_result=""
    
    for subagent_id in "${subagent_ids[@]}"; do
        local subagent_dir="$SUBAGENT_RUNTIME_DIR/$subagent_id"
        local config_file="$subagent_dir/config.yaml"
        
        if [[ -f "$config_file" ]]; then
            local result
            result=$(grep -A 100 "result:" "$config_file" | grep -v "completed_at" | head -20 || echo "No result")
            aggregated_result+="\n\n=== Sub-Agent: $subagent_id ===\n$result"
        fi
    done
    
    echo -e "$aggregated_result"
}

# 显示帮助
show_help() {
    cat << EOF
Task Router - Dynamic Routing Engine

Usage: $0 <command> [options]

Commands:
    route <task_description> [parent_session]
        Route a task using appropriate strategy
        
    analyze <task_description>
        Analyze task characteristics only
        
    strategy <task_description>
        Show which strategy would be selected
        
    wait <subagent_id> [subagent_id...]
        Wait for subagents to complete
        
    aggregate <subagent_id> [subagent_id...]
        Aggregate results from subagents
        
    help
        Show this help message

Environment Variables:
    WAIT_TIMEOUT      Timeout for waiting subagents (default: 300s)

Examples:
    $0 route "Implement user authentication system"
    $0 analyze "Design database schema for e-commerce"
    $0 wait sub-1234567890-abcdef12 sub-1234567890-ghijkl34
EOF
}

# 主函数
main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        route)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 route <task_description> [parent_session]"
                exit 1
            fi
            route_task "$1" "${2:-}"
            ;;
        analyze)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 analyze <task_description>"
                exit 1
            fi
            analyze_task "$1"
            ;;
        strategy)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 strategy <task_description>"
                exit 1
            fi
            local analysis
            analysis=$(analyze_task "$1")
            select_routing_strategy "$analysis"
            ;;
        wait)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 wait <subagent_id> [subagent_id...]"
                exit 1
            fi
            wait_for_subagents "$@"
            ;;
        aggregate)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 aggregate <subagent_id> [subagent_id...]"
                exit 1
            fi
            aggregate_results "$@"
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
