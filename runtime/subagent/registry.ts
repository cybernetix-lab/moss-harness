/**
 * Sub-Agent Registry
 *
 * Manages sub-agent registration, discovery, and lifecycle
 * Based on Systems Theory: Clear component boundaries and dependency management
 */

import type {
  SubAgent,
  ISubAgentRegistry,
} from './types';
import type { IStorage } from '../storage/types';

export class SubAgentRegistry implements ISubAgentRegistry {
  private storage: IStorage;
  private cache: Map<string, SubAgent> = new Map();
  private initialized = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create sub_agents table if not exists
    await this.storage.execute(`
      CREATE TABLE IF NOT EXISTS sub_agents (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        capabilities TEXT NOT NULL, -- JSON array
        config TEXT NOT NULL, -- JSON object
        status TEXT NOT NULL DEFAULT 'active',
        version TEXT NOT NULL DEFAULT '1.0.0',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Load active agents into cache
    const agents = await this.list();
    for (const agent of agents) {
      if (agent.status === 'active') {
        this.cache.set(agent.name, agent);
      }
    }

    this.initialized = true;
  }

  async register(agent: SubAgent): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const existing = await this.get(agent.name);
    if (existing) {
      throw new Error(`Sub-agent '${agent.name}' already registered`);
    }

    const id = this.generateId();
    const now = new Date();

    await this.storage.execute(
      `INSERT INTO sub_agents 
       (id, name, type, description, capabilities, config, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        agent.name,
        agent.type,
        agent.description,
        JSON.stringify(agent.capabilities),
        JSON.stringify(agent.config),
        agent.status,
        agent.version,
        now.toISOString(),
        now.toISOString(),
      ]
    );

    // Add to cache if active
    if (agent.status === 'active') {
      this.cache.set(agent.name, agent);
    }
  }

  async unregister(name: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.storage.execute(
      'DELETE FROM sub_agents WHERE name = ?',
      [name]
    );

    // Remove from cache
    this.cache.delete(name);
  }

  async get(name: string): Promise<SubAgent | null> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    // Query database
    const result = await this.storage.execute(
      'SELECT * FROM sub_agents WHERE name = ?',
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const agent = this.rowToAgent(result.rows[0]);
    
    // Add to cache if active
    if (agent.status === 'active') {
      this.cache.set(name, agent);
    }

    return agent;
  }

  async list(): Promise<SubAgent[]> {
    const result = await this.storage.execute(
      'SELECT * FROM sub_agents ORDER BY name'
    );

    return result.rows.map(row => this.rowToAgent(row));
  }

  async findByCapability(capability: string): Promise<SubAgent[]> {
    const result = await this.storage.execute(
      'SELECT * FROM sub_agents WHERE capabilities LIKE ? AND status = ?',
      [`%"${capability}"%`, 'active']
    );

    return result.rows.map(row => this.rowToAgent(row));
  }

  async findByType(type: string): Promise<SubAgent[]> {
    const result = await this.storage.execute(
      'SELECT * FROM sub_agents WHERE type = ? AND status = ?',
      [type, 'active']
    );

    return result.rows.map(row => this.rowToAgent(row));
  }

  async activate(name: string): Promise<void> {
    await this.updateStatus(name, 'active');
    
    // Update cache
    const agent = await this.get(name);
    if (agent) {
      agent.status = 'active';
      this.cache.set(name, agent);
    }
  }

  async deactivate(name: string): Promise<void> {
    await this.updateStatus(name, 'inactive');
    
    // Remove from cache
    this.cache.delete(name);
  }

  async deprecate(name: string): Promise<void> {
    await this.updateStatus(name, 'deprecated');
    
    // Remove from cache
    this.cache.delete(name);
  }

  private async updateStatus(name: string, status: string): Promise<void> {
    await this.storage.execute(
      'UPDATE sub_agents SET status = ?, updated_at = ? WHERE name = ?',
      [status, new Date().toISOString(), name]
    );
  }

  private rowToAgent(row: Record<string, unknown>): SubAgent {
    return {
      name: row.name as string,
      type: row.type as string,
      description: row.description as string,
      capabilities: JSON.parse(row.capabilities as string),
      config: JSON.parse(row.config as string),
      status: row.status as 'active' | 'inactive' | 'deprecated',
      version: row.version as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private generateId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
