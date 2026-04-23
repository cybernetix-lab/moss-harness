import { Agent } from '../models/Agent';

export interface IAgentRepository {
  findById(id: string): Promise<Agent | null>;
  findByName(name: string): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  create(agent: Agent): Promise<void>;
  update(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
}
