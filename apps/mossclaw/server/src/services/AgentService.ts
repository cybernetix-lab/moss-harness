import { IAgentRepository } from '../domain/repositories/IAgentRepository';
import { Agent } from '../domain/models/Agent';
import { v4 as uuidv4 } from 'uuid';

export class AgentService {
  constructor(private agentRepository: IAgentRepository) {}

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name: data.name || 'New Agent',
      type: data.type || 'custom',
      description: data.description || '',
      systemPrompt: data.systemPrompt || 'You are a helpful assistant.',
      modelConfig: data.modelConfig || {
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        temperature: 0.7,
        maxTokens: 4096
      },
      status: 'IDLE',
      isBuiltin: data.isBuiltin ?? false,
      isDisabled: data.isDisabled ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.agentRepository.create(agent);
    return agent;
  }

  async getAllAgents(): Promise<Agent[]> {
    return this.agentRepository.findAll();
  }

  async getAgentById(id: string): Promise<Agent | null> {
    return this.agentRepository.findById(id);
  }

  async updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);
    if (!agent) throw new Error('Agent not found');

    const updatedAgent = {
      ...agent,
      ...data,
      updatedAt: new Date()
    };
    
    await this.agentRepository.update(updatedAgent);
    return updatedAgent;
  }

  async deleteAgent(id: string): Promise<void> {
    await this.agentRepository.delete(id);
  }

  async setAgentDisabled(id: string, isDisabled: boolean): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);
    if (!agent) throw new Error('Agent not found');

    const updatedAgent: Agent = {
      ...agent,
      isDisabled,
      updatedAt: new Date()
    };

    await this.agentRepository.update(updatedAgent);
    return updatedAgent;
  }
}
