#!/bin/bash
# agent-evolve.sh - Agent 进化引擎
# 分析 Agent 性能数据并自动优化 Agent 配置

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
AGENTS_DIR="${PROJECT_ROOT}/agents"
EVAL_RESULTS_DIR="${PROJECT_ROOT}/runtime/memory/agent-eval-results"
EVOLUTION_DIR="${PROJECT_ROOT}/runtime/memory/agent-evolution"
CONFIG_DIR="${PROJECT_ROOT}/config"
BACKUP_DIR="${PROJECT_ROOT}/runtime/memory/agent-backups"

mkdir -p "$EVOLUTION_DIR" "$BACKUP_DIR"

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
Agent Evolution Engine - Agent 进化引擎

用法: $0 [命令] [选项]

命令:
    analyze <agent_name>        分析 Agent 性能数据
    evolve <agent_name>         执行 Agent 进化
    status <agent_name>         查看 Agent 进化状态
    list                        列出可进化的 Agent
    dry-run <agent_name>        模拟进化过程（不实际修改）
    rollback <agent_name>       回滚到上一版本
    proposals                   列出所有进化提案
    apply <proposal_id>         应用指定的进化提案
    
选项:
    -f, --force                 强制进化（忽略阈值检查）
    -v, --verbose               显示详细信息
    -h, --help                  显示此帮助

示例:
    $0 analyze planner
    $0 evolve planner
    $0 status executor
    $0 dry-run reviewer --verbose
    $0 rollback planner
    $0 proposals
EOF
}

# 检查依赖
check_dependencies() {
    if ! command -v yq &> /dev/null; then
        log_error "yq 未安装。请安装 yq: https://github.com/mikefarah/yq"
        exit 1
    fi
}

# 加载进化配置
load_evolution_config() {
    local config_file="${CONFIG_DIR}/agent-evolution.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        # 使用默认配置
        cat << EOF
thresholds:
  min_evaluations: 3
  min_success_rate: 70
  min_quality_score: 75
  max_evolution_frequency: 7d

weights:
  success_rate: 0.4
  quality_score: 0.4
  constraint_compliance: 0.2

strategies:
  prompt_optimization:
    enabled: true
    trigger: success_rate < 80
  tool_adjustment:
    enabled: true
    trigger: constraint_compliance < 90
  model_tuning:
    enabled: true
    trigger: quality_score < 75
  context_optimization:
    enabled: true
    trigger: avg_duration > 300

constraints:
  max_temperature: 1.0
  min_temperature: 0.1
  max_tokens_step: 1024
EOF
    else
        cat "$config_file"
    fi
}

# 获取最新的评估结果
get_latest_eval() {
    local agent_name=$1
    find "$EVAL_RESULTS_DIR" -name "${agent_name}-*.json" -type f -print0 | \
        xargs -0 ls -t 2>/dev/null | head -1
}

