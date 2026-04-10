/**
 * Telemetry Types
 * 
 * Type definitions for the comprehensive observability system
 */

// Core telemetry configuration
export interface TelemetryConfig {
  enabled: boolean;
  sampleRate: number;
  retentionDays: number;
  storagePath: string;
  aggregationIntervalMs: number;
  
  // Collection settings
  collection: {
    traces: boolean;
    metrics: boolean;
    events: boolean;
    spans: boolean;
  };
  
  // Redaction settings
  redaction: {
    enabled: boolean;
    patterns: string[];
    replacement: string;
  };
  
  // Information theory metrics
  informationTheory: {
    enabled: boolean;
    calculateEntropy: boolean;
    calculateDensity: boolean;
    calculateSNR: boolean;
  };
}

// Base telemetry event
export interface TelemetryEvent {
  id: string;
  type: string;
  timestamp: number;
  sessionId: string;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  
  // Context
  context: TelemetryContext;
  
  // Data
  data: Record<string, unknown>;
  
  // Metadata
  metadata: {
    agentType?: string;
    agentName?: string;
    workflowPhase?: string;
    iteration?: number;
    confidence?: number;
  };
}

// Telemetry context
export interface TelemetryContext {
  sessionId: string;
  workflowId?: string;
  agentId?: string;
  parentAgentId?: string;
  iteration: number;
  depth: number;
}

// Telemetry span (OpenTelemetry compatible)
export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  
  // Attributes
  attributes: Record<string, string | number | boolean>;
  
  // Events
  events: SpanEvent[];
  
  // Links
  links: SpanLink[];
}

export type SpanKind = 
  | 'INTERNAL'
  | 'SERVER'
  | 'CLIENT'
  | 'PRODUCER'
  | 'CONSUMER';

export type SpanStatus = 
  | 'UNSET'
  | 'OK'
  | 'ERROR';

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, unknown>;
}

// Telemetry metrics collection
export interface TelemetryMetrics {
  session: SessionMetrics;
  agents: AgentMetrics;
  workflow: WorkflowMetrics;
  tokens: TokenMetrics;
  information: InformationQualityMetrics;
  memory: MemoryMetrics;
  middleware: MiddlewareMetrics;
}

// Session metrics
export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // Counts
  totalAgents: number;
  totalSteps: number;
  totalIterations: number;
  
  // Status
  status: 'active' | 'completed' | 'failed' | 'aborted';
  
  // Performance
  avgStepDuration: number;
  totalDuration: number;
}

// Agent metrics
export interface AgentMetrics {
  agentType: string;
  agentName: string;
  
  // Invocation counts
  invocations: number;
  successes: number;
  failures: number;
  timeouts: number;
  
  // Duration
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  
  // Success rate
  successRate: number;
  
  // Token usage
  tokensInput: number;
  tokensOutput: number;
  
  // Information quality
  avgConfidence: number;
  informationDensity: number;
}

// Workflow metrics
export interface WorkflowMetrics {
  workflowId: string;
  
  // Steps
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  
  // Iterations
  totalIterations: number;
  maxIterations: number;
  
  // Convergence
  convergenceRate: number;
  convergenceTime?: number;
  
  // Feedback loops
  positiveFeedbackLoops: number;
  negativeFeedbackLoops: number;
  negativeFeedbackRate: number;
  
  // Routing
  routingDecisions: number;
  routingEfficiency: number;
}

// Token metrics
export interface TokenMetrics {
  // Input/Output
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  
  // Cost
  inputCost: number;
  outputCost: number;
  totalCost: number;
  
  // Budget
  budgetLimit: number;
  budgetUsed: number;
  budgetRemaining: number;
  budgetUtilization: number;
  
  // Efficiency
  tokensPerStep: number;
  tokensPerAgent: number;
  
  // Information theory
  informationDensity: number;
  compressionRatio: number;
}

// Information quality metrics (based on Information Theory)
export interface InformationQualityMetrics {
  // Entropy (uncertainty measure)
  entropy: number;
  maxEntropy: number;
  normalizedEntropy: number;
  
  // Information density
  informationDensity: number;
  tokenEfficiency: number;
  
  // Signal to noise ratio
  signalToNoiseRatio: number;
  noiseLevel: number;
  
  // Confidence
  confidenceScore: number;
  confidenceCalibration: number;
  
  // Redundancy
  redundancyRatio: number;
  compressionPotential: number;
}

export interface BlockCompactionSignals extends InformationQualityMetrics {
  tokenCount: number;
  densityNorm: number;
  ngramRedundancy: number;
}

// Memory metrics
export interface MemoryMetrics {
  // Operations
  reads: number;
  writes: number;
  updates: number;
  deletions: number;
  
  // Performance
  avgReadLatency: number;
  avgWriteLatency: number;
  hitRate: number;
  missRate: number;
  
  // Storage
  totalFacts: number;
  curatedFacts: number;
  dynamicFacts: number;
  
  // Quality
  avgFactConfidence: number;
  factFreshness: number;
}

// Middleware metrics
export interface MiddlewareMetrics {
  middlewareName: string;
  
  // Execution
  executions: number;
  successes: number;
  failures: number;
  
  // Performance
  totalExecutionTime: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  
  // Impact
  itemsProcessed: number;
  itemsModified: number;
  itemsBlocked: number;
}

// Sub-agent metrics
export interface SubAgentMetrics {
  // Spawn counts
  spawned: number;
  completed: number;
  failed: number;
  
  // Parallelism
  maxParallelism: number;
  avgParallelism: number;
  
  // Duration
  totalDuration: number;
  avgDuration: number;
  
  // Efficiency
  taskSuccessRate: number;
  resultQuality: number;
}

// Routing decision record
export interface RoutingDecision {
  decisionId: string;
  timestamp: number;
  
  // Source and target
  fromAgent: string;
  toAgent: string;
  fromPhase: string;
  toPhase: string;
  
  // Decision basis
  signal: string;
  confidence: number;
  feedbackType: 'positive' | 'negative' | 'neutral';
  
  // Context
  iteration: number;
  workflowState: string;
  
  // Reasoning
  reason: string;
  alternativeConsidered?: string;
}

// Feedback loop record
export interface FeedbackLoop {
  loopId: string;
  timestamp: number;
  
  // Type
  type: 'positive' | 'negative';
  
  // Source
  sourceAgent: string;
  targetAgent: string;
  
  // Content
  signal: string;
  strength: number;
  
  // Impact
  stateChange: string;
  iterationDelta: number;
}

// Telemetry collector interface
export interface ITelemetryCollector {
  // Lifecycle
  initialize(config: TelemetryConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // Event recording
  recordEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void;
  
  // Span management
  startSpan(name: string, context: TelemetryContext): TelemetrySpan;
  endSpan(spanId: string, status: SpanStatus): void;
  
  // Metrics
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;
  getMetrics(): TelemetryMetrics;
  
  // Information quality
  analyzeInformationQuality(content: string): InformationQualityMetrics;
  
  // Export
  exportTraces(): Promise<string>;
  exportMetrics(): Promise<string>;
  exportEvents(): Promise<string>;
}
