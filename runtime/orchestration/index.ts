/**
 * Orchestration Module
 *
 * Provides workflow orchestration, sub-agent management, and middleware chain
 */

export { Orchestrator } from './orchestrator';
export { SubAgentOrchestrator } from './subagent-orchestrator';
export { MiddlewareChain } from './middleware-chain';
export { WorkflowStateManager } from './workflow-state';

// Types
export type {
  OrchestratorConfig,
  WorkflowState,
  WorkflowPhase,
  RoutingDecision,
  RoutingSignal,
  FeedbackLoop,
  FeedbackType,
  SubAgentConfig,
  SubAgentTask,
  SubAgentResult,
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
} from './types';

// Constants
export const WORKFLOW_PHASES = {
  INIT: 'init',
  PLANNING: 'planning',
  REVIEW: 'review',
  EXECUTION: 'execution',
  EVALUATION: 'evaluation',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const;

export const ROUTING_SIGNALS = {
  // Positive signals
  PLAN_COMPLETE: 'plan_complete',
  APPROVED: 'approved',
  APPROVED_WITH_SUGGESTIONS: 'approved_with_suggestions',
  EXECUTION_COMPLETE: 'execution_complete',
  PASS: 'pass',
  EXCELLENT: 'excellent',
  PASS_WITH_WARNINGS: 'pass_with_warnings',

  // Negative signals
  NEEDS_REVISION: 'needs_revision',
  REJECTED: 'rejected',
  PLAN_DEFECT_DETECTED: 'plan_defect_detected',
  NEEDS_IMPROVEMENT: 'needs_improvement',
  CRITICAL_FAILURE: 'critical_failure',

  // Neutral signals
  NEED_MORE_INFO: 'need_more_info',
  NEED_CLARIFICATION: 'need_clarification',
} as const;

export const FEEDBACK_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  TERMINAL: 'terminal',
} as const;

// Middleware order (DeerFlow style)
export const DEFAULT_MIDDLEWARE_ORDER = [
  'dangling-tool-call',
  'sandbox',
  'thread-data',
  'uploads',
  'summarization',
  'todo',
  'token-usage',
  'title',
  'memory',
  'view-image',
  'deferred-tool-filter',
  'subagent-limit',
  'loop-detection',
  'clarification',
] as const;
