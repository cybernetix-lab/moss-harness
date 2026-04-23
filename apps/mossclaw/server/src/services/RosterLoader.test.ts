import { describe, expect, it } from 'vitest';
import path from 'path';
import { RosterLoader } from './RosterLoader';
import type { Agent } from '../domain/models/Agent';
import type { Skill } from '../domain/models/Skill';

class InMemoryAgentRepository {
  private agents: Agent[] = [];

  async findById(id: string): Promise<Agent | null> {
    return this.agents.find((agent) => agent.id === id) ?? null;
  }

  async findByName(name: string): Promise<Agent | null> {
    return this.agents.find((agent) => agent.name === name) ?? null;
  }

  async findAll(): Promise<Agent[]> {
    return [...this.agents];
  }

  async create(agent: Agent): Promise<void> {
    this.agents.push(agent);
  }

  async update(agent: Agent): Promise<void> {
    this.agents = this.agents.map((item) => (item.id === agent.id ? agent : item));
  }

  async delete(id: string): Promise<void> {
    this.agents = this.agents.filter((item) => item.id !== id);
  }
}

class InMemorySkillRepository {
  private skills: Skill[] = [];

  async findById(id: string): Promise<Skill | null> {
    return this.skills.find((skill) => skill.id === id) ?? null;
  }

  async findByName(name: string): Promise<Skill | null> {
    return this.skills.find((skill) => skill.name === name) ?? null;
  }

  async findAll(): Promise<Skill[]> {
    return [...this.skills];
  }

  async create(skill: Skill): Promise<void> {
    this.skills.push(skill);
  }

  async update(skill: Skill): Promise<void> {
    this.skills = this.skills.map((item) => (item.id === skill.id ? skill : item));
  }

  async delete(id: string): Promise<void> {
    this.skills = this.skills.filter((item) => item.id !== id);
  }
}

describe('RosterLoader', () => {
  it('同步内置 YAML 时应标记为内置并保留已存在记录的禁用状态', async () => {
    const agentRepo = new InMemoryAgentRepository();
    const skillRepo = new InMemorySkillRepository();

    await agentRepo.create({
      id: 'existing-agent',
      name: 'planner',
      type: 'planning',
      description: 'old',
      systemPrompt: 'old',
      modelConfig: {
        provider: 'anthropic',
        modelName: 'old-model',
        temperature: 0.1,
        maxTokens: 1000
      },
      status: 'IDLE',
      isBuiltin: false,
      isDisabled: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    await skillRepo.create({
      id: 'existing-skill',
      name: 'search-first',
      category: 'research',
      version: '0.1.0',
      description: 'old',
      author: 'test',
      triggers: [],
      patterns: [],
      actions: [],
      contextRequirements: {},
      validation: [],
      examples: [],
      uiMetadata: {},
      isBuiltin: false,
      isDisabled: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    const loader = new RosterLoader(
      agentRepo as never,
      skillRepo as never,
      path.resolve(__dirname, '../../../../..')
    );

    await loader.syncAll();

    const planner = await agentRepo.findByName('planner');
    const documentationLookup = await skillRepo.findByName('documentation-lookup');
    const searchFirst = await skillRepo.findByName('search-first');
    const coordinator = await agentRepo.findByName('coordinator');

    expect(planner).not.toBeNull();
    expect(planner?.isBuiltin).toBe(true);
    expect(planner?.isDisabled).toBe(true);

    expect(searchFirst).not.toBeNull();
    expect(searchFirst?.isBuiltin).toBe(true);
    expect(searchFirst?.isDisabled).toBe(true);
    expect(searchFirst?.category).toBe('research');
    expect(searchFirst?.actions).toHaveLength(1);
    expect(searchFirst?.actions[0]).toMatchObject({
      type: 'analyze',
      description: '识别需要检索的问题空间',
      steps: [
        '明确目标能力和约束',
        '优先搜索仓库内现有实现',
        '再比较外部方案',
        '给出 adopt、wrap 或 build 决策'
      ]
    });
    expect(searchFirst?.uiMetadata.dependencies).toEqual(['documentation-lookup']);

    expect(documentationLookup).not.toBeNull();
    expect(documentationLookup?.isBuiltin).toBe(true);
    expect(documentationLookup?.isDisabled).toBe(false);

    expect(coordinator).not.toBeNull();
    expect(coordinator?.isBuiltin).toBe(true);
    expect(coordinator?.isDisabled).toBe(false);
  });
});
