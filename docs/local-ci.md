# 本地 CI 验证指南

在将项目推送到 GitHub 之前，建议先运行本地 CI 验证来确保所有配置正确。

## 快速开始

```bash
# 运行本地 CI 验证
./scripts/local-ci.sh
```

## 验证内容

本地 CI 脚本会检查以下内容：

### 1. 健康检查 (Health Check)
- 目录结构完整性
- 核心文件存在性
- 脚本可执行性
- 工具配置有效性

### 2. YAML 语法验证
- 所有 `.yaml` 和 `.yml` 文件的语法正确性
- 需要安装 `yamllint` 或 `pyyaml`

### 3. Skill 定义验证
- Skill 文件结构完整性
- 必要字段检查（name, version, description）

### 4. Agent 定义验证
- Agent 配置文件完整性
- 必要字段检查（name, type）

### 5. Shell 脚本检查
- 脚本语法检查（需要 `shellcheck`）
- 可执行权限检查

### 6. 功能测试
- `skill-list.sh` 功能测试
- `agent-list.sh` 功能测试
- `init.sh` 初始化测试
- `verify.sh` 验证测试

### 7. 项目结构检查
- 必要目录存在性
- 开源文档完整性

### 8. Git 检查
- Git 仓库初始化状态
- 未提交更改检查
- 远程仓库配置

## 安装可选依赖

为了获得更完整的验证，建议安装以下工具：

### macOS

```bash
# 使用 Homebrew 安装
brew install yamllint shellcheck

# 或使用 pip
pip install yamllint pyyaml
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y yamllint shellcheck python3-yaml
```

### Windows (WSL)

```bash
# 在 WSL 中运行
sudo apt-get update
sudo apt-get install -y yamllint shellcheck
```

## 验证结果解读

### ✅ 通过状态
所有检查项都通过，项目可以安全推送到 GitHub。

### ⚠️ 警告状态
某些非关键检查未通过（如可选工具未安装），但不会影响核心功能。

### ❌ 失败状态
关键检查未通过，需要修复后才能推送。

## 推送前检查清单

- [ ] 运行 `./scripts/local-ci.sh` 并通过所有检查
- [ ] 更新 `LICENSE` 中的版权信息
- [ ] 更新 `README.md` 中的项目链接和徽章
- [ ] 确保所有敏感信息已从代码中移除
- [ ] 初始化 Git 仓库并添加远程地址

## 推送到 GitHub

```bash
# 1. 初始化 Git（如果还没初始化）
git init

# 2. 添加所有文件
git add .

# 3. 提交
git commit -m "Initial commit: Complete AI Agent Harness framework"

# 4. 添加远程仓库（替换为你的实际仓库地址）
git remote add origin https://github.com/yourusername/awesome-agent-harness.git

# 5. 推送
git push -u origin main
```

## GitHub Actions CI

推送到 GitHub 后，GitHub Actions 会自动运行以下工作流：

- **CI 工作流** (`.github/workflows/ci.yml`)
  - 健康检查
  - YAML 验证
  - ShellCheck
  - 功能测试

- **Release 工作流** (`.github/workflows/release.yml`)
  - 自动发布（当推送版本标签时触发）

## 故障排除

### 问题：权限被拒绝

```bash
chmod +x scripts/local-ci.sh
```

### 问题：找不到命令

确保你在项目根目录运行脚本：

```bash
cd /path/to/awesome-agent-harness
./scripts/local-ci.sh
```

### 问题：YAML 验证失败

安装 YAML 验证工具：

```bash
pip install pyyaml
# 或
brew install yamllint
```

## 自定义验证

你可以根据需要修改 `scripts/local-ci.sh` 来添加自定义检查项。