# 分析 Agent 性能
analyze_agent_performance() {
    local agent_name=$1
    local verbose=${2:-false}
    
    log_info "分析 Agent: $agent_name"
    
    local eval_file=$(get_latest_eval "$agent_name")
    
    if [[ -z "$eval_file" ]]; then
        log_error "没有找到评估结果，请先运行 agent-eval.sh"
        return 1
    fi
    
    local metrics=$(cat "$eval_file" | jq -r '.metrics')
    local overall_score=$(cat "$eval_file" | jq -r '.overall_score')
    
    if [[ "$verbose" == "true" ]]; then
        log_info "评估文件: $eval_file"
        log_info "总体评分: $overall_score"
    fi
    
    # 加载配置
    local config=$(load_evolution_config)
    local thresholds=$(echo "$config" | yq -o json | jq -r '.thresholds')
    
    # 分析各项指标
    local success_rate=$(echo "$metrics" | jq -r '.success_rate // 0')
    local quality_score=$(echo "$metrics" | jq -r '.avg_quality_score // 0')
    local constraint_compliance=$(echo "$metrics" | jq -r '.constraint_compliance // 0')
    local avg_duration=$(echo "$metrics" | jq -r '.avg_duration // 0')
    
    # 确定需要优化的方面
    local improvements="[]"
    
    if (( $(echo "$success_rate < $(echo "$thresholds" | jq -r '.min_success_rate')" | bc -l) )); then
        improvements=$(echo "$improvements" | jq '. + ["prompt_optimization"]')
    fi
    
    if (( $(echo "$constraint_compliance < $(echo "$thresholds" | jq -r '.min_constraint_compliance // 90')" | bc -l) )); then
        improvements=$(echo "$improvements" | jq '. + ["tool_adjustment"]')
    fi
    
    if (( $(echo "$quality_score < $(echo "$thresholds" | jq -r '.min_quality_score')" | bc -l) )); then
        improvements=$(echo "$improvements" | jq '. + ["model_tuning"]')
    fi
    
    if (( $(echo "$avg_duration > 300" | bc -l) )); then
        improvements=$(echo "$improvements" | jq '. + ["context_optimization"]')
    fi
    
    cat << EOF
{
  "agent_name": "$agent_name",
  "evaluated_at": "$(cat "$eval_file" | jq -r '.evaluated_at')",
  "metrics": $metrics,
  "overall_score": $overall_score,
  "improvements_needed": $improvements,
  "analysis_summary": {
    "success_rate_status": $(echo "$success_rate >= $(echo "$thresholds" | jq -r '.min_success_rate')" | bc),
    "quality_score_status": $(echo "$quality_score >= $(echo "$thresholds" | jq -r '.min_quality_score')" | bc),
    "constraint_compliance_status": $(echo "$constraint_compliance >= $(echo "$thresholds" | jq -r '.min_constraint_compliance // 90')" | bc)
  }
}
EOF
}

# 生成进化提案
generate_evolution_proposal() {
    local agent_name=$1
    local analysis=$2
    local dry_run=${3:-false}
    
    local improvements=$(echo "$analysis" | jq -r '.improvements_needed')
    local agent_config_file="${AGENTS_DIR}/${agent_name}.yaml"
    local agent_config=$(cat "$agent_config_file")
    
    local proposal_id="prop-$(date +%Y%m%d)-$(openssl rand -hex 4)"
    local proposal_file="${EVOLUTION_DIR}/${proposal_id}.json"
    
    local changes="[]"
    local rationale=""
    
    # 根据需要的改进生成具体的变更
    if echo "$improvements" | jq -e 'contains(["prompt_optimization"])' > /dev/null; then
        # 优化 system_prompt
        local current_prompt=$(echo "$agent_config" | yq -r '.system_prompt // ""')
        
        changes=$(echo "$changes" | jq --arg type "prompt" '. + [{
            "type": "system_prompt",
            "action": "enhance",
            "description": "增强 system_prompt，添加更详细的指导和约束",
            "current_length": '"${#current_prompt}"'
        }]')
        
        rationale="$rationale\n- 成功率较低，需要增强 system_prompt 的指导性"
    fi
    
    if echo "$improvements" | jq -e 'contains(["tool_adjustment"])' > /dev/null; then
        # 调整工具权限
        changes=$(echo "$changes" | jq '. + [{
            "type": "tools",
            "action": "review",
            "description": "审查工具权限配置，确保约束得到遵守"
        }]')
        
        rationale="$rationale\n- 约束遵守度较低，需要调整工具权限"
    fi
    
    if echo "$improvements" | jq -e 'contains(["model_tuning"])' > /dev/null; then
        # 调整模型参数
        local current_temp=$(echo "$agent_config" | yq -r '.model.temperature // 0.7')
        local new_temp=$(echo "scale=1; $current_temp - 0.1" | bc)
        
        if (( $(echo "$new_temp < 0.1" | bc -l) )); then
            new_temp="0.1"
        fi
        
        changes=$(echo "$changes" | jq --arg temp "$new_temp" '. + [{
            "type": "model",
            "action": "tune",
            "description": "降低 temperature 以提高输出质量",
            "changes": {
                "temperature": { "from": '$current_temp', "to": ('$new_temp' | tonumber) }
            }
        }]')
        
        rationale="$rationale\n- 质量评分较低，降低 temperature 以提高稳定性"
    fi
    
    if echo "$improvements" | jq -e 'contains(["context_optimization"])' > /dev/null; then
        # 优化上下文管理
        local current_max_tokens=$(echo "$agent_config" | yq -r '.context.max_tokens // 8000')
        local new_max_tokens=$((current_max_tokens - 1024))
        
        if [[ $new_max_tokens -lt 4096 ]]; then
            new_max_tokens=4096
        fi
        
        changes=$(echo "$changes" | jq --arg tokens "$new_max_tokens" '. + [{
            "type": "context",
            "action": "optimize",
            "description": "优化上下文管理，减少 token 使用量",
            "changes": {
                "max_tokens": { "from": '$current_max_tokens', "to": '$new_max_tokens' }
            }
        }]')
        
        rationale="$rationale\n- 平均执行时间较长，优化上下文管理以提升效率"
    fi
    
    # 生成提案
    cat << EOF | jq . > "$proposal_file"
{
  "proposal_id": "$proposal_id",
  "agent_name": "$agent_name",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "based_on_eval": "$(echo "$analysis" | jq -r '.evaluated_at')",
  "overall_score": $(echo "$analysis" | jq -r '.overall_score'),
  "rationale": "$(echo -e "$rationale" | sed 's/"/\\"/g')",
  "changes": $changes,
  "status": "pending",
  "dry_run": $dry_run
}
EOF
    
    echo "$proposal_file"
}

