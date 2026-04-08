#!/bin/bash
#
# Sandbox Manager - 沙箱执行系统
# 支持 Local、Docker、K8s 三种沙箱模式
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 沙箱配置
SANDBOX_DIR="${PROJECT_ROOT}/runtime/sandbox"
DEFAULT_PROVIDER="${SANDBOX_PROVIDER:-local}"
DEFAULT_TIMEOUT="${SANDBOX_TIMEOUT:-60}"
DEFAULT_CPU="${SANDBOX_CPU:-1.0}"
DEFAULT_MEMORY="${SANDBOX_MEMORY:-512m}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[SANDBOX]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 初始化沙箱系统
init_sandbox_system() {
    log_info "Initializing sandbox system..."
    
    if [[ ! -d "$SANDBOX_DIR" ]]; then
        mkdir -p "$SANDBOX_DIR"/{local,docker,k8s}
        log_info "Created sandbox directories"
    fi
    
    # 检查 Docker 可用性
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        log_success "Docker is available"
    else
        log_warn "Docker is not available, falling back to local sandbox"
    fi
    
    log_success "Sandbox system initialized"
}

# 生成沙箱 ID
generate_sandbox_id() {
    local provider="$1"
    local timestamp
    timestamp=$(date +%s)
    local random_suffix
    random_suffix=$(openssl rand -hex 4)
    echo "${provider}-${timestamp}-${random_suffix}"
}

# ==================== Local Sandbox ====================

# 创建 Local Sandbox
create_local_sandbox() {
    local sandbox_id="$1"
    local sandbox_dir="$SANDBOX_DIR/local/$sandbox_id"
    
    log_info "Creating local sandbox: $sandbox_id"
    
    # 创建沙箱目录结构
    mkdir -p "$sandbox_dir"/{workspace,tmp,logs}
    
    # 创建沙箱配置
    cat > "$sandbox_dir/config.yaml" << EOF
sandbox:
  id: "$sandbox_id"
  provider: local
  created_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  status: ready
  
resources:
  cpu: $DEFAULT_CPU
  memory: $DEFAULT_MEMORY
  timeout: $DEFAULT_TIMEOUT
  
security:
  network_access: false
  file_system: restricted
  allowed_paths:
    - $sandbox_dir/workspace
    - $sandbox_dir/tmp
EOF
    
    log_success "Local sandbox created: $sandbox_id"
    echo "$sandbox_id"
}

# 在 Local Sandbox 中执行命令
exec_local_command() {
    local sandbox_id="$1"
    shift
    local command="$*"
    
    local sandbox_dir="$SANDBOX_DIR/local/$sandbox_id"
    local config_file="$sandbox_dir/config.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Sandbox not found: $sandbox_id"
        return 1
    fi
    
    log_info "Executing in local sandbox $sandbox_id: $command"
    
    # 更新状态
    sed -i '' 's/status: ready/status: running/' "$config_file"
    
    # 记录执行
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] $command" >> "$sandbox_dir/logs/exec.log"
    
    # 执行命令（限制资源）
    local timeout_seconds
    timeout_seconds=$(grep "timeout:" "$config_file" | awk '{print $2}')
    
    (
        cd "$sandbox_dir/workspace"
        # 使用 timeout 限制执行时间
        timeout "$timeout_seconds" bash -c "$command" 2>&1
    ) || {
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log_error "Command timed out after ${timeout_seconds}s"
        fi
        return $exit_code
    }
    
    # 更新状态
    sed -i '' 's/status: running/status: ready/' "$config_file"
    
    log_success "Command completed in sandbox: $sandbox_id"
}

# 在 Local Sandbox 中执行 Python
exec_local_python() {
    local sandbox_id="$1"
    shift
    local code="$*"
    
    local sandbox_dir="$SANDBOX_DIR/local/$sandbox_id"
    local script_file="$sandbox_dir/tmp/script_$(date +%s).py"
    
    # 写入代码
    echo "$code" > "$script_file"
    
    log_info "Executing Python in sandbox $sandbox_id"
    
    # 执行 Python
    exec_local_command "$sandbox_id" "python3 $script_file"
}

