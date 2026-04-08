#!/bin/bash
# eval-feedback.sh - 评估反馈处理器
# 将评估结果反馈到 memory 和 optimizer，形成闭环

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
EVAL_RESULTS_DIR="${PROJECT_ROOT}/runtime/memory/eval-results"
FEEDBACK_LOG="${PROJECT_ROOT}/runtime/memory/eval-feedback.log"
SKILL_STATS_DIR="${PROJECT_ROOT}/runtime/memory/skill-stats"

# 确保目录存在
mkdir -p "$EVAL_RESULTS_DIR"

# 记录日志
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] $1" >> "$FEEDBACK_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [SUCCESS] $1" >> "$FEEDBACK_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [WARNING] $1" >> "$FEEDBACK_LOG"
}

# 处理评估结果
process_eval_result() {
    local eval_file="$1"
    local eval_name=$(basename "$eval_file" .yaml)
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    log_info "处理评估结果: $eval_name"
    
    # 检查是否是技能评估
    if [[ "$eval_name" == *"-eval" ]]; then
        local skill_name=$(echo "$eval_name" | sed 's/-eval$//')
        log_info "检测到技能评估: $skill_name"
        
        # 运行技能评估
        "${SCRIPT_DIR}/skill-eval.sh" eval "$skill_name" || true
    else
        # 处理 harness 评估
        local passed=0
        local failed=0
        local total=0
        
        if [[ -f "$eval_file" ]]; then
            total=$(grep -c "^  - name:" "$eval_file" || echo 0)
            
            local result_file="${EVAL_RESULTS_DIR}/${eval_name}-$(date +%s).json"
            
            python3 << EOF
import json

result = {
    "eval_name": "${eval_name}",
    "timestamp": "${timestamp}",
    "total_tests": ${total},
    "passed": ${passed},
    "failed": ${failed},
    "success_rate": 0.0 if ${total} == 0 else ${passed} / ${total},
    "details": [],
    "eval_type": "harness"
}

with open('${result_file}', 'w') as f:
    json.dump(result, f, indent=2)

print(f"评估结果已保存: ${result_file}")
EOF
            
            log_success "评估结果已记录: $eval_name"
        fi
    fi
}

# 将评估结果关联到技能
link_eval_to_skills() {
    local eval_name="$1"
    local eval_result="$2"
    
    log_info "将评估结果关联到相关技能..."
    
    # 根据评估名称推断相关技能
    local related_skills=()
    
    case "$eval_name" in
        *constraint*)
            related_skills+=("security-scan")
            ;;
        *context*)
            related_skills+=("documentation-lookup")
            ;;
        *typescript*)
            related_skills+=("typescript-patterns")
            ;;
        *react*)
            related_skills+=("react-hooks")
            ;;
    esac
    
    # 更新技能统计中的评估数据
    for skill in "${related_skills[@]}"; do
        local stats_file="${SKILL_STATS_DIR}/${skill}.json"
        
        if [[ -f "$stats_file" ]]; then
            python3 << EOF
import json

try:
    with open('${stats_file}', 'r') as f:
        stats = json.load(f)
    
    # 添加评估历史
    if 'eval_history' not in stats:
        stats['eval_history'] = []
    
    stats['eval_history'].append({
        "eval_name": "${eval_name}",
        "result": "${eval_result}",
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    })
    
    # 只保留最近 20 条评估记录
    if len(stats['eval_history']) > 20:
        stats['eval_history'] = stats['eval_history'][-20:]
    
    with open('${stats_file}', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"已更新技能评估数据: ${skill}")
except Exception as e:
    print(f"更新失败: ${skill} - {e}")
EOF
        fi
    done
}

# 生成优化建议
generate_optimization_suggestions() {
    log_info "生成优化建议..."
    
    local suggestions_file="${PROJECT_ROOT}/runtime/memory/optimization-suggestions.json"
    
    python3 << EOF
import json
import os
import glob

suggestions = {
    "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "suggestions": []
}

# 分析技能统计
stats_dir = "${SKILL_STATS_DIR}"
for stats_file in glob.glob(os.path.join(stats_dir, "*.json")):
    try:
        with open(stats_file, 'r') as f:
            stats = json.load(f)
        
        skill_name = stats.get('skill_name', os.path.basename(stats_file).replace('.json', ''))
        usage_count = stats.get('usage_count', 0)
        success_count = stats.get('success_count', 0)
        failure_count = stats.get('failure_count', 0)
        
        if usage_count > 0:
            success_rate = success_count / usage_count
            
            # 根据成功率生成建议
            if success_rate < 0.7:
                suggestions["suggestions"].append({
                    "skill": skill_name,
                    "priority": "high",
                    "issue": "success_rate_low",
                    "message": f"成功率较低 ({success_rate:.1%})，建议优化验证规则",
                    "action": "review_validation_rules"
                })
            elif success_rate > 0.95 and usage_count > 20:
                suggestions["suggestions"].append({
                    "skill": skill_name,
                    "priority": "medium",
                    "issue": "ready_for_evolution",
                    "message": f"表现优秀，建议执行技能进化",
                    "action": "run_skill_evolve"
                })
        
        # 检查评估历史
        eval_history = stats.get('eval_history', [])
        failed_evals = [e for e in eval_history if e.get('result') == 'failed']
        
        if len(failed_evals) > 3:
            suggestions["suggestions"].append({
                "skill": skill_name,
                "priority": "high",
                "issue": "repeated_eval_failures",
                "message": f"多次评估失败 ({len(failed_evals)} 次)，需要审查",
                "action": "review_skill_implementation"
            })
            
    except Exception as e:
        print(f"处理失败: {stats_file} - {e}")

# 保存建议
with open('${suggestions_file}', 'w') as f:
    json.dump(suggestions, f, indent=2)

print(f"生成了 {len(suggestions['suggestions'])} 条优化建议")
EOF
    
    log_success "优化建议已保存"
}

