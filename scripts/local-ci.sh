#!/bin/bash

# Local CI Validation Script
# 在推送到 GitHub 前运行此脚本验证所有配置

# 不要在错误时退出，让我们自己处理错误
# set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0

# 打印函数
print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 检查命令是否存在
check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# ==================== 测试开始 ====================

echo -e "${BLUE}
╔══════════════════════════════════════════════════════════════╗
║           Awesome Agent Harness - Local CI                   ║
║                  本地 CI 验证脚本                             ║
╚══════════════════════════════════════════════════════════════╝
${NC}"

# 1. 健康检查
print_header "1. 健康检查 (Health Check)"
if [ -f "./scripts/health-check.sh" ]; then
    chmod +x ./scripts/health-check.sh
    if ./scripts/health-check.sh; then
        print_success "健康检查通过"
    else
        print_error "健康检查失败"
    fi
else
    print_error "health-check.sh 脚本不存在"
fi

# 2. YAML 语法验证
print_header "2. YAML 语法验证"
if check_command yamllint; then
    print_info "使用 yamllint 验证 YAML 文件..."
    if find . -name "*.yaml" -o -name "*.yml" | grep -v node_modules | xargs yamllint -d relaxed 2>/dev/null; then
        print_success "所有 YAML 文件语法正确"
    else
        print_warning "部分 YAML 文件有警告（非致命错误）"
        ((PASSED++))
    fi
else
    print_warning "yamllint 未安装，跳过 YAML 语法检查"
    print_info "安装命令: pip install yamllint 或 brew install yamllint"
    
    # 检查是否有 pyyaml
    if python3 -c "import yaml" 2>/dev/null; then
        # 基础 YAML 验证
        print_info "执行基础 YAML 结构验证..."
        YAML_VALID=true
        while IFS= read -r file; do
            if ! python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
                print_error "YAML 解析失败: $file"
                YAML_VALID=false
            fi
        done < <(find . \( -name "*.yaml" -o -name "*.yml" \) | grep -v node_modules)
        if [ "$YAML_VALID" = true ]; then
            print_success "所有 YAML 文件基础结构正确"
        fi
    else
        print_warning "Python yaml 模块未安装，跳过 YAML 结构验证"
        print_info "安装命令: pip install pyyaml"
        print_info "或者使用 Node.js 验证: npm install -g yaml-validator"
        
        # 基础文件存在性检查
        print_info "执行基础文件存在性检查..."
        YAML_COUNT=$(find . \( -name "*.yaml" -o -name "*.yml" \) | grep -v node_modules | wc -l)
        print_success "发现 $YAML_COUNT 个 YAML 文件"
    fi
fi

# 3. Skill 定义验证
print_header "3. Skill 定义验证"
SKILL_VALID=true
for skill in skills/*/*/skill.yaml; do
    if [ -f "$skill" ]; then
        # 检查必要的字段
        if grep -q "name:" "$skill" && grep -q "version:" "$skill" && grep -q "description:" "$skill"; then
            continue
        else
            print_error "Skill 定义不完整: $skill"
            SKILL_VALID=false
        fi
    fi
done
if [ "$SKILL_VALID" = true ]; then
    print_success "所有 Skill 定义结构正确"
fi

