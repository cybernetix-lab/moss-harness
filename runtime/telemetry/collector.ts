/**
 * Telemetry Collector
 * 
 * Central telemetry collection and management system
 * Implements comprehensive observability for Agent Harness
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetrySpan,
  TelemetryContext,
  SpanStatus,
  ITelemetryCollector,
  TelemetryMetrics,
  InformationQualityMetrics,
} from './types';
import { EVENT_TYPES, METRIC_NAMES } from './index';
import { MetricsAggregator } from './metrics';
import { InformationQualityAnalyzer } from './information-quality';

export class TelemetryCollector implements ITelemetryCollector {
  private config: TelemetryConfig;
  private spans: Map<string, TelemetrySpan> = new Map();
  private events: TelemetryEvent[] = [];
  private metrics: MetricsAggregator;
  private qualityAnalyzer: InformationQualityAnalyzer;
  private sessionId: string;
  private isInitialized = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.metrics = new MetricsAggregator();
    this.qualityAnalyzer = new InformationQualityAnalyzer();
  }

  async initialize(config: TelemetryConfig): Promise<void> {
    this.config = config;
    
    // Create storage directory
    if (!existsSync(config.storagePath)) {
      mkdirSync(config.storagePath, { recursive: true });
    }

    // Initialize session
    this.recordEvent({
      type: EVENT_TYPES.SESSION_START,
      sessionId: this.sessionId,
      traceId: this.sessionId,
      context: {
        sessionId: this.sessionId,
        iteration: 0,
        depth: 0,
      },
      data: {
        config: {
          sampleRate: config.sampleRate,
          retentionDays: config.retentionDays,
        },
      },
      metadata: {},
    });

    this.isInitialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    // Record session end
    this.recordEvent({
      type: EVENT_TYPES.SESSION_END,
      sessionId: this.sessionId,
      traceId: this.sessionId,
      context: {
        sessionId: this.sessionId,
        iteration: 0,
        depth: 0,
      },
      data: {
        metrics: this.metrics.getSnapshot(),
      },
      metadata: {},
    });

    // Persist data
    await this.persistData();
    
    this.isInitialized = false;
  }

  recordEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    if (!this.isInitialized || !this.config.enabled) return;

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return;

    const fullEvent: TelemetryEvent = {
      ...event,
      id: randomUUID(),
      timestamp: Date.now(),
    };

    // Redact sensitive data
    if (this.config.redaction.enabled) {
      this.redactSensitiveData(fullEvent);
    }

    this.events.push(fullEvent);
    
    // Update metrics based on event type
    this.updateMetricsFromEvent(fullEvent);

    // Persist if buffer is full
    if (this.events.length >= 100) {
      this.persistEvents();
    }
  }

  startSpan(name: string, context: TelemetryContext): TelemetrySpan {
    const span: TelemetrySpan = {
      traceId: this.sessionId,
      spanId: randomUUID(),
      parentSpanId: context.agentId,
      name,
      kind: 'INTERNAL',
      startTime: Date.now(),
      status: 'UNSET',
      attributes: {
        'session.id': context.sessionId,
        'agent.id': context.agentId || '',
        'iteration': context.iteration,
        'depth': context.depth,
      },
      events: [],
      links: [],
    };

    this.spans.set(span.spanId, span);
    
    // Record span start event
    this.recordEvent({
      type: 'span.start',
      sessionId: this.sessionId,
      traceId: this.sessionId,
      spanId: span.spanId,
      context,
      data: { spanName: name },
      metadata: {},
    });

    return span;
  }

  endSpan(spanId: string, status: SpanStatus): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    // Record metrics
    this.metrics.recordMetric(METRIC_NAMES.AGENT_DURATION, span.duration || 0, {
      span_name: span.name,
      status,
    });

    // Record span end event
    this.recordEvent({
      type: 'span.end',
      sessionId: this.sessionId,
      traceId: this.sessionId,
      spanId,
      context: {
        sessionId: this.sessionId,
        iteration: 0,
        depth: 0,
      },
      data: {
        duration: span.duration,
        status,
      },
      metadata: {},
    });
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.recordMetric(name, value, labels);
  }

  getMetrics(): TelemetryMetrics {
    return this.metrics.getMetrics();
  }

  analyzeInformationQuality(content: string): InformationQualityMetrics {
    return this.qualityAnalyzer.analyze(content);
  }

  async exportTraces(): Promise<string> {
    const spans = Array.from(this.spans.values());
    const outputPath = join(this.config.storagePath, `${this.sessionId}-traces.jsonl`);
    
    const lines = spans.map(span => JSON.stringify(span)).join('\n');
    writeFileSync(outputPath, lines);
    
    return outputPath;
  }

  async exportMetrics(): Promise<string> {
    const metrics = this.metrics.getMetrics();
    const outputPath = join(this.config.storagePath, `${this.sessionId}-metrics.json`);
    
    writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
    
    return outputPath;
  }

  async exportEvents(): Promise<string> {
    const outputPath = join(this.config.storagePath, `${this.sessionId}-events.jsonl`);
    
    const lines = this.events.map(event => JSON.stringify(event)).join('\n');
    writeFileSync(outputPath, lines);
    
    return outputPath;
  }

  private redactSensitiveData(event: TelemetryEvent): void {
    const patterns = this.config.redaction.patterns;
    const replacement = this.config.redaction.replacement;

    const redactString = (str: string): string => {
      let result = str;
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'gi');
        result = result.replace(regex, replacement);
      }
      return result;
    };

    const redactObject = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        return redactString(obj);
      }
      if (typeof obj === 'object' && obj !== null) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = redactObject(value);
        }
        return result;
      }
      return obj;
    };

    event.data = redactObject(event.data) as Record<string, unknown>;
  }

  private updateMetricsFromEvent(event: TelemetryEvent): void {
    switch (event.type) {
      case EVENT_TYPES.AGENT_INVOCATION:
        this.metrics.incrementCounter(METRIC_NAMES.AGENT_INVOCATIONS, {
          agent_type: event.metadata.agentType || 'unknown',
        });
        break;
      
      case EVENT_TYPES.AGENT_ERROR:
        this.metrics.incrementCounter(METRIC_NAMES.AGENT_ERRORS, {
          agent_type: event.metadata.agentType || 'unknown',
        });
        break;
      
      case EVENT_TYPES.ROUTING_DECISION:
        this.metrics.incrementCounter(METRIC_NAMES.ROUTING_DECISIONS);
        if (event.metadata.feedbackType === 'negative') {
          this.metrics.incrementCounter(METRIC_NAMES.NEGATIVE_FEEDBACK_RATE);
        }
        break;
      
      case EVENT_TYPES.TOKEN_USAGE:
        if (event.data.inputTokens) {
          this.metrics.recordMetric(
            METRIC_NAMES.TOKENS_INPUT,
            event.data.inputTokens as number
          );
        }
        if (event.data.outputTokens) {
          this.metrics.recordMetric(
            METRIC_NAMES.TOKENS_OUTPUT,
            event.data.outputTokens as number
          );
        }
        break;
      
      case EVENT_TYPES.INFORMATION_ENTROPY:
        if (event.data.entropy) {
          this.metrics.recordMetric(
            METRIC_NAMES.INFORMATION_ENTROPY,
            event.data.entropy as number
          );
        }
        break;
    }
  }

  private persistEvents(): void {
    const outputPath = join(this.config.storagePath, `${this.sessionId}-events.jsonl`);
    
    const lines = this.events.map(event => JSON.stringify(event)).join('\n') + '\n';
    writeFileSync(outputPath, lines, { flag: 'a' });
    
    this.events = [];
  }

  private async persistData(): Promise<void> {
    await this.exportEvents();
    await this.exportTraces();
    await this.exportMetrics();
  }
}
