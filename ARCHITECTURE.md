# 架构设计

## 目录结构

```
agent-harness-spec/
├── 📁 apps/                    # 应用层
│   ├── agent-cli/              # 命令行工具
│   └── operator/               # K8s Operator
│
├── 📁 configs/                 # 配置层
│   ├── agents/                 # Agent 配置
│   ├── constraints/            # 约束策略
│   ├── orchestration/          # 编排配置
│   ├── protocols/              # 协议定义
│   ├── skills/                 # 技能注册表
│   └── telemetry/              # 遥测配置
│
├── 📁 runtime/                 # 运行时实现（TypeScript）
│   ├── agents/                 # Agent 运行时
│   ├── memory/                 # 内存系统
│   ├── orchestration/          # 编排系统
│   ├── sandbox/                # 沙箱系统
│   ├── storage/                # 存储系统
│   ├── subagent/               # 子代理管理
│   └── telemetry/              # 遥测收集
│
├── 📁 .runtime/                # 运行时数据（.gitignore）
│   └── context/                # 上下文管理
│       ├── PROGRESS.md
│       └── DECISIONS.md
│
├── 📁 integrations/            # 集成层
│   ├── extensions/             # 扩展模块
│   │   └── mailbox/            # 邮箱系统
│   ├── mcp/                    # MCP 协议
│   └── skills/                 # 技能定义
│
├── 📁 deployments/             # 部署配置
│   ├── docker/                 # Docker 配置
│   └── helm/                   # Helm charts
│
├── 📁 observability/           # 可观测性
│   ├── grafana/                # Grafana 看板
│   └── prometheus/             # Prometheus 配置
│
├── 📁 platform/                # 平台扩展
│   └── telemetry/              # 遥测文档
│
├── 📁 scripts/                 # 运维脚本
│
├── 📁 tooling/                 # 开发工具
│   ├── evals/                  # 评估用例
│   ├── rules/                  # 代码规范
│   └── scripts/                # 工具脚本
│
├── 📁 docs/                    # 文档
│
└── 📁 context/                 # 上下文管理（已迁移到 .runtime/context/）
```

## 分层职责

### 1. 应用层 (apps/)
- **职责**: 提供用户界面和外部接口
- **内容**: CLI工具、K8s Operator
- **依赖**: 可以依赖 configs/, runtime/, integrations/

### 2. 配置层 (configs/)
- **职责**: 静态配置管理
- **内容**: Agent配置、约束策略、编排配置、协议定义
- **特点**: 版本控制，运行时只读

### 3. 运行时层 (runtime/)
- **职责**: TypeScript 运行时实现
- **内容**: Agent运行时、内存系统、编排、沙箱、存储、遥测
- **特点**: 核心业务逻辑实现

### 4. 集成层 (integrations/)
- **职责**: 外部集成和扩展
- **内容**: 邮箱系统、MCP协议、技能定义
- **特点**: 可插拔的扩展模块

### 5. 运行时数据 (.runtime/)
- **职责**: 运行时生成的数据
- **内容**: 上下文、会话、检查点、遥测数据
- **特点**: .gitignore，动态生成

### 6. 部署层 (deployments/)
- **职责**: 部署配置
- **内容**: Docker、Helm、K8s配置
- **特点**: 基础设施即代码

### 7. 可观测性 (observability/)
- **职责**: 监控和告警
- **内容**: Prometheus、Grafana配置
- **特点**: 独立的监控栈

### 8. 工具层 (tooling/)
- **职责**: 开发工具和评估
- **内容**: 脚本、评估用例、代码规范
- **特点**: 独立运行，辅助开发

## 迁移映射

| 旧路径 | 新路径 |
|--------|--------|
| `packages/core/agents/` | `configs/agents/` |
| `packages/core/orchestration/` | `configs/orchestration/` |
| `packages/core/memory/` | `runtime/memory/` |
| `packages/core/sandbox/` | `runtime/sandbox/` |
| `packages/core/skills/` | `integrations/skills/` |
| `packages/platform/telemetry/` | `platform/telemetry/` |
| `infra/deployments/` | `deployments/` |
| `infra/observability/` | `observability/` |
| `infra/configs/` | `configs/` |
| `context/` | `.runtime/context/` |
