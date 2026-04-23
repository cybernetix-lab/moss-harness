import type { IStorage } from '@agent-harness/core/storage/types';
import type { Agent } from '../../domain/models/Agent';
import type { IAgentRepository } from '../../domain/repositories/IAgentRepository';

export class UnifiedAgentRepository implements IAgentRepository {
  private readonly tableName = 'agents';

  constructor(private readonly storage: IStorage) {}

  async findById(id: string): Promise<Agent | null> {
    const row = await this.storage.query(this.tableName).where('id', '=', id).first();
    if (!row) return null;
    return this.mapToAgent(row);
  }

  async findByName(name: string): Promise<Agent | null> {
    const row = await this.storage.query(this.tableName).where('name', '=', name).first();
    if (!row) return null;
    return this.mapToAgent(row);
  }

  async findAll(): Promise<Agent[]> {
    const rows = await this.storage.query(this.tableName).get();
    return rows.map(this.mapToAgent).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(agent: Agent): Promise<void> {
    await this.storage.query(this.tableName).insert({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      modelConfig: JSON.stringify(agent.modelConfig),
      status: agent.status,
      isBuiltin: agent.isBuiltin ? 1 : 0,
      isDisabled: agent.isDisabled ? 1 : 0,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    });
  }

  async update(agent: Agent): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', agent.id).update({
      name: agent.name,
      type: agent.type,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      modelConfig: JSON.stringify(agent.modelConfig),
      status: agent.status,
      isBuiltin: agent.isBuiltin ? 1 : 0,
      isDisabled: agent.isDisabled ? 1 : 0,
      updatedAt: agent.updatedAt.toISOString()
    });
  }

  async delete(id: string): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', id).delete();
  }

  private mapToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      systemPrompt: row.systemPrompt,
      modelConfig: typeof row.modelConfig === 'string' ? JSON.parse(row.modelConfig) : row.modelConfig,
      status: row.status,
      isBuiltin: Boolean(row.isBuiltin),
      isDisabled: Boolean(row.isDisabled),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
