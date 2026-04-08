/**
 * Sub-Agent Orchestration Types
 *
 * Type definitions for sub-agent management and task orchestration
 * Based on Systems Theory: Hierarchical task decomposition and parallel execution
 */

// Sub-agent definition
export interface SubAgent {
  name: string;
  type: string;
  description: string;
  capabilities: string[];
  config: SubAgentConfig;
  status: 'active' | 'inactive' | 'deprecated';
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubAgentConfig {
  // Model configuration
  modelProfile: string;
  
  // Execution constraints
  maxTokens: number;
  timeout: number;
  maxRetries: number;
  
  // Tool permissions
  allowedTools: string[];
  blockedTools: string[];
  
  // Context configuration
  contextWindow: number;
  memoryEnabled: boolean;
  
  // Output configuration
  outputFormat: 'structured' | 'text' | 'json';
  
  // Custom configuration
  [key: string]: unknown;
}

// Sub-agent task definition
export interface SubAgentTask {
  id: string;
  parentTaskId?: string;
  agentName: string;
  prompt: string;
  context?: Record<string, unknown>;
  
  // Execution state
  status: TaskStatus;
  priority: TaskPriority;
  
  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  
  // Results
  result?: SubAgentResult;
  error?: TaskError;
  
  // Metadata
  metadata: TaskMetadata;
}

export type TaskStatus = 
  | 'pending'      // Waiting to be executed
  | 'queued'       // In the execution queue
  | 'running'      // Currently executing
  | 'completed'    // Successfully completed
  | 'failed'       // Failed with error
  | 'cancelled'    // Cancelled by user or system
  | 'timeout';     // Timed out

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskMetadata {
  sessionId: string;
  workflowId?: string;
  iteration: number;
  depth: number;
  tags: string[];
  customData: Record<string, unknown>;
}

export interface SubAgentResult {
  content: string;
  format: 'text' | 'json' | 'structured';
  structuredData?: Record<string, unknown>;
  confidence: number;
  tokenUsage: TokenUsage;
  executionTime: number;
}

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  recoverable: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

// Task execution options
export interface TaskExecutionOptions {
  // Parallelism control
  maxConcurrent: number;
  
  // Timeout configuration
  defaultTimeout: number;
  
  // Retry configuration
  maxRetries: number;
  retryDelay: number;
  
  // Result aggregation
  aggregationStrategy: AggregationStrategy;
  
  // Conflict resolution
  conflictResolution: ConflictResolutionStrategy;
}

export type AggregationStrategy = 
  | 'concat'           // Concatenate all results
  | 'merge'            // Merge structured data
  | 'vote'             // Majority vote for decisions
  | 'best'             // Select best result based on confidence
  | 'custom';          // Use custom aggregator

export type ConflictResolutionStrategy =
  | 'first'            // Keep first result
  | 'last'             // Keep last result
  | 'merge'            // Attempt to merge conflicting results
  | 'escalate'         // Escalate to parent for resolution
  | 'retry';           // Retry conflicting tasks

// Task tool interface (task() function)
export interface TaskTool {
  // Execute a single task
  execute(
    agentName: string,
    prompt: string,
    options?: Partial<TaskToolOptions>
  ): Promise<SubAgentResult>;
  
  // Execute multiple tasks in parallel
  executeParallel(
    tasks: TaskDefinition[],
    options?: Partial<TaskExecutionOptions>
  ): Promise<SubAgentResult[]>;
  
  // Execute tasks with dependencies
  executeGraph(
    tasks: TaskNode[],
    edges: TaskEdge[],
    options?: Partial<TaskExecutionOptions>
  ): Promise<Map<string, SubAgentResult>>;
  
  // Poll task status
  poll(taskId: string, interval?: number, timeout?: number): Promise<SubAgentResult>;
  
  // Cancel a task
  cancel(taskId: string): Promise<boolean>;
}

export interface TaskToolOptions {
  timeout: number;
  priority: TaskPriority;
  context: Record<string, unknown>;
  metadata: Partial<TaskMetadata>;
}

export interface TaskDefinition {
  agentName: string;
  prompt: string;
  id?: string;
  priority?: TaskPriority;
  dependencies?: string[];
}

export interface TaskNode extends TaskDefinition {
  id: string;
}

export interface TaskEdge {
  from: string;
  to: string;
  condition?: string;
}

// Sub-agent registry interface
export interface ISubAgentRegistry {
  // Registration
  register(agent: SubAgent): Promise<void>;
  unregister(name: string): Promise<void>;
  
  // Retrieval
  get(name: string): Promise<SubAgent | null>;
  list(): Promise<SubAgent[]>;
  findByCapability(capability: string): Promise<SubAgent[]>;
  findByType(type: string): Promise<SubAgent[]>;
  
  // Status management
  activate(name: string): Promise<void>;
  deactivate(name: string): Promise<void>;
  deprecate(name: string): Promise<void>;
}

// Task scheduler interface
export interface ITaskScheduler {
  // Scheduling
  schedule(task: SubAgentTask): Promise<string>;
  scheduleMany(tasks: SubAgentTask[]): Promise<string[]>;
  
  // Execution control
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  
  // Monitoring
  getStatus(taskId: string): Promise<TaskStatus>;
  getQueueLength(): Promise<number>;
  getRunningCount(): Promise<number>;
  getStats(): Promise<SchedulerStats>;
}

export interface SchedulerStats {
  totalScheduled: number;
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;
  averageExecutionTime: number;
  currentQueueLength: number;
  currentRunningCount: number;
}

// Result aggregator interface
export interface IResultAggregator {
  aggregate(results: SubAgentResult[], strategy: AggregationStrategy): Promise<SubAgentResult>;
  mergeStructuredData(dataArray: Record<string, unknown>[]): Record<string, unknown>;
  vote(results: SubAgentResult[]): SubAgentResult;
  selectBest(results: SubAgentResult[]): SubAgentResult;
}

// Sub-agent orchestrator configuration
export interface SubAgentOrchestratorConfig {
  // Registry configuration
  registry: {
    storage: 'memory' | 'database';
    autoReload: boolean;
  };
  
  // Scheduler configuration
  scheduler: {
    maxConcurrent: number;
    queueSize: number;
    workerCount: number;
  };
  
  // Execution defaults
  execution: TaskExecutionOptions;
  
  // Monitoring
  telemetry: {
    enabled: boolean;
    detailedMetrics: boolean;
  };
}

// Event types for sub-agent orchestration
export interface SubAgentEvent {
  type: SubAgentEventType;
  timestamp: number;
  taskId: string;
  agentName: string;
  data: Record<string, unknown>;
}

export type SubAgentEventType =
  | 'task_scheduled'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'task_timeout'
  | 'agent_registered'
  | 'agent_unregistered'
  | 'queue_full'
  | 'parallel_limit_reached';
