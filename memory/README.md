# Memory System

记忆系统负责跨会话持久化 Agent 的学习和经验，并与 Eval 和 Optimizer 形成闭环。

## 闭环架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        闭环数据流                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐      评估结果      ┌──────────┐                  │
│   │   Eval   │ ─────────────────> │  Memory  │                  │
│   │  System  │                    │  System  │                  │
│   └────┬─────┘                    └────┬─────┘                  │
│        │                               │                        │
│        │                               │ 使用数据               │
│        │                               ▼                        │
│        │                        ┌──────────┐                   │
│        │                        │ Optimizer│                   │
│        │                        │(Evolver) │                   │
│        │                        └────┬─────┘                   │
│        │                             │                         │
│        │                             │ 优化建议                │
│        │                             ▼                         │
│        │                        ┌──────────┐                   │
│        │                        │  Skills  │                   │
│        │                        └────┬─────┘                   │
│        │                             │                         │
│        └─────────────────────────────┘  验证                    │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 记忆类型

| 类型 | 描述 | 存储位置 | 闭环作用 |
|------|------|----------|----------|
| `session` | 会话状态 | `memory/sessions/{id}/` | 提取模式 |
| `patterns` | 提取的模式 | `memory/patterns/` | 优化输入 |
| `skills` | 技能统计 | `memory/skill-stats/` | 进化依据 |
| `telemetry` | 历史遥测 | `memory/telemetry/` | 性能分析 |
| `knowledge` | 领域知识 | `memory/knowledge/` | 经验积累 |
| `eval-results` | 评估结果 | `memory/eval-results/` | 质量反馈 |
| `optimization` | 优化建议 | `memory/optimization-suggestions.json` | 行动指南 |

## 记忆结构

```
memory/
├── sessions/              # 会话记忆
│   └── {session_id}/
│       ├── TASK.md
│       ├── DECISIONS.md
│       ├── PROGRESS.md
│       ├── meta.json
│       └── summary.md
│
├── patterns/              # 可复用模式
│   └── {pattern_id}.yaml
│
├── skill-stats/           # 技能统计（闭环关键）
│   └── {skill_name}.json
│       ├── usage_count
│       ├── success_count
│       ├── eval_history   # 评估历史
│       └── performance_history
│
├── skill-history/         # 技能使用历史
│   └── {skill_name}.jsonl
│
├── telemetry/             # 历史遥测
│   └── {session_id}/
│
├── knowledge/             # 领域知识
│   └── {domain}/
│       └── facts.yaml
│
├── eval-results/          # 评估结果（新增）
│   └── {eval_name}-{timestamp}.json
│
├── optimization-suggestions.json  # 优化建议（新增）
│
└── closure-report-{date}.md       # 闭环报告（新增）
```

## 闭环流程

### 1. Eval → Memory

评估结果自动记录到 memory：

```bash
# 运行评估
./scripts/run-evals.sh

# 评估完成后自动触发反馈处理
./scripts/eval-feedback.sh process
```

### 2. Memory → Optimizer

技能统计驱动进化决策：

```bash
# 分析技能性能
./scripts/skill-evolve.sh analyze <skill-name>

# 基于统计数据决定是否可以进化
```

### 3. Optimizer → Skills

执行技能优化：

```bash
# 执行进化
./scripts/skill-evolve.sh evolve <skill-name>

# 更新技能定义、版本号、触发器
```

### 4. Skills → Eval

进化后的技能需要重新验证：

```bash
# 验证进化效果
./scripts/run-evals.sh harness

# 确保优化没有降低质量
```

## CLI 工具

### 记忆检索

```bash
# 搜索相关记忆
./scripts/memory-search.sh "typescript error handling"

# 查看会话历史
./scripts/memory-session.sh list

# 提取模式
./scripts/memory-extract.sh session_xxx

# 遗忘旧记忆
./scripts/memory-forget.sh --older-than 30d
```

### 评估反馈

```bash
# 处理评估结果（形成闭环）
./scripts/eval-feedback.sh process

# 生成优化建议
./scripts/eval-feedback.sh suggest

# 触发技能进化
./scripts/eval-feedback.sh evolve

# 生成闭环报告
./scripts/eval-feedback.sh report
```

### 技能进化

```bash
# 分析技能
./scripts/skill-evolve.sh analyze <skill-name>

# 执行进化
./scripts/skill-evolve.sh evolve <skill-name>

# 查看状态
./scripts/skill-evolve.sh status

# 回滚
./scripts/skill-evolve.sh rollback <skill-name>
```

## 记忆压缩

长期记忆会自动压缩：

- **保留**：目标、决策、失败经验、评估结果
- **压缩**：实现细节、成功路径
- **丢弃**：临时日志、重复信息

## 闭环指标

### 关键指标

1. **评估覆盖率** - 有多少技能有对应的评估
2. **反馈响应率** - 评估结果有多少被处理
3. **进化成功率** - 技能进化后的成功率变化
4. **闭环周期** - 从评估到优化的平均时间

### 查看指标

```bash
# 查看闭环报告
cat memory/closure-report-$(date +%Y%m%d).md

# 查看优化建议
cat memory/optimization-suggestions.json
```

## 集成到工作流

### 在 session-stop 钩子中

```bash
# hooks/session-stop.sh

# 1. 提取会话模式
./scripts/memory-extract.sh $SESSION_ID

# 2. 更新技能统计
./scripts/skill-usage.sh end $ACTIVE_SKILL

# 3. 生成优化建议
./scripts/eval-feedback.sh suggest
```

### 在 CI/CD 中

```yaml
# .github/workflows/closure.yml
name: Harness Closure Loop
on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日运行

jobs:
  closure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Evaluations
        run: ./scripts/run-evals.sh
      
      - name: Process Feedback
        run: ./scripts/eval-feedback.sh process
      
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: closure-reports
          path: memory/closure-report-*.md
```

## 故障排除

### 评估结果未记录

1. 检查 `memory/eval-results/` 目录权限
2. 确认 `eval-feedback.sh` 已正确集成到 `run-evals.sh`
3. 查看 `memory/eval-feedback.log` 错误日志

### 技能进化未触发

1. 检查技能使用次数是否达到阈值
2. 查看 `memory/optimization-suggestions.json` 是否有建议
3. 确认 `skill-evolve.sh` 可以正常执行

### 闭环不完整

1. 运行 `./scripts/eval-feedback.sh report` 查看闭环状态
2. 检查各组件之间的数据流
3. 确认所有脚本都有执行权限