# 销毁 Local Sandbox
destroy_local_sandbox() {
    local sandbox_id="$1"
    local sandbox_dir="$SANDBOX_DIR/local/$sandbox_id"
    
    if [[ -d "$sandbox_dir" ]]; then
        rm -rf "$sandbox_dir"
        log_success "Local sandbox destroyed: $sandbox_id"
    else
        log_warn "Sandbox not found: $sandbox_id"
    fi
}

# ==================== Docker Sandbox ====================

# 创建 Docker Sandbox
create_docker_sandbox() {
    local sandbox_id="$1"
    local image="${2:-python:3.11-slim}"
    
    log_info "Creating Docker sandbox: $sandbox_id"
    
    local sandbox_dir="$SANDBOX_DIR/docker/$sandbox_id"
    mkdir -p "$sandbox_dir"/{workspace,logs}
    
    # 创建沙箱配置
    cat > "$sandbox_dir/config.yaml" << EOF
sandbox:
  id: "$sandbox_id"
  provider: docker
  image: "$image"
  created_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  status: creating
  
resources:
  cpu: $DEFAULT_CPU
  memory: ${DEFAULT_MEMORY%m}m
  timeout: $DEFAULT_TIMEOUT
  
security:
  network_mode: none
  read_only: false
  cap_drop:
    - ALL
  cap_add:
    - CHOWN
    - SETUID
    - SETGID
EOF
    
    # 启动容器
    local container_name="sandbox-$sandbox_id"
    if docker run -d \
        --name "$container_name" \
        --network none \
        --cpus="$DEFAULT_CPU" \
        --memory="${DEFAULT_MEMORY%m}m" \
        --cap-drop ALL \
        --cap-add CHOWN \
        --cap-add SETUID \
        --cap-add SETGID \
        -v "$sandbox_dir/workspace:/workspace" \
        -w /workspace \
        "$image" \
        tail -f /dev/null &> /dev/null; then
        
        # 更新状态
        sed -i '' 's/status: creating/status: ready/' "$sandbox_dir/config.yaml"
        log_success "Docker sandbox created: $sandbox_id"
        echo "$sandbox_id"
    else
        log_error "Failed to create Docker sandbox"
        return 1
    fi
}

# 在 Docker Sandbox 中执行命令
exec_docker_command() {
    local sandbox_id="$1"
    shift
    local command="$*"
    
    local container_name="sandbox-$sandbox_id"
    local sandbox_dir="$SANDBOX_DIR/docker/$sandbox_id"
    local config_file="$sandbox_dir/config.yaml"
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_error "Docker sandbox not running: $sandbox_id"
        return 1
    fi
    
    log_info "Executing in Docker sandbox $sandbox_id: $command"
    
    # 更新状态
    sed -i '' 's/status: ready/status: running/' "$config_file"
    
    # 记录执行
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] $command" >> "$sandbox_dir/logs/exec.log"
    
    # 执行命令
    local timeout_seconds
    timeout_seconds=$(grep "timeout:" "$config_file" | awk '{print $2}')
    
    timeout "$timeout_seconds" docker exec "$container_name" bash -c "$command" 2>&1 || {
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log_error "Command timed out after ${timeout_seconds}s"
        fi
        sed -i '' 's/status: running/status: ready/' "$config_file"
        return $exit_code
    }
    
    # 更新状态
    sed -i '' 's/status: running/status: ready/' "$config_file"
    
    log_success "Command completed in Docker sandbox: $sandbox_id"
}

# 在 Docker Sandbox 中执行 Python
exec_docker_python() {
    local sandbox_id="$1"
    shift
    local code="$*"
    
    log_info "Executing Python in Docker sandbox $sandbox_id"
    exec_docker_command "$sandbox_id" "python3 -c '$code'"
}

# 销毁 Docker Sandbox
destroy_docker_sandbox() {
    local sandbox_id="$1"
    local container_name="sandbox-$sandbox_id"
    local sandbox_dir="$SANDBOX_DIR/docker/$sandbox_id"
    
    # 停止并删除容器
    if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
        docker stop "$container_name" &> /dev/null || true
        docker rm "$container_name" &> /dev/null || true
        log_info "Docker container removed: $container_name"
    fi
    
    # 删除目录
    if [[ -d "$sandbox_dir" ]]; then
        rm -rf "$sandbox_dir"
        log_success "Docker sandbox destroyed: $sandbox_id"
    fi
}

