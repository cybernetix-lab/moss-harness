import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { UnifiedAgentRepository } from './UnifiedAgentRepository';
import { UnifiedSkillRepository } from './UnifiedSkillRepository';

const openedStorages: IStorage[] = [];

async function createTestStorage(): Promise<IStorage> {
  const storage = await createStorage({
    ...DEFAULT_STORAGE_CONFIG,
    backend: 'memory',
    connection: {
      filepath: ':memory:'
    }
  });

  openedStorages.push(storage);
  return storage;
}

afterEach(async () => {
  while (openedStorages.length > 0) {
    await openedStorages.pop()?.close();
  }
});

describe('Unified roster repositories', () => {
  it('queries agents and skills by name through SQLite-backed query builder', async () => {
    const storage = await createTestStorage();

    await storage.execute(`
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        systemPrompt TEXT,
        modelConfig TEXT NOT NULL,
        status TEXT NOT NULL,
        isBuiltin INTEGER NOT NULL DEFAULT 0,
        isDisabled INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )
    `);
    await storage.execute(`
      CREATE TABLE skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        author TEXT,
        triggers TEXT,
        patterns TEXT,
        actions TEXT,
        contextRequirements TEXT,
        validation TEXT,
        examples TEXT,
        uiMetadata TEXT,
        isBuiltin INTEGER NOT NULL DEFAULT 0,
        isDisabled INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )
    `);

    await storage.execute(
      `INSERT INTO agents (
        id, name, type, description, systemPrompt, modelConfig, status, isBuiltin, isDisabled, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'agent-1',
        'planner',
        'planning',
        'Planner agent',
        'Plan the work',
        JSON.stringify({ provider: 'anthropic', modelName: 'claude-3-5-sonnet' }),
        'IDLE',
        1,
        0,
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      ]
    );
    await storage.execute(
      `INSERT INTO skills (
        id, name, category, version, description, author, triggers, patterns, actions, contextRequirements, validation, examples, uiMetadata, isBuiltin, isDisabled, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'skill-1',
        'documentation-lookup',
        'research',
        '1.0.0',
        'Lookup documentation',
        'system',
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify({}),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify({ dependencies: [] }),
        1,
        0,
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      ]
    );

    const agentRepository = new UnifiedAgentRepository(storage);
    const skillRepository = new UnifiedSkillRepository(storage);

    await expect(agentRepository.findByName('planner')).resolves.toMatchObject({
      id: 'agent-1',
      name: 'planner'
    });
    await expect(skillRepository.findByName('documentation-lookup')).resolves.toMatchObject({
      id: 'skill-1',
      name: 'documentation-lookup'
    });
  });
});
