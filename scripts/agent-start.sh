#!/bin/bash
# agent-start.sh - 启动指定的 Agent
#
# Usage: agent-start.sh <agent-name> [options]
#   --task <file>       指定任务文件
#   --context <dir>     指定上下文目录
#   --output <dir>      指定输出目录
#   --interactive       交互式模式
#   --verbose           显示详细输出
#   --help              显示帮助

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="${PROJECT_ROOT}/agents"
RUNTIME_DIR="${PROJECT_ROOT}/runtime"
MEMORY_DIR="${PROJECT_ROOT}/memory"

# 默认配置
AGENT_NAME=""
TASK_FILE=""
CONTEXT_DIR=""
OUTPUT_DIR=""
INTERACTIVE=false
VERBOSE=false
DAEMON=false

# Agent 状态
AGENT_PID=""
SESSION_ID=""
START_TIME=$(date +%s)

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
Usage: $(basename "$0") <agent-name> [options]

启动指定的 Agent，加载其配置并开始工作会话。

Arguments:
  agent-name          要启动的 Agent 名称

Options:
  --task <file>       指定任务描述文件
  --context <dir>     指定上下文目录
  --output <dir>      指定输出目录
  --interactive       交互式模式，提示输入
  --verbose           显示详细输出
  --daemon            后台运行模式
  --help              显示此帮助

Examples:
  $(basename "$0") implementer                    # 启动 implementer agent
  $(basename "$0") researcher --task task.md      # 带任务文件启动
  $(basename "$0") reviewer --interactive         # 交互式启动

EOF
}

# 解析参数
parse_args() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    AGENT_NAME="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            --task)
                TASK_FILE="$2"
                shift 2
                ;;
            --context)
                CONTEXT_DIR="$2"
                shift 2
                ;;
            --output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --interactive)
                INTERACTIVE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --daemon)
                DAEMON=true
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

# 验证 Agent 存在
validate_agent() {
    local agent_file="${AGENTS_DIR}/${AGENT_NAME}.yaml"

    if [[ ! -f "$agent_file" ]]; then
        log_error "Agent not found: $AGENT_NAME"
        log_info "Available agents:"
        list_available_agents
        exit 1
    fi

    echo "$agent_file"
}

# 列出可用 Agents
list_available_agents() {
    for agent_file in "$AGENTS_DIR"/*.yaml; do
        if [[ -f "$agent_file" ]]; then
            local name=$(basename "$agent_file" .yaml)
            local agent_type=$(grep "^type:" "$agent_file" 2>/dev/null | head -1 | cut -d':' -f2- | sed 's/^[[:space:]]*//' || echo "unknown")
            echo "  - $name ($agent_type)"
        fi
    done
}

# 解析 Agent 配置
parse_agent_config() {
    local agent_file="$1"

    if command -v python3 &> /dev/null; then
        python3 -c "
import yaml
try:
    with open('$agent_file', 'r') as f:
        data = yaml.safe_load(f)
        if data:
            print('NAME=' + str(data.get('name', '')))
            print('TYPE=' + str(data.get('type', '')))
            desc = data.get('description', '')
            print('DESCRIPTION=' + desc.split('\n')[0] if desc else '')
            
            model = data.get('model', {})
            print('MODEL_PROVIDER=' + str(model.get('provider', '')))
            print('MODEL_NAME=' + str(model.get('model', '')))
            print('TEMPERATURE=' + str(model.get('temperature', 0.3)))
            
            skills = data.get('skills', [])
            print('SKILLS=' + ','.join(skills))
            
            eval_config = data.get('evaluation', {})
            print('AUTO_EVAL=' + str(eval_config.get('auto_run', False)))
except Exception as e:
    print('NAME=')
    print('TYPE=unknown')
    print('DESCRIPTION=')
    print('MODEL_PROVIDER=')
    print('MODEL_NAME=')
    print('TEMPERATURE=0.3')
    print('SKILLS=')
    print('AUTO_EVAL=false')
" 2>/dev/null
    else
        # 简单解析
        echo "NAME=$AGENT_NAME"
        echo "TYPE=$(grep "^type:" "$agent_file" | head -1 | cut -d':' -f2- | sed 's/^[[:space:]]*//' || echo unknown)"
        echo "DESCRIPTION=$(grep "^description:" "$agent_file" | head -1 | cut -d'|' -f2- | sed 's/^[[:space:]]*//' || echo '')"
        echo "MODEL_PROVIDER=anthropic"
        echo "MODEL_NAME=claude-3-5-sonnet"
        echo "TEMPERATURE=0.3"
        echo "SKILLS="
        echo "AUTO_EVAL=false"
    fi
}

