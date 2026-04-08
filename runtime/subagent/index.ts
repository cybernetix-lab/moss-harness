/**
 * Sub-Agent Orchestration Module
 *
 * Multi-agent task orchestration with parallel execution support
 * Based on Systems Theory: Hierarchical decomposition and emergent behavior
 */

export { SubAgentRegistry } from './registry';
export { TaskScheduler } from './scheduler';
export { TaskToolImpl } from './task-tool';

// Types
export type {
  SubAgent,
  SubAgentConfig,
  SubAgentTask,
  TaskStatus,
  TaskPriority,
  TaskMetadata,
  SubAgentResult,
  TaskError,
  TokenUsage,
  TaskExecutionOptions,
  AggregationStrategy,
  ConflictResolutionStrategy,
  TaskTool,
  TaskToolOptions,
  TaskDefinition,
  TaskNode,
  TaskEdge,
  ISubAgentRegistry,
  ITaskScheduler,
  SchedulerStats,
  IResultAggregator,
  SubAgentOrchestratorConfig,
  SubAgentEvent,
  SubAgentEventType,
} from './types';

// Default sub-agent configurations
export const DEFAULT_SUBAGENTS: SubAgent[] = [
  {
    name: 'researcher',
    type: 'research',
    description: 'Web research and information gathering agent',
    capabilities: ['web_search', 'information_extraction', 'summarization'],
    config: {
      modelProfile: 'balanced',
      maxTokens: 4000,
      timeout: 120000,
      maxRetries: 2,
      allowedTools: ['web_search', 'web_fetch', 'read_file'],
      blockedTools: ['write_file', 'execute_command'],
      contextWindow: 8000,
      memoryEnabled: true,
      outputFormat: 'structured',
    },
    status: 'active',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'coder',
    type: 'code',
    description: 'Code analysis and implementation agent',
    capabilities: ['code_analysis', 'code_generation', 'refactoring', 'testing'],
    config: {
      modelProfile: 'coding',
      maxTokens: 8000,
      timeout: 180000,
      maxRetries: 3,
      allowedTools: ['read_file', 'write_file', 'code_search', 'execute_command'],
      blockedTools: ['web_search'],
      contextWindow: 16000,
      memoryEnabled: true,
      outputFormat: 'structured',
    },
    status: 'active',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'bash',
    type: 'execution',
    description: 'Command execution and system operations agent',
    capabilities: ['command_execution', 'file_operations', 'system_admin'],
    config: {
      modelProfile: 'fast',
      maxTokens: 2000,
      timeout: 60000,
      maxRetries: 1,
      allowedTools: ['execute_command', 'read_file', 'write_file'],
      blockedTools: ['web_search'],
      contextWindow: 4000,
      memoryEnabled: false,
      outputFormat: 'text',
    },
    status: 'active',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'reporter',
    type: 'synthesis',
    description: 'Report generation and content synthesis agent',
    capabilities: ['content_synthesis', 'report_writing', 'formatting'],
    config: {
      modelProfile: 'creative',
      maxTokens: 8000,
      timeout: 120000,
      maxRetries: 2,
      allowedTools: ['read_file', 'write_file'],
      blockedTools: ['execute_command', 'web_search'],
      contextWindow: 12000,
      memoryEnabled: true,
      outputFormat: 'structured',
    },
    status: 'active',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Default configuration
export const DEFAULT_SUBAGENT_CONFIG = {
  registry: {
    storage: 'database' as const,
    autoReload: true,
  },
  scheduler: {
    maxConcurrent: 5,
    queueSize: 100,
    workerCount: 3,
  },
  execution: {
    maxConcurrent: 5,
    defaultTimeout: 300000,
    maxRetries: 3,
    retryDelay: 1000,
    aggregationStrategy: 'concat' as const,
    conflictResolution: 'merge' as const,
  },
  telemetry: {
    enabled: true,
    detailedMetrics: true,
  },
};

import type { SubAgent } from './types';
