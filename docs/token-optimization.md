# Token 消耗优化策略

> 基于信息论原理的 Token 使用优化指南

## 概述

Token 消耗是 LLM 应用的主要成本来源。本文档基于**信息论**原理，提供系统化的 Token 优化策略，帮助在保持输出质量的同时降低成本。

```
信息论核心：用最少的符号传递最多的信息
Token 优化目标：用最少的 Token 获得最好的结果
```

---

## 一、信息论基础

### 1.1 关键概念

#### 信息熵（Information Entropy）
衡量信息的不确定性，单位为比特（bits）。

```
H(X) = -Σ p(x) * log₂(p(x))
```

**在 Token 优化中的意义：**
- 高熵内容 = 高信息量 = 值得保留
- 低熵内容 = 低信息量 = 可以压缩

#### 信道容量（Channel Capacity）
信道的最大信息传输速率。

**在 Token 优化中的映射：**
- `max_tokens` = 信道容量上限
- 上下文窗口 = 信道带宽

#### 编码效率
将信息编码为 Token 的效率。

**优化目标：**
- 提高每个 Token 承载的信息量
- 减少冗余编码

### 1.2 Token 信息密度

定义：单位 Token 承载的信息量

```
信息密度 = 信息熵 / Token 数量
```

**优化原则：**
- 信息密度 > 2 bits/token：高效
- 信息密度 1-2 bits/token：正常
- 信息密度 < 1 bit/token：低效，需要优化

---

## 二、Token 消耗观测指标

### 2.1 基础指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| `token_input_count` | 输入 Token 数 | > 8000 |
| `token_output_count` | 输出 Token 数 | > 4000 |
| `token_total_count` | 总 Token 消耗 | > 10000 |
| `token_cost_estimate` | 预估成本 | > $1.0 |

### 2.2 信息论指标

| 指标 | 说明 | 优化目标 |
|------|------|----------|
| `information_entropy` | 信息熵 | 保持 > 4.5 bits/char |
| `token_information_density` | Token 信息密度 | > 2 bits/token |
| `signal_to_noise_ratio` | 信噪比 | > 0.7 |
| `compression_ratio` | 压缩率 | > 2.0 |

### 2.3 效率指标

| 指标 | 说明 | 优化目标 |
|------|------|----------|
| `tokens_per_task` | 每任务 Token 数 | < 5000 |
| `token_utilization_rate` | Token 利用率 | 60-80% |
| `context_efficiency_score` | 上下文效率 | > 70 |

---

## 三、优化策略

### 3.1 系统提示词优化

#### 问题
系统提示词通常占用 1000-3000 Token，但内容相对固定。

#### 优化策略

**1. 分层加载**
```yaml
system_prompt:
  base: "基础角色定义"  # 始终加载
  context_specific: "上下文相关指令"  # 按需加载
  task_specific: "任务相关指令"  # 动态加载
```

**2. 模板化**
```yaml
# 优化前（冗余）
system_prompt: |
  你是 Planner Agent。你的职责是...
  （2000 tokens 详细描述）

# 优化后（精简）
system_prompt: |
  Role: Planner
  Goal: Create execution plans
  Constraints: [详见: docs/agents/planner.md]
  # 使用引用减少重复
```

**3. 动态注入**
只注入当前任务需要的指令：
```python
if task_type == "code_review":
    prompt += code_review_guidelines
elif task_type == "architecture":
    prompt += architecture_guidelines
```

**预期效果：**
- 系统提示词从 2500 → 800 tokens
- 节省 68% 的系统提示词开销

### 3.2 上下文压缩

#### 问题
长对话历史占用大量 Token，但信息价值递减。

#### 优化策略

**1. 基于信息熵的压缩**
```python
def compress_by_entropy(messages, threshold=2.0):
    """
    根据信息熵压缩消息
    高熵消息保留，低熵消息摘要
    """
    for msg in messages:
        entropy = calculate_entropy(msg.content)
        if entropy < threshold:
            msg.content = generate_summary(msg.content)
    return messages
```