# 执行 Agent 进化
evolve_agent() {
    local agent_name=$1
    local force=${2:-false}
    local verbose=${3:-false}
    
    log_info "开始进化 Agent: $agent_name"
    
    # 检查 Agent 是否存在
    if [[ ! -f "${AGENTS_DIR}/${agent_name}.yaml" ]]; then
        log_error "Agent 不存在: $agent_name"
        return 1
    fi
    
    # 分析性能
    local analysis=$(analyze_agent_performance "$agent_name" "$verbose")
    local improvements=$(echo "$analysis" | jq -r '.improvements_needed')
    
    if [[ "$improvements" == "[]" ]] && [[ "$force" != "true" ]]; then
        log_success "Agent $agent_name 性能良好，无需进化"
        return 0
    fi
    
    # 检查进化频率限制
    local last_evolution=$(find "$EVOLUTION_DIR" -name "${agent_name}-*.json" -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
    if [[ -n "$last_evolution" ]] && [[ "$force" != "true" ]]; then
        local last_date=$(cat "$last_evolution" | jq -r '.created_at' | cut -dT -f1)
        local days_since=$(( ($(date +%s) - $(date -d "$last_date" +%s)) / 86400 ))
        
        if [[ $days_since -lt 7 ]]; then
            log_warning "Agent $agent_name 在 $days_since 天前刚进化过，建议等待至少 7 天"
            log_info "使用 --force 强制进化"
            return 0
        fi
    fi
    
    # 生成进化提案
    log_info "生成进化提案..."
    local proposal_file=$(generate_evolution_proposal "$agent_name" "$analysis" "false")
    local proposal_id=$(cat "$proposal_file" | jq -r '.proposal_id')
    
    log_info "进化提案: $proposal_id"
    
    # 备份当前配置
    local backup_file="${BACKUP_DIR}/${agent_name}-$(date +%Y%m%d-%H%M%S).yaml"
    cp "${AGENTS_DIR}/${agent_name}.yaml" "$backup_file"
    log_info "已备份原配置: $backup_file"
    
    # 应用变更
    apply_proposal "$proposal_id" "$verbose"
    
    log_success "Agent $agent_name 进化完成"
    log_info "提案文件: $proposal_file"
}

# 应用进化提案
apply_proposal() {
    local proposal_id=$1
    local verbose=${2:-false}
    
    local proposal_file="${EVOLUTION_DIR}/${proposal_id}.json"
    
    if [[ ! -f "$proposal_file" ]]; then
        log_error "提案不存在: $proposal_id"
        return 1
    fi
    
    local proposal=$(cat "$proposal_file")
    local agent_name=$(echo "$proposal" | jq -r '.agent_name')
    local changes=$(echo "$proposal" | jq -r '.changes')
    local agent_config_file="${AGENTS_DIR}/${agent_name}.yaml"
    
    log_info "应用提案 $proposal_id 到 Agent $agent_name"
    
    # 应用每个变更
    local change_count=$(echo "$changes" | jq 'length')
    for ((i=0; i<change_count; i++)); do
        local change=$(echo "$changes" | jq -r ".[$i]")
        local type=$(echo "$change" | jq -r '.type')
        local action=$(echo "$change" | jq -r '.action')
        
        log_info "应用变更: $type - $action"
        
        case "$type" in
            model)
                # 调整模型参数
                local new_temp=$(echo "$change" | jq -r '.changes.temperature.to')
                yq -i ".model.temperature = $new_temp" "$agent_config_file"
                ;;
            context)
                # 调整上下文配置
                local new_tokens=$(echo "$change" | jq -r '.changes.max_tokens.to')
                yq -i ".context.max_tokens = $new_tokens" "$agent_config_file"
                ;;
            tools)
                # 工具权限调整需要人工审查
                log_warning "工具权限调整需要人工审查，请在配置文件中手动调整"
                ;;
            prompt)
                # Prompt 优化需要人工审查
                log_warning "Prompt 优化需要人工审查，请参考提案文件中的建议"
                ;;
        esac
    done
    
    # 更新提案状态
    jq '.status = "applied" | .applied_at = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$proposal_file" > "${proposal_file}.tmp"
    mv "${proposal_file}.tmp" "$proposal_file"
    
    log_success "提案 $proposal_id 已应用"
}

