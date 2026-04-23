#!/usr/bin/env bash

# shellcheck disable=SC2034
# Sourced by local-ci.sh and GitHub Actions to share the exact target set.
SHELLCHECK_TARGETS=(
  "local-ci.sh"
  "scripts/ci-shellcheck-targets.sh"
  "apps/agent-cli/agent-list.sh"
  "scripts/health-check.sh"
  "scripts/skill-list.sh"
  "scripts/verify.sh"
)
