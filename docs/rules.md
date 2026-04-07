# 规则编写指南

规则定义了项目的编码规范、安全约束和最佳实践。

## 什么是规则？

规则是自动化的代码检查标准，包含：
- **检测逻辑** - 如何识别违规代码
- **严重程度** - error / warning / info
- **修复建议** - 如何改正
- **例外情况** - 何时可以违反

## 规则结构

```
rules/
├── {language}/
│   └── {rule-name}.yaml
└── common/
    └── {rule-name}.yaml
```

## 创建新规则

### 1. 选择类别

根据规则适用的范围选择目录：

- `rules/typescript/` - TypeScript 专用规则
- `rules/python/` - Python 专用规则
- `rules/security/` - 安全相关规则（通用）
- `rules/common/` - 通用规则

### 2. 编写规则文件

```bash
cat > rules/typescript/my-rule.yaml << 'EOF'
name: my-rule
severity: warning              # error | warning | info
category: maintainability      # style | security | performance | maintainability
language: typescript

description: |
  详细描述规则的目的和原因。
  解释为什么这个规则很重要。

# 检测配置
detection:
  pattern: "正则表达式模式"
  ast_query: "//AST查询"      # 可选
  scope: file                  # file | function | line

# 消息模板
message: |
  检测到 {{pattern_name}}。
  建议：{{suggestion}}

# 修复建议
fix:
  description: |
    1. 第一步操作
    2. 第二步操作
    3. 第三步操作
  
  template: |
    // 修复后的代码示例
    const goodExample = "正确写法";

# 示例
examples:
  valid:
    - |
      // ✅ 符合规则的代码
      const good = "正确";
  
  invalid:
    - |
      // ❌ 违反规则的代码
      const bad = "错误";

# 例外情况
exceptions:
  - condition: "特定情况"
    reason: "为什么可以例外"
    requirement: "必须满足的条件"
EOF
```

## 规则配置详解

### 严重程度

```yaml
severity: error      # 必须修复，阻塞提交
severity: warning    # 建议修复，不阻塞
severity: info       # 仅供参考
```

### 类别

```yaml
category: style             # 代码风格
category: security          # 安全相关
category: performance       # 性能优化
category: maintainability   # 可维护性
```

### 检测方式

#### 正则表达式

```yaml
detection:
  pattern: "\\bany\\b"      # 检测 any 关键字
  scope: line
```

#### AST 查询

```yaml
detection:
  ast_query: |
    //FunctionDeclaration[
      count(.//*) > 150
    ]
  scope: function
```

#### 多模式检测

```yaml
detection:
  patterns:
    - name: pattern-1
      pattern: "regex1"
      message: "消息1"
    
    - name: pattern-2
      pattern: "regex2"
      message: "消息2"
```

## 规则示例

### 示例 1：函数大小限制

```yaml
name: function-size-limit
severity: warning
category: maintainability
language: typescript

description: |
  函数应该保持简洁，单一职责。
  过长的函数难以理解和维护。

limits:
  max_lines: 50
  max_statements: 30

detection:
  ast_query: |
    //FunctionDeclaration[
      count(.//*) > 150
    ]

message: |
  函数 {{name}} 过长（{{actual_lines}} 行）。
  建议将其拆分为多个小函数。

fix:
  description: |
    1. 识别函数中的不同职责
    2. 将每个职责提取为独立函数
    3. 使用有意义的函数名

examples:
  valid:
    - |
      function calculateTotal(price: number, quantity: number): number {
        return price * quantity;
      }
  
  invalid:
    - |
      function processOrder(order: Order) {
        // 100+ 行代码...
      }

exceptions:
  - condition: "生成的代码"
    reason: "某些生成代码天然复杂"
```

### 示例 2：禁止硬编码密钥

```yaml
name: no-hardcoded-secrets
severity: error
category: security
language: common

description: |
  禁止在代码中硬编码敏感信息。

patterns:
  - name: api-key
    pattern: "api[_-]?key\\s*=\\s*['\"][^'\"]{8,}['\"]"
    message: "检测到可能的 API Key"
  
  - name: password
    pattern: "password\\s*=\\s*['\"][^'\"]+['\"]"
    message: "检测到硬编码密码"

message: |
  检测到硬编码的敏感信息：{{pattern_name}}
  安全风险：代码泄露导致凭证暴露

fix:
  description: |
    1. 从代码中移除硬编码值
    2. 使用环境变量
    3. 或使用密钥管理服务
  
  template: |
    const apiKey = process.env.API_KEY;

examples:
  valid:
    - |
      const apiKey = process.env.API_KEY;
  
  invalid:
    - |
      const API_KEY = "sk-1234567890abcdef";

exceptions:
  - condition: "测试文件"
    reason: "测试可以使用假数据"
    requirement: "文件名必须包含 .test."
```

### 示例 3：类型安全

```yaml
name: no-explicit-any
severity: error
category: maintainability
language: typescript

description: |
  TypeScript 代码应该充分利用类型系统，避免使用 any。

detection:
  pattern: ":\\s*any\\b"
  exclude:
    - ".test.ts"
    - ".spec.ts"

message: |
  检测到 any 类型使用。
  请使用更具体的类型或 unknown。

fix:
  description: |
    1. 分析变量/参数的实际类型
    2. 定义接口或类型别名
    3. 使用泛型增加灵活性

examples:
  valid:
    - |
      interface User {
        id: string;
        name: string;
      }
      
      function getUser(id: string): User | undefined {
        return users.find(u => u.id === id);
      }
  
  invalid:
    - |
      function processData(data: any): any {
        return data.value;
      }

exceptions:
  - condition: "与遗留 JavaScript 交互"
    reason: "某些第三方库没有类型定义"
    mitigation: "使用 declare module 声明类型"
```

## 运行规则检查

```bash
# 检查所有规则
./scripts/lint-rules.sh

# 检查特定文件
./scripts/lint-rules.sh src/components/Button.tsx

# 自动修复
./scripts/lint-rules.sh --fix

# 检查特定规则
./scripts/lint-rules.sh --rule no-explicit-any
```

## 规则集配置

创建规则集来组合多个规则：

```yaml
# rules/sets/frontend.yaml
name: frontend-ruleset
description: 前端开发规则集

rules:
  - typescript/function-size-limit
  - typescript/no-explicit-any
  - typescript/require-return-type
  - react/no-dangerous-html
  - security/no-hardcoded-secrets

severity_override:
  typescript/no-explicit-any: error
  security/no-hardcoded-secrets: error

ignore_patterns:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/node_modules/**"
```

## 最佳实践

### 1. 清晰的描述

```yaml
description: |
  解释规则的目的、原因和影响。
  帮助开发者理解为什么要遵守这个规则。
```

### 2. 提供修复示例

```yaml
fix:
  description: |
    详细的修复步骤说明
  
  template: |
    // 修复后的代码
    // 包含注释说明
```

### 3. 合理的例外

```yaml
exceptions:
  - condition: "明确的例外情况"
    reason: "为什么可以例外"
    requirement: "必须满足的条件"
```

### 4. 渐进式启用

```yaml
# 新规则从 warning 开始
severity: warning

# 稳定后改为 error
# severity: error
```

## 参考

- [TypeScript 规则示例](../rules/typescript/)
- [安全规则示例](../rules/security/)