# 模拟进化（dry-run）
dry_run_evolution() {
    local agent_name=$1
    local verbose=${2:-false}
    
    log_info "模拟进化 Agent: $agent_name"
    
    # 分析性能
    local analysis=$(analyze_agent_performance "$agent_name" "$verbose")
    local improvements=$(echo "$analysis" | jq -r '.improvements_needed')
    
    if [[ "$improvements" == "[]" ]]; then
        log_success "Agent $agent_name 性能良好，无需进化"
        return 0
    fi
    
    # 生成提案（dry-run 模式）
    local proposal_file=$(generate_evolution_proposal "$agent_name" "$analysis" "true")
    local proposal_id=$(cat "$proposal_file" | jq -r '.proposal_id')
    
    echo ""
    echo "=== 进化提案预览 ==="
    echo "提案 ID: $proposal_id"
    echo "Agent: $agent_name"
    echo ""
    echo "分析结果:"
    echo "$analysis" | jq -r '.analysis_summary | to_entries[] | "  \(.key): \(.value)"'
    echo ""
    echo "建议的改进:"
    cat "$proposal_file" | jq -r '.changes[] | "  - [\(.type)] \(.description)"'
    echo ""
    echo "提案文件: $proposal_file"
    echo ""
    echo "使用 '$0 apply $proposal_id' 应用此提案"
}