# 触发技能进化
trigger_skill_evolution() {
    log_info "检查是否需要触发技能进化..."
    
    local suggestions_file="${PROJECT_ROOT}/runtime/memory/optimization-suggestions.json"
    
    if [[ ! -f "$suggestions_file" ]]; then
        log_warning "没有优化建议文件"
        return
    fi
    
    # 查找建议进化的技能
    local skills_to_evolve=$(python3 << EOF
import json

with open('${suggestions_file}', 'r') as f:
    data = json.load(f)

skills = []
for suggestion in data.get('suggestions', []):
    if suggestion.get('action') == 'run_skill_evolve':
        skills.append(suggestion['skill'])

print(' '.join(skills))
EOF
)
    
    if [[ -n "$skills_to_evolve" ]]; then
        log_info "以下技能建议进化: $skills_to_evolve"
        
        for skill in $skills_to_evolve; do
            log_info "触发技能进化: $skill"
            "${SCRIPT_DIR}/skill-evolve.sh" analyze "$skill" || true
        done
    else
        log_info "暂无可进化的技能"
    fi
}

# 生成闭环报告
generate_closure_report() {
    local report_file="${PROJECT_ROOT}/runtime/memory/closure-report-$(date +%Y%m%d).md"
    
    log_info "生成闭环报告..."
    
    cat > "$report_file" << EOF
# Harness 闭环报告

生成时间: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## 数据流概览

\`\`\`
Eval → Memory → Optimizer → Skills → Eval
\`\`\`

## 评估结果统计

EOF
    
    # 统计评估结果
    local eval_count=$(find "$EVAL_RESULTS_DIR" -name "*.json" | wc -l)
    echo "- 总评估次数: $eval_count" >> "$report_file"
    
    # 技能统计
    echo "" >> "$report_file"
    echo "## 技能使用统计" >> "$report_file"
    echo "" >> "$report_file"
    
    for stats_file in "$SKILL_STATS_DIR"/*.json; do
        if [[ -f "$stats_file" ]]; then
            local skill_name=$(basename "$stats_file" .json)
            python3 << EOF >> "$report_file"
import json
try:
    with open('${stats_file}', 'r') as f:
        stats = json.load(f)
    
    usage = stats.get('usage_count', 0)
    success = stats.get('success_count', 0)
    failure = stats.get('failure_count', 0)
    
    if usage > 0:
        rate = success / usage * 100
        print(f"- **{skill_name}**: 使用 {usage} 次, 成功率 {rate:.1f}%")
except:
    pass
EOF
        fi
    done
    
    # 优化建议
    echo "" >> "$report_file"
    echo "## 优化建议" >> "$report_file"
    echo "" >> "$report_file"
    
    local suggestions_file="${PROJECT_ROOT}/runtime/memory/optimization-suggestions.json"
    if [[ -f "$suggestions_file" ]]; then
        python3 << EOF >> "$report_file"
import json
try:
    with open('${suggestions_file}', 'r') as f:
        data = json.load(f)
    
    for suggestion in data.get('suggestions', []):
        skill = suggestion.get('skill', 'unknown')
        priority = suggestion.get('priority', 'low')
        message = suggestion.get('message', '')
        action = suggestion.get('action', '')
        
        print(f"- [{priority.upper()}] **{skill}**: {message}")
        print(f"  - 建议操作: \`{action}\`")
        print()
except Exception as e:
    print(f"读取建议失败: {e}")
EOF
    fi
    
    log_success "闭环报告已生成: $report_file"
}

# 主函数
main() {
    local command="${1:-process}"
    
    case "$command" in
        process)
            log_info "开始处理评估反馈..."
            
            # 处理所有评估结果
            for eval_file in "${PROJECT_ROOT}/tooling/evals/harness"/*.yaml; do
                if [[ -f "$eval_file" ]]; then
                    process_eval_result "$eval_file"
                    link_eval_to_skills "$(basename "$eval_file" .yaml)" "pending"
                fi
            done
            
            # 生成优化建议
            generate_optimization_suggestions
            
            # 触发技能进化
            trigger_skill_evolution
            
            # 生成报告
            generate_closure_report
            
            log_success "评估反馈处理完成"
            ;;
        
        report)
            generate_closure_report
            ;;
        
        suggest)
            generate_optimization_suggestions
            ;;
        
        evolve)
            trigger_skill_evolution
            ;;
        
        *)
            echo "用法: $0 [process|report|suggest|evolve]"
            echo ""
            echo "命令:"
            echo "  process  - 处理评估结果并触发闭环（默认）"
            echo "  report   - 生成闭环报告"
            echo "  suggest  - 生成优化建议"
            echo "  evolve   - 触发技能进化"
            exit 1
            ;;
    esac
}

main "$@"