# 创建会话目录
create_session() {
    SESSION_ID="${AGENT_NAME}-$(date +%Y%m%d-%H%M%S)"
    local session_dir="${RUNTIME_DIR}/sessions/${SESSION_ID}"

    mkdir -p "$session_dir"
    mkdir -p "${session_dir}/logs"
    mkdir -p "${session_dir}/outputs"
    mkdir -p "${session_dir}/checkpoints"

    # 保存会话信息
    cat > "${session_dir}/session.json" << EOF
{
  "session_id": "$SESSION_ID",
  "agent": "$AGENT_NAME",
  "start_time": "$(date -Iseconds)",
  "status": "running",
  "task_file": "$TASK_FILE",
  "context_dir": "$CONTEXT_DIR",
  "output_dir": "$OUTPUT_DIR"
}
EOF

    echo "$session_dir"
}

# 激活技能
activate_skills() {
    local skills="$1"
    local session_dir="$2"

    if [[ -z "$skills" ]]; then
        return
    fi

    log_step "Activating skills..."

    local activated=()
    IFS=',' read -ra SKILL_LIST <<< "$skills"

    for skill in "${SKILL_LIST[@]}"; do
        skill=$(echo "$skill" | xargs)  # 去除空格
        if [[ -f "${SCRIPT_DIR}/skill-activate.sh" ]]; then
            if bash "${SCRIPT_DIR}/skill-activate.sh" "$skill" --quiet 2>/dev/null; then
                activated+=("$skill")
                [[ "$VERBOSE" == true ]] && log_success "  Activated: $skill"
            else
                log_warning "  Failed to activate: $skill"
            fi
        fi
    done

    # 记录激活的技能
    echo "${activated[*]}" > "${session_dir}/activated-skills.txt"

    if [[ ${#activated[@]} -gt 0 ]]; then
        log_success "Activated ${#activated[@]} skills"
    fi
}

# 加载上下文
load_context() {
    local agent_file="$1"
    local session_dir="$2"

    log_step "Loading context..."

    local context_files=()

    # 从 Agent 配置中提取上下文优先级
    if command -v python3 &> /dev/null; then
        while IFS= read -r file; do
            if [[ -f "${PROJECT_ROOT}/${file}" ]]; then
                context_files+=("$file")
            fi
        done < <(python3 -c "
import yaml
try:
    with open('$agent_file', 'r') as f:
        data = yaml.safe_load(f)
        ctx = data.get('context', {})
        for f in ctx.get('priority', []):
            print(f)
except:
    pass
" 2>/dev/null)
    fi

    # 默认上下文文件
    local default_contexts=("CLAUDE.md" "DECISIONS.md" "PROGRESS.md")
    for ctx in "${default_contexts[@]}"; do
        if [[ -f "${PROJECT_ROOT}/${ctx}" && ! " ${context_files[@]} " =~ " ${ctx} " ]]; then
            context_files+=("$ctx")
        fi
    done

    # 复制上下文到会话目录
    local context_dest="${session_dir}/context"
    mkdir -p "$context_dest"

    for ctx in "${context_files[@]}"; do
        if [[ -f "${PROJECT_ROOT}/${ctx}" ]]; then
            cp "${PROJECT_ROOT}/${ctx}" "$context_dest/"
            [[ "$VERBOSE" == true ]] && log_info "  Loaded: $ctx"
        fi
    done

    # 加载任务文件
    if [[ -n "$TASK_FILE" && -f "$TASK_FILE" ]]; then
        cp "$TASK_FILE" "${context_dest}/TASK.md"
        log_success "Task file loaded"
    fi

    log_success "Context loaded (${#context_files[@]} files)"
}

# 启动 Agent 会话
start_agent_session() {
    local agent_file="$1"
    local session_dir="$2"

    log_step "Starting agent session..."

    # 创建启动脚本
    local start_script="${session_dir}/start.sh"
    cat > "$start_script" << 'EOF'
#!/bin/bash
# Auto-generated agent session starter

SESSION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME="$(grep '"agent":' "${SESSION_DIR}/session.json" | cut -d'"' -f4)"

echo "═══════════════════════════════════════════════════════════════"
echo "  Agent Session: $AGENT_NAME"
echo "  Session ID: $(basename "$SESSION_DIR")"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Context files:"
ls -1 "${SESSION_DIR}/context/" 2>/dev/null | sed 's/^/  - /'
echo ""
echo "Activated skills:"
cat "${SESSION_DIR}/activated-skills.txt" 2>/dev/null | tr ' ' '\n' | sed 's/^/  - /'
echo ""
echo "Logs: ${SESSION_DIR}/logs/"
echo "Outputs: ${SESSION_DIR}/outputs/"
echo ""
echo "Agent is ready. Press Ctrl+C to stop."
echo "═══════════════════════════════════════════════════════════════"

# 保持运行
tail -f /dev/null
EOF

    chmod +x "$start_script"

    if [[ "$DAEMON" == true ]]; then
        # 后台运行
        nohup "$start_script" > "${session_dir}/logs/agent.log" 2>&1 &
        AGENT_PID=$!
        echo "$AGENT_PID" > "${session_dir}/agent.pid"
        log_success "Agent started in background (PID: $AGENT_PID)"
    else
        # 更新会话状态
        cat > "${session_dir}/session.json" << EOF
{
  "session_id": "$SESSION_ID",
  "agent": "$AGENT_NAME",
  "start_time": "$(date -Iseconds)",
  "status": "active",
  "task_file": "$TASK_FILE",
  "context_dir": "$CONTEXT_DIR",
  "output_dir": "$OUTPUT_DIR"
}
EOF

        log_success "Agent session ready"
        echo ""
        echo "═══════════════════════════════════════════════════════════════"
        echo "  Agent:      $AGENT_NAME"
        echo "  Session:    $SESSION_ID"
        echo "  SessionDir: $session_dir"
        echo "═══════════════════════════════════════════════════════════════"

        # 如果不是守护模式，显示会话信息
        if [[ "$INTERACTIVE" == true ]]; then
            echo ""
            echo "Interactive mode. Available commands:"
            echo "  status    - Show session status"
            echo "  context   - List context files"
            echo "  skills    - List activated skills"
            echo "  stop      - Stop session"
            echo ""

            # 简单的交互式循环
            while true; do
                echo -n "[$AGENT_NAME] > "
                read -r cmd

                case "$cmd" in
                    status)
                        cat "${session_dir}/session.json"
                        ;;
                    context)
                        ls -la "${session_dir}/context/" 2>/dev/null || echo "No context files"
                        ;;
                    skills)
                        cat "${session_dir}/activated-skills.txt" 2>/dev/null || echo "No skills activated"
                        ;;
                    stop|exit|quit)
                        stop_session "$session_dir"
                        break
                        ;;
                    *)
                        echo "Unknown command: $cmd"
                        ;;
                esac
            done
        fi
    fi
}

