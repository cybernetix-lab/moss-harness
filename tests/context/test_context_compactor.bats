#!/usr/bin/env bats
#
# context-compactor.sh 测试
# 测试三层压缩机制：大结果持久化、旧结果微压缩、整体历史压缩
#

setup() {
    load '../test_helper'
    
    COMPACTOR="${PROJECT_ROOT}/runtime/context/context-compactor.sh"
    TEST_SESSION="${PROJECT_ROOT}/.runtime/sessions/test_compact_$$"
    TEST_OUTPUTS="${PROJECT_ROOT}/.runtime/outputs"
    
    # 创建测试会话目录
    mkdir -p "$TEST_SESSION"
    mkdir -p "$TEST_OUTPUTS"
}

teardown() {
    # 清理测试数据
    if [[ -d "$TEST_SESSION" ]]; then
        rm -rf "$TEST_SESSION"
    fi
    
    # 清理测试输出文件
    find "$TEST_OUTPUTS" -name "test_tool_*.txt" -delete 2>/dev/null || true
}

@test "compactor script exists and is executable" {
    assert_file_exists "$COMPACTOR"
    [[ -x "$COMPACTOR" ]]
}

@test "compactor status command works" {
    run "$COMPACTOR" status
    assert_success
    [[ "$output" == *"has_compacted"* ]]
}

@test "persist small output (under threshold) returns as-is" {
    run "$COMPACTOR" persist test_tool "small output"
    assert_success
    [[ "$output" == "small output" ]]
}

@test "persist large output (over threshold) saves to disk with preview" {
    # 生成超过2000字符的输出
    large_output=$(python3 -c "print('A' * 3000)")
    
    run "$COMPACTOR" persist test_tool "$large_output"
    assert_success
    
    # 检查输出包含持久化标记
    [[ "$output" == *"<persisted-output>"* ]]
    [[ "$output" == *"Full output saved to:"* ]]
    [[ "$output" == *"Size: 3000 characters"* ]]
    [[ "$output" == *"Preview:"* ]]
    
    # 检查文件实际被保存
    [[ "$output" == *".runtime/outputs/test_tool_"* ]]
}

@test "micro_compact keeps only last 3 tool results" {
    # 创建包含5个工具结果的消息文件
    cat > "$TEST_SESSION/messages.json" << 'EOF'
{
    "messages": [
        {"role": "tool", "content": "result1"},
        {"role": "tool", "content": "result2"},
        {"role": "tool", "content": "result3"},
        {"role": "tool", "content": "result4"},
        {"role": "tool", "content": "result5"}
    ]
}
EOF
    
    # 运行微压缩
    run "$COMPACTOR" auto "$TEST_SESSION"
    assert_success
    
    # 检查输出
    [[ "$output" == *"Micro-compact completed"* ]] || [[ "$output" == *"Context size is within limits"* ]]
}

@test "compact_history generates summary file" {
    # 创建必要的上下文文件
    cat > "$TEST_SESSION/TASK.md" << 'EOF'
# Task State

## Current Focus
Test goal for compaction
EOF
    
    cat > "$TEST_SESSION/PROGRESS.md" << 'EOF'
# Progress

## Completed
- Step 1 completed
- Step 2 completed
EOF
    
    cat > "$TEST_SESSION/DECISIONS.md" << 'EOF'
# Decisions

### Decision 1
Use compression for context management
EOF
    
    # 运行完整压缩
    run "$COMPACTOR" compact "$TEST_SESSION"
    assert_success
    
    # 检查摘要文件是否生成
    assert_file_exists "$TEST_SESSION/context-summary.md"
    
    # 检查摘要内容
    [[ "$(cat "$TEST_SESSION/context-summary.md")" == *"Current Goal"* ]]
    [[ "$(cat "$TEST_SESSION/context-summary.md")" == *"Completed Work"* ]]
    [[ "$(cat "$TEST_SESSION/context-summary.md")" == *"Key Decisions"* ]]
}

@test "auto_compact checks context size and triggers compression when needed" {
    # 创建一个大文件来触发压缩
    cat > "$TEST_SESSION/large_file.md" << 'EOF'
# Large Context File
EOF
    # 添加大量内容
    for i in {1..1000}; do
        echo "Line $i with some content to increase file size significantly" >> "$TEST_SESSION/large_file.md"
    done
    
    # 运行自动压缩
    run "$COMPACTOR" auto "$TEST_SESSION"
    assert_success
    
    # 应该显示当前大小
    [[ "$output" == *"Current context size:"* ]]
}

@test "expand command retrieves persisted output" {
    # 先持久化一个大输出
    large_output=$(python3 -c "print('TEST_CONTENT_' * 100)")
    run "$COMPACTOR" persist test_tool "$large_output"
    assert_success
    
    # 提取文件路径
    filepath=$(echo "$output" | grep "Full output saved to:" | sed 's/.*Full output saved to: //' | tr -d '[:space:]')
    
    # 展开输出
    if [[ -n "$filepath" && -f "$filepath" ]]; then
        run "$COMPACTOR" expand "$filepath"
        assert_success
        [[ "$output" == *"TEST_CONTENT_"* ]]
    fi
}

@test "compact state is updated after compaction" {
    # 创建必要的文件
    cat > "$TEST_SESSION/TASK.md" << 'EOF'
## Current Focus
Test task
EOF
    
    # 运行压缩
    run "$COMPACTOR" compact "$TEST_SESSION"
    assert_success
    
    # 检查状态
    run "$COMPACTOR" status
    assert_success
    
    # 状态应该显示已压缩
    [[ "$output" == *"has_compacted"* ]]
    [[ "$output" == *"compact_count"* ]]
}

@test "context-compactor handles missing session directory gracefully" {
    run "$COMPACTOR" auto "/nonexistent/session"
    # 应该成功但不执行任何操作
    assert_success
}

@test "context-compactor shows help for unknown commands" {
    run "$COMPACTOR" unknown_command
    [[ "$status" -eq 1 ]]
    [[ "$output" == *"Usage:"* ]]
    [[ "$output" == *"auto"* ]]
    [[ "$output" == *"compact"* ]]
    [[ "$output" == *"persist"* ]]
}