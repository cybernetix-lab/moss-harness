#!/bin/bash
# 技能标签管理工具
# 支持按标签查询、筛选、推荐相关技能

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$PROJECT_ROOT/integrations/skills"
REGISTRY_FILE="$PROJECT_ROOT/configs/skills/skill-registry.yaml"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# 检查依赖
check_dependencies() {
    if ! command -v yq &> /dev/null; then
        echo "错误: yq 未安装。请安装 yq: https://github.com/mikefarah/yq"
        exit 1
    fi
    
    if [ ! -f "$REGISTRY_FILE" ]; then
        echo "错误: 技能注册表不存在。请先运行: ./scripts/skill-discover.sh"
        exit 1
    fi
}

# 获取所有标签
get_all_tags() {
    yq e '.registry.taxonomy | keys[]' "$REGISTRY_FILE"
}

# 获取特定类别的标签
get_tags_by_category() {
    local category="$1"
    yq e ".registry.taxonomy.${category}[]" "$REGISTRY_FILE" 2>/dev/null || echo ""
}

# 列出所有标签类别
list_categories() {
    echo -e "${CYAN}标签分类体系:${NC}"
    echo ""
    
    local categories=$(get_all_tags)
    
    for category in $categories; do
        echo -e "${GREEN}$category:${NC}"
        local tags=$(get_tags_by_category "$category")
        for tag in $tags; do
            echo "  - $tag"
        done
        echo ""
    done
}

# 按标签筛选技能
filter_by_tag() {
    local tag="$1"
    
    log_info "查找包含标签 '$tag' 的技能..."
    echo ""
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    local found=0
    
    printf "%-20s %-10s %-40s\n" "技能名称" "版本" "所有标签"
    printf "%-20s %-10s %-40s\n" "--------" "----" "--------"
    
    for i in $(seq 0 $((skill_count - 1))); do
        local tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
        
        if echo "$tags" | grep -q "^${tag}$"; then
            local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
            local version=$(yq e ".skills[$i].version" "$REGISTRY_FILE")
            local all_tags=$(echo "$tags" | tr '\n' ',' | sed 's/,$//' | cut -c1-40)
            
            printf "%-20s %-10s %-40s\n" "$name" "$version" "$all_tags"
            ((found++))
        fi
    done
    
    echo ""
    log_success "找到 $found 个技能包含标签 '$tag'"
}

# 按多个标签筛选技能（AND 逻辑）
filter_by_tags_and() {
    local tags_str="$1"
    IFS=',' read -ra TAGS <<< "$tags_str"
    
    log_info "查找同时包含标签 '${tags_str}' 的技能..."
    echo ""
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    local found=0
    
    printf "%-20s %-10s %-40s\n" "技能名称" "版本" "所有标签"
    printf "%-20s %-10s %-40s\n" "--------" "----" "--------"
    
    for i in $(seq 0 $((skill_count - 1))); do
        local skill_tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
        local match=true
        
        for tag in "${TAGS[@]}"; do
            if ! echo "$skill_tags" | grep -q "^${tag}$"; then
                match=false
                break
            fi
        done
        
        if [ "$match" = true ]; then
            local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
            local version=$(yq e ".skills[$i].version" "$REGISTRY_FILE")
            local all_tags=$(echo "$skill_tags" | tr '\n' ',' | sed 's/,$//' | cut -c1-40)
            
            printf "%-20s %-10s %-40s\n" "$name" "$version" "$all_tags"
            ((found++))
        fi
    done
    
    echo ""
    log_success "找到 $found 个技能同时包含标签 '${tags_str}'"
}