# ==================== K8s Sandbox ====================

# 创建 K8s Sandbox
create_k8s_sandbox() {
    local sandbox_id="$1"
    local namespace="${2:-default}"
    
    log_info "Creating K8s sandbox: $sandbox_id"
    
    local pod_name="sandbox-$sandbox_id"
    local sandbox_dir="$SANDBOX_DIR/k8s/$sandbox_id"
    mkdir -p "$sandbox_dir"
    
    # 创建 Pod 定义
    cat > "$sandbox_dir/pod.yaml" << EOF
apiVersion: v1
kind: Pod
metadata:
  name: $pod_name
  namespace: $namespace
  labels:
    app: sandbox
    sandbox-id: $sandbox_id
spec:
  containers:
  - name: sandbox
    image: python:3.11-slim
    command: ["sleep", "3600"]
    resources:
      limits:
        cpu: "${DEFAULT_CPU}"
        memory: "$DEFAULT_MEMORY"
      requests:
        cpu: "100m"
        memory: "128Mi"
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: false
      runAsNonRoot: true
      runAsUser: 1000
    volumeMounts:
    - name: workspace
      mountPath: /workspace
  volumes:
  - name: workspace
    emptyDir: {}
  restartPolicy: Never
EOF
    
    # 创建沙箱配置
    cat > "$sandbox_dir/config.yaml" << EOF
sandbox:
  id: "$sandbox_id"
  provider: k8s
  namespace: "$namespace"
  pod_name: "$pod_name"
  created_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  status: creating
  
resources:
  cpu: $DEFAULT_CPU
  memory: $DEFAULT_MEMORY
  timeout: $DEFAULT_TIMEOUT
EOF
    
    # 创建 Pod
    if kubectl apply -f "$sandbox_dir/pod.yaml" &> /dev/null; then
        log_info "Waiting for pod to be ready..."
        kubectl wait --for=condition=Ready pod/"$pod_name" -n "$namespace" --timeout=60s &> /dev/null
        
        # 更新状态
        sed -i '' 's/status: creating/status: ready/' "$sandbox_dir/config.yaml"
        log_success "K8s sandbox created: $sandbox_id"
        echo "$sandbox_id"
    else
        log_error "Failed to create K8s sandbox"
        return 1
    fi
}

# 在 K8s Sandbox 中执行命令
exec_k8s_command() {
    local sandbox_id="$1"
    shift
    local command="$*"
    
    local sandbox_dir="$SANDBOX_DIR/k8s/$sandbox_id"
    local config_file="$sandbox_dir/config.yaml"
    
    local pod_name namespace
    pod_name=$(grep "pod_name:" "$config_file" | awk '{print $2}')
    namespace=$(grep "namespace:" "$config_file" | awk '{print $2}')
    
    log_info "Executing in K8s sandbox $sandbox_id: $command"
    
    # 更新状态
    sed -i '' 's/status: ready/status: running/' "$config_file"
    
    # 执行命令
    kubectl exec "$pod_name" -n "$namespace" -- bash -c "$command" 2>&1 || {
        local exit_code=$?
        sed -i '' 's/status: running/status: ready/' "$config_file"
        return $exit_code
    }
    
    # 更新状态
    sed -i '' 's/status: running/status: ready/' "$config_file"
    
    log_success "Command completed in K8s sandbox: $sandbox_id"
}

# 销毁 K8s Sandbox
destroy_k8s_sandbox() {
    local sandbox_id="$1"
    local sandbox_dir="$SANDBOX_DIR/k8s/$sandbox_id"
    
    if [[ -f "$sandbox_dir/config.yaml" ]]; then
        local pod_name namespace
        pod_name=$(grep "pod_name:" "$sandbox_dir/config.yaml" | awk '{print $2}')
        namespace=$(grep "namespace:" "$sandbox_dir/config.yaml" | awk '{print $2}')
        
        # 删除 Pod
        kubectl delete pod "$pod_name" -n "$namespace" --grace-period=0 --force &> /dev/null || true
        log_info "K8s pod deleted: $pod_name"
    fi
    
    # 删除目录
    if [[ -d "$sandbox_dir" ]]; then
        rm -rf "$sandbox_dir"
        log_success "K8s sandbox destroyed: $sandbox_id"
    fi
}