**2. 时间衰减策略**
```yaml
context_retention:
  recent:  # 最近消息
    count: 5
    compression: 0%  # 不压缩
  
  medium:  # 中等时效
    count: 10
    compression: 50%  # 压缩一半
  
  old:  # 过期消息
    count: unlimited
    compression: 90%  # 高度压缩，仅保留关键信息
```

**3. 相关性过滤**
```python
def filter_by_relevance(messages, current_query, threshold=0.7):
    """
    只保留与当前查询相关的上下文
    """
    relevant = []
    for msg in messages:
        similarity = calculate_similarity(msg.content, current_query)
        if similarity > threshold:
            relevant.append(msg)
    return relevant
```

**预期效果：**
- 上下文从 6000 → 2000 tokens
- 信息保留率 > 85%

### 3.3 结构化输出优化

#### 问题
自然语言输出冗余，信息密度低。

#### 优化策略

**1. 使用结构化格式**
```yaml
# 优化前（自然语言，约 500 tokens）
output: |
  我已经完成了代码审查。发现以下问题：
  1. 第 15 行有一个未使用的变量
  2. 第 32 行缺少错误处理
  3. 整体代码质量良好...

# 优化后（结构化，约 200 tokens）
output:
  status: completed
  issues:
    - line: 15
      type: unused_variable
      severity: warning
    - line: 32
      type: missing_error_handling
      severity: error
  quality_score: 85
```

**2. 缩写和符号系统**
```yaml
# 定义符号系统
symbols:
  "→": "implies/ leads to"
  "∵": "because"
  "∴": "therefore"
  "⚠": "warning"
  "✓": "completed"
  "✗": "failed"
```

**3. 代码块优化**
```yaml
# 优化前
output: |
  这是完整的代码实现：
  ```python
  def calculate_sum(a, b):
      result = a + b
      return result
  ```

# 优化后（使用 diff 或引用）
output:
  action: create_file
  path: src/utils.py
  content_ref: file_123  # 引用外部存储
  summary: "Added calculate_sum function"
```

**预期效果：**
- 输出 Token 减少 40-60%
- 信息密度提高 2-3 倍

### 3.4 智能缓存

#### 问题
重复查询浪费 Token。

#### 优化策略

**1. 语义缓存**
```python
class SemanticCache:
    def __init__(self, similarity_threshold=0.95):
        self.cache = {}
        self.threshold = similarity_threshold
    
    def get(self, query):
        for cached_query, result in self.cache.items():
            if semantic_similarity(query, cached_query) > self.threshold:
                return result
        return None
```

**2. 分层缓存**
```yaml
cache_layers:
  l1_memory:  # 内存缓存
    ttl: 300  # 5分钟
    max_size: 100
    
  l2_local:  # 本地缓存
    ttl: 3600  # 1小时
    max_size: 1000
    
  l3_remote:  # 远程缓存
    ttl: 86400  # 1天
    max_size: 10000
```

**预期效果：**
- 缓存命中率 30-50%
- 整体 Token 消耗降低 20-30%

### 3.5 模型选择优化

#### 问题
所有任务使用同一模型，造成浪费。

#### 优化策略

**1. 任务复杂度分级**
```yaml
task_complexity:
  simple:
    criteria:
      - token_count < 1000
      - no_reasoning_required
    model: gpt-3.5-turbo  # 低成本模型
    
  medium:
    criteria:
      - token_count < 5000
      - requires_basic_reasoning
    model: claude-3-5-sonnet
    
  complex:
    criteria:
      - token_count > 5000
      - requires_deep_reasoning
    model: claude-3-opus  # 高性能模型
```

**2. 级联调用**
```python
async def cascade_completion(prompt):
    # 先用低成本模型尝试
    result = await gpt35.complete(prompt)
    
    # 检查质量
    if quality_score(result) < 0.8:
        # 质量不达标，使用高性能模型
        result = await claude_opus.complete(prompt)
    
    return result
```

