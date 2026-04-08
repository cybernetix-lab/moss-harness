/**
 * Agent Harness Core
 * 
 * A production-grade AI Agent runtime framework based on
 * Systems Theory, Cybernetics, and Information Theory (SCI Theory)
 */

// Core exports
export * from './agents';
export * from './orchestration';
export * from './memory';
export * from './telemetry';
export * from './skills';
export * from './middleware';
export * from './config';

// Types
export type {
  Agent,
  AgentType,
  AgentConfig,
  AgentCapabilities,
  AgentExecutionResult,
} from './agents/types';

export type {
  Orchestrator,
  WorkflowState,
  RoutingDecision,
  FeedbackLoop,
} from './orchestration/types';

export type {
  MemorySystem,
  MemoryLayer,
  MemoryFact,
  MemoryRetrievalOptions,
} from './memory/types';

export type {
  TelemetryCollector,
  TelemetryEvent,
  TelemetryMetrics,
  TelemetrySpan,
} from './telemetry/types';

// Version
export const VERSION = '1.0.0';

// Design Philosophy
export const DESIGN_PHILOSOPHY = {
  systems_theory: 'Seeing the whole - Four-role separation architecture for emergence',
  cybernetics: 'Achieving purpose - Feedback-driven closed-loop control',
  information_theory: 'Understanding communication - Structured information transfer with quality metrics',
} as const;
