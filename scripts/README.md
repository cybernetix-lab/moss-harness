# Tooling Scripts

开发工具脚本，支持 Agent 开发、技能管理和评估调试。

## 定位

- **目标用户**: Agent 工程师、开发者
- **使用场景**: 技能开发/评估调试
- **交互方式**: 开发辅助工具

## 脚本分类

### 技能管理

| 脚本 | 功能 | 使用示例 |
|------|------|----------|
| `skill-discover.sh` | 发现并注册技能 | `./skill-discover.sh` |
| `skill-list.sh` | 列出所有技能 | `./skill-list.sh` |
| `skill-activate.sh` | 激活技能 | `./skill-activate.sh typescript-patterns` |
| `skill-run.sh` | 运行技能 | `./skill-run.sh react-hooks` |
| `skill-tag.sh` | 标签管理 | `./skill-tag.sh filter react` |
| `skill-eval.sh` | 评估技能 | `./skill-eval.sh typescript-patterns` |
| `skill-evolve.sh` | 进化技能 | `./skill-evolve.sh analyze react-hooks` |

### 评估框架

| 脚本 | 功能 | 使用示例 |
|------|------|----------|
| `run-evals.sh` | 运行评估用例 | `./run-evals.sh agents` |
| `eval-feedback.sh` | 处理评估反馈 | `./eval-feedback.sh process` |

### 遥测分析

| 脚本 | 功能 | 使用示例 |
|------|------|----------|
| `telemetry-analyze.sh` | 分析遥测数据 | `./telemetry-analyze.sh --session session_001` |
| `telemetry-view.sh` | 查看遥测指标 | `./telemetry-view.sh` |
| `telemetry-prometheus-exporter.sh` | 导出到 Prometheus | `./telemetry-prometheus-exporter.sh` |

### 开发工具

| 脚本 | 功能 | 使用示例 |
|------|------|----------|
| `local-ci.sh` | 本地 CI 检查 | `./local-ci.sh` |
| `lint-rules.sh` | 规则检查 | `./lint-rules.sh` |
| `verify.sh` | 验证配置 | `./verify.sh` |
| `update-context.sh` | 更新上下文 | `./update-context.sh task "新目标"` |
| `health-check.sh` | 健康检查 | `./health-check.sh` |
| `memory.sh` | 内存操作 | `./memory.sh search "pattern"` |
| `ruleset.sh` | 规则集管理 | `./ruleset.sh list` |

## 典型工作流

```bash
# 1. 发现新技能
./skill-discover.sh

# 2. 激活技能
./skill-activate.sh typescript-patterns

# 3. 评估技能效果
./skill-eval.sh typescript-patterns

# 4. 分析遥测数据
./telemetry-analyze.sh --skill typescript-patterns

# 5. 基于反馈进化技能
./skill-evolve.sh evolve typescript-patterns
```

## 与其他目录的关系

- 操作 `configs/skills/` 中的技能注册表
- 操作 `integrations/skills/` 中的技能定义
- 读取 `runtime/telemetry/` 中的遥测数据
- 被 `apps/agent-cli/` 调用进行技能评估
