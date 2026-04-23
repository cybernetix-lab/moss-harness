import type { IStorage } from '@agent-harness/core/storage/types';
import type { Task } from '../../domain/models/task';
import type { ITaskRepository } from '../../domain/repositories/ITaskRepository';

export class UnifiedTaskRepository implements ITaskRepository {
  private readonly tableName = 'tasks';

  constructor(private readonly storage: IStorage) {}

  async findById(id: string): Promise<Task | null> {
    const row = await this.storage.query(this.tableName).where('id', '=', id).first();
    if (!row) return null;
    return this.mapToTask(row);
  }

  async findAll(): Promise<Task[]> {
    // 假设 IStorage 的实现支持默认倒序或者这里简单读取
    const rows = await this.storage.query(this.tableName).get();
    return rows.map(this.mapToTask).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(task: Task): Promise<void> {
    const taskRecord = this.buildCreateRecord(task);

    try {
      await this.storage.query(this.tableName).insert(taskRecord);
    } catch (error) {
      if (!this.shouldRetryLegacyInsert(error)) {
        throw error;
      }

      await this.storage.query(this.tableName).insert({
        ...taskRecord,
        ...this.buildLegacyCompatRecord(task)
      });
    }
  }

  async update(task: Task): Promise<void> {
    await this.storage
      .query(this.tableName)
      .where('id', '=', task.id)
      .update(this.buildUpdateRecord(task));
  }

  async delete(id: string): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', id).delete();
  }

  private mapToTask(row: any): Task {
    const config = this.parseTaskConfig(row);

    return {
      id: row.id,
      goal: row.goal || row.description || row.name || '',
      status: row.status,
      config,
      stages: this.parseJson(row.stages, []),
      artifacts: this.parseJson(row.artifacts, []),
      events: this.parseJson(row.events, []),
      metrics: this.parseJson(row.metrics, {}),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }

  private buildCreateRecord(task: Task): Record<string, unknown> {
    return {
      id: task.id,
      goal: task.goal,
      status: task.status,
      config: JSON.stringify(task.config),
      stages: JSON.stringify(task.stages),
      artifacts: JSON.stringify(task.artifacts),
      events: JSON.stringify(task.events),
      metrics: JSON.stringify(task.metrics),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString()
    };
  }

  private buildUpdateRecord(task: Task): Record<string, unknown> {
    return {
      goal: task.goal,
      status: task.status,
      config: JSON.stringify(task.config),
      stages: JSON.stringify(task.stages),
      artifacts: JSON.stringify(task.artifacts),
      events: JSON.stringify(task.events),
      metrics: JSON.stringify(task.metrics),
      updatedAt: task.updatedAt.toISOString()
    };
  }

  private buildLegacyCompatRecord(task: Task): Record<string, unknown> {
    return {
      name: task.goal,
      description: task.goal,
      agentId: task.config.entryAgentName
    };
  }

  private parseTaskConfig(row: Record<string, unknown>): Task['config'] {
    const parsedConfig = this.parseJson<Partial<Task['config']>>(row.config, {});
    const entryAgentName =
      typeof parsedConfig.entryAgentName === 'string' && parsedConfig.entryAgentName.length > 0
        ? parsedConfig.entryAgentName
        : typeof row.agentId === 'string' && row.agentId.length > 0
          ? row.agentId
          : 'planner';

    return {
      ...parsedConfig,
      entryAgentName
    };
  }

  private shouldRetryLegacyInsert(error: unknown): boolean {
    const message = String((error as { message?: string })?.message || '');
    return (
      message.includes('NOT NULL constraint failed: tasks.name') ||
      message.includes('NOT NULL constraint failed: tasks.agentId')
    );
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') {
      return fallback;
    }

    if (typeof value !== 'string') {
      return value as T;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
