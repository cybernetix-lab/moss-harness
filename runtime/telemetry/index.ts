/**
 * Telemetry Module
 * 
 * Comprehensive observability system for Agent Harness
 * Based on Information Theory - measuring information flow and quality
 */

export { TelemetryCollector } from './collector';
export { MetricsAggregator } from './metrics';
export { SpanManager } from './spans';
export { EventBus } from './events';
export { InformationQualityAnalyzer } from './information-quality';

// Types
export type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryMetrics,
  TelemetrySpan,
  TelemetryContext,
  InformationQualityMetrics,
  TokenMetrics,
  AgentMetrics,
  WorkflowMetrics,
} from './types';

// Constants
export const TELEMETRY_CONSTANTS = {
  DEFAULT_SAMPLE_RATE: 1.0,
  DEFAULT_RETENTION_DAYS: 30,
  MAX_FILE_SIZE_MB: 100,
  AGGREGATION_INTERVAL_MS: 60000,
  TOKEN_BUDGET_ALERT_THRESHOLD: 0.8,
  INFORMATION_DENSITY_THRESHOLD: 0.001,
} as const;

// Event types
export const EVENT_TYPES = {
  // Session lifecycle
  SESSION_START: 'session.start',
  SESSION_END: 'session.end',
  SESSION_PAUSE: 'session.pause',
  SESSION_RESUME: 'session.resume',
  
  // Agent lifecycle
  AGENT_INVOCATION: 'agent.invocation',
  AGENT_COMPLETION: 'agent.completion',
  AGENT_ERROR: 'agent.error',
  AGENT_TIMEOUT: 'agent.timeout',
  
  // Workflow
  WORKFLOW_START: 'workflow.start',
  WORKFLOW_STEP: 'workflow.step',
  WORKFLOW_END: 'workflow.end',
  WORKFLOW_ERROR: 'workflow.error',
  
  // Routing
  ROUTING_DECISION: 'routing.decision',
  FEEDBACK_LOOP: 'feedback.loop',
  STATE_TRANSITION: 'state.transition',
  
  // Sub-agent
  SUBAGENT_SPAWN: 'subagent.spawn',
  SUBAGENT_COMPLETE: 'subagent.complete',
  SUBAGENT_ERROR: 'subagent.error',
  
  // Memory
  MEMORY_READ: 'memory.read',
  MEMORY_WRITE: 'memory.write',
  MEMORY_RETRIEVAL: 'memory.retrieval',
  
  // Token usage
  TOKEN_USAGE: 'token.usage',
  TOKEN_BUDGET_ALERT: 'token.budget_alert',
  
  // Information quality
  INFORMATION_ENTROPY: 'information.entropy',
  INFORMATION_DENSITY: 'information.density',
  QUALITY_DEGRADATION: 'quality.degradation',
  
  // Middleware
  MIDDLEWARE_EXECUTION: 'middleware.execution',
  MIDDLEWARE_ERROR: 'middleware.error',
  
  // Skills
  SKILL_ACTIVATION: 'skill.activation',
  SKILL_EXECUTION: 'skill.execution',
} as const;

// Metric names
export const METRIC_NAMES = {
  // Session metrics
  SESSIONS_ACTIVE: 'harness_sessions_active',
  SESSIONS_TOTAL: 'harness_sessions_total',
  SESSION_DURATION: 'harness_session_duration_seconds',
  
  // Agent metrics
  AGENT_INVOCATIONS: 'harness_agent_invocations_total',
  AGENT_DURATION: 'harness_agent_duration_seconds',
  AGENT_ERRORS: 'harness_agent_errors_total',
  AGENT_SUCCESS_RATE: 'harness_agent_success_rate',
  
  // Workflow metrics
  WORKFLOW_STEPS: 'harness_workflow_steps_total',
  WORKFLOW_ITERATIONS: 'harness_workflow_iterations',
  WORKFLOW_CONVERGENCE: 'harness_workflow_convergence_rate',
  
  // Routing metrics
  ROUTING_DECISIONS: 'harness_routing_decisions_total',
  FEEDBACK_LOOPS: 'harness_feedback_loops_total',
  NEGATIVE_FEEDBACK_RATE: 'harness_negative_feedback_rate',
  
  // Sub-agent metrics
  SUBAGENTS_ACTIVE: 'harness_subagents_active',
  SUBAGENTS_TOTAL: 'harness_subagents_total',
  SUBAGENT_PARALLELISM: 'harness_subagent_parallelism',
  
  // Token metrics
  TOKENS_INPUT: 'harness_tokens_input_total',
  TOKENS_OUTPUT: 'harness_tokens_output_total',
  TOKEN_COST: 'harness_token_cost_usd',
  TOKEN_INFORMATION_DENSITY: 'harness_token_information_density',
  
  // Information quality metrics
  INFORMATION_ENTROPY: 'harness_information_entropy',
  SIGNAL_TO_NOISE_RATIO: 'harness_signal_to_noise_ratio',
  CONFIDENCE_SCORE: 'harness_confidence_score',
  
  // Memory metrics
  MEMORY_OPERATIONS: 'harness_memory_operations_total',
  MEMORY_RETRIEVAL_LATENCY: 'harness_memory_retrieval_latency_ms',
  MEMORY_HIT_RATE: 'harness_memory_hit_rate',
  
  // Middleware metrics
  MIDDLEWARE_EXECUTION_TIME: 'harness_middleware_execution_time_ms',
  MIDDLEWARE_ERRORS: 'harness_middleware_errors_total',
} as const;
