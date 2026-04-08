# 贡献指南

感谢你对 Awesome Agent Harness 项目的关注！我们欢迎所有形式的贡献。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [提交规范](#提交规范)
- [代码审查](#代码审查)

## 🤝 行为准则

本项目遵循 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。参与本项目即表示你同意遵守此准则。

## 🚀 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议：

1. 先搜索 [Issues](https://github.com/yourusername/awesome-agent-harness/issues) 确认是否已存在
2. 如果没有，创建一个新的 Issue
3. 使用对应的模板填写详细信息

### 提交代码

1. **Fork** 本仓库
2. **Clone** 你的 fork
   ```bash
   git clone https://github.com/yourusername/awesome-agent-harness.git
   ```
3. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/issue-description
   ```
4. **提交更改**
   ```bash
   git commit -m "feat: 添加新功能"
   ```
5. **推送到你的 fork**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **创建 Pull Request**

## 🛠️ 开发流程

### 环境设置

```bash
# 克隆仓库
git clone https://github.com/yourusername/awesome-agent-harness.git
cd awesome-agent-harness

# 运行健康检查
./scripts/health-check.sh

# 启动开发会话
./scripts/start-session.sh
```

### 项目结构

```
awesome-agent-harness/
├── agents/          # Agent 配置
├── skills/          # 技能系统
├── hooks/           # 会话钩子
├── rules/           # 代码规则
├── verification/    # 验证循环
├── .runtime/        # 运行时数据
│   └── context/    # 上下文管理
├── constraints/     # 约束配置
├── evals/           # 评估框架
├── telemetry/       # 可观测性
├── mcp/             # MCP 配置
├── memory/          # 记忆系统
├── tools/           # 工具定义
├── scripts/         # 运维脚本
└── docs/            # 文档
```

### 添加新技能

1. 在 `skills/{category}/` 下创建新目录
2. 创建 `skill.yaml` 文件
3. 添加示例和测试

示例：

```yaml
# skills/coding/my-skill/skill.yaml
name: my-skill
category: coding
description: "技能描述"
version: 1.0.0

triggers:
  - pattern: "触发模式"
    confidence: 0.8

actions:
  - type: analyze
    description: "分析操作"
```

### 添加新规则

1. 在 `rules/{language}/` 下创建 YAML 文件
2. 定义检测模式和修复建议

示例：

```yaml
# rules/typescript/my-rule.yaml
name: my-rule
severity: warning
category: maintainability
description: "规则描述"

detection:
  pattern: "正则表达式"

fix:
  description: "如何修复"
```

### 添加新 Agent

1. 在 `agents/` 下创建 YAML 文件
2. 定义系统提示词和可用技能

示例：

```yaml
# agents/my-agent.yaml
name: my-agent
type: custom
description: |
  Agent 描述

system_prompt: |
  你是 MyAgent...

skills:
  - typescript-patterns
```

## 📝 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具/依赖

### 提交示例

```bash
# 新功能
feat: 添加 Python 技能支持

# Bug 修复
fix: 修复 session-stop 钩子中的时间戳问题

# 文档
docs: 更新 README 中的示例

# 重构
refactor: 优化技能加载逻辑
```

## 🔍 代码审查

所有提交都需要通过代码审查：

1. 确保所有测试通过
2. 遵循项目编码规范
3. 更新相关文档
4. 添加必要的注释

## 🧪 测试

```bash
# 运行所有测试
./scripts/run-evals.sh

# 运行特定测试
./scripts/run-evals.sh harness

# 运行验证
./scripts/verify.sh
```

## 📚 文档

- 更新 README.md 如果添加新功能
- 添加/更新 docs/ 中的文档
- 为复杂逻辑添加注释

## 🎯 开发优先级

我们优先处理以下类型的贡献：

1. 🐛 **Bug 修复** - 修复现有问题
2. 📖 **文档** - 改进文档质量
3. 🛠️ **新技能** - 扩展技能库
4. 🤖 **新 Agent** - 添加新的 Agent 类型
5. ⚡ **性能** - 优化性能

## 💬 联系方式

- GitHub Issues: [提交问题](https://github.com/yourusername/awesome-agent-harness/issues)
- Discussions: [参与讨论](https://github.com/yourusername/awesome-agent-harness/discussions)

## 🙏 感谢

感谢所有贡献者！

---

**再次感谢你的贡献！** 🎉