# 按多个标签筛选技能（OR 逻辑）
filter_by_tags_or() {
    local tags_str="$1"
    IFS=',' read -ra TAGS <<< "$tags_str"
    
    log_info "查找包含任一标签 '${tags_str}' 的技能..."
    echo ""
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    local found=0
    
    printf "%-20s %-10s %-40s\n" "技能名称" "版本" "匹配标签"
    printf "%-20s %-10s %-40s\n" "--------" "----" "--------"
    
    for i in $(seq 0 $((skill_count - 1))); do
        local skill_tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
        local matched_tags=""
        
        for tag in "${TAGS[@]}"; do
            if echo "$skill_tags" | grep -q "^${tag}$"; then
                matched_tags="${matched_tags}${tag},"
            fi
        done
        
        if [ -n "$matched_tags" ]; then
            local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
            local version=$(yq e ".skills[$i].version" "$REGISTRY_FILE")
            matched_tags=$(echo "$matched_tags" | sed 's/,$//')
            
            printf "%-20s %-10s %-40s\n" "$name" "$version" "$matched_tags"
            ((found++))
        fi
    done
    
    echo ""
    log_success "找到 $found 个技能包含任一标签 '${tags_str}'"
}

# 获取技能详情
get_skill_details() {
    local skill_name="$1"
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    
    for i in $(seq 0 $((skill_count - 1))); do
        local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
        
        if [ "$name" = "$skill_name" ]; then
            echo -e "${CYAN}技能详情: $name${NC}"
            echo "================================"
            echo ""
            
            local version=$(yq e ".skills[$i].version" "$REGISTRY_FILE")
            local description=$(yq e ".skills[$i].description" "$REGISTRY_FILE")
            local path=$(yq e ".skills[$i].path" "$REGISTRY_FILE")
            local tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
            
            echo -e "${GREEN}名称:${NC} $name"
            echo -e "${GREEN}版本:${NC} $version"
            echo -e "${GREEN}路径:${NC} integrations/skills/$path"
            echo -e "${GREEN}描述:${NC} $description"
            echo ""
            echo -e "${GREEN}标签:${NC}"
            echo "$tags" | while read -r tag; do
                echo "  • $tag"
            done
            
            return 0
        fi
    done
    
    log_warning "未找到技能: $skill_name"
    return 1
}

# 查找相关技能
find_related_skills() {
    local skill_name="$1"
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    local target_tags=""
    
    # 找到目标技能的标签
    for i in $(seq 0 $((skill_count - 1))); do
        local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
        if [ "$name" = "$skill_name" ]; then
            target_tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
            break
        fi
    done
    
    if [ -z "$target_tags" ]; then
        log_warning "未找到技能: $skill_name"
        return 1
    fi
    
    log_info "查找与 '$skill_name' 相关的技能..."
    echo ""
    
    printf "%-20s %-10s %-30s %-10s\n" "技能名称" "版本" "共同标签" "相似度"
    printf "%-20s %-10s %-30s %-10s\n" "--------" "----" "--------" "------"
    
    # 计算相似度（共同标签数）
    for i in $(seq 0 $((skill_count - 1))); do
        local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
        
        if [ "$name" = "$skill_name" ]; then
            continue
        fi
        
        local skill_tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
        local common_tags=""
        local common_count=0
        
        while IFS= read -r tag; do
            if echo "$skill_tags" | grep -q "^${tag}$"; then
                common_tags="${common_tags}${tag},"
                ((common_count++))
            fi
        done <<< "$target_tags"
        
        if [ $common_count -gt 0 ]; then
            local version=$(yq e ".skills[$i].version" "$REGISTRY_FILE")
            common_tags=$(echo "$common_tags" | sed 's/,$//' | cut -c1-30)
            local similarity="${common_count} tags"
            
            printf "%-20s %-10s %-30s %-10s\n" "$name" "$version" "$common_tags" "$similarity"
        fi
    done
}

# 标签统计
tag_statistics() {
    log_info "标签使用统计"
    echo ""
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    declare -A tag_counts
    
    # 统计每个标签的使用次数
    for i in $(seq 0 $((skill_count - 1))); do
        local tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
        while IFS= read -r tag; do
            if [ -n "$tag" ]; then
                tag_counts["$tag"]=$((${tag_counts["$tag"]:-0} + 1))
            fi
        done <<< "$tags"
    done
    
    # 按使用次数排序输出
    printf "%-20s %-10s %s\n" "标签" "使用次数" "可视化"
    printf "%-20s %-10s %s\n" "----" "--------" "-------"
    
    for tag in "${!tag_counts[@]}"; do
        local count=${tag_counts[$tag]}
        local bar=$(printf '%*s' "$count" '' | tr ' ' '█')
        printf "%-20s %-10s %s\n" "$tag" "$count" "$bar"
    done | sort -k2 -nr
}

