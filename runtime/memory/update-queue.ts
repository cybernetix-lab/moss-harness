/**
 * Memory Update Queue
 *
 * Debounced async update queue for batching memory updates
 * Based on DeerFlow design: Thread deduplication, debounce window, rate limiting
 */

import type {
  IMemoryUpdateQueue,
  MemoryUpdateContext,
  MemoryConfig,
} from './types';

interface QueuedUpdate {
  context: MemoryUpdateContext;
  timer: NodeJS.Timeout | null;
}

export class MemoryUpdateQueue implements IMemoryUpdateQueue {
  private config: MemoryConfig;
  private queue: Map<string, QueuedUpdate> = new Map();
  private processing = false;
  private lock = false;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  add(context: MemoryUpdateContext): void {
    const sessionId = context.sessionId;

    // Thread deduplication: Replace existing pending update for same thread
    const existing = this.queue.get(sessionId);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    // Check queue size limit
    if (this.queue.size >= this.config.updateQueue.maxQueueSize) {
      console.warn(`Memory update queue full (${this.queue.size}), dropping oldest update`);
      const oldestKey = this.queue.keys().next().value;
      const oldest = this.queue.get(oldestKey);
      if (oldest?.timer) {
        clearTimeout(oldest.timer);
      }
      this.queue.delete(oldestKey);
    }

    // Create new queued update with debounce timer
    const update: QueuedUpdate = {
      context,
      timer: null,
    };

    // Set debounce timer
    update.timer = setTimeout(() => {
      this.processSingle(sessionId);
    }, this.config.updateQueue.debounceSeconds * 1000);

    this.queue.set(sessionId, update);
  }

  async process(): Promise<void> {
    if (this.processing || this.lock) {
      return;
    }

    this.processing = true;
    this.lock = true;

    try {
      const sessionIds = Array.from(this.queue.keys());

      for (const sessionId of sessionIds) {
        await this.processSingle(sessionId);

        // Rate limiting: Sleep between batch items
        await this.sleep(this.config.updateQueue.rateLimitDelay);
      }
    } finally {
      this.processing = false;
      this.lock = false;
    }
  }

  clear(): void {
    for (const update of this.queue.values()) {
      if (update.timer) {
        clearTimeout(update.timer);
      }
    }
    this.queue.clear();
  }

  size(): number {
    return this.queue.size;
  }

  private async processSingle(sessionId: string): Promise<void> {
    const update = this.queue.get(sessionId);
    if (!update) return;

    // Clear timer if exists
    if (update.timer) {
      clearTimeout(update.timer);
      update.timer = null;
    }

    // Remove from queue
    this.queue.delete(sessionId);

    // Process the update
    try {
      await this.extractAndStore(update.context);
    } catch (error) {
      console.error(`Failed to process memory update for session ${sessionId}:`, error);
    }
  }

  private async extractAndStore(context: MemoryUpdateContext): Promise<void> {
    // This is a placeholder for the actual memory extraction logic
    // In a real implementation, this would:
    // 1. Call LLM to extract facts from messages
    // 2. Calculate confidence scores
    // 3. Store extracted facts in database
    // 4. Update summaries

    console.log(`Processing memory update for session ${context.sessionId}`);
    console.log(`Messages: ${context.messages.length}`);
    console.log(`Agent: ${context.agentName || 'unknown'}`);

    // TODO: Implement actual extraction logic
    // For now, just log the update
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
