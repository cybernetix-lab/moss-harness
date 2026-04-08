/**
 * Storage Layer Types
 *
 * Abstract storage interface supporting multiple backends (SQLite, PostgreSQL, etc.)
 * Based on Systems Theory: Layered architecture with clear boundaries
 */

// Storage backend types
export type StorageBackend = 'sqlite' | 'postgresql' | 'memory';

// Storage configuration
export interface StorageConfig {
  backend: StorageBackend;
  connection: StorageConnectionConfig;
  pool?: ConnectionPoolConfig;
  migrations?: MigrationConfig;
}

export interface StorageConnectionConfig {
  // SQLite
  filepath?: string;
  
  // PostgreSQL
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  
  // Common
  timeout?: number;
}

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeout: number;
  idleTimeout: number;
}

export interface MigrationConfig {
  enabled: boolean;
  directory: string;
  tableName: string;
}

// Generic storage interface
export interface IStorage {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  health(): Promise<StorageHealth>;
  
  // Transactions
  transaction<T>(fn: (trx: ITransaction) => Promise<T>): Promise<T>;
  
  // Query builders
  query(table: string): IQueryBuilder;
  
  // Raw execution
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  
  // Migrations
  migrate(): Promise<MigrationResult>;
}

export interface ITransaction {
  query(table: string): IQueryBuilder;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IQueryBuilder {
  // Selection
  select(columns?: string[]): IQueryBuilder;
  where(column: string, operator: string, value: unknown): IQueryBuilder;
  whereIn(column: string, values: unknown[]): IQueryBuilder;
  orderBy(column: string, direction?: 'asc' | 'desc'): IQueryBuilder;
  limit(count: number): IQueryBuilder;
  offset(count: number): IQueryBuilder;
  
  // Execution
  get(): Promise<Record<string, unknown>[]>;
  first(): Promise<Record<string, unknown> | null>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  
  // Mutation
  insert(data: Record<string, unknown>): Promise<InsertResult>;
  insertMany(data: Record<string, unknown>[]): Promise<InsertResult>;
  update(data: Record<string, unknown>): Promise<UpdateResult>;
  delete(): Promise<DeleteResult>;
}

// Query results
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  command: string;
}

export interface InsertResult {
  id: string | number;
  rowCount: number;
}

export interface UpdateResult {
  rowCount: number;
}

export interface DeleteResult {
  rowCount: number;
}

// Storage health
export interface StorageHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  connections: number;
  maxConnections: number;
  errors: number;
}

// Migration result
export interface MigrationResult {
  success: boolean;
  executed: string[];
  failed?: string;
  error?: string;
}

// Entity base interface
export interface StorageEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Memory storage entities
export interface MemoryEntity extends StorageEntity {
  sessionId: string;
  type: 'curated' | 'dynamic' | 'retrieval';
  layer: string;
  content: string;
  metadata: Record<string, unknown>;
  confidence?: number;
  expiresAt?: Date;
}

// Sub-agent storage entities
export interface SubAgentEntity extends StorageEntity {
  name: string;
  type: string;
  description: string;
  capabilities: string[];
  config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'deprecated';
}

export interface SubAgentTaskEntity extends StorageEntity {
  parentTaskId?: string;
  agentName: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

// Workflow storage entities
export interface WorkflowStateEntity extends StorageEntity {
  sessionId: string;
  phase: string;
  agent: string;
  iteration: number;
  state: Record<string, unknown>;
  routingHistory: string[];
}

// Sandbox storage entities
export interface SandboxSessionEntity extends StorageEntity {
  sessionId: string;
  type: 'local' | 'docker' | 'kubernetes';
  status: 'creating' | 'ready' | 'busy' | 'destroyed';
  config: Record<string, unknown>;
  destroyedAt?: Date;
}

export interface SandboxExecutionEntity extends StorageEntity {
  sessionId: string;
  command: string;
  type: 'bash' | 'python' | 'read' | 'write';
  status: 'pending' | 'running' | 'completed' | 'failed';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration: number;
  resourceUsage: {
    cpuMs: number;
    memoryBytes: number;
  };
}