# 停止会话
stop_session() {
    local session_dir="$1"

    log_step "Stopping session..."

    # 更新会话状态
    cat > "${session_dir}/session.json" << EOF
{
  "session_id": "$SESSION_ID",
  "agent": "$AGENT_NAME",
  "start_time": "$(date -Iseconds)",
  "end_time": "$(date -Iseconds)",
  "status": "stopped"
}
EOF

    # 如果有 PID 文件，终止进程
    if [[ -f "${session_dir}/agent.pid" ]]; then
        local pid=$(cat "${session_dir}/agent.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    fi

    log_success "Session stopped"
}

# 记录遥测
record_telemetry() {
    local event="$1"
    local session_dir="$2"

    if [[ -f "${PROJECT_ROOT}/hooks/session-start.sh" ]]; then
        local timestamp=$(date -Iseconds)

        # 调用 session hook
        export SESSION_ID
        export AGENT_NAME
        export SESSION_DIR="$session_dir"

        if [[ "$event" == "start" ]]; then
            bash "${PROJECT_ROOT}/hooks/session-start.sh" 2>/dev/null || true
        fi
    fi
}

# 主函数
main() {
    parse_args "$@"

    # 创建运行时目录
    mkdir -p "$RUNTIME_DIR"

    # 验证 Agent
    local agent_file=$(validate_agent)

    # 解析配置
    log_step "Loading agent configuration..."
    eval "$(parse_agent_config "$agent_file")"

    if [[ "$VERBOSE" == true ]]; then
        log_info "Agent: $NAME"
        log_info "Type: $TYPE"
        log_info "Model: $MODEL_PROVIDER/$MODEL_NAME"
        log_info "Skills: $SKILLS"
    fi

    # 创建会话
    local session_dir=$(create_session)
    log_success "Session created: $SESSION_ID"

    # 激活技能
    activate_skills "$SKILLS" "$session_dir"

    # 加载上下文
    load_context "$agent_file" "$session_dir"

    # 记录遥测
    record_telemetry "start" "$session_dir"

    # 启动会话
    start_agent_session "$agent_file" "$session_dir"

    log_success "Agent '$AGENT_NAME' started successfully"
}

main "$@"
