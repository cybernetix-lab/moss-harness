/**
 * Storage Module
 *
 * Abstract storage layer supporting multiple backends (SQLite, PostgreSQL)
 * Based on Systems Theory: Layered architecture with clear boundaries
 */

export { BaseStorage, BaseQueryBuilder } from './base-storage';
export { SQLiteStorage } from './sqlite-storage';

// Types
export type {
  StorageBackend,
  StorageConfig,
  StorageConnectionConfig,
  ConnectionPoolConfig,
  MigrationConfig,
  IStorage,
  ITransaction,
  IQueryBuilder,
  QueryResult,
  InsertResult,
  UpdateResult,
  DeleteResult,
  StorageHealth,
  MigrationResult,
  StorageEntity,
  MemoryEntity,
  SubAgentEntity,
  SubAgentTaskEntity,
  WorkflowStateEntity,
  SandboxSessionEntity,
  SandboxExecutionEntity,
} from './types';

// Factory function
import type { StorageConfig, IStorage } from './types';
import { SQLiteStorage } from './sqlite-storage';

export async function createStorage(config: StorageConfig): Promise<IStorage> {
  let storage: IStorage;
  
  switch (config.backend) {
    case 'sqlite':
      storage = new SQLiteStorage(config);
      break;
    case 'postgresql':
      // PostgreSQL implementation would be added here
      throw new Error('PostgreSQL backend not yet implemented');
    case 'memory':
      storage = new SQLiteStorage({
        ...config,
        connection: { filepath: ':memory:' },
      });
      break;
    default:
      throw new Error(`Unknown storage backend: ${config.backend}`);
  }
  
  await storage.initialize();
  return storage;
}

// Default configuration
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  backend: 'sqlite',
  connection: {
    filepath: './data/agent-harness.db',
  },
  pool: {
    min: 1,
    max: 10,
    acquireTimeout: 30000,
    idleTimeout: 300000,
  },
  migrations: {
    enabled: true,
    directory: './migrations',
    tableName: 'migrations',
  },
};
