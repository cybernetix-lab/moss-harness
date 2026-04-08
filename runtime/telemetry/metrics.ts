/**
 * Metrics Aggregator
 *
 * Aggregates and manages telemetry metrics
 * Supports counters, gauges, and histograms
 */

import type { TelemetryMetrics, AgentMetrics, WorkflowMetrics, TokenMetrics, MemoryMetrics, MiddlewareMetrics } from './types';
import { METRIC_NAMES } from './index';

interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface CounterMetric {
  type: 'counter';
  values: MetricValue[];
  total: number;
}

interface GaugeMetric {
  type: 'gauge';
  values: MetricValue[];
  current: number;
  min: number;
  max: number;
}

interface HistogramMetric {
  type: 'histogram';
  values: MetricValue[];
  buckets: Map<number, number>;
  sum: number;
  count: number;
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric;

export class MetricsAggregator {
  private metrics: Map<string, Metric> = new Map();
  private sessionStartTime: number = Date.now();

  constructor() {
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // Initialize counters
    this.metrics.set(METRIC_NAMES.AGENT_INVOCATIONS, { type: 'counter', values: [], total: 0 });
    this.metrics.set(METRIC_NAMES.AGENT_ERRORS, { type: 'counter', values: [], total: 0 });
    this.metrics.set(METRIC_NAMES.ROUTING_DECISIONS, { type: 'counter', values: [], total: 0 });
    this.metrics.set(METRIC_NAMES.FEEDBACK_LOOPS, { type: 'counter', values: [], total: 0 });

    // Initialize gauges
    this.metrics.set(METRIC_NAMES.SESSIONS_ACTIVE, { type: 'gauge', values: [], current: 1, min: 0, max: 1 });
    this.metrics.set(METRIC_NAMES.AGENT_SUCCESS_RATE, { type: 'gauge', values: [], current: 1, min: 0, max: 1 });

    // Initialize histograms
    this.metrics.set(METRIC_NAMES.AGENT_DURATION, { type: 'histogram', values: [], buckets: new Map(), sum: 0, count: 0 });
    this.metrics.set(METRIC_NAMES.TOKENS_INPUT, { type: 'histogram', values: [], buckets: new Map(), sum: 0, count: 0 });
    this.metrics.set(METRIC_NAMES.TOKENS_OUTPUT, { type: 'histogram', values: [], buckets: new Map(), sum: 0, count: 0 });
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      // Create new counter if doesn't exist
      this.metrics.set(name, { type: 'counter', values: [], total: 0 });
    }

    const counter = this.metrics.get(name) as CounterMetric;
    counter.total += 1;
    counter.values.push({
      value: 1,
      timestamp: Date.now(),
      labels,
    });
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    let metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      metric = { type: 'gauge', values: [], current: value, min: value, max: value };
      this.metrics.set(name, metric);
    }