# 回滚 Agent 配置
rollback_agent() {
    local agent_name=$1
    
    log_info "回滚 Agent: $agent_name"
    
    # 找到最新的备份
    local latest_backup=$(find "$BACKUP_DIR" -name "${agent_name}-*.yaml" -type f -print0 | \
        xargs -0 ls -t 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "没有找到备份文件"
        return 1
    fi
    
    log_info "使用备份: $latest_backup"
    
    # 备份当前配置
    local current_backup="${BACKUP_DIR}/${agent_name}-pre-rollback-$(date +%Y%m%d-%H%M%S).yaml"
    cp "${AGENTS_DIR}/${agent_name}.yaml" "$current_backup"
    
    # 恢复备份
    cp "$latest_backup" "${AGENTS_DIR}/${agent_name}.yaml"
    
    log_success "Agent $agent_name 已回滚到: $latest_backup"
    log_info "当前配置已备份到: $current_backup"
}

# 列出所有提案
list_proposals() {
    log_info "进化提案列表:"
    
    find "$EVOLUTION_DIR" -name "prop-*.json" -type f -print0 | \
        xargs -0 ls -t 2>/dev/null | \
        while read -r file; do
            local id=$(cat "$file" | jq -r '.proposal_id')
            local agent=$(cat "$file" | jq -r '.agent_name')
            local status=$(cat "$file" | jq -r '.status')
            local score=$(cat "$file" | jq -r '.overall_score')
            
            printf "  %-30s %-15s %-10s 评分: %s\n" "$id" "$agent" "$status" "$score"
        done
}

# 查看 Agent 进化状态
show_evolution_status() {
    local agent_name=$1
    
    echo "=== Agent $agent_name 进化状态 ==="
    
    # 查找相关提案
    local proposals=$(find "$EVOLUTION_DIR" -name "prop-*.json" -type f -exec grep -l "\"agent_name\": \"$agent_name\"" {} \;)
    
    if [[ -z "$proposals" ]]; then
        echo "该 Agent 尚未有进化记录"
        return 0
    fi
    
    echo ""
    echo "进化历史:"
    echo "$proposals" | while read -r file; do
        local id=$(cat "$file" | jq -r '.proposal_id')
        local date=$(cat "$file" | jq -r '.created_at')
        local status=$(cat "$file" | jq -r '.status')
        local score=$(cat "$file" | jq -r '.overall_score')
        
        echo "  [$date] $id - $status (评分: $score)"
    done
    
    # 查找备份
    local backups=$(find "$BACKUP_DIR" -name "${agent_name}-*.yaml" -type f)
    
    if [[ -n "$backups" ]]; then
        echo ""
        echo "可用备份:"
        echo "$backups" | while read -r file; do
            echo "  - $(basename "$file")"
        done
    fi
}

# 列出可进化的 Agent
list_evolveable_agents() {
    log_info "可进化的 Agent 列表:"
    
    find "$AGENTS_DIR" -name "*.yaml" -not -name "README*" -exec basename {} .yaml \; | \
        while read -r agent_name; do
            local eval_file=$(get_latest_eval "$agent_name")
            
            if [[ -n "$eval_file" ]]; then
                local score=$(cat "$eval_file" | jq -r '.overall_score // 0')
                local needs_evolution="否"
                
                if (( $(echo "$score < 80" | bc -l) )); then
                    needs_evolution="是"
                fi
                
                printf "  %-20s 评分: %-6s 需要进化: %s\n" "$agent_name" "$score" "$needs_evolution"
            else
                printf "  %-20s 未评估\n" "$agent_name"
            fi
        done
}

# 主函数
main() {
    check_dependencies
    
    local command=$1
    shift || true
    
    local force=false
    local verbose=false
    
    # 解析选项
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                force=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
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
        analyze)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            analyze_agent_performance "$1" "$verbose" | jq .
            ;;
        evolve)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            evolve_agent "$1" "$force" "$verbose"
            ;;
        status)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            show_evolution_status "$1"
            ;;
        list)
            list_evolveable_agents
            ;;
        dry-run)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            dry_run_evolution "$1" "$verbose"
            ;;
        rollback)
            if [[ -z "$1" ]]; then
                log_error "请指定 Agent 名称"
                exit 1
            fi
            rollback_agent "$1"
            ;;
        proposals)
            list_proposals
            ;;
        apply)
            if [[ -z "$1" ]]; then
                log_error "请指定提案 ID"
                exit 1
            fi
            apply_proposal "$1" "$verbose"
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"
