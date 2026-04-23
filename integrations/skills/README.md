# 技能系统 (Skills System)

## 概述

技能系统采用**多标签分类**架构，替代传统的单一层级目录分类。每个技能可以同时拥有多个标签，实现更灵活的组织和发现。

## 多标签分类体系

### 标签类别

| 类别 | 说明 | 示例 |
|------|------|------|
| **domain** | 领域标签 | frontend, backend, security, devops |
| **technology** | 技术栈标签 | react, typescript, python, docker |
| **task_type** | 任务类型标签 | coding, review, testing, research |
| **scenario** | 场景标签 | startup, enterprise, legacy, greenfield |
| **complexity** | 复杂度标签 | beginner, intermediate, advanced |

### 标签使用示例

```yaml
# skill.yaml
tags:
  # 领域标签
  - frontend
  - backend
  # 技术栈标签
  - react
  - typescript
  # 任务类型标签
  - coding
  - review
  # 场景标签
  - enterprise
  # 复杂度标签
  - intermediate
```

## 技能结构

```
integrations/skills/
├── README.md                # 本文件
├── evolution/
│   └── config.yaml          # 技能进化配置
├── react-hooks/             # 技能目录（扁平结构）
│   └── skill.yaml
├── typescript-patterns/
│   └── skill.yaml
├── documentation-lookup/
│   └── skill.yaml
└── security-scan/
    └── skill.yaml

configs/skills/
└── skill-registry.yaml      # 技能注册表（自动生成）
```

## 技能定义文件

### skill.yaml 结构

```yaml
name: skill-name                    # 技能唯一标识
description: |                      # 技能描述
  技能的详细描述...

version: 1.0.0                      # 语义化版本

# 多标签分类（核心）
tags:
  - frontend
  - react
  - coding
  - intermediate

# 标签权重（可选）
tag_weights:
  react: 1.0
  frontend: 0.8
  coding: 0.9

# 触发器
triggers:
  - pattern: "创建.*hook"
    confidence: 0.9
    tags_match: [react, frontend]

# 执行上下文
context:
  required_files:
    - "package.json"
  check_dependencies:
    - react

# 代码模板
patterns:
  - name: pattern-name
    description: 模式描述
    tags: [utility, performance]
    template: |
      // 代码模板

# 规则约束
rules:
  - name: rule-name
    description: 规则描述
    severity: warning

# 验证方式
validation:
  - eslint
  - typecheck

# 相关技能
related_skills:
  - other-skill
  - another-skill

# 进化配置
evolution:
  track_patterns: true
  learn_from_usage: true
```

### 第三方技能导入约定

从外部仓库导入技能时，保持上游 `SKILL.md` 原文不变，并在同目录补一个本地 `skill.yaml` 作为 Harness 适配层：

```
integrations/skills/
└── imported-skill/
    ├── SKILL.md     # 上游原文
    └── skill.yaml   # Harness 发现与导入配置
```

## 技能注册表

### skill-registry.yaml

注册表是技能系统的中央索引，包含：

1. **发现配置** - 定义如何扫描和发现技能
2. **标签分类体系** - 定义所有有效的标签类别和值
3. **技能列表** - 所有已注册技能的元数据

### 自动生成

注册表通过以下命令自动生成：

```bash
./scripts/skill-discover.sh
```

## CLI 工具

### 技能发现

```bash
# 扫描并注册所有技能
./scripts/skill-discover.sh discover

# 验证注册表
./scripts/skill-discover.sh validate

# 列出所有技能
./scripts/skill-discover.sh list
```

### 标签管理

```bash
# 查看标签分类体系
./scripts/skill-tag.sh categories

# 按标签筛选技能
./scripts/skill-tag.sh filter react

# 多标签 AND 筛选
./scripts/skill-tag.sh filter-and frontend,coding

# 多标签 OR 筛选
./scripts/skill-tag.sh filter-or react,vue

# 查看技能详情
./scripts/skill-tag.sh details react-hooks

# 查找相关技能
./scripts/skill-tag.sh related react-hooks

# 标签使用统计
./scripts/skill-tag.sh stats

# 验证标签
./scripts/skill-tag.sh validate
```

## 创建新技能

### 步骤

1. **创建技能目录**
   ```bash
   mkdir -p skills/my-new-skill
   ```

2. **编写 skill.yaml**
   ```yaml
   name: my-new-skill
   description: |
     技能描述...
   
   version: 1.0.0
   
   tags:
     - frontend
     - coding
     - beginner
   
   triggers:
     - pattern: "触发模式"
       confidence: 0.9
   
   # ... 其他配置
   ```

3. **注册技能**
   ```bash
   ./scripts/skill-discover.sh
   ```

4. **验证标签**
   ```bash
   ./scripts/skill-tag.sh validate
   ```

## 标签最佳实践

### 1. 标签选择原则

- **准确性**：选择最能描述技能特性的标签
- **完整性**：覆盖领域、技术、任务类型等多个维度
- **一致性**：使用注册表中预定义的标签

### 2. 避免过度标记

- 不要为每个技能添加所有可能的标签
- 保持标签数量在 5-10 个之间
- 优先使用高相关性标签

### 3. 标签权重

为关键标签设置权重，帮助系统更好地理解技能重点：

```yaml
tag_weights:
  react: 1.0        # 核心标签，最高权重
  frontend: 0.8     # 相关领域
  coding: 0.9       # 任务类型
```

## 技能发现机制

### 基于标签的匹配

系统通过以下方式发现技能：

1. **精确匹配** - 用户查询包含技能标签
2. **权重排序** - 根据标签权重计算相关性
3. **相关推荐** - 基于共同标签推荐相关技能

### 触发器增强

触发器可以指定匹配的上下文标签：

```yaml
triggers:
  - pattern: "创建.*组件"
    confidence: 0.9
    tags_match: [react, frontend]  # 仅在上下文匹配这些标签时触发
```

## 集成到 Agent 工作流

### 技能选择

```bash
# Agent 根据当前上下文标签选择技能
CONTEXT_TAGS="frontend,react,coding"

# 查找匹配的技能
./scripts/skill-tag.sh filter-or $CONTEXT_TAGS
```

### 动态加载

```bash
# 根据任务动态加载技能
TASK="创建 React Hook"

# 分析任务标签
TASK_TAGS=$(analyze_task "$TASK")

# 加载匹配的技能
for skill in $(./scripts/skill-tag.sh filter-or $TASK_TAGS); do
    load_skill "$skill"
done
```

## 扩展标签体系

### 添加新标签

编辑 `configs/skills/skill-registry.yaml`：

```yaml
registry:
  taxonomy:
    domain:
      - frontend
      - backend
      - my-new-domain  # 添加新标签
```

### 添加新类别

```yaml
registry:
  taxonomy:
    my_category:      # 新类别
      - tag1
      - tag2
```

## 故障排除

### 技能未被注册

1. 检查 skill.yaml 是否存在且格式正确
2. 确认技能不在排除路径中（如 evolution/）
3. 运行 `./scripts/skill-discover.sh` 重新扫描

### 标签验证失败

1. 检查标签是否在注册表的分类体系中
2. 确认标签拼写正确
3. 运行 `./scripts/skill-tag.sh validate` 查看详细信息

### 技能发现失败

1. 确认已安装 `yq` 工具
2. 检查 skill.yaml 的 YAML 格式
3. 查看错误日志定位问题
