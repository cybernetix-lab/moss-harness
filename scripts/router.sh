#!/bin/bash
#
# Task Router - 动态路由决策引擎
# 基于任务特征选择最优的 Sub-Agent 编排策略
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 延迟加载旧的 Sub-Agent Manager，避免影响新的 workflow orchestrator 入口
SUBAGENT_MANAGER_SCRIPT="${PROJECT_ROOT}/scripts/subagent-manager.sh"
SUBAGENT_MANAGER_LOADED="${SUBAGENT_MANAGER_LOADED:-false}"

ensure_subagent_manager_loaded() {
    if [[ "$SUBAGENT_MANAGER_LOADED" == "true" ]]; then
        return 0
    fi
    if [[ ! -f "$SUBAGENT_MANAGER_SCRIPT" ]]; then
        log_error "Sub-Agent Manager not found: ${SUBAGENT_MANAGER_SCRIPT}"
        return 1
    fi
    # shellcheck disable=SC1090
    source "$SUBAGENT_MANAGER_SCRIPT"
    SUBAGENT_MANAGER_LOADED="true"
}

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

emit_workflow_event() {
    local event_type="$1"
    local json_payload="${2-}"
    local runtime_dir="${MOSS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
    local telemetry_dir="${runtime_dir}/telemetry"
    local telemetry_file="${telemetry_dir}/events.jsonl"

    if [[ -z "$json_payload" ]]; then
        json_payload='{}'
    fi

    mkdir -p "$telemetry_dir"

    python3 - "$telemetry_file" "$event_type" "$json_payload" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

telemetry_file, event_type, raw_payload = sys.argv[1:]
payload = json.loads(raw_payload)

event = {
    "type": event_type,
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "id": f"{event_type.replace('.', '_')}_{os.getpid()}",
    "data": payload,
}

with open(telemetry_file, "a", encoding="utf-8") as fh:
    fh.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")
PY
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

    ensure_subagent_manager_loaded
    
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

    ensure_subagent_manager_loaded
    
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

    ensure_subagent_manager_loaded
    
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
Workflow Orchestrator Router
Usage: $0 <command> [options]

Commands:
    orchestrate --text "<request>" [--task-id <id>] [--task-type <type>] [--tags <tag1,tag2>] [--priority <p>]
        统一入口：意图识别 -> 策略包 -> 决策 -> 建档/控制器调用（任务治理）

    orchestrate --campaign "<topic>" [--campaign-id <id>] [--tags <tag1,tag2>]
        统一入口：意图识别 -> 策略包 -> 决策 -> 学习控制器（学习推进）

    route <task_description> [parent_session]
        [兼容] 子代理路由策略
    analyze <task_description>
        [兼容] 仅分析任务特征
    strategy <task_description>
        [兼容] 查看选中的旧策略
    wait <subagent_id> [subagent_id...]
        [兼容] 等待子代理完成
    aggregate <subagent_id> [subagent_id...]
        [兼容] 汇总子代理结果
    help
        Show this help message

Environment Variables:
    WAIT_TIMEOUT      Timeout for waiting subagents (default: 300s)

Examples:
    $0 orchestrate --text "Implement a local bugfix"
    $0 orchestrate --campaign "Study feedback control"
    $0 route "Implement user authentication system"   # 兼容旧行为
EOF
}

# 主函数
main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        orchestrate)
            # 轻量内联新入口（无破坏旧实现）
            # 依赖：task-board.sh、path-controller.sh、learning-controller.sh
            local text=""
            local tags_csv=""
            local priority="normal"
            local task_id=""
            local task_type="generic_task"
            local campaign=""
            local campaign_id=""

            while [[ $# -gt 0 ]]; do
              case "$1" in
                --text) text="${2-}"; shift 2;;
                --tags) tags_csv="${2-}"; shift 2;;
                --priority) priority="${2-}"; shift 2;;
                --task-id) task_id="${2-}"; shift 2;;
                --task-type) task_type="${2-}"; shift 2;;
                --campaign) campaign="${2-}"; shift 2;;
                --campaign-id) campaign_id="${2-}"; shift 2;;
                --help|-h) show_help; return 0;;
                *) log_error "Unknown option for orchestrate: $1"; exit 1;;
              esac
            done

            # 工具路径
            local TASK_BOARD_SCRIPT="${PROJECT_ROOT}/scripts/task-board.sh"
            local PATH_CONTROLLER_SCRIPT="${PROJECT_ROOT}/scripts/path-controller.sh"
            local LEARNING_CONTROLLER_SCRIPT="${PROJECT_ROOT}/scripts/learning-controller.sh"
            local WORKFLOW_ORCHESTRATOR_SCRIPT="${PROJECT_ROOT}/runtime/orchestration/workflow-orchestrator.ts"

            if [[ -z "$text" ]]; then
              if [[ -z "$campaign" ]]; then
                log_error "orchestrate requires --text (task) or --campaign (learning)"
                exit 1
              fi
            fi

            if [[ -n "$campaign" && -z "$campaign_id" ]]; then
              campaign_id="learn-$(date +%s)"
            fi

            if [[ -n "$text" && -z "$task_id" ]]; then
              task_id="task-$(date +%s)"
            fi

            if [[ ! -f "$WORKFLOW_ORCHESTRATOR_SCRIPT" ]]; then
              log_error "Workflow orchestrator script not found: ${WORKFLOW_ORCHESTRATOR_SCRIPT}"
              exit 1
            fi

            local eval_payload
            eval_payload="$(python3 - "$text" "$task_id" "$task_type" "$campaign" "$campaign_id" "$tags_csv" <<'PY'
import json
import sys

