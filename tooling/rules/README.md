# Tools Definition

工具定义目录包含 Agent 可用工具的规范定义。

## 工具设计原则

1. **单一职责** - 每个工具只做一件事
2. **显式接口** - 输入输出明确声明
3. **可验证性** - 结果可被自动验证
4. **安全性** - 默认安全，显式授权

## 工具分类

```
tools/
├── filesystem/     # 文件系统操作
├── code/           # 代码相关
├── search/         # 搜索功能
├── execution/      # 代码执行
└── network/        # 网络请求
```

## 工具定义格式

```yaml
name: tool_name
description: 工具描述
input:
  type: object
  properties:
    param1:
      type: string
      description: 参数描述
  required: [param1]
output:
  type: object
  properties:
    result:
      type: string
errors:
  - name: NotFoundError
    description: 资源不存在
examples:
  - input: {param1: "value"}
    output: {result: "success"}
```
