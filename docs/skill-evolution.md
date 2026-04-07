# 技能进化系统 (Skill Evolution System)

技能进化系统是一个自动化机制，允许 AI Agent 的技能根据使用数据和性能反馈自我优化和改进。

## 核心概念

### 什么是技能进化？

技能进化是指通过分析技能的历史使用数据，自动识别成功模式、优化触发条件、扩展模板库，从而提升技能的准确性和效率。

### 进化维度

1. **触发器优化 (Trigger Optimization)**
   - 基于成功匹配历史优化触发条件
   - 添加新的关键词和模式
   - 调整触发权重

2. **模板扩展 (Template Expansion)**
   - 从成功案例中提取新的模板变体
   - 识别高频使用模式
   - 生成上下文感知的模板

3. **参数学习 (Parameter Learning)**
   - 学习最优参数配置
   - 根据上下文动态调整参数
   - 建立参数-成功率关联模型

4. **上下文感知 (Context Awareness)**
   - 识别不同上下文下的最佳实践
   - 建立场景-策略映射
   - 实现自适应执行策略

5. **新技能发现 (New Skill Discovery)** ⭐ NEW
   - 从 memory 经验中学习新技能
   - 自动识别重复出现的代码模式
   - 严格的阈值控制防止随意生成

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Skill Evolution System                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Tracking   │  │   Analysis   │  │  Evolution   │      │
│  │   Layer      │  │    Engine    │  │   Engine     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         ▼                 ▼                 ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Skill Stats Storage                    │   │
│  │         (memory/skill-stats/*.json)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           New Skill Discovery Engine                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │  Extract │→│  Analyze │→│ Propose  │          │   │
│  │  │  Patterns│  │ Frequency│  │  New Skill│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 配置文件

### evolution/config.yaml

```yaml
version: 1.1.0

# 进化触发条件
evolution_triggers:
  usage_threshold: 10
  success_rate_threshold: 0.85
  time_interval_days: 7
  new_pattern_threshold: 3

# 性能指标权重
performance_weights:
  success_rate: 0.4
  avg_duration: 0.2
  user_feedback: 0.2
  code_quality: 0.2

# 进化策略
evolution_strategies:
  trigger_optimization:
    enabled: true
    min_confidence: 0.7
    max_triggers: 10
  
  template_expansion:
    enabled: true
    max_templates: 20
    similarity_threshold: 0.8
  
  parameter_learning:
    enabled: true
    learning_rate: 0.1
  
  context_awareness:
    enabled: true
    context_window: 5

# 学习数据源
learning_sources:
  - session_memory
  - successful_executions
  - user_corrections
  - code_reviews
  - extracted_patterns

# 新技能发现配置 (New Skill Discovery) ⭐
new_skill_discovery:
  enabled: true
  
  # 发现触发条件 - 严格控制避免随意生成
  discovery_triggers:
    min_pattern_frequency: 5      # 最小重复模式次数
    min_session_samples: 3        # 最小会话样本数
    min_success_rate: 0.9         # 最小成功率
    time_window_days: 30          # 时间窗口（天）
    min_uniqueness_score: 0.7     # 最小独特性分数
  
  # 模式提取配置
  pattern_extraction:
    min_code_lines: 5             # 代码模式最小行数
    max_code_lines: 100           # 代码模式最大行数
    keyword_count: 5              # 关键词提取数量
    semantic_similarity_threshold: 0.85
  
  # 提案验证流程
  proposal_validation:
    require_approval: true        # 是否需要人工审核
    auto_checks:
      - syntax_valid
      - no_duplicates
      - naming_convention
      - trigger_coverage
    similarity_threshold: 0.75    # 相似技能检测阈值
  
  # 生成控制 - 防止过度生成
  generation_control:
    max_proposals_per_week: 3     # 每周最大新技能提案数
    cooldown_days: 7              # 冷却期（天）
    min_quality_score: 0.8        # 最小质量分数
    min_requirements_met: 4       # 必须满足的最低条件数

# 版本控制
versioning:
  auto_increment: patch
  retention_versions: 5
  changelog_required: true
```

## 使用统计追踪

### 追踪的数据

每个技能的使用数据存储在 `memory/skill-stats/{skill-name}.json`：

```json
{
  "skill_name": "code-review",
  "version": "1.2.0",
  "stats": {
    "total_usage": 150,
    "successful_usage": 135,
    "failed_usage": 15,
    "success_rate": 0.9,
    "avg_duration_ms": 2500,
    "last_used": "2024-01-15T10:30:00Z"
  },
  "history": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "query": "review this PR",
      "success": true,
      "duration_ms": 2300
    }
  ],
  "patterns": [
    {
      "pattern": "review.*PR",
      "frequency": 45,
      "success_rate": 0.95
    }
  ]
}
```

### 追踪方式

通过 `hooks/skill-usage.sh` 在技能执行时自动追踪：

```bash
# 在技能执行开始时记录
./hooks/skill-usage.sh start code-review "review this PR"

# 在技能执行结束时记录结果
./hooks/skill-usage.sh end code-review "review this PR" true 2300
```

## CLI 工具

### skill-evolve.sh

技能进化引擎的命令行工具：

#### 现有技能进化

```bash
# 分析特定技能的进化潜力
./scripts/skill-evolve.sh analyze code-review

# 执行技能进化
./scripts/skill-evolve.sh evolve code-review

# 查看技能进化状态
./scripts/skill-evolve.sh status code-review

# 列出所有可进化的技能
./scripts/skill-evolve.sh list

# 模拟进化（不实际执行）
./scripts/skill-evolve.sh dry-run code-review

# 回滚到上一版本
./scripts/skill-evolve.sh rollback code-review
```

#### 新技能发现 ⭐ NEW

```bash
# 从 memory 中发现潜在新技能
./scripts/skill-evolve.sh discover

# 详细模式（显示扫描条件和过滤原因）
./scripts/skill-evolve.sh discover --verbose

# 列出所有待审核提案
./scripts/skill-evolve.sh proposals

# 查看提案详情
./scripts/skill-evolve.sh propose prop-20240101-abc123

# 批准并创建新技能
./scripts/skill-evolve.sh propose prop-20240101-abc123 --approve

# 拒绝提案
./scripts/skill-evolve.sh propose prop-20240101-abc123 --reject
```

### 分析输出示例

#### 现有技能分析

```
══════════════════════════════════════════════════════════════
              分析技能: code-review
══════════════════════════════════════════════════════════════

📋 技能信息
  路径: skills/code-review/skill.yaml
  当前版本: 1.2.0
  触发器数量: 5
  模板数量: 3

📊 使用统计
  使用次数: 150
  成功次数: 135
  失败次数: 15
  成功率: 0.90
  提取的模式: 8

🔍 进化条件检查
  ✓ 使用次数达标 (150 >= 10)
  ✓ 成功率达标
  ✓ 新模式数量达标 (8 >= 3)

💡 优化建议
  • 触发器数量较少，建议添加更多触发模式
  • 失败率较高，建议优化验证规则

✅ 技能已准备好进化
   运行: ./scripts/skill-evolve.sh evolve code-review
```

#### 新技能发现

```
══════════════════════════════════════════════════════════════
              从 Memory 中发现新技能
══════════════════════════════════════════════════════════════

📊 本周提案数: 1 / 3

🔍 步骤1: 从会话记忆中提取代码模式...
  ✓ 提取了 47 个代码片段

📈 步骤2: 分析模式频率和分布...
  ✓ 发现 3 个候选模式

🎯 步骤3: 评估候选模式质量...

  ✓ 创建提案: prop-20240115-a1b2c3d4
    建议名称: typescript-create-component
    质量分数: 0.87
    出现频率: 7 次 / 4 个会话
    语言: typescript

══════════════════════════════════════════════════════════════
✅ 发现完成
   创建提案数: 1
   查看提案: ./scripts/skill-evolve.sh proposals
   审核提案: ./scripts/skill-evolve.sh propose <proposal_id>
```

## 新技能发现流程 ⭐ NEW

### 发现阶段

```
┌─────────────────────────────────────────────────────────────┐
│  1. EXTRACT - 从 Memory 提取代码模式                         │
├─────────────────────────────────────────────────────────────┤
│  • 扫描 memory/sessions/*.json                              │
│  • 只处理 status=success 的会话                              │
│  • 提取 5-100 行的代码块                                     │
│  • 记录语言、关键词、时间戳                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. ANALYZE - 分析模式频率                                   │
├─────────────────────────────────────────────────────────────┤
│  • 按代码签名分组（MD5前12位）                                │
│  • 筛选: 频率≥5, 跨≥3个会话                                   │
│  • 按频率排序，取前10                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. EVALUATE - 质量评估                                      │
├─────────────────────────────────────────────────────────────┤
│  • 复杂度评分（代码结构）                                     │
│  • 完整性评分（导入/定义/返回）                               │
│  • 通用性评分（频率+跨会话）                                  │
│  • 可读性评分（注释/空行）                                    │
│  • 综合质量分 ≥ 0.8 才通过                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  4. VALIDATE - 验证唯一性                                    │
├─────────────────────────────────────────────────────────────┤
│  • 与现有技能计算相似度                                       │
│  • 相似度 ≥ 0.75 则拒绝                                      │
│  • 确保不重复造轮子                                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  5. PROPOSE - 创建提案                                       │
├─────────────────────────────────────────────────────────────┤
│  • 生成建议名称（基于关键词）                                 │
│  • 保存到 skills/evolution/proposals/                        │
│  • 状态: pending，等待人工审核                                │
└─────────────────────────────────────────────────────────────┘
```

### 审核阶段

```bash
# 查看提案列表
./scripts/skill-evolve.sh proposals

# 提案ID          建议名称                质量分    状态      创建时间
# ─────────────────────────────────────────────────────────────────────────────
# prop-20240115-001 typescript-create-comp 0.87     pending   2024-01-15
# prop-20240115-002 react-custom-hook      0.82     pending   2024-01-15

# 查看详情
./scripts/skill-evolve.sh propose prop-20240115-001

# 批准后自动创建技能
./scripts/skill-evolve.sh propose prop-20240115-001 --approve
# ✓ 技能已创建: skills/auto-generated/typescript-create-component
# ✓ 提案已批准
```

### 生成控制机制

为了防止随意生成新技能，系统实现了多层控制：

1. **频率控制**
   - 最小重复次数: 5次
   - 跨会话验证: 至少3个不同会话
   - 时间窗口: 30天内

2. **质量控制**
   - 最小质量分数: 0.8
   - 最小成功率: 0.9
   - 多维度评估（复杂度/完整性/通用性/可读性）

3. **唯一性控制**
   - 与现有技能相似度检测
   - 相似度阈值: 0.75
   - 自动过滤重复模式

4. **生成速率控制**
   - 每周最大提案数: 3个
   - 冷却期: 7天
   - 需要人工审核才能创建

## 进化流程

### 1. 数据收集阶段

```
技能执行 → 触发 hooks/skill-usage.sh → 更新 stats JSON
```

### 2. 分析阶段

```
运行 skill-evolve.sh analyze → 读取 stats → 计算进化潜力 → 生成建议
```

### 3. 进化阶段

```
运行 skill-evolve.sh evolve → 备份当前版本 → 应用优化 → 更新版本号 → 记录历史
```

### 4. 新技能发现阶段 ⭐ NEW

```
运行 skill-evolve.sh discover → 提取模式 → 分析频率 → 质量评估 → 创建提案
```

### 5. 验证阶段

```
运行测试 → 验证成功率 → 决定是否回滚
```

## 模式提取算法

### 触发器模式提取

```python
def extract_trigger_patterns(queries, min_frequency=3):
    """
    从成功查询中提取高频触发模式
    """
    patterns = {}
    for query in queries:
        # 提取关键词组合
        tokens = tokenize(query.lower())
        for n in range(2, min(5, len(tokens))):
            for ngram in ngrams(tokens, n):
                pattern = '.*'.join(ngram)
                patterns[pattern] = patterns.get(pattern, 0) + 1
    
    # 过滤低频模式
    return {p: c for p, c in patterns.items() if c >= min_frequency}
```

### 模板变体生成

```python
def generate_template_variants(successful_outputs):
    """
    从成功案例中生成模板变体
    """
    variants = []
    for output in successful_outputs:
        # 识别可参数化的部分
        placeholders = identify_placeholders(output)
        template = create_template(output, placeholders)
        variants.append(template)
    return deduplicate(variants)
```

### 新技能代码模式提取 ⭐ NEW

```python
def extract_code_patterns(session_data):
    """
    从会话数据中提取可复用的代码模式
    """
    patterns = []
    
    for change in session_data['code_changes']:
        code = change['code']
        lines = code.strip().split('\n')
        
        # 过滤代码长度
        if not (5 <= len(lines) <= 100):
            continue
            
        # 提取关键词
        keywords = extract_keywords(code)
        
        # 生成签名
        signature = hashlib.md5(code[:100].encode()).hexdigest()[:12]
        
        patterns.append({
            'signature': signature,
            'code': code,
            'keywords': keywords,
            'language': change['language'],
            'line_count': len(lines)
        })
    
    return patterns
```

## 最佳实践

### 1. 定期分析

建议每周运行一次分析：

```bash
#!/bin/bash
# weekly-analysis.sh

# 分析现有技能
for skill in skills/*/*/; do
    skill_name=$(basename "$skill")
    if [ -f "memory/skill-stats/${skill_name}.json" ]; then
        ./scripts/skill-evolve.sh analyze "$skill_name"
    fi
done

# 发现新技能
./scripts/skill-evolve.sh discover

# 查看待审核提案
./scripts/skill-evolve.sh proposals
```

### 2. 渐进式进化

- 每次只进化一个技能
- 进化后观察至少一周
- 确认成功率提升后再进化下一个

### 3. 新技能审核流程

```
发现提案 → 人工审核 → 测试验证 → 批准创建 → 监控使用
```

- **发现提案**: 系统自动发现潜在技能
- **人工审核**: 检查代码质量、命名规范、触发器合理性
- **测试验证**: 在测试环境验证技能效果
- **批准创建**: 确认无误后批准创建
- **监控使用**: 追踪新技能的使用情况和成功率

### 4. 版本管理

- 保留最近的 10 个版本
- 重大版本变更（v1.x → v2.0）需要人工审核
- 使用 `skill-evolve.sh rollback` 快速回滚
- 新技能从 v1.0.0 开始

### 5. 监控指标

关注以下指标：

- **成功率变化**：进化后成功率应提升至少 5%
- **响应时间**：进化后响应时间不应增加超过 10%
- **用户满意度**：收集用户反馈评估进化效果
- **新技能质量**：新创建技能的成功率应 ≥ 0.85

## 集成到工作流

### 在 session-stop 钩子中集成

```bash
# hooks/session-stop.sh

# 会话结束时分析技能使用情况
if [ -d "memory/skill-stats" ]; then
    for stats_file in memory/skill-stats/*.json; do
        skill_name=$(basename "$stats_file" .json)
        ./scripts/skill-evolve.sh analyze "$skill_name" --quiet
    done
fi

# 每月第一天尝试发现新技能
if [ "$(date +%d)" == "01" ]; then
    ./scripts/skill-evolve.sh discover
fi
```

### 在 CI/CD 中集成

```yaml
# .github/workflows/skill-evolution.yml
name: Skill Evolution Analysis
on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日运行

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Analyze Existing Skills
        run: |
          for skill in skills/*/*/; do
            ./scripts/skill-evolve.sh analyze "$(basename "$skill")"
          done
      
      - name: Discover New Skills
        run: |
          ./scripts/skill-evolve.sh discover --verbose
          ./scripts/skill-evolve.sh proposals
```

## 故障排除

### 常见问题

**Q: 技能没有被追踪到使用情况**
- 检查 `hooks/skill-usage.sh` 是否正确集成到技能执行流程
- 确认 `memory/skill-stats/` 目录存在且有写权限

**Q: 进化后成功率下降**
- 使用 `./scripts/skill-evolve.sh rollback <skill-name>` 回滚
- 检查进化日志了解具体变更
- 调整 `evolution/config.yaml` 中的阈值

**Q: 进化建议不准确**
- 增加 `min_confidence` 阈值
- 增加 `usage_threshold` 要求更多数据
- 手动审核进化建议

**Q: 发现不到新技能**
- 检查 `memory/sessions/` 是否有足够的成功会话数据
- 确认代码变更是否满足最小行数要求（5-100行）
- 检查质量分数阈值是否过高
- 使用 `--verbose` 查看详细过滤原因

**Q: 提案质量分数低**
- 确保代码有完整的导入/定义/返回
- 添加注释提高可读性分数
- 确保代码结构清晰（条件/循环等）

## 未来扩展

1. **机器学习集成**：使用 ML 模型预测最佳进化策略
2. **A/B 测试**：同时运行多个技能版本对比效果
3. **跨技能学习**：从相似技能迁移优化策略
4. **自动参数调优**：使用贝叶斯优化自动调整参数
5. **语义理解**：使用代码嵌入模型理解代码语义相似度
6. **社区共享**：允许导入社区贡献的技能模式
