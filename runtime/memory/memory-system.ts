/**
 * Memory System Implementation
 *
 * Hierarchical memory management with token-aware injection
 * Based on DeerFlow design: Curated + Dynamic + Retrieval layers
 */

import type {
  IMemorySystem,
  MemoryEntry,
  MemoryLayer,
  MemoryEntryType,
  MemoryMetadata,
  FactCategory,
  MemoryRetrievalOptions,
  FormattedMemory,
  MemorySchema,
  Fact,
  MemoryUpdateContext,
  MemoryConfig,
  MemoryMetrics,
} from './types';
import type { IStorage } from '../storage/types';
import { MemoryUpdateQueue } from './update-queue';

export class MemorySystem implements IMemorySystem {
  private storage: IStorage;
  private config: MemoryConfig;
  private updateQueue: MemoryUpdateQueue;
  private initialized = false;

  constructor(storage: IStorage, config: MemoryConfig) {
    this.storage = storage;
    this.config = config;
    this.updateQueue = new MemoryUpdateQueue(config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create memory_entries table
    await this.storage.execute(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        layer TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL, -- JSON
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        access_count INTEGER DEFAULT 0,
        last_accessed_at DATETIME
      )
    `);

    // Create indexes
    await this.storage.execute(`
      CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_entries(session_id)
    `);
    await this.storage.execute(`
      CREATE INDEX IF NOT EXISTS idx_memory_layer ON memory_entries(layer)
    `);
    await this.storage.execute(`
      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type)
    `);
    await this.storage.execute(`
      CREATE INDEX IF NOT EXISTS idx_memory_confidence ON memory_entries(confidence)
    `);

    this.initialized = true;
  }

  async close(): Promise<void> {
    this.updateQueue.clear();
    this.initialized = false;
  }

  async add(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MemoryEntry> {
    await this.initialize();

    const id = this.generateId();
    const now = new Date();

    await this.storage.execute(
      `INSERT INTO memory_entries 
       (id, session_id, layer, type, content, metadata, confidence, expires_at, access_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.sessionId,
        entry.layer,
        entry.type,
        entry.content,
        JSON.stringify(entry.metadata),
        entry.confidence,
        entry.expiresAt?.toISOString() || null,
        0,
      ]
    );

