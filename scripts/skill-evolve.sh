#!/bin/bash
# skill-evolve.sh - 技能进化引擎
# 分析技能使用数据并自动优化技能定义

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

# 显示帮助
show_help() {
    cat << EOF
Skill Evolution Engine - 技能进化引擎

用法: $0 [命令] [选项]

命令:
    analyze <skill_name>        分析技能性能数据
    evolve <skill_name>         执行技能进化
    status <skill_name>         查看技能进化状态
    list                        列出可进化的技能
    dry-run <skill_name>        模拟进化过程（不实际修改）
    rollback <skill_name>       回滚到上一版本
    discover                    从memory中发现潜在新技能
    propose <proposal_id>       查看或确认新技能提案
    proposals                   列出所有待审核提案

选项:
    -f, --force                 强制进化（忽略阈值检查）
    -v, --verbose               显示详细信息
    -h, --help                  显示此帮助

示例:
    $0 analyze typescript-patterns
    $0 evolve typescript-patterns
    $0 status typescript-patterns
    $0 dry-run typescript-patterns --verbose
    $0 discover --verbose
    $0 proposals
    $0 propose prop-20240101-001 --approve
EOF
}

# 获取技能路径
get_skill_path() {
    local skill_name="$1"
    find "${PROJECT_ROOT}/skills" -name "skill.yaml" -path "*/${skill_name}/*" | head -1
}

# 获取技能目录
get_skill_dir() {
    local skill_path="$1"
    dirname "$skill_path"
}

# 获取技能使用统计
get_skill_stats() {
    local skill_name="$1"
    local stats_file="${PROJECT_ROOT}/memory/skill-stats/${skill_name}.json"
    
    if [[ -f "$stats_file" ]]; then
        cat "$stats_file"
    else
        echo '{"usage_count": 0, "success_count": 0, "failure_count": 0, "patterns_extracted": 0}'
    fi
}

# 分析技能性能
analyze_skill() {
    local skill_name="$1"
    local verbose="${2:-false}"
    
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}              分析技能: ${skill_name}${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    local skill_path=$(get_skill_path "$skill_name")
    if [[ -z "$skill_path" ]]; then
        echo -e "${RED}✗ 技能不存在: $skill_name${NC}"
        return 1
    fi
    
    local skill_dir=$(get_skill_dir "$skill_path")
    
    # 读取技能定义
    local current_version=$(grep "version:" "$skill_path" | head -1 | awk '{print $2}')
    local trigger_count=$(grep -c "pattern:" "$skill_path" || echo 0)
    local template_count=$(grep -c "name:" "$skill_path" || echo 0)
    
    echo -e "\n${CYAN}📋 技能信息${NC}"
    echo "  路径: $skill_path"
    echo "  当前版本: $current_version"
    echo "  触发器数量: $trigger_count"
    echo "  模板数量: $template_count"
    
    # 获取使用统计
    local stats=$(get_skill_stats "$skill_name")
    local usage_count=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['usage_count'])")
    local success_count=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['success_count'])")
    local failure_count=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['failure_count'])")
    local patterns_extracted=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['patterns_extracted'])")
    
    echo -e "\n${CYAN}📊 使用统计${NC}"
    echo "  使用次数: $usage_count"
    echo "  成功次数: $success_count"
    echo "  失败次数: $failure_count"
    
    if [[ $usage_count -gt 0 ]]; then
        local success_rate=$(echo "scale=2; $success_count / $usage_count" | bc)
        echo "  成功率: ${success_rate}%"
    fi
    
    echo "  提取的模式: $patterns_extracted"
    
    # 检查进化条件
    echo -e "\n${CYAN}🔍 进化条件检查${NC}"
    
    local config_file="${PROJECT_ROOT}/skills/evolution/config.yaml"
    local usage_threshold=$(grep "usage_threshold:" "$config_file" | awk '{print $2}')
    local success_threshold=$(grep "success_rate_threshold:" "$config_file" | awk '{print $2}')
    local pattern_threshold=$(grep "new_pattern_threshold:" "$config_file" | awk '{print $2}')
    
    local can_evolve=true
    
    if [[ $usage_count -ge $usage_threshold ]]; then
        echo -e "  ${GREEN}✓${NC} 使用次数达标 ($usage_count >= $usage_threshold)"
    else
        echo -e "  ${RED}✗${NC} 使用次数不足 ($usage_count < $usage_threshold)"
        can_evolve=false
    fi
    
    if [[ $usage_count -gt 0 ]]; then
        local success_rate_calc=$(echo "scale=2; $success_count / $usage_count" | bc)
        if (( $(echo "$success_rate_calc >= $success_threshold" | bc -l) )); then
            echo -e "  ${GREEN}✓${NC} 成功率达标"
        else
            echo -e "  ${YELLOW}⚠${NC} 成功率未达标"
        fi
    fi
    
    if [[ $patterns_extracted -ge $pattern_threshold ]]; then
        echo -e "  ${GREEN}✓${NC} 新模式数量达标 ($patterns_extracted >= $pattern_threshold)"
    else
        echo -e "  ${YELLOW}⚠${NC} 新模式数量不足"
    fi
    
    # 分析建议
    echo -e "\n${CYAN}💡 优化建议${NC}"
    
    if [[ $trigger_count -lt 5 ]]; then
        echo "  • 触发器数量较少，建议添加更多触发模式"
    fi
    
    if [[ $template_count -lt 3 ]]; then
        echo "  • 模板数量较少，建议扩展更多代码模板"
    fi
    
    if [[ $failure_count -gt $(( usage_count / 4 )) ]]; then
        echo "  • 失败率较高，建议优化验证规则"
    fi
    
    if [[ "$can_evolve" == "true" ]]; then
        echo -e "\n${GREEN}✅ 技能已准备好进化${NC}"
        echo "   运行: $0 evolve $skill_name"
    else
        echo -e "\n${YELLOW}⚠ 技能尚未满足进化条件${NC}"
        echo "   继续使用该技能以收集更多数据"
    fi
}

