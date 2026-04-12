#!/usr/bin/env bats

load ../test_helper

# skill-discover.sh 测试
@test "skill-discover.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/skill-discover.sh"
  [[ -x "$PROJECT_ROOT/scripts/skill-discover.sh" ]]
}

# skill-list.sh 测试
@test "skill-list.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/skill-list.sh"
  [[ -x "$PROJECT_ROOT/scripts/skill-list.sh" ]]
}

@test "skill-list.sh should run successfully" {
  run "$PROJECT_ROOT/scripts/skill-list.sh"
  assert_success
}

# skill-activate.sh 测试
@test "skill-activate.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/skill-activate.sh"
  [[ -x "$PROJECT_ROOT/scripts/skill-activate.sh" ]]
}

@test "skill-activate.sh should require skill name" {
  run "$PROJECT_ROOT/scripts/skill-activate.sh"
  assert_failure
}

# skill-eval.sh 测试
@test "skill-eval.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/skill-eval.sh"
  [[ -x "$PROJECT_ROOT/scripts/skill-eval.sh" ]]
}

# skill-evolve.sh 测试
@test "skill-evolve.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/skill-evolve.sh"
  [[ -x "$PROJECT_ROOT/scripts/skill-evolve.sh" ]]
}

# run-evals.sh 测试
@test "run-evals.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/run-evals.sh"
  [[ -x "$PROJECT_ROOT/scripts/run-evals.sh" ]]
}

# health-check.sh 测试
@test "health-check.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/health-check.sh"
  [[ -x "$PROJECT_ROOT/scripts/health-check.sh" ]]
}

@test "health-check.sh should run successfully" {
  run "$PROJECT_ROOT/scripts/health-check.sh"
  assert_success
}

# verify.sh 测试
@test "verify.sh should exist and be executable" {
  assert_file_exists "$PROJECT_ROOT/scripts/verify.sh"
  [[ -x "$PROJECT_ROOT/scripts/verify.sh" ]]
}

# 技能定义测试
@test "skill definitions should exist" {
  assert_dir_exists "$PROJECT_ROOT/integrations/skills"
  assert_file_exists "$PROJECT_ROOT/integrations/skills/react-hooks/skill.yaml"
  assert_file_exists "$PROJECT_ROOT/integrations/skills/typescript-patterns/skill.yaml"
}

@test "react-hooks skill.yaml should be valid yaml" {
  run yamllint -d relaxed "$PROJECT_ROOT/integrations/skills/react-hooks/skill.yaml"
  assert_success
}

@test "typescript-patterns skill.yaml should be valid yaml" {
  run yamllint -d relaxed "$PROJECT_ROOT/integrations/skills/typescript-patterns/skill.yaml"
  assert_success
}