# ==================== 通用接口 ====================

# 创建沙箱（根据 provider 自动选择）
create_sandbox() {
    local provider="${1:-$DEFAULT_PROVIDER}"
    
    case "$provider" in
        local)
            local sandbox_id
            sandbox_id=$(generate_sandbox_id "local")
            create_local_sandbox "$sandbox_id"
            ;;
        docker)
            if ! command -v docker &> /dev/null || ! docker info &> /dev/null; then
                log_warn "Docker not available, falling back to local sandbox"
                local sandbox_id
                sandbox_id=$(generate_sandbox_id "local")
                create_local_sandbox "$sandbox_id"
            else
                local sandbox_id
                sandbox_id=$(generate_sandbox_id "docker")
                create_docker_sandbox "$sandbox_id"
            fi
            ;;
        k8s|kubernetes)
            if ! command -v kubectl &> /dev/null; then
                log_warn "kubectl not available, falling back to docker"
                create_sandbox "docker"
            else
                local sandbox_id
                sandbox_id=$(generate_sandbox_id "k8s")
                create_k8s_sandbox "$sandbox_id"
            fi
            ;;
        *)
            log_error "Unknown provider: $provider"
            return 1
            ;;
    esac
}

# 执行命令（根据沙箱类型自动选择）
exec_in_sandbox() {
    local sandbox_id="$1"
    shift
    local command="$*"
    
    # 检测沙箱类型
    if [[ -d "$SANDBOX_DIR/local/$sandbox_id" ]]; then
        exec_local_command "$sandbox_id" "$command"
    elif [[ -d "$SANDBOX_DIR/docker/$sandbox_id" ]]; then
        exec_docker_command "$sandbox_id" "$command"
    elif [[ -d "$SANDBOX_DIR/k8s/$sandbox_id" ]]; then
        exec_k8s_command "$sandbox_id" "$command"
    else
        log_error "Sandbox not found: $sandbox_id"
        return 1
    fi
}

# 执行 Python 代码
exec_python_in_sandbox() {
    local sandbox_id="$1"
    shift
    local code="$*"
    
    # 检测沙箱类型
    if [[ -d "$SANDBOX_DIR/local/$sandbox_id" ]]; then
        exec_local_python "$sandbox_id" "$code"
    elif [[ -d "$SANDBOX_DIR/docker/$sandbox_id" ]]; then
        exec_docker_python "$sandbox_id" "$code"
    elif [[ -d "$SANDBOX_DIR/k8s/$sandbox_id" ]]; then
        exec_k8s_command "$sandbox_id" "python3 -c '$code'"
    else
        log_error "Sandbox not found: $sandbox_id"
        return 1
    fi
}

# 销毁沙箱（根据类型自动选择）
destroy_sandbox() {
    local sandbox_id="$1"
    
    if [[ -d "$SANDBOX_DIR/local/$sandbox_id" ]]; then
        destroy_local_sandbox "$sandbox_id"
    elif [[ -d "$SANDBOX_DIR/docker/$sandbox_id" ]]; then
        destroy_docker_sandbox "$sandbox_id"
    elif [[ -d "$SANDBOX_DIR/k8s/$sandbox_id" ]]; then
        destroy_k8s_sandbox "$sandbox_id"
    else
        log_error "Sandbox not found: $sandbox_id"
        return 1
    fi
}

