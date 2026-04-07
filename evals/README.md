# Evaluation Framework

评估框架用于验证 Agent 输出质量，确保符合预期标准。

## 评估类型

```
evals/
├── unit/           # 单元测试
├── integration/    # 集成测试
├── benchmarks/     # 性能基准
└── harness/        # Harness 自身评估
```

## 评估维度

1. **Correctness** - 正确性
2. **Performance** - 性能
3. **Security** - 安全性
4. **Maintainability** - 可维护性
5. **Completeness** - 完整性

## 运行评估

```bash
# 运行所有评估
./scripts/run-evals.sh

# 运行特定评估
./scripts/run-evals.sh unit

# 生成报告
./scripts/generate-report.sh
```
