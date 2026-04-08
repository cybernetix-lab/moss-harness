#!/bin/bash
# 技能发现脚本 - 多标签分类版本
# 扫描所有技能并更新注册表

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$PROJECT_ROOT/skills"
REGISTRY_FILE="$SKILLS_DIR/skill-registry.yaml"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查依赖
check_dependencies() {
    if ! command -v yq &> /dev/null; then
        log_error "yq 未安装。请安装 yq: https://github.com/mikefarah/yq"
        exit 1
    fi
}

# 解析技能 YAML 文件
parse_skill() {
    local skill_file="$1"
    
    if [ ! -f "$skill_file" ]; then
        return 1
    fi
    
    local skill_name=$(yq e '.name' "$skill_file" 2>/dev/null || echo "")
    local version=$(yq e '.version' "$skill_file" 2>/dev/null || echo "1.0.0")
    local description=$(yq e '.description' "$skill_file" 2>/dev/null || echo "")
    
    # 读取标签数组
    local tags=$(yq e '.tags[]' "$skill_file" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    
    # 获取技能目录（相对于 skills 目录的路径）
    local skill_dir=$(dirname "$skill_file")
    # macOS compatible relative path calculation
    local relative_path=$(echo "$skill_dir" | sed "s|^$SKILLS_DIR/||")
    
    echo "${skill_name}|${version}|${description}|${tags}|${relative_path}"
}

# 发现所有技能
discover_skills() {
    log_info "扫描技能目录: $SKILLS_DIR"
    
    local skills=()
    local count=0
    
    # 查找所有 skill.yaml 文件
    while IFS= read -r -d '' skill_file; do
        # 跳过 evolution 目录
        if [[ "$skill_file" == *"/evolution/"* ]]; then
            continue
        fi
        
        local parsed=$(parse_skill "$skill_file")
        if [ -n "$parsed" ]; then
            skills+=("$parsed")
            ((count++))
            local name=$(echo "$parsed" | cut -d'|' -f1)
            log_success "发现技能: $name"
        fi
    done < <(find "$SKILLS_DIR" -name "skill.yaml" -type f -print0 2>/dev/null)
    
    log_info "共发现 $count 个技能"
    
    # 输出为数组
    printf '%s\n' "${skills[@]}"
}

# 生成技能注册表 YAML
generate_registry() {
    local skills_data="$1"
    local temp_file=$(mktemp)
    
    log_info "生成技能注册表..."
    
    # 保留注册表的配置部分
    if [ -f "$REGISTRY_FILE" ]; then
        yq e '.registry' "$REGISTRY_FILE" > "$temp_file"
    else
        # 创建默认配置
        cat > "$temp_file" << 'EOF'
registry:
  discovery:
    pattern: "**/skill.yaml"
    paths:
      - "skills/"
    exclude:
      - "**/evolution/**"
      - "**/deprecated/**"
  taxonomy:
    domain:
      - frontend
      - backend
      - fullstack
      - mobile
      - devops
      - ai-ml
      - data
      - security
    technology:
      - react
      - vue
      - angular
      - typescript
      - javascript
      - python
      - go
      - rust
      - java
      - nodejs
      - docker
      - kubernetes
      - aws
      - gcp
      - azure
    task_type:
      - coding
      - review
      - testing
      - debugging
      - refactoring
      - documentation
      - research
      - analysis
      - optimization
    scenario:
      - startup
      - enterprise
      - legacy
      - greenfield
      - maintenance
    complexity:
      - beginner
      - intermediate
      - advanced
      - expert
EOF
    fi
    
    # 生成技能列表
    local skills_yaml="skills:"
    
    while IFS= read -r skill_line; do
        if [ -z "$skill_line" ]; then
            continue
        fi
        
        local name=$(echo "$skill_line" | cut -d'|' -f1)
        local version=$(echo "$skill_line" | cut -d'|' -f2)
        local description=$(echo "$skill_line" | cut -d'|' -f3)
        local tags=$(echo "$skill_line" | cut -d'|' -f4)
        local path=$(echo "$skill_line" | cut -d'|' -f5)
        
        # 构建标签 YAML 数组
        local tags_yaml=""
        IFS=',' read -ra TAG_ARRAY <<< "$tags"
        for tag in "${TAG_ARRAY[@]}"; do
            if [ -n "$tag" ]; then
                tags_yaml="${tags_yaml}      - $tag\n"
            fi
        done
        
        skills_yaml="${skills_yaml}
  - name: $name
    version: $version
    description: $description
    path: $path
    tags:
${tags_yaml}"
    done <<< "$skills_data"
    
    # 合并配置和技能列表
    echo -e "# 技能注册表 - 多标签分类系统\n# 自动生成于 $(date -u +"%Y-%m-%dT%H:%M:%SZ")\n" > "$REGISTRY_FILE"
    cat "$temp_file" >> "$REGISTRY_FILE"
    echo "" >> "$REGISTRY_FILE"
    echo -e "$skills_yaml" >> "$REGISTRY_FILE"
    
    rm -f "$temp_file"
    
    log_success "技能注册表已更新: $REGISTRY_FILE"
}

# 验证注册表
validate_registry() {
    log_info "验证技能注册表..."
    
    if [ ! -f "$REGISTRY_FILE" ]; then
        log_error "注册表文件不存在"
        return 1
    fi
    
    # 检查 YAML 格式
    if ! yq e '.' "$REGISTRY_FILE" > /dev/null 2>&1; then
        log_error "注册表 YAML 格式无效"
        return 1
    fi
    
    # 检查必需字段
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    log_info "注册表中共有 $skill_count 个技能"
    
    # 验证每个技能的路径是否存在
    local invalid_count=0
    for i in $(seq 0 $((skill_count - 1))); do
        local path=$(yq e ".skills[$i].path" "$REGISTRY_FILE")
        local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
        
        if [ ! -d "$SKILLS_DIR/$path" ]; then
            log_warning "技能 '$name' 的路径不存在: $path"
            ((invalid_count++))
        fi
    done
    
    if [ $invalid_count -eq 0 ]; then
        log_success "所有技能路径验证通过"
    else
        log_warning "$invalid_count 个技能路径无效"
    fi
    
    return 0
}

# 显示发现的技能列表
list_skills() {
    log_info "已注册的技能列表:"
    echo ""
    
    if [ ! -f "$REGISTRY_FILE" ]; then
        log_error "注册表文件不存在"
        return 1
    fi
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    
    printf "%-20s %-10s %-30s %s\n" "名称" "版本" "标签" "路径"
    printf "%-20s %-10s %-30s %s\n" "----" "----" "----" "----"
    
    for i in $(seq 0 $((skill_count - 1))); do
        local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
        local version=$(yq e ".skills[$i].version" "$REGISTRY_FILE")
        local path=$(yq e ".skills[$i].path" "$REGISTRY_FILE")
        local tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null | tr '\n' ',' | sed 's/,$//' | cut -c1-30)
        
        printf "%-20s %-10s %-30s %s\n" "$name" "$version" "$tags" "$path"
    done
}

# 主函数
main() {
    case "${1:-discover}" in
        discover)
            check_dependencies
            local skills_data=$(discover_skills)
            generate_registry "$skills_data"
            validate_registry
            ;;
        validate)
            check_dependencies
            validate_registry
            ;;
        list)
            check_dependencies
            list_skills
            ;;
        *)
            echo "用法: $0 [discover|validate|list]"
            echo ""
            echo "命令:"
            echo "  discover  - 扫描并注册所有技能（默认）"
            echo "  validate  - 验证技能注册表"
            echo "  list      - 列出所有已注册技能"
            exit 1
            ;;
    esac
}

main "$@"