# 列出所有沙箱
list_sandboxes() {
    local provider="${1:-all}"
    
    printf "%-40s %-10s %-20s %-10s\n" "SANDBOX_ID" "PROVIDER" "CREATED_AT" "STATUS"
    printf "%-40s %-10s %-20s %-10s\n" "----------------------------------------" "----------" "--------------------" "----------"
    
    list_provider_sandboxes() {
        local p="$1"
        local dir="$SANDBOX_DIR/$p"
        
        if [[ -d "$dir" ]]; then
            for sandbox_dir in "$dir"/*; do
                if [[ -d "$sandbox_dir" ]]; then
                    local config_file="$sandbox_dir/config.yaml"
                    if [[ -f "$config_file" ]]; then
                        local id created_at status
                        id=$(grep "^  id:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                        created_at=$(grep "^  created_at:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                        status=$(grep "^  status:" "$config_file" | head -1 | awk '{print $2}' | tr -d '"')
                        printf "%-40s %-10s %-20s %-10s\n" "$id" "$p" "$created_at" "$status"
                    fi
                fi
            done
        fi
    }
    
    if [[ "$provider" == "all" ]]; then
        list_provider_sandboxes "local"
        list_provider_sandboxes "docker"
        list_provider_sandboxes "k8s"
    else
        list_provider_sandboxes "$provider"
    fi
}

# 清理所有沙箱
cleanup_sandboxes() {
    log_info "Cleaning up all sandboxes..."
    
    local cleaned=0
    
    # 清理 local
    for sandbox_dir in "$SANDBOX_DIR/local"/*; do
        if [[ -d "$sandbox_dir" ]]; then
            local sandbox_id
            sandbox_id=$(basename "$sandbox_dir")
            destroy_local_sandbox "$sandbox_id"
            ((cleaned++))
        fi
    done
    
    # 清理 docker
    for sandbox_dir in "$SANDBOX_DIR/docker"/*; do
        if [[ -d "$sandbox_dir" ]]; then
            local sandbox_id
            sandbox_id=$(basename "$sandbox_dir")
            destroy_docker_sandbox "$sandbox_id"
            ((cleaned++))
        fi
    done
    
    # 清理 k8s
    for sandbox_dir in "$SANDBOX_DIR/k8s"/*; do
        if [[ -d "$sandbox_dir" ]]; then
            local sandbox_id
            sandbox_id=$(basename "$sandbox_dir")
            destroy_k8s_sandbox "$sandbox_id"
            ((cleaned++))
        fi
    done
    
    log_success "Cleaned up $cleaned sandboxes"
}

# 显示帮助
show_help() {
    cat << EOF
Sandbox Manager - Secure Execution Environment

Usage: $0 <command> [options]

Commands:
    create [provider]
        Create a new sandbox (local, docker, k8s)
    
    exec <sandbox_id> <command>
        Execute command in sandbox
    
    python <sandbox_id> <code>
        Execute Python code in sandbox
    
    destroy <sandbox_id>
        Destroy a sandbox
    
    list [provider]
        List all sandboxes
    
    cleanup
        Clean up all sandboxes
    
    help
        Show this help message

Environment Variables:
    SANDBOX_PROVIDER    Default provider (local, docker, k8s)
    SANDBOX_TIMEOUT     Default timeout in seconds
    SANDBOX_CPU         CPU limit
    SANDBOX_MEMORY      Memory limit

Examples:
    $0 create docker
    $0 exec local-1234567890-abcdef12 "ls -la"
    $0 python local-1234567890-abcdef12 "print('Hello World')"
    $0 destroy local-1234567890-abcdef12
EOF
}

# 主函数
main() {
    # 初始化沙箱系统
    init_sandbox_system
    
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        create)
            create_sandbox "${1:-$DEFAULT_PROVIDER}"
            ;;
        exec)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 exec <sandbox_id> <command>"
                exit 1
            fi
            local sandbox_id="$1"
            shift
            exec_in_sandbox "$sandbox_id" "$@"
            ;;
        python)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 python <sandbox_id> <code>"
                exit 1
            fi
            local sandbox_id="$1"
            shift
            exec_python_in_sandbox "$sandbox_id" "$@"
            ;;
        destroy)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 destroy <sandbox_id>"
                exit 1
            fi
            destroy_sandbox "$1"
            ;;
        list)
            list_sandboxes "${1:-all}"
            ;;
        cleanup)
            cleanup_sandboxes
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
