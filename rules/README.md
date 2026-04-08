# Code Rules

代码规则定义项目的编码规范、架构约束和最佳实践。

## 规则分类

```
rules/
├── common/           # 通用规则（所有语言）
├── typescript/       # TypeScript 规则
├── python/           # Python 规则
├── react/            # React 规则
├── yaml/             # YAML 规则
├── security/         # 安全规则
└── architecture/     # 架构规则
```

## 规则格式

```yaml
name: rule_name
severity: error|warning|info
category: style|security|performance|maintainability
language: typescript

# 规则描述
description: |
  详细描述规则的目的和原因

# 检测逻辑
detection:
  pattern: "正则表达式或AST查询"
  ast_query: "//FunctionDeclaration[count(//*) > 50]"

# 修复建议
fix:
  description: 如何修复
  template: |
    修复后的代码模板

# 示例
examples:
  valid:
    - |
      // 符合规则的代码
  invalid:
    - |
      // 违反规则的代码

# 例外情况
exceptions:
  - condition: "特定情况下可以违反"
    reason: 原因说明
```

## 使用规则

```bash
# 运行规则检查
./scripts/lint-rules.sh

# 检查特定文件
./scripts/lint-rules.sh src/components/Button.tsx

# 自动修复
./scripts/lint-rules.sh --fix
```
