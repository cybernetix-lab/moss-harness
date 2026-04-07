# 更新日志

所有项目的显著变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增

- 技能系统支持触发器自动识别
- 会话钩子自动化上下文管理
- 多 Agent 架构（实现者、审查者、研究者）
- 代码规则系统
- MCP 集成
- 记忆系统
- 6 级验证循环

## [1.0.0] - 2024-XX-XX

### 新增

- 🎉 初始版本发布
- 完整的 Harness 工程模板
- 上下文管理系统
- 约束与护栏系统
- 评估框架
- 可观测性系统
- 工具定义规范
- 运维脚本集合

### 技能

- TypeScript 模式技能
- React Hooks 技能
- 安全扫描技能
- 文档查询技能

### Agent

- 实现者 Agent (Implementer)
- 审查者 Agent (Reviewer)
- 研究者 Agent (Researcher)

### 规则

- 函数大小限制规则
- 类型安全规则
- 禁止硬编码密钥规则

---

## 版本说明

### 版本号格式

`MAJOR.MINOR.PATCH`

- **MAJOR**: 不兼容的 API 变更
- **MINOR**: 向后兼容的功能添加
- **PATCH**: 向后兼容的问题修复

### 变更类型

- `Added` - 新功能
- `Changed` - 现有功能的变更
- `Deprecated` - 即将移除的功能
- `Removed` - 移除的功能
- `Fixed` - Bug 修复
- `Security` - 安全相关的修复
