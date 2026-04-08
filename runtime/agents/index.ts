/**
 * Agents Module
 *
 * Core agent system with four-role separation architecture
 */

export { AgentRegistry } from './registry';
export { AgentLoader } from './loader';
export { AgentRunner } from './runner';

// Types
export type {
  Agent,
  AgentType,
  AgentConfig,
  AgentCapabilities,
  AgentExecutionResult,
  AtomicCapability,
  CollaborationInterface,
  FeedbackConfig,
  IntrospectionConfig,
} from './types';

// Constants
export const AGENT_TYPES = {
  PLANNER: 'planner',
  REVIEWER: 'reviewer',
  EXECUTOR: 'executor',
  EVALUATOR: 'evaluator',
  RESEARCHER: 'researcher',
  ORCHESTRATOR: 'orchestrator',
} as const;

export const AGENT_PHASES = {
  PLANNING: 'planning',
  REVIEW: 'review',
  EXECUTION: 'execution',
  EVALUATION: 'evaluation',
  ORCHESTRATION: 'orchestration',
} as const;

// Tool permissions
export const TOOL_PERMISSIONS = {
  READ_ONLY: ['filesystem_read', 'code_search', 'memory_search'],
  READ_WRITE: ['filesystem_read', 'filesystem_write', 'code_search', 'memory_search'],
  EXECUTE: ['filesystem_read', 'filesystem_write', 'code_search', 'execution_run_command', 'execution_run_tests', 'execution_run_linter'],
  NETWORK: ['network_search', 'network_fetch_documentation'],
} as const;

// Agent tool permissions mapping
export const AGENT_TOOL_PERMISSIONS = {
  [AGENT_TYPES.PLANNER]: [...TOOL_PERMISSIONS.READ_ONLY, ...TOOL_PERMISSIONS.NETWORK],
  [AGENT_TYPES.REVIEWER]: TOOL_PERMISSIONS.READ_ONLY,
  [AGENT_TYPES.EXECUTOR]: [...TOOL_PERMISSIONS.EXECUTE, ...TOOL_PERMISSIONS.NETWORK],
  [AGENT_TYPES.EVALUATOR]: [...TOOL_PERMISSIONS.READ_ONLY, 'execution_run_tests', 'execution_run_linter'],
  [AGENT_TYPES.RESEARCHER]: [...TOOL_PERMISSIONS.READ_ONLY, ...TOOL_PERMISSIONS.NETWORK],
  [AGENT_TYPES.ORCHESTRATOR]: ['filesystem_read', 'filesystem_write', 'execution_run_command'],
} as const;
