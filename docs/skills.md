# 技能开发指南

技能是 Harness 的核心能力模块，定义了 Agent 可以执行的专业任务。

## 什么是技能？

技能是封装了特定领域知识的可复用模块，包含：
- 触发器（Triggers）- 自动识别何时使用该技能
- 动作（Actions）- 定义可以执行的操作
- 模板（Patterns）- 可复用的代码片段
- 规则（Rules）- 执行该技能时的约束

## 技能结构

```
integrations/skills/
└── {skill-name}/
    ├── skill.yaml      # 技能定义
    ├── SKILL.md        # 第三方导入技能的上游原文（可选）
    ├── examples/       # 示例代码
    └── tests/          # 技能测试（可选）

configs/skills/
└── skill-registry.yaml # 自动生成的技能注册表
```

## 创建新技能

### 1. 创建目录

```bash
mkdir -p integrations/skills/my-awesome-skill
```

### 2. 编写 skill.yaml

```yaml
name: my-awesome-skill
category: coding
description: |
  清晰描述这个技能的作用。
  可以包含多行说明。

version: 1.0.0
author: your-name
tags:
  - tag1
  - tag2

# 触发器 - 自动识别何时使用该技能
triggers:
  - pattern: "创建.*组件"
    confidence: 0.8
  - pattern: "create.*component"
    confidence: 0.8
  - pattern: "component.*template"
    confidence: 0.7

# 上下文要求
context:
  required_files:
    - "package.json"
    - "tsconfig.json"
  optional_files:
    - ".eslintrc"
  preferred_models:
    - claude-3-5-sonnet

# 代码模板
patterns:
  - name: basic-component
    description: 基础组件模板
    template: |
      interface {{ComponentName}}Props {
        title: string;
      }
      
      export function {{ComponentName}}({ title }: {{ComponentName}}Props) {
        return (
          <div>
            <h1>{title}</h1>
          </div>
        );
      }

# 动作定义
actions:
  - type: analyze
    description: 分析现有代码结构
    steps:
      - 扫描项目结构
      - 识别组件模式
      - 分析依赖关系
  
  - type: generate
    description: 生成新组件
    steps:
      - 根据需求选择模板
      - 填充组件内容
      - 添加必要的导入
  
  - type: refactor
    description: 重构现有组件
    steps:
      - 识别重构机会
      - 应用最佳实践
      - 保持功能不变

# 验证要求
validation:
  - typecheck
  - eslint
  - tests

# 示例
examples:
  - input: "创建一个用户卡片组件"
    output: |
      interface UserCardProps {
        name: string;
        email: string;
      }
      
      export function UserCard({ name, email }: UserCardProps) {
        return (
          <div className="user-card">
            <h3>{name}</h3>
            <p>{email}</p>
          </div>
        );
      }
```

### 3. 添加示例

```bash
mkdir -p integrations/skills/my-awesome-skill/examples
cat > integrations/skills/my-awesome-skill/examples/basic.tsx << 'EOF'
// 基础组件示例
interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  return (
    <button onClick={onClick}>
      {label}
    </button>
  );
}
EOF
```

### 导入第三方技能

当技能来自外部仓库时，保留上游 `SKILL.md`，并在同目录补一个最小 `skill.yaml` 供 Harness 发现与导入：

```text
integrations/skills/external-skill/
├── SKILL.md
└── skill.yaml
```

## 技能类别

| 类别 | 用途 | 示例 |
|------|------|------|
| `coding` | 代码开发 | typescript-patterns, react-hooks |
| `review` | 代码审查 | security-scan, performance-review |
| `research` | 研究分析 | documentation-lookup, api-research |
| `ops` | 运维操作 | deployment, monitoring-setup |
| `communication` | 沟通协作 | pr-description, code-summary |

## 触发器模式

触发器使用正则表达式匹配用户输入：

```yaml
triggers:
  # 简单匹配
  - pattern: "创建.*组件"
    confidence: 0.8
  
  # 英文匹配
  - pattern: "create.*component"
    confidence: 0.8
  
  # 多关键词
  - pattern: "(实现|创建|添加).*(功能|特性)"
    confidence: 0.75
  
  # 特定文件类型
  - pattern: ".*\\.test\\.(ts|tsx)$"
    confidence: 0.9
```

## 最佳实践

### 1. 保持单一职责

每个技能应该专注于一个明确的任务：

```yaml
# ✅ 好的技能
description: |
  React Hooks 开发技能。
  提供自定义 Hook 生成和优化。

# ❌ 避免过于宽泛
description: |
  前端开发技能。
  包含 React、Vue、Angular 等所有框架。
```

### 2. 提供清晰的示例

```yaml
examples:
  - input: "创建一个 useLocalStorage Hook"
    output: |
      function useLocalStorage<T>(key: string, initialValue: T) {
        // 实现代码
      }
    explanation: |
      这个 Hook 同步了 React 状态和 localStorage。
```

### 3. 定义明确的验证

```yaml
validation:
  - typecheck        # TypeScript 类型检查
  - eslint          # 代码风格检查
  - tests           # 运行测试
  - runtime-check   # 运行时验证
```

### 4. 使用版本控制

```yaml
version: 1.0.0
# 遵循语义化版本
# MAJOR.MINOR.PATCH
```

## 测试技能

### 1. 本地测试

```bash
# 激活技能
./scripts/skill-activate.sh my-awesome-skill

# 启动会话
./scripts/start-session.sh

# 测试触发器
# 在会话中输入触发模式，观察技能是否被激活
```

### 2. 验证配置

```bash
# 检查 YAML 语法
yamllint skills/coding/my-awesome-skill/skill.yaml

# 运行健康检查
./scripts/health-check.sh
```

## 提交技能

1. Fork 本仓库
2. 在 `skills/{category}/` 下创建你的技能
3. 添加示例和文档
4. 提交 Pull Request

## 参考

- [TypeScript 技能示例](../skills/coding/typescript-patterns/skill.yaml)
- [React Hooks 技能示例](../skills/coding/react-hooks/skill.yaml)