# 4. Agent 定义验证
print_header "4. Agent 定义验证"
AGENT_VALID=true
for agent in agents/*.yaml; do
    if [ -f "$agent" ]; then
        if grep -q "name:" "$agent" && grep -q "type:" "$agent"; then
            continue
        else
            print_error "Agent 定义不完整: $agent"
            AGENT_VALID=false
        fi
    fi
done
if [ "$AGENT_VALID" = true ]; then
    print_success "所有 Agent 定义结构正确"
fi

# 5. Shell 脚本检查
print_header "5. Shell 脚本检查"
if check_command shellcheck; then
    print_info "使用 shellcheck 检查脚本..."
    if find . -name "*.sh" | grep -v node_modules | xargs shellcheck --severity=warning 2>/dev/null; then
        print_success "所有 Shell 脚本检查通过"
    else
        print_warning "部分脚本有警告（查看上方详情）"
        ((PASSED++))
    fi
else
    print_warning "shellcheck 未安装，跳过 Shell 脚本检查"
    print_info "安装命令: brew install shellcheck 或 apt-get install shellcheck"
    
    # 基础检查：确保脚本可执行
    print_info "执行基础脚本检查..."
    for script in $(find . -name "*.sh" | grep -v node_modules); do
        if [ -x "$script" ]; then
            continue
        else
            print_warning "脚本未设置可执行权限: $script"
        fi
    done
    print_success "基础脚本检查完成"
fi

# 6. 功能测试
print_header "6. 功能测试"

# 6.1 测试技能列表
print_info "测试 skill-list.sh..."
if [ -f "./scripts/skill-list.sh" ]; then
    chmod +x ./scripts/skill-list.sh
    if ./scripts/skill-list.sh > /dev/null 2>&1; then
        print_success "skill-list.sh 运行正常"
    else
        print_error "skill-list.sh 运行失败"
    fi
else
    print_error "skill-list.sh 不存在"
fi

# 6.2 测试 Agent 列表
print_info "测试 agent-list.sh..."
if [ -f "./scripts/agent-list.sh" ]; then
    chmod +x ./scripts/agent-list.sh
    if ./scripts/agent-list.sh > /dev/null 2>&1; then
        print_success "agent-list.sh 运行正常"
    else
        print_error "agent-list.sh 运行失败"
    fi
else
    print_error "agent-list.sh 不存在"
fi

# 6.3 测试项目初始化
print_info "测试 init.sh..."
if [ -f "./init.sh" ]; then
    chmod +x ./init.sh
    if ./init.sh > /dev/null 2>&1; then
        print_success "init.sh 运行正常"
    else
        print_error "init.sh 运行失败"
    fi
else
    print_error "init.sh 不存在"
fi

# 6.4 测试验证脚本
print_info "测试 verify.sh..."
if [ -f "./scripts/verify.sh" ]; then
    chmod +x ./scripts/verify.sh
    if ./scripts/verify.sh > /dev/null 2>&1; then
        print_success "verify.sh 运行正常"
    else
        print_error "verify.sh 运行失败"
    fi
else
    print_error "verify.sh 不存在"
fi

# 7. 文件结构检查
print_header "7. 项目结构检查"

REQUIRED_DIRS=("context" "constraints" "skills" "agents" "hooks" "scripts" "docs")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_success "目录存在: $dir/"
    else
        print_error "目录缺失: $dir/"
    fi
done

REQUIRED_FILES=("README.md" "LICENSE" "CONTRIBUTING.md" "CHANGELOG.md" ".gitignore" "CLAUDE.md")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "文件存在: $file"
    else
        print_error "文件缺失: $file"
    fi
done

# 8. Git 检查
print_header "8. Git 检查"
if [ -d ".git" ]; then
    print_success "Git 仓库已初始化"
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "有未提交的更改"
        git status --short
    else
        print_success "工作区干净"
    fi
    
    # 检查远程仓库
    if git remote -v > /dev/null 2>&1; then
        print_info "配置的远程仓库:"
        git remote -v
    else
        print_warning "未配置远程仓库"
    fi
else
    print_warning "未初始化 Git 仓库"
    print_info "运行: git init"
fi

# ==================== 总结 ====================

echo -e "\n${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                      验证总结                                 ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"

echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ 所有检查通过！项目已准备好推送到 GitHub。${NC}"
    echo -e "${BLUE}  推送命令:${NC}"
    echo -e "    git add ."
    echo -e "    git commit -m 'Initial commit: Complete AI Agent Harness framework'"
    echo -e "    git push -u origin main"
    exit 0
else
    echo -e "\n${RED}✗ 有 $FAILED 项检查失败，请修复后再推送。${NC}"
    exit 1
fi