    const gauge = metric as GaugeMetric;
    gauge.current = value;
    gauge.min = Math.min(gauge.min, value);
    gauge.max = Math.max(gauge.max, value);
    gauge.values.push({
      value,
      timestamp: Date.now(),
      labels,
    });
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    let metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      metric = { type: 'histogram', values: [], buckets: new Map(), sum: 0, count: 0 };
      this.metrics.set(name, metric);
    }

    const histogram = metric as HistogramMetric;
    histogram.sum += value;
    histogram.count += 1;
    histogram.values.push({
      value,
      timestamp: Date.now(),
      labels,
    });

    // Update buckets (using predefined buckets)
    const predefinedBuckets = [10, 50, 100, 500, 1000, 5000, 10000, 50000];
    for (const bucket of predefinedBuckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  getMetrics(): TelemetryMetrics {
    return {
      session: this.getSessionMetrics(),
      agents: this.getAgentMetrics(),
      workflow: this.getWorkflowMetrics(),
      tokens: this.getTokenMetrics(),
      information: this.getInformationMetrics(),
      memory: this.getMemoryMetrics(),
      middleware: this.getMiddlewareMetrics(),
    };
  }

  getSnapshot(): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics) {
      switch (metric.type) {
        case 'counter':
          snapshot[name] = {
            type: 'counter',
            total: metric.total,
            count: metric.values.length,
          };
          break;
        case 'gauge':
          snapshot[name] = {
            type: 'gauge',
            current: metric.current,
            min: metric.min,
            max: metric.max,
          };
          break;
        case 'histogram':
          snapshot[name] = {
            type: 'histogram',
            count: metric.count,
            sum: metric.sum,
            avg: metric.count > 0 ? metric.sum / metric.count : 0,
          };
          break;
      }
    }

    return snapshot;
  }

  private getSessionMetrics() {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const totalAgents = (this.metrics.get(METRIC_NAMES.AGENT_INVOCATIONS) as CounterMetric)?.total || 0;

    return {
      sessionId: 'current',
      startTime: this.sessionStartTime,
      duration: sessionDuration,
      totalAgents,
      totalSteps: totalAgents,
      totalIterations: 0,
      status: 'active' as const,
      avgStepDuration: totalAgents > 0 ? sessionDuration / totalAgents : 0,
      totalDuration: sessionDuration,
    };
  }

  private getAgentMetrics(): AgentMetrics {
    const invocations = (this.metrics.get(METRIC_NAMES.AGENT_INVOCATIONS) as CounterMetric)?.total || 0;
    const errors = (this.metrics.get(METRIC_NAMES.AGENT_ERRORS) as CounterMetric)?.total || 0;
    const duration = this.metrics.get(METRIC_NAMES.AGENT_DURATION) as HistogramMetric;

    return {
      agentType: 'aggregate',
      agentName: 'all',
      invocations,
      successes: invocations - errors,
      failures: errors,
      timeouts: 0,
      totalDuration: duration?.sum || 0,
      avgDuration: duration?.count > 0 ? duration.sum / duration.count : 0,
      minDuration: 0,
      maxDuration: 0,
      successRate: invocations > 0 ? (invocations - errors) / invocations : 1,
      tokensInput: 0,
      tokensOutput: 0,
      avgConfidence: 0,
      informationDensity: 0,
    };
  }

  private getWorkflowMetrics(): WorkflowMetrics {
    const routingDecisions = (this.metrics.get(METRIC_NAMES.ROUTING_DECISIONS) as CounterMetric)?.total || 0;
    const feedbackLoops = (this.metrics.get(METRIC_NAMES.FEEDBACK_LOOPS) as CounterMetric)?.total || 0;

    return {
      workflowId: 'current',
      totalSteps: routingDecisions,
      completedSteps: routingDecisions,
      failedSteps: 0,
      totalIterations: feedbackLoops,
      maxIterations: 10,
      convergenceRate: 1,
      positiveFeedbackLoops: feedbackLoops,
      negativeFeedbackLoops: 0,
      negativeFeedbackRate: 0,
      routingDecisions,
      routingEfficiency: 1,
    };
  }

  private getTokenMetrics(): TokenMetrics {
    const inputTokens = this.metrics.get(METRIC_NAMES.TOKENS_INPUT) as HistogramMetric;
    const outputTokens = this.metrics.get(METRIC_NAMES.TOKENS_OUTPUT) as HistogramMetric;

    const inputTotal = inputTokens?.sum || 0;
    const outputTotal = outputTokens?.sum || 0;

    return {
      inputTokens: inputTotal,
      outputTokens: outputTotal,
      totalTokens: inputTotal + outputTotal,
      inputCost: inputTotal * 0.003 / 1000, // $3 per 1M tokens
      outputCost: outputTotal * 0.015 / 1000, // $15 per 1M tokens
      totalCost: (inputTotal * 0.003 + outputTotal * 0.015) / 1000,
      budgetLimit: 10000,
      budgetUsed: inputTotal + outputTotal,
      budgetRemaining: Math.max(0, 10000 - inputTotal - outputTotal),
      budgetUtilization: (inputTotal + outputTotal) / 10000,
      tokensPerStep: inputTokens?.count > 0 ? (inputTotal + outputTotal) / inputTokens.count : 0,
      tokensPerAgent: inputTokens?.count > 0 ? (inputTotal + outputTotal) / inputTokens.count : 0,
      informationDensity: 0,
      compressionRatio: 1,
    };
  }

  private getInformationMetrics() {
    return {
      entropy: 0,
      maxEntropy: 10,
      normalizedEntropy: 0,
      informationDensity: 0,
      tokenEfficiency: 0,
      signalToNoiseRatio: 1,
      noiseLevel: 0,
      confidenceScore: 0.8,
      confidenceCalibration: 0.8,
      redundancyRatio: 0.2,
      compressionPotential: 0.2,
    };
  }

  private getMemoryMetrics(): MemoryMetrics {
    return {
      reads: 0,
      writes: 0,
      updates: 0,
      deletions: 0,
      avgReadLatency: 0,
      avgWriteLatency: 0,
      hitRate: 0.9,
      missRate: 0.1,
      totalFacts: 0,
      curatedFacts: 0,
      dynamicFacts: 0,
      avgFactConfidence: 0.8,
      factFreshness: 0.9,
    };
  }

  private getMiddlewareMetrics(): MiddlewareMetrics {
    return {
      middlewareName: 'aggregate',
      executions: 0,
      successes: 0,
      failures: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      minExecutionTime: 0,
      maxExecutionTime: 0,
      itemsProcessed: 0,
      itemsModified: 0,
      itemsBlocked: 0,
    };
  }
}