    return {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async get(id: string): Promise<MemoryEntry | null> {
    await this.initialize();

    // Update access count
    await this.storage.execute(
      `UPDATE memory_entries 
       SET access_count = access_count + 1, last_accessed_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    const result = await this.storage.execute(
      'SELECT * FROM memory_entries WHERE id = ?',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntry(result.rows[0]);
  }

  async update(id: string, data: Partial<MemoryEntry>): Promise<MemoryEntry> {
    await this.initialize();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }
    if (data.confidence !== undefined) {
      updates.push('confidence = ?');
      values.push(data.confidence);
    }
    if (data.expiresAt !== undefined) {
      updates.push('expires_at = ?');
      values.push(data.expiresAt.toISOString());
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.storage.execute(
      `UPDATE memory_entries SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await this.get(id);
    if (!updated) {
      throw new Error(`Memory entry ${id} not found after update`);
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const result = await this.storage.execute(
      'DELETE FROM memory_entries WHERE id = ?',
      [id]
    );

    return result.rowCount > 0;
  }

  async addCurated(
    content: string,
    type: MemoryEntryType,
    metadata?: Partial<MemoryMetadata>
  ): Promise<MemoryEntry> {
    return this.add({
      sessionId: 'global',
      layer: 'curated',
      type,
      content,
      metadata: {
        tags: metadata?.tags || [],
        importance: metadata?.importance || 1.0,
        customData: metadata?.customData || {},
        ...metadata,
      },
      confidence: 1.0,
      accessCount: 0,
    });
  }

  async addDynamic(
    content: string,
    type: MemoryEntryType,
    confidence: number
  ): Promise<MemoryEntry> {
    return this.add({
      sessionId: 'global',
      layer: 'dynamic',
      type,
      content,
      metadata: {
        tags: [],
        importance: confidence,
        customData: {},
      },
      confidence,
      accessCount: 0,
    });
  }

  async addFact(
    content: string,
    category: FactCategory,
    confidence: number
  ): Promise<MemoryEntry> {
    // Check confidence threshold
    if (confidence < this.config.facts.confidenceThreshold) {
      throw new Error(
        `Fact confidence ${confidence} below threshold ${this.config.facts.confidenceThreshold}`
      );
    }

    const entry = await this.add({
      sessionId: 'global',
      layer: 'dynamic',
      type: 'fact',
      content,
      metadata: {
        category,
        tags: [category],
        importance: confidence,
        customData: {},
      },
      confidence,
      accessCount: 0,
    });

    // Prune facts if over limit
    await this.pruneFacts();

    return entry;
  }

  async retrieve(options: MemoryRetrievalOptions): Promise<MemoryEntry[]> {
    await this.initialize();

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.layer) {
      conditions.push('layer = ?');
      values.push(options.layer);
    }
    if (options.type) {
      conditions.push('type = ?');
      values.push(options.type);
    }
    if (options.sessionId) {
      conditions.push('session_id = ?');
      values.push(options.sessionId);
    }
    if (options.minConfidence !== undefined) {
      conditions.push('confidence >= ?');
      values.push(options.minConfidence);
    }
    if (!options.includeExpired) {
      conditions.push('(expires_at IS NULL OR expires_at > ?)');
      values.push(new Date().toISOString());
    }

    let sql = 'SELECT * FROM memory_entries';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY confidence DESC, updated_at DESC';

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    const result = await this.storage.execute(sql, values);
    return result.rows.map((row) => this.rowToEntry(row));
  }

  async search(query: string, limit = 10): Promise<MemoryEntry[]> {
    // Simple text search for now
    // TODO: Implement semantic search with embeddings
    const result = await this.storage.execute(
      `SELECT * FROM memory_entries 
       WHERE content LIKE ? 
       ORDER BY confidence DESC, updated_at DESC 
       LIMIT ?`,
      [`%${query}%`, limit]
    );

    return result.rows.map((row) => this.rowToEntry(row));
  }

  async getFacts(minConfidence = 0.7): Promise<Fact[]> {
    const entries = await this.retrieve({
      type: 'fact',
      minConfidence,
    });

    return entries.map((entry) => ({
      id: entry.id,
      content: entry.content,
      category: entry.metadata.category || 'knowledge',
      confidence: entry.confidence,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      source: entry.metadata.source,
      expiresAt: entry.expiresAt,
    }));
  }

  async formatForInjection(maxTokens?: number): Promise<FormattedMemory> {
    const budget = maxTokens || this.config.tokenBudget.maxTokens;
    const curatedBudget = Math.floor(budget * this.config.tokenBudget.curatedRatio);
    const dynamicBudget = Math.floor(budget * this.config.tokenBudget.dynamicRatio);
    const retrievalBudget = Math.floor(budget * this.config.tokenBudget.retrievalRatio);

    const sections: FormattedMemory['sections'] = [];

    // Layer 1: Curated Memory (highest priority)
    const curated = await this.retrieve({ layer: 'curated', limit: 10 });
    let curatedText = '';
    for (const entry of curated) {
      const text = this.formatEntry(entry);
      const tokens = this.estimateTokens(text);
      if (this.estimateTokens(curatedText) + tokens > curatedBudget) break;
      curatedText += text + '\n';
    }
    if (curatedText) {
      sections.push({
        name: 'Curated Memory',
        content: curatedText.trim(),
        tokenCount: this.estimateTokens(curatedText),
        priority: 1,
      });
    }

    // Layer 2: Dynamic Memory (summaries and facts)
    const dynamic = await this.retrieve({ layer: 'dynamic', limit: 20 });
    let dynamicText = '';
    for (const entry of dynamic) {
      const text = this.formatEntry(entry);
      const tokens = this.estimateTokens(text);
      if (this.estimateTokens(dynamicText) + tokens > dynamicBudget) break;
      dynamicText += text + '\n';
    }
    if (dynamicText) {
      sections.push({
        name: 'Dynamic Memory',
        content: dynamicText.trim(),
        tokenCount: this.estimateTokens(dynamicText),
        priority: 2,
      });
    }

    // Combine all sections
    const fullText = sections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n');

    return {
      text: fullText,
      tokenCount: this.estimateTokens(fullText),
      sections,
    };
  }

  queueUpdate(context: MemoryUpdateContext): void {
    this.updateQueue.add(context);
  }

  async processUpdateQueue(): Promise<void> {
    await this.updateQueue.process();
  }

  async pruneFacts(): Promise<number> {
    const facts = await this.getFacts(0);

    if (facts.length <= this.config.facts.maxFacts) {
      return 0;
    }

    // Sort by confidence (descending) and keep top N
    const sorted = facts.sort((a, b) => b.confidence - a.confidence);
    const toRemove = sorted.slice(this.config.facts.maxFacts);

    for (const fact of toRemove) {
      await this.delete(fact.id);
    }

    return toRemove.length;
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.storage.execute(
      'DELETE FROM memory_entries WHERE expires_at IS NOT NULL AND expires_at < ?',
      [new Date().toISOString()]
    );

    return result.rowCount;
  }

  async export(): Promise<MemorySchema> {
    const curated = await this.retrieve({ layer: 'curated' });
    const dynamic = await this.retrieve({ layer: 'dynamic' });
    const facts = await this.getFacts();

    return {
      version: '1.0',
      lastUpdated: new Date(),
      user: {
        workContext: {
          summary: this.findSummary(curated, 'work_context'),
          updatedAt: new Date(),
        },
        personalContext: {
          summary: this.findSummary(curated, 'personal_context'),
          updatedAt: new Date(),
        },
        topOfMind: {
          summary: this.findSummary(curated, 'top_of_mind'),
          updatedAt: new Date(),
        },
      },
      history: {
        recentMonths: {
          summary: this.findSummary(dynamic, 'recent_summary'),
          updatedAt: new Date(),
        },
        earlierContext: {
          summary: this.findSummary(dynamic, 'earlier_summary'),
          updatedAt: new Date(),
        },
        longTermBackground: {
          summary: this.findSummary(dynamic, 'long_term_background'),
          updatedAt: new Date(),
        },
      },
      facts,
    };
  }

  async import(data: MemorySchema): Promise<void> {
    // Import curated memory
    if (data.user.workContext.summary) {
      await this.addCurated(data.user.workContext.summary, 'work_context');
    }
    if (data.user.personalContext.summary) {
      await this.addCurated(data.user.personalContext.summary, 'personal_context');
    }
    if (data.user.topOfMind.summary) {
      await this.addCurated(data.user.topOfMind.summary, 'top_of_mind');
    }

    // Import dynamic memory
    if (data.history.recentMonths.summary) {
      await this.addDynamic(data.history.recentMonths.summary, 'recent_summary', 0.8);
    }
    if (data.history.earlierContext.summary) {
      await this.addDynamic(data.history.earlierContext.summary, 'earlier_summary', 0.7);
    }
    if (data.history.longTermBackground.summary) {
      await this.addDynamic(data.history.longTermBackground.summary, 'long_term_background', 0.6);
    }

    // Import facts
    for (const fact of data.facts) {
      await this.addFact(fact.content, fact.category, fact.confidence);
    }
  }

  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      layer: row.layer as MemoryLayer,
      type: row.type as MemoryEntryType,
      content: row.content as string,
      metadata: JSON.parse(row.metadata as string),
      confidence: row.confidence as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      accessCount: row.access_count as number,
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at as string) : undefined,
    };
  }

  private formatEntry(entry: MemoryEntry): string {
    return `- ${entry.content}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private findSummary(entries: MemoryEntry[], type: MemoryEntryType): string {
    const entry = entries.find((e) => e.type === type);
    return entry?.content || '';
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
