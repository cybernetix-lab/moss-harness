import type { IStorage } from '@agent-harness/core/storage/types';
import type { Memory } from '../../domain/models/Memory';
import type { IMemoryRepository } from '../../domain/repositories/IMemoryRepository';

export class UnifiedMemoryRepository implements IMemoryRepository {
  private readonly tableName = 'memories';

  constructor(private readonly storage: IStorage) {}

  async findById(id: string): Promise<Memory | null> {
    const row = await this.storage.query(this.tableName).where('id', '=', id).first();
    if (!row) return null;
    return this.mapToMemory(row);
  }

  async findAll(sessionId?: string): Promise<Memory[]> {
    let query = this.storage.query(this.tableName);
    if (sessionId) {
      query = query.where('sessionId', '=', sessionId);
    }
    const rows = await query.get();
    return rows.map(this.mapToMemory).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(memory: Memory): Promise<void> {
    await this.storage.query(this.tableName).insert({
      id: memory.id,
      sessionId: memory.sessionId,
      layer: memory.layer,
      type: memory.type,
      content: memory.content,
      confidence: memory.confidence,
      metadata: JSON.stringify(memory.metadata),
      lifecycle: JSON.stringify(memory.lifecycle),
      usageStats: JSON.stringify(memory.usageStats),
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString()
    });
  }

  async update(memory: Memory): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', memory.id).update({
      sessionId: memory.sessionId,
      layer: memory.layer,
      type: memory.type,
      content: memory.content,
      confidence: memory.confidence,
      metadata: JSON.stringify(memory.metadata),
      lifecycle: JSON.stringify(memory.lifecycle),
      usageStats: JSON.stringify(memory.usageStats),
      updatedAt: memory.updatedAt.toISOString()
    });
  }

  async delete(id: string): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', id).delete();
  }

  private mapToMemory(row: any): Memory {
    const parseJSON = (data: any) => typeof data === 'string' ? JSON.parse(data) : data;
    return {
      id: row.id,
      sessionId: row.sessionId,
      layer: row.layer,
      type: row.type,
      content: row.content,
      confidence: row.confidence,
      metadata: parseJSON(row.metadata),
      lifecycle: parseJSON(row.lifecycle),
      usageStats: parseJSON(row.usageStats),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