# 验证技能标签
validate_skill_tags() {
    log_info "验证技能标签..."
    echo ""
    
    local skill_count=$(yq e '.skills | length' "$REGISTRY_FILE")
    local valid_categories=$(get_all_tags | tr '\n' '|' | sed 's/|$//')
    local issues=0
    
    for i in $(seq 0 $((skill_count - 1))); do
        local name=$(yq e ".skills[$i].name" "$REGISTRY_FILE")
        local tags=$(yq e ".skills[$i].tags[]" "$REGISTRY_FILE" 2>/dev/null)
        
        # 检查是否有标签
        if [ -z "$tags" ]; then
            log_warning "技能 '$name' 没有标签"
            ((issues++))
            continue
        fi
        
        # 检查标签是否在分类体系中
        while IFS= read -r tag; do
            local found=false
            for category in $(get_all_tags); do
                if get_tags_by_category "$category" | grep -q "^${tag}$"; then
                    found=true
                    break
                fi
            done
            
            if [ "$found" = false ]; then
                log_warning "技能 '$name' 使用了未定义的标签: $tag"
                ((issues++))
            fi
        done <<< "$tags"
    done
    
    if [ $issues -eq 0 ]; then
        log_success "所有技能标签验证通过"
    else
        log_warning "发现 $issues 个标签问题"
    fi
}

# 显示帮助
show_help() {
    cat << 'EOF'
技能标签管理工具

用法: ./scripts/skill-tag.sh <命令> [参数]

命令:
  categories                    列出所有标签类别
  list-tags <category>          列出指定类别的所有标签
  filter <tag>                  按单个标签筛选技能
  filter-and <tag1,tag2,...>    按多个标签筛选技能（AND）
  filter-or <tag1,tag2,...>     按多个标签筛选技能（OR）
  details <skill-name>          查看技能详情
  related <skill-name>          查找相关技能
  stats                         标签使用统计
  validate                      验证技能标签
  help                          显示此帮助

示例:
  ./scripts/skill-tag.sh categories
  ./scripts/skill-tag.sh filter react
  ./scripts/skill-tag.sh filter-and frontend,coding
  ./scripts/skill-tag.sh details react-hooks
  ./scripts/skill-tag.sh related react-hooks
  ./scripts/skill-tag.sh stats
EOF
}

# 主函数
main() {
    check_dependencies
    
    case "${1:-help}" in
        categories)
            list_categories
            ;;
        list-tags)
            if [ -z "${2:-}" ]; then
                echo "用法: $0 list-tags <category>"
                exit 1
            fi
            get_tags_by_category "$2"
            ;;
        filter)
            if [ -z "${2:-}" ]; then
                echo "用法: $0 filter <tag>"
                exit 1
            fi
            filter_by_tag "$2"
            ;;
        filter-and)
            if [ -z "${2:-}" ]; then
                echo "用法: $0 filter-and <tag1,tag2,...>"
                exit 1
            fi
            filter_by_tags_and "$2"
            ;;
        filter-or)
            if [ -z "${2:-}" ]; then
                echo "用法: $0 filter-or <tag1,tag2,...>"
                exit 1
            fi
            filter_by_tags_or "$2"
            ;;
        details)
            if [ -z "${2:-}" ]; then
                echo "用法: $0 details <skill-name>"
                exit 1
            fi
            get_skill_details "$2"
            ;;
        related)
            if [ -z "${2:-}" ]; then
                echo "用法: $0 related <skill-name>"
                exit 1
            fi
            find_related_skills "$2"
            ;;
        stats)
            tag_statistics
            ;;
        validate)
            validate_skill_tags
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