**预期效果：**
- 成本降低 40-60%
- 质量保持 95%+

---

## 四、实施路线图

### 阶段 1：观测（1-2 周）

**目标：** 建立 Token 消耗的可观测性

- [ ] 部署 Token telemetry
- [ ] 建立基线指标
- [ ] 识别高消耗场景

### 阶段 2：快速优化（2-4 周）

**目标：** 实现 20-30% 的 Token 节省

- [ ] 系统提示词精简
- [ ] 上下文压缩实现
- [ ] 基础缓存部署

### 阶段 3：深度优化（1-2 月）

**目标：** 实现 40-50% 的 Token 节省

- [ ] 信息熵驱动的压缩
- [ ] 智能模型选择
- [ ] 高级缓存策略

### 阶段 4：持续优化（长期）

**目标：** 保持高效，持续改进

- [ ] 自动化优化建议
- [ ] A/B 测试框架
- [ ] 自适应参数调整

---

## 五、最佳实践

### 5.1 设计阶段

1. **预设 Token 预算**
   ```yaml
   task_design:
     token_budget: 5000
     optimization_required: true
   ```

2. **信息密度评估**
   ```python
   def evaluate_prompt_efficiency(prompt):
       entropy = calculate_entropy(prompt)
       tokens = count_tokens(prompt)
       density = entropy / tokens
       
       if density < 1.5:
           logger.warning("Low information density, consider optimization")
   ```

### 5.2 开发阶段

1. **Token 感知编程**
   ```python
   # 监控 Token 使用
   with token_tracker.track("operation_name"):
       result = agent.execute(task)
       
   # 检查是否超预算
   if token_tracker.usage > budget:
       trigger_optimization()
   ```

2. **渐进式加载**
   ```python
   # 先加载必要信息
   essential_context = load_essential_context()
   
   # 根据需要加载额外信息
   if need_more_context():
       additional_context = load_additional_context()
   ```

### 5.3 运维阶段

1. **定期审查**
   - 每周审查 Token 消耗报告
   - 识别异常消耗模式
   - 评估优化效果

2. **告警响应**
   ```yaml
   alerts:
     - condition: "token_usage > 10000"
       action: "investigate_and_optimize"
       
     - condition: "information_density < 1.0"
       action: "review_prompt_design"
   ```

---

## 六、度量与验证

### 6.1 关键指标

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| 平均任务 Token 数 | 8000 | 4000 | -50% |
| 信息密度 | 1.2 | 2.5 | +108% |
| 成本/任务 | $0.50 | $0.25 | -50% |
| 响应质量 | 85% | 87% | +2% |

### 6.2 验证方法

1. **A/B 测试**
   ```python
   # 对照组 vs 优化组
   control_group = execute_with_original_prompt(task)
   treatment_group = execute_with_optimized_prompt(task)
   
   # 比较结果
   token_savings = compare_token_usage(control_group, treatment_group)
   quality_retention = compare_quality(control_group, treatment_group)
   ```

2. **回归测试**
   - 确保优化不降低输出质量
   - 维护测试用例库
   - 自动化质量评估

---

## 七、总结

Token 优化的核心是**信息论原理的应用**：

1. **识别高价值信息**（高熵）并优先保留
2. **压缩低价值信息**（低熵）减少冗余
3. **优化编码方式**提高信息密度
4. **建立反馈机制**持续改进

```
优化公式：
最优 Token 使用 = 必要信息量 / 最大信息密度

其中：
- 必要信息量由任务决定
- 信息密度通过优化提升
```

通过系统化的观测和优化，可以实现：
- **成本降低 40-60%**
- **响应速度提升 30-50%**
- **质量保持稳定或略有提升**

---

## 参考

- [信息论基础 - Claude Shannon](https://en.wikipedia.org/wiki/Information_theory)
- [Token 计数原理 - OpenAI](https://platform.openai.com/tokenizer)
- [上下文压缩技术 - LangChain](https://python.langchain.com/docs/modules/memory/)