# 提取新模式
extract_patterns() {
    local skill_name="$1"
    local skill_dir=$(get_skill_dir "$(get_skill_path "$skill_name")")
    
    echo -e "${CYAN}🔍 从会话记忆中提取模式...${NC}"
    
    local patterns_dir="${skill_dir}/extracted-patterns"
    mkdir -p "$patterns_dir"
    
    # 从 memory/sessions 中提取成功的代码模式
    local sessions_dir="${PROJECT_ROOT}/memory/sessions"
    local extracted_count=0
    
    if [[ -d "$sessions_dir" ]]; then
        for session_dir in "$sessions_dir"/*; do
            if [[ -d "$session_dir" ]]; then
                # 查找成功的代码生成
                local code_changes="${session_dir}/code-changes.md"
                if [[ -f "$code_changes" ]]; then
                    # 提取 TypeScript/React 代码块（示例）
                    grep -A 20 "typescript" "$code_changes" 2>/dev/null | head -50 >> "${patterns_dir}/extracted-$(date +%s).md" || true
                    extracted_count=$((extracted_count + 1))
                fi
            fi
        done
    fi
    
    echo "  提取了 $extracted_count 个潜在模式"
}

# 优化触发器
optimize_triggers() {
    local skill_path="$1"
    local skill_dir=$(get_skill_dir "$skill_path")
    
    echo -e "${CYAN}🎯 优化触发器...${NC}"
    
    # 从使用历史中学习新的触发模式
    local usage_history="${skill_dir}/usage-history.jsonl"
    
    if [[ -f "$usage_history" ]]; then
        # 分析高频查询
        local new_patterns=$(python3 << EOF
import json
from collections import Counter
import re

queries = []
with open('${usage_history}', 'r') as f:
    for line in f:
        if line.strip():
            try:
                data = json.loads(line)
                query = data.get('query', '')
                if query:
                    queries.append(query.lower())
            except:
                pass

# 提取常见关键词
keywords = []
for query in queries:
    # 简单的关键词提取
    words = re.findall(r'\b(创建|生成|添加|实现|优化|重构|定义)\b', query)
    keywords.extend(words)

if keywords:
    counter = Counter(keywords)
    print(f"发现高频关键词: {counter.most_common(3)}")
else:
    print("暂无足够数据优化触发器")
EOF
)
        echo "  $new_patterns"
    else
        echo "  暂无使用历史数据"
    fi
}

# 执行技能进化
evolve_skill() {
    local skill_name="$1"
    local force="${2:-false}"
    local dry_run="${3:-false}"
    
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}              进化技能: ${skill_name}${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    local skill_path=$(get_skill_path "$skill_name")
    if [[ -z "$skill_path" ]]; then
        echo -e "${RED}✗ 技能不存在: $skill_name${NC}"
        return 1
    fi
    
    local skill_dir=$(get_skill_dir "$skill_path")
    
    # 检查进化条件
    if [[ "$force" != "true" ]]; then
        local stats=$(get_skill_stats "$skill_name")
        local usage_count=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['usage_count'])")
        
        local config_file="${PROJECT_ROOT}/skills/evolution/config.yaml"
        local usage_threshold=$(grep "usage_threshold:" "$config_file" | awk '{print $2}')
        
        if [[ $usage_count -lt $usage_threshold ]]; then
            echo -e "${YELLOW}⚠ 使用次数不足，无法进化${NC}"
            echo "   当前: $usage_count, 需要: $usage_threshold"
            echo "   使用 --force 强制进化"
            return 1
        fi
    fi
    
    # 创建备份
    local backup_dir="${skill_dir}/.backups"
    mkdir -p "$backup_dir"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/skill-${timestamp}.yaml"
    
    if [[ "$dry_run" != "true" ]]; then
        cp "$skill_path" "$backup_file"
        echo -e "${GREEN}✓${NC} 已创建备份: $backup_file"
    fi
    
    # 执行进化步骤
    echo -e "\n${CYAN}🚀 开始进化过程${NC}"
    
    # 1. 提取新模式
    extract_patterns "$skill_name"
    
    # 2. 优化触发器
    optimize_triggers "$skill_path"
    
    # 3. 更新版本号
    local current_version=$(grep "version:" "$skill_path" | head -1 | awk '{print $2}')
    local new_version=$(echo "$current_version" | python3 -c "
import sys
v = sys.stdin.read().strip()
parts = v.split('.')
if len(parts) == 3:
    parts[2] = str(int(parts[2]) + 1)
    print('.'.join(parts))
else:
    print(v)
")
    
    if [[ "$dry_run" == "true" ]]; then
        echo -e "\n${YELLOW}[DRY RUN] 将更新版本: $current_version → $new_version${NC}"
    else
        # 实际更新版本
        sed -i '' "s/version: $current_version/version: $new_version/" "$skill_path"
        echo -e "${GREEN}✓${NC} 版本更新: $current_version → $new_version"
        
        # 添加进化记录
        local evolution_log="${skill_dir}/evolution-log.md"
        cat >> "$evolution_log" << EOF

## Evolution $(date '+%Y-%m-%d %H:%M:%S')

- 版本: $current_version → $new_version
- 触发原因: 使用次数达标
- 优化内容:
  - 提取新模式
  - 优化触发器
- 性能提升: 待评估
EOF
        
        echo -e "${GREEN}✓${NC} 进化完成！"
        echo "   新版本: $new_version"
        echo "   备份: $backup_file"
    fi
}

# 查看进化状态
show_status() {
    local skill_name="$1"
    
    if [[ -n "$skill_name" ]]; then
        analyze_skill "$skill_name"
    else
        # 列出所有技能的状态
        echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}                    技能进化状态概览                          ${NC}"
        echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
        
        printf "%-30s %-10s %-10s %-10s\n" "技能名称" "版本" "使用次数" "状态"
        echo "────────────────────────────────────────────────────────────────"
        
        for skill_file in "${PROJECT_ROOT}/skills"/*/*/skill.yaml; do
            if [[ -f "$skill_file" ]]; then
                local name=$(grep "^name:" "$skill_file" | head -1 | awk '{print $2}')
                local version=$(grep "version:" "$skill_file" | head -1 | awk '{print $2}')
                local stats=$(get_skill_stats "$name")
                local usage=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['usage_count'])")
                
                local status="${YELLOW}待进化${NC}"
                if [[ $usage -ge 10 ]]; then
                    status="${GREEN}可进化${NC}"
                fi
                
                printf "%-30s %-10s %-10s %-10s\n" "$name" "$version" "$usage" "$status"
            fi
        done
    fi
}

