import type { IStorage } from '@agent-harness/core/storage/types';
import type { Skill } from '../../domain/models/Skill';
import type { ISkillRepository } from '../../domain/repositories/ISkillRepository';

export class UnifiedSkillRepository implements ISkillRepository {
  private readonly tableName = 'skills';

  constructor(private readonly storage: IStorage) {}

  async findById(id: string): Promise<Skill | null> {
    const row = await this.storage.query(this.tableName).where('id', '=', id).first();
    if (!row) return null;
    return this.mapToSkill(row);
  }

  async findByName(name: string): Promise<Skill | null> {
    const row = await this.storage.query(this.tableName).where('name', '=', name).first();
    if (!row) return null;
    return this.mapToSkill(row);
  }

  async findAll(): Promise<Skill[]> {
    const rows = await this.storage.query(this.tableName).get();
    return rows.map(this.mapToSkill).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(skill: Skill): Promise<void> {
    await this.storage.query(this.tableName).insert({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      version: skill.version,
      description: skill.description,
      author: skill.author,
      triggers: JSON.stringify(skill.triggers),
      patterns: JSON.stringify(skill.patterns),
      actions: JSON.stringify(skill.actions),
      contextRequirements: JSON.stringify(skill.contextRequirements),
      validation: JSON.stringify(skill.validation),
      examples: JSON.stringify(skill.examples),
      uiMetadata: JSON.stringify(skill.uiMetadata),
      isBuiltin: skill.isBuiltin ? 1 : 0,
      isDisabled: skill.isDisabled ? 1 : 0,
      createdAt: skill.createdAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString()
    });
  }

  async update(skill: Skill): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', skill.id).update({
      name: skill.name,
      category: skill.category,
      version: skill.version,
      description: skill.description,
      author: skill.author,
      triggers: JSON.stringify(skill.triggers),
      patterns: JSON.stringify(skill.patterns),
      actions: JSON.stringify(skill.actions),
      contextRequirements: JSON.stringify(skill.contextRequirements),
      validation: JSON.stringify(skill.validation),
      examples: JSON.stringify(skill.examples),
      uiMetadata: JSON.stringify(skill.uiMetadata),
      isBuiltin: skill.isBuiltin ? 1 : 0,
      isDisabled: skill.isDisabled ? 1 : 0,
      updatedAt: skill.updatedAt.toISOString()
    });
  }

  async delete(id: string): Promise<void> {
    await this.storage.query(this.tableName).where('id', '=', id).delete();
  }

  private mapToSkill(row: any): Skill {
    const parseJSON = (data: any) => typeof data === 'string' ? JSON.parse(data) : data;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      version: row.version,
      description: row.description,
      author: row.author,
      triggers: parseJSON(row.triggers),
      patterns: parseJSON(row.patterns),
      actions: parseJSON(row.actions),
      contextRequirements: parseJSON(row.contextRequirements),
      validation: parseJSON(row.validation),
      examples: parseJSON(row.examples),
      uiMetadata: parseJSON(row.uiMetadata),
      isBuiltin: Boolean(row.isBuiltin),
      isDisabled: Boolean(row.isDisabled),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
