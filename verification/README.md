# Verification Loops

验证循环系统确保 Agent 输出的质量和正确性。

## 验证类型

| 类型 | 描述 | 触发时机 |
|------|------|----------|
| `syntax` | 语法检查 | 代码生成后 |
| `static` | 静态分析 | 文件保存后 |
| `unit` | 单元测试 | 功能实现后 |
| `integration` | 集成测试 | 模块完成后 |
| `security` | 安全扫描 | 提交前 |
| `performance` | 性能测试 | 优化后 |

## 验证循环模式

### 1. 检查点验证 (Checkpoint-based)

```
[实现] -> [验证] -> [通过?] -> [是: 继续] -> [检查点]
                    -> [否: 修复] -> [重试]
```

### 2. 连续验证 (Continuous)

```
[编辑] -> [实时检查] -> [问题?] -> [即时反馈]
```

### 3. 分级验证 (Graded)

```
Level 1: 语法检查 (自动)
Level 2: 静态分析 (自动)
Level 3: 单元测试 (自动)
Level 4: 集成测试 (半自动)
Level 5: 人工审查 (手动)
```

## 配置

```yaml
# verification/config.yaml
verification:
  mode: checkpoint  # checkpoint | continuous | graded
  
  levels:
    - name: syntax
      auto: true
      block_on_failure: true
    
    - name: unit_tests
      auto: true
      block_on_failure: true
      min_coverage: 80
    
    - name: integration
      auto: false
      trigger: manual
  
  graders:
    - type: deterministic  # 确定性检查
      checks:
        - compilation
        - lint
    
    - type: heuristic      # 启发式检查
      checks:
        - code_quality
        - best_practices
    
    - type: model_based    # 模型评估
      checks:
        - semantic_correctness
        - completeness
```

## 使用

```bash
# 运行验证
./scripts/verify.sh

# 运行特定级别
./scripts/verify.sh --level unit

# 修复失败
./scripts/verify.sh --fix
```