# 列出可进化的技能
list_evolveable() {
    echo -e "${BLUE}可进化的技能:${NC}\n"
    
    for skill_file in "${PROJECT_ROOT}/skills"/*/*/skill.yaml; do
        if [[ -f "$skill_file" ]]; then
            local name=$(grep "^name:" "$skill_file" | head -1 | awk '{print $2}')
            local stats=$(get_skill_stats "$name")
            local usage=$(echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['usage_count'])")
            
            if [[ $usage -ge 10 ]]; then
                local version=$(grep "version:" "$skill_file" | head -1 | awk '{print $2}')
                echo -e "${GREEN}✓${NC} $name (v$version) - 使用 $usage 次"
            fi
        fi
    done
}

# 回滚技能
rollback_skill() {
    local skill_name="$1"
    
    local skill_path=$(get_skill_path "$skill_name")
    if [[ -z "$skill_path" ]]; then
        echo -e "${RED}✗ 技能不存在: $skill_name${NC}"
        return 1
    fi
    
    local skill_dir=$(get_skill_dir "$skill_path")
    local backup_dir="${skill_dir}/.backups"
    
    if [[ ! -d "$backup_dir" ]]; then
        echo -e "${RED}✗ 没有可用的备份${NC}"
        return 1
    fi
    
    # 找到最新的备份
    local latest_backup=$(ls -t "$backup_dir"/skill-*.yaml 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        echo -e "${RED}✗ 没有找到备份文件${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}⚠ 即将回滚技能: $skill_name${NC}"
    echo "   备份文件: $latest_backup"
    read -p "   确认回滚? (y/N): " confirm
    
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        cp "$latest_backup" "$skill_path"
        echo -e "${GREEN}✓${NC} 已回滚到上一版本"
    else
        echo "已取消"
    fi
}

# ==================== 新技能发现功能 ====================

# 获取配置值
get_config_value() {
    local key="$1"
    local default="$2"
    local config_file="${PROJECT_ROOT}/skills/evolution/config.yaml"
    
    if [[ -f "$config_file" ]]; then
        local value=$(grep -E "^\s*${key}:" "$config_file" | head -1 | awk '{print $2}')
        if [[ -n "$value" ]]; then
            echo "$value"
            return
        fi
    fi
    echo "$default"
}

# 计算字符串相似度 (0-1)
calculate_similarity() {
    local str1="$1"
    local str2="$2"
    
    python3 << EOF
import difflib
s1 = """$str1"""
s2 = """$str2"""
similarity = difflib.SequenceMatcher(None, s1, s2).ratio()
print(f"{similarity:.2f}")
EOF
}

# 检查与现有技能的相似度
check_skill_similarity() {
    local pattern="$1"
    local threshold=$(get_config_value "similarity_threshold" "0.75")
    
    local max_similarity=0
    local similar_skill=""
    
    for skill_file in "${PROJECT_ROOT}"/skills/*/*/skill.yaml; do
        if [[ -f "$skill_file" ]]; then
            local skill_content=$(cat "$skill_file")
            local similarity=$(calculate_similarity "$pattern" "$skill_content")
            
            if (( $(echo "$similarity > $max_similarity" | bc -l) )); then
                max_similarity=$similarity
                similar_skill=$(basename "$(dirname "$skill_file")")
            fi
        fi
    done
    
    if (( $(echo "$max_similarity >= $threshold" | bc -l) )); then
        echo "similar:$similar_skill:$max_similarity"
        return 0
    else
        echo "unique:$max_similarity"
        return 1
    fi
}

# 从memory中提取代码模式
extract_patterns_from_memory() {
    local verbose="$1"
    
    local sessions_dir="${PROJECT_ROOT}/memory/sessions"
    local patterns_dir="${PROJECT_ROOT}/memory/patterns"
    mkdir -p "$patterns_dir"
    
    local min_frequency=$(get_config_value "min_pattern_frequency" "5")
    local min_sessions=$(get_config_value "min_session_samples" "3")
    local time_window=$(get_config_value "time_window_days" "30")
    local min_code_lines=$(get_config_value "min_code_lines" "5")
    local max_code_lines=$(get_config_value "max_code_lines" "100")
    
    if [[ "$verbose" == "true" ]]; then
        echo -e "${CYAN}🔍 扫描条件:${NC}"
        echo "  最小重复次数: $min_frequency"
        echo "  最小会话数: $min_sessions"
        echo "  时间窗口: ${time_window}天"
        echo "  代码行数范围: $min_code_lines-$max_code_lines"
    fi
    
    # 收集所有代码块
    local all_patterns="${patterns_dir}/extracted_patterns.jsonl"
    > "$all_patterns"
    
    local cutoff_date=$(date -v-${time_window}d +%Y%m%d 2>/dev/null || date -d "-${time_window} days" +%Y%m%d)
    
    if [[ -d "$sessions_dir" ]]; then
        for session_file in "$sessions_dir"/*.json; do
            if [[ -f "$session_file" ]]; then
                local session_date=$(basename "$session_file" | cut -d'-' -f1-3 | tr -d '-')
                
                # 检查时间窗口
                if [[ "$session_date" < "$cutoff_date" ]]; then
                    continue
                fi
                
                # 提取成功的代码变更
                python3 << EOF >> "$all_patterns"
import json
import re

session_file = "$session_file"
min_lines = $min_code_lines
max_lines = $max_code_lines

try:
    with open(session_file, 'r') as f:
        session = json.load(f)
    
    # 只处理成功的会话
    if session.get('status') != 'success':
        exit()
    
    session_id = session.get('id', '')
    
    # 从代码变更中提取模式
    code_changes = session.get('code_changes', [])
    for change in code_changes:
        code = change.get('code', '')
        language = change.get('language', 'unknown')
        
        lines = code.strip().split('\n')
        line_count = len(lines)
        
        if min_lines <= line_count <= max_lines:
            # 提取关键词
            keywords = re.findall(r'\b(def|class|function|const|let|var|import|from|return|if|for|while)\b', code)
            
            pattern_obj = {
                'session_id': session_id,
                'language': language,
                'line_count': line_count,
                'keywords': list(set(keywords)),
                'code': code[:500],  # 限制长度
                'timestamp': session.get('end_time', '')
            }
            print(json.dumps(pattern_obj, ensure_ascii=False))
except Exception as e:
    pass
EOF
            fi
        done
    fi
    
    echo "$all_patterns"
}

# 分析模式频率
analyze_pattern_frequency() {
    local patterns_file="$1"
    local verbose="$2"
    
    local min_frequency=$(get_config_value "min_pattern_frequency" "5")
    local min_sessions=$(get_config_value "min_session_samples" "3")
    
    python3 << EOF
import json
from collections import defaultdict
import hashlib

patterns_file = "$patterns_file"
min_freq = $min_frequency
min_sessions = $min_sessions

try:
    # 读取所有模式
    patterns = []
    with open(patterns_file, 'r') as f:
        for line in f:
            if line.strip():
                try:
                    patterns.append(json.loads(line))
                except:
                    pass
    
    # 按代码内容分组
    pattern_groups = defaultdict(lambda: {'count': 0, 'sessions': set(), 'languages': set()})
    
    for p in patterns:
        # 使用代码前100字符作为签名
        code_sig = p['code'][:100]
        sig_hash = hashlib.md5(code_sig.encode()).hexdigest()[:12]
        
        pattern_groups[sig_hash]['count'] += 1
        pattern_groups[sig_hash]['sessions'].add(p['session_id'])
        pattern_groups[sig_hash]['languages'].add(p['language'])
        pattern_groups[sig_hash]['code'] = p['code']
        pattern_groups[sig_hash]['keywords'] = p.get('keywords', [])
    
    # 筛选高频模式
    candidates = []
    for sig, data in pattern_groups.items():
        if data['count'] >= min_freq and len(data['sessions']) >= min_sessions:
            candidates.append({
                'signature': sig,
                'frequency': data['count'],
                'sessions': len(data['sessions']),
                'languages': list(data['languages']),
                'code': data['code'],
                'keywords': data['keywords']
            })
    
    # 按频率排序
    candidates.sort(key=lambda x: x['frequency'], reverse=True)
    
    print(json.dumps(candidates[:10], ensure_ascii=False, indent=2))
except Exception as e:
    print(f"[]")
EOF
}

# 生成技能名称建议
generate_skill_name() {
    local keywords="$1"
    local language="$2"
    
    python3 << EOF
import json
import re

keywords = json.loads('$keywords')
language = "$language"

# 提取动作词和名词
actions = ['create', 'generate', 'add', 'implement', 'optimize', 'refactor', 'define', 'build', 'setup']
nouns = ['component', 'function', 'class', 'module', 'service', 'hook', 'pattern', 'utility']

action = None
noun = None

for kw in keywords:
    kw_lower = kw.lower()
    if kw_lower in actions:
        action = kw_lower
    for n in nouns:
        if n in kw_lower or kw_lower in n:
            noun = n
            break

if not action:
    action = 'create'
if not noun:
    noun = 'component'

# 生成名称
if language and language != 'unknown':
    print(f"{language}-{action}-{noun}")
else:
    print(f"{action}-{noun}")
EOF
}

# 评估模式质量
evaluate_pattern_quality() {
    local code="$1"
    local frequency="$2"
    local sessions="$3"
    
    python3 << EOF
import json

code = """$code"""
frequency = $frequency
sessions = $sessions

# 质量评分维度
scores = {}

# 1. 复杂度评分 (基于代码结构)
complexity_indicators = ['if', 'for', 'while', 'switch', 'try', 'catch', 'async', 'await']
complexity_score = sum(1 for ind in complexity_indicators if ind in code) / len(complexity_indicators)
scores['complexity'] = min(complexity_score * 2, 1.0)  # 归一化到0-1

# 2. 完整性评分 (是否有导入、定义、返回等)
completeness = 0
if any(x in code for x in ['import', 'from', 'require']):
    completeness += 0.3
if any(x in code for x in ['def ', 'function ', 'class ', 'const ', 'let ', 'var ']):
    completeness += 0.4
if 'return' in code:
    completeness += 0.3
scores['completeness'] = completeness

# 3. 通用性评分 (频率和跨会话数)
scores['universality'] = min((frequency + sessions) / 20, 1.0)

# 4. 可读性评分 (注释、空行等)
readability = 0.5
if '#' in code or '//' in code:
    readability += 0.3
if code.count('\n\n') > 0:
    readability += 0.2
scores['readability'] = min(readability, 1.0)

# 综合评分
overall = sum(scores.values()) / len(scores)
scores['overall'] = overall

print(json.dumps(scores, indent=2))
EOF
}

# 发现新技能
discover_new_skills() {
    local verbose="${1:-false}"
    
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}              从 Memory 中发现新技能                          ${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    # 检查生成控制
    local max_proposals=$(get_config_value "max_proposals_per_week" "3")
    local proposals_dir="${PROJECT_ROOT}/skills/evolution/proposals"
    mkdir -p "$proposals_dir"
    
    local current_week=$(date +%Y%W)
    local week_proposals=$(find "$proposals_dir" -name "prop-${current_week}-*.json" 2>/dev/null | wc -l)
    
    if [[ $week_proposals -ge $max_proposals ]]; then
        echo -e "${YELLOW}⚠ 本周已达到最大提案数限制 ($max_proposals)${NC}"
        echo "   请审核现有提案或等待下周"
        return 0
    fi
    
    echo -e "${CYAN}📊 本周提案数: $week_proposals / $max_proposals${NC}\n"
    
    # 步骤1: 从memory提取模式
    echo -e "${CYAN}🔍 步骤1: 从会话记忆中提取代码模式...${NC}"
    local patterns_file=$(extract_patterns_from_memory "$verbose")
    local pattern_count=$(wc -l < "$patterns_file" | tr -d ' ')
    
    if [[ $pattern_count -eq 0 ]]; then
        echo -e "${YELLOW}⚠ 未找到足够的代码模式${NC}"
        echo "   提示: 需要至少 $(get_config_value "min_pattern_frequency" "5") 次重复且跨 $(get_config_value "min_session_samples" "3") 个会话"
        return 0
    fi
    
    echo -e "${GREEN}✓${NC} 提取了 $pattern_count 个代码片段"
    
    # 步骤2: 分析模式频率
    echo -e "\n${CYAN}📈 步骤2: 分析模式频率和分布...${NC}"
    local candidates=$(analyze_pattern_frequency "$patterns_file" "$verbose")
    local candidate_count=$(echo "$candidates" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
    
    if [[ $candidate_count -eq 0 ]]; then
        echo -e "${YELLOW}⚠ 未找到满足频率阈值的模式${NC}"
        return 0
    fi
    
    echo -e "${GREEN}✓${NC} 发现 $candidate_count 个候选模式"
    
    # 步骤3: 评估和筛选
    echo -e "\n${CYAN}🎯 步骤3: 评估候选模式质量...${NC}"
    
    local min_quality=$(get_config_value "min_quality_score" "0.8")
    local min_requirements=$(get_config_value "min_requirements_met" "4")
    local proposals_created=0
    
    # 使用临时文件避免管道问题
    local temp_candidates="${TEMP_DIR}/candidates.json"
    echo "$candidates" > "$temp_candidates"
    
    python3 << EOF > "${TEMP_DIR}/candidate_lines.txt"
import json
import sys

with open("$temp_candidates", 'r') as f:
    candidates = json.load(f)

for i, candidate in enumerate(candidates):
    # 输出候选信息供bash处理
    print(json.dumps(candidate, ensure_ascii=False))
EOF

    while read -r line; do
        local candidate="$line"
        local code=$(echo "$candidate" | python3 -c "import json,sys; print(json.load(sys.stdin)['code'])")
        local freq=$(echo "$candidate" | python3 -c "import json,sys; print(json.load(sys.stdin)['frequency'])")
        local sessions=$(echo "$candidate" | python3 -c "import json,sys; print(json.load(sys.stdin)['sessions'])")
        local sig=$(echo "$candidate" | python3 -c "import json,sys; print(json.load(sys.stdin)['signature'])")
        local keywords=$(echo "$candidate" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['keywords']))")
        local languages=$(echo "$candidate" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['languages']))")
        
        # 检查与现有技能的相似度
        local similarity_check=$(check_skill_similarity "$code")
        
        if [[ "$similarity_check" == similar:* ]]; then
            local similar_skill=$(echo "$similarity_check" | cut -d':' -f2)
            local sim_score=$(echo "$similarity_check" | cut -d':' -f3)
            if [[ "$verbose" == "true" ]]; then
                echo "  跳过: 与现有技能 '$similar_skill' 相似度过高 ($sim_score)"
            fi
            continue
        fi
        
        # 评估质量
        local quality=$(evaluate_pattern_quality "$code" "$freq" "$sessions")
        local overall_score=$(echo "$quality" | python3 -c "import json,sys; print(json.load(sys.stdin)['overall'])")
        
        if (( $(echo "$overall_score < $min_quality" | bc -l) )); then
            if [[ "$verbose" == "true" ]]; then
                echo "  跳过: 质量分数不足 ($overall_score < $min_quality)"
            fi
            continue
        fi
        
        # 生成技能名称
        local primary_lang=$(echo "$languages" | python3 -c "import json,sys; langs=json.load(sys.stdin); print(langs[0] if langs else 'unknown')")
        local suggested_name=$(generate_skill_name "$keywords" "$primary_lang")
        
        # 创建提案
        local proposal_id="prop-$(date +%Y%m%d)-${sig}"
        local proposal_file="${proposals_dir}/${proposal_id}.json"
        
        cat > "$proposal_file" << PROPOSAL
{
  "id": "$proposal_id",
  "status": "pending",
  "created_at": "$(date -Iseconds)",
  "suggested_name": "$suggested_name",
  "source": {
    "pattern_signature": "$sig",
    "frequency": $freq,
    "unique_sessions": $sessions,
    "languages": $languages,
    "keywords": $keywords
  },
  "quality_score": $overall_score,
  "quality_breakdown": $(echo "$quality"),
  "similarity_check": "$similarity_check",
  "code_sample": $(echo "$candidate" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['code']))"),
  "validation": {
    "syntax_valid": null,
    "no_duplicates": null,
    "naming_convention": null,
    "trigger_coverage": null
  },
  "review_notes": ""
}
PROPOSAL
        
        proposals_created=$((proposals_created + 1))
        
        echo -e "\n  ${GREEN}✓ 创建提案: $proposal_id${NC}"
        echo "    建议名称: $suggested_name"
        echo "    质量分数: $overall_score"
        echo "    出现频率: $freq 次 / $sessions 个会话"
        echo "    语言: $primary_lang"
    done < "${TEMP_DIR}/candidate_lines.txt"
    
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ 发现完成${NC}"
    echo "   创建提案数: $proposals_created"
    echo "   查看提案: $0 proposals"
    echo "   审核提案: $0 propose <proposal_id>"
}

# 列出所有提案
list_proposals() {
    local proposals_dir="${PROJECT_ROOT}/skills/evolution/proposals"
    
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    新技能提案列表                            ${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    
    if [[ ! -d "$proposals_dir" ]] || [[ -z $(ls -A "$proposals_dir" 2>/dev/null) ]]; then
        echo -e "${YELLOW}⚠ 暂无待审核提案${NC}"
        echo "   运行 '$0 discover' 发现新技能"
        return 0
    fi
    
    printf "\n%-25s %-20s %-10s %-8s %-12s\n" "提案ID" "建议名称" "质量分" "状态" "创建时间"
    echo "─────────────────────────────────────────────────────────────────────────────"
    
    for proposal_file in "$proposals_dir"/*.json; do
        if [[ -f "$proposal_file" ]]; then
            local id=$(basename "$proposal_file" .json)
            local name=$(grep '"suggested_name"' "$proposal_file" | cut -d'"' -f4)
            local score=$(grep '"quality_score"' "$proposal_file" | grep -o '[0-9.]\+' | head -1)
            local status=$(grep '"status"' "$proposal_file" | cut -d'"' -f4)
            local created=$(grep '"created_at"' "$proposal_file" | cut -d'"' -f4 | cut -d'T' -f1)
            
            local status_color="${YELLOW}"
            if [[ "$status" == "approved" ]]; then
                status_color="${GREEN}"
            elif [[ "$status" == "rejected" ]]; then
                status_color="${RED}"
            fi
            
            printf "%-25s %-20s %-10s ${status_color}%-8s${NC} %-12s\n" "$id" "$name" "$score" "$status" "$created"
        fi
    done
    
    echo -e "\n${CYAN}💡 操作提示:${NC}"
    echo "   查看详情: $0 propose <proposal_id>"
    echo "   批准创建: $0 propose <proposal_id> --approve"
    echo "   拒绝提案: $0 propose <proposal_id> --reject"
}

# 查看/处理单个提案
review_proposal() {
    local proposal_id="$1"
    local action="$2"  # view, approve, reject
    
    local proposals_dir="${PROJECT_ROOT}/skills/evolution/proposals"
    local proposal_file="${proposals_dir}/${proposal_id}.json"
    
    if [[ ! -f "$proposal_file" ]]; then
        echo -e "${RED}✗ 提案不存在: $proposal_id${NC}"
        return 1
    fi
    
    if [[ "$action" == "view" || -z "$action" ]]; then
        # 显示提案详情
        echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}                    提案详情                                  ${NC}"
        echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
        
        cat "$proposal_file" | python3 -m json.tool 2>/dev/null || cat "$proposal_file"
        
        echo -e "\n${CYAN}💡 操作选项:${NC}"
        echo "   批准: $0 propose $proposal_id --approve"
        echo "   拒绝: $0 propose $proposal_id --reject"
        
    elif [[ "$action" == "approve" ]]; then
        # 批准提案并创建技能
        echo -e "${CYAN}🚀 批准提案并创建新技能...${NC}"
        
        local suggested_name=$(grep '"suggested_name"' "$proposal_file" | cut -d'"' -f4)
        local code_sample=$(python3 -c "import json; print(json.load(open('$proposal_file'))['code_sample'][:200])")
        
        # 创建技能目录
        local skill_category="auto-generated"
        local skill_dir="${PROJECT_ROOT}/skills/${skill_category}/${suggested_name}"
        mkdir -p "$skill_dir"
        
        # 生成技能定义
        cat > "${skill_dir}/skill.yaml" << SKILL
name: ${suggested_name}
version: 1.0.0
description: Auto-generated skill from memory patterns
category: ${skill_category}
tags:
  - auto-generated
  - from-memory

triggers:
  - pattern: "${suggested_name}"
    confidence: 0.8

templates:
  - name: default
    template: |
$(echo "$code_sample" | sed 's/^/      /')

validation:
  - type: syntax
    required: true
  
  - type: pattern
    required: true

evolution:
  auto_optimize: true
  learning_enabled: true

# 创建信息
origin:
  source: memory_pattern
  proposal_id: ${proposal_id}
  created_at: $(date -Iseconds)
  quality_score: $(grep '"quality_score"' "$proposal_file" | grep -o '[0-9.]\+' | head -1)
SKILL
        
        # 更新提案状态
        python3 -c "
import json
with open('$proposal_file', 'r') as f:
    data = json.load(f)
data['status'] = 'approved'
data['approved_at'] = '$(date -Iseconds)'
data['created_skill_path'] = '$skill_dir'
with open('$proposal_file', 'w') as f:
    json.dump(data, f, indent=2)
"
        
        echo -e "${GREEN}✓${NC} 技能已创建: $skill_dir"
        echo -e "${GREEN}✓${NC} 提案已批准"
        
    elif [[ "$action" == "reject" ]]; then
        # 拒绝提案
        echo -e "${YELLOW}⚠ 拒绝提案...${NC}"
        
        python3 -c "
import json
with open('$proposal_file', 'r') as f:
    data = json.load(f)
data['status'] = 'rejected'
data['rejected_at'] = '$(date -Iseconds)'
with open('$proposal_file', 'w') as f:
    json.dump(data, f, indent=2)
"
        
        echo -e "${GREEN}✓${NC} 提案已拒绝"
    fi
}

# 主函数
main() {
    local command=""
    local skill_name=""
    local proposal_id=""
    local force=false
    local verbose=false
    local dry_run=false
    local proposal_action="view"  # view, approve, reject
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            analyze|evolve|status|dry-run|rollback)
                command="$1"
                skill_name="$2"
                shift 2
                ;;
            list|discover|proposals)
                command="$1"
                shift
                ;;
            propose)
                command="$1"
                proposal_id="$2"
                shift 2
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --approve)
                proposal_action="approve"
                shift
                ;;
            --reject)
                proposal_action="reject"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    case "$command" in
        analyze)
            if [[ -z "$skill_name" ]]; then
                echo -e "${RED}✗ 请提供技能名称${NC}"
                exit 1
            fi
            analyze_skill "$skill_name" "$verbose"
            ;;
        evolve)
            if [[ -z "$skill_name" ]]; then
                echo -e "${RED}✗ 请提供技能名称${NC}"
                exit 1
            fi
            evolve_skill "$skill_name" "$force" "$dry_run"
            ;;
        status)
            show_status "$skill_name"
            ;;
        list)
            list_evolveable
            ;;
        dry-run)
            if [[ -z "$skill_name" ]]; then
                echo -e "${RED}✗ 请提供技能名称${NC}"
                exit 1
            fi
            evolve_skill "$skill_name" "$force" "true"
            ;;
        rollback)
            if [[ -z "$skill_name" ]]; then
                echo -e "${RED}✗ 请提供技能名称${NC}"
                exit 1
            fi
            rollback_skill "$skill_name"
            ;;
        discover)
            discover_new_skills "$verbose"
            ;;
        proposals)
            list_proposals
            ;;
        propose)
            if [[ -z "$proposal_id" ]]; then
                echo -e "${RED}✗ 请提供提案ID${NC}"
                exit 1
            fi
            review_proposal "$proposal_id" "$proposal_action"
            ;;
        *)
            show_help
            ;;
    esac
}

main "$@"