text, task_id, task_type, campaign, campaign_id, tags_csv = sys.argv[1:]
payload = {}
if text:
    payload["text"] = text
if task_id:
    payload["taskId"] = task_id
if task_type:
    payload["taskType"] = task_type
if campaign:
    payload["campaign"] = campaign
if campaign_id:
    payload["campaignId"] = campaign_id
payload["tags"] = [tag.strip() for tag in tags_csv.split(",") if tag.strip()]
print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
)"

            local eval_result
            eval_result="$(node "$WORKFLOW_ORCHESTRATOR_SCRIPT" "$eval_payload" 2>/dev/null)"

            local work_item_type policy_pack route lane result_task_id result_campaign_id result_study_plan
            work_item_type="$(python3 - "$eval_result" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("workItemType", ""))
PY
)"
            policy_pack="$(python3 - "$eval_result" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("policyPack", ""))
PY
)"
            route="$(python3 - "$eval_result" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("route", ""))
PY
)"
            lane="$(python3 - "$eval_result" <<'PY'
import json, sys
value = json.loads(sys.argv[1]).get("firstLane", "")
print(value)
PY
)"
            result_task_id="$(python3 - "$eval_result" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("taskId", ""))
PY
)"
            result_campaign_id="$(python3 - "$eval_result" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("campaignId", ""))
PY
)"
            result_study_plan="$(python3 - "$eval_result" <<'PY'
import json, sys
value = json.loads(sys.argv[1]).get("studyPlan")
if value is None:
    print("")
else:
    print(json.dumps(value, ensure_ascii=True, separators=(",", ":")))
PY
)"

            emit_workflow_event "workflow.intent.recognized" "$(python3 - "$work_item_type" "$text" "$campaign" "$tags_csv" <<'PY'
import json
import sys

work_item_type, text, campaign, tags_csv = sys.argv[1:]
payload = {
    "work_item_type": work_item_type,
    "goal": campaign or text,
    "domain_tags": [tag.strip() for tag in tags_csv.split(",") if tag.strip()],
}
print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
)"

            emit_workflow_event "workflow.policy.selected" "$(python3 - "$work_item_type" "$policy_pack" "$route" "$result_task_id" "$result_campaign_id" <<'PY'
import json
import sys

work_item_type, policy_pack, route, task_id, campaign_id = sys.argv[1:]
payload = {
    "work_item_type": work_item_type,
    "policy_pack": policy_pack,
    "route": route,
}
if task_id:
    payload["task_id"] = task_id
if campaign_id:
    payload["campaign_id"] = campaign_id
print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
)"

            if [[ "$work_item_type" == "learning" ]]; then
              emit_workflow_event "learning.route.selected" "$(python3 - "$result_campaign_id" "$route" "$policy_pack" "$campaign" <<'PY'
import json
import sys

campaign_id, route, policy_pack, campaign = sys.argv[1:]
print(json.dumps({
    "campaign_id": campaign_id,
    "route": route,
    "policy_pack": policy_pack,
    "goal": campaign,
}, ensure_ascii=True, separators=(",", ":")))
PY
)"
              log_decision "policy_pack=${policy_pack} route=${route} campaign_id=${result_campaign_id}"
              if [[ -x "$LEARNING_CONTROLLER_SCRIPT" ]]; then
                if [[ -n "$result_study_plan" ]]; then
                  "$LEARNING_CONTROLLER_SCRIPT" start-iteration --campaign-id "$result_campaign_id" --route "$route" --study-plan-json "$result_study_plan" || true
                else
                  "$LEARNING_CONTROLLER_SCRIPT" start-iteration --campaign-id "$result_campaign_id" --route "$route" || true
                fi
              fi
              echo "{\"work_item_type\":\"learning\",\"campaign_id\":\"${result_campaign_id}\",\"route\":\"${route}\"}"
              return 0
            fi

            [[ -z "$lane" ]] && lane="planner"
            [[ -z "$result_task_id" ]] && result_task_id="$task_id"
            emit_workflow_event "task.path.selected" "$(python3 - "$result_task_id" "$route" "$policy_pack" "$lane" "$text" <<'PY'
import json
import sys

task_id, route, policy_pack, first_lane, text = sys.argv[1:]
print(json.dumps({
    "task_id": task_id,
    "route": route,
    "policy_pack": policy_pack,
    "first_lane": first_lane,
    "goal": text,
}, ensure_ascii=True, separators=(",", ":")))
PY
)"
            log_decision "policy_pack=${policy_pack} route=${route} task_id=${result_task_id} first_lane=${lane}"

            # 建档：创建首个 lane 任务（pending）
            if [[ -x "$TASK_BOARD_SCRIPT" ]]; then
              "$TASK_BOARD_SCRIPT" create \
                --lane "$lane" \
                --task-id "$result_task_id" \
                --task-type "$task_type" \
                --tags "${tags_csv}" \
                --priority "${priority}" \
                --stage "$lane" \
                --flow-sequence 1 \
                --work-item-type "task" \
                --policy-pack "$policy_pack" \
                --route "$route" \
                --route-state "queued" || log_warn "task-board create failed; continue"
            else
              log_warn "Task board script not executable: ${TASK_BOARD_SCRIPT}"
            fi

            # 控制器：启动路径
            if [[ -x "$PATH_CONTROLLER_SCRIPT" ]]; then
              "$PATH_CONTROLLER_SCRIPT" start --task-id "$result_task_id" --route "$route" || true
            fi

            echo "{\"work_item_type\":\"task\",\"task_id\":\"${result_task_id}\",\"route\":\"${route}\",\"first_lane\":\"${lane}\"}"
            ;;
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
