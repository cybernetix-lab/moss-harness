/**
 * Base Storage Implementation
 *
 * Abstract base class for storage backends
 * Provides common functionality and enforces interface compliance
 */

import type {
  IStorage,
  ITransaction,
  IQueryBuilder,
  StorageConfig,
  StorageHealth,
  QueryResult,
  MigrationResult,
} from './types';

export abstract class BaseStorage implements IStorage {
  protected config: StorageConfig;
  protected initialized = false;
  protected healthStats = {
    errors: 0,
    lastError: null as Error | null,
    lastHealthCheck: 0,
  };

  constructor(config: StorageConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract query(table: string): IQueryBuilder;
  abstract execute(sql: string, params?: unknown[]): Promise<QueryResult>;

  async transaction<T>(fn: (trx: ITransaction) => Promise<T>): Promise<T> {
    const trx = await this.beginTransaction();
    try {
      const result = await fn(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  protected abstract beginTransaction(): Promise<ITransaction>;

  async health(): Promise<StorageHealth> {
    const startTime = Date.now();
    try {
      await this.execute('SELECT 1');
      const latency = Date.now() - startTime;
      this.healthStats.lastHealthCheck = Date.now();
      
      return {
        status: this.healthStats.errors > 10 ? 'degraded' : 'healthy',
        latency,
        connections: await this.getConnectionCount(),
        maxConnections: this.config.pool?.max || 10,
        errors: this.healthStats.errors,
      };
    } catch (error) {
      this.healthStats.errors++;
      this.healthStats.lastError = error as Error;
      
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        connections: 0,
        maxConnections: this.config.pool?.max || 10,
        errors: this.healthStats.errors,
      };
    }
  }

  protected abstract getConnectionCount(): Promise<number>;

  async migrate(): Promise<MigrationResult> {
    if (!this.config.migrations?.enabled) {
      return {
        success: true,
        executed: [],
      };
    }

    const startTime = Date.now();
    const executed: string[] = [];

    try {
      // Create migrations table if not exists
      await this.createMigrationsTable();

      // Get executed migrations
      const completed = await this.getCompletedMigrations();

      // Get pending migrations
      const pending = await this.getPendingMigrations(completed);

      // Execute pending migrations
      for (const migration of pending) {
        await this.executeMigration(migration);
        executed.push(migration.name);
      }

      return {
        success: true,
        executed,
      };
    } catch (error) {
      return {
        success: false,
        executed,
        failed: executed[executed.length - 1],
        error: (error as Error).message,
      };
    }
  }

  protected abstract createMigrationsTable(): Promise<void>;
  protected abstract getCompletedMigrations(): Promise<string[]>;
  protected abstract getPendingMigrations(completed: string[]): Promise<Migration[]>;
  protected abstract executeMigration(migration: Migration): Promise<void>;

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected now(): Date {
    return new Date();
  }
}

export interface Migration {
  name: string;
  version: number;
  up: string;
  down: string;
}

export abstract class BaseQueryBuilder implements IQueryBuilder {
  protected table: string;
  protected storage: BaseStorage;
  
  protected selectColumns: string[] = ['*'];
  protected whereClauses: WhereClause[] = [];
  protected orderByClause: { column: string; direction: 'asc' | 'desc' } | null = null;
  protected limitValue: number | null = null;
  protected offsetValue: number | null = null;

  constructor(table: string, storage: BaseStorage) {
    this.table = table;
    this.storage = storage;
  }

  select(columns?: string[]): IQueryBuilder {
    this.selectColumns = columns || ['*'];
    return this;
  }

  where(column: string, operator: string, value: unknown): IQueryBuilder {
    this.whereClauses.push({ column, operator, value, type: 'basic' });
    return this;
  }

  whereIn(column: string, values: unknown[]): IQueryBuilder {
    this.whereClauses.push({ column, operator: 'in', value: values, type: 'in' });
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): IQueryBuilder {
    this.orderByClause = { column, direction };
    return this;
  }

  limit(count: number): IQueryBuilder {
    this.limitValue = count;
    return this;
  }

  offset(count: number): IQueryBuilder {
    this.offsetValue = count;
    return this;
  }

  abstract get(): Promise<Record<string, unknown>[]>;
  abstract first(): Promise<Record<string, unknown> | null>;
  abstract count(): Promise<number>;
  abstract exists(): Promise<boolean>;
  abstract insert(data: Record<string, unknown>): Promise<{ id: string | number; rowCount: number }>;
  abstract insertMany(data: Record<string, unknown>[]): Promise<{ id: string | number; rowCount: number }>;
  abstract update(data: Record<string, unknown>): Promise<{ rowCount: number }>;
  abstract delete(): Promise<{ rowCount: number }>;

  protected buildSelectQuery(): string {
    let sql = `SELECT ${this.selectColumns.join(', ')} FROM ${this.table}`;
    
    const whereSql = this.buildWhereClause();
    if (whereSql) {
      sql += ` WHERE ${whereSql}`;
    }
    
    if (this.orderByClause) {
      sql += ` ORDER BY ${this.orderByClause.column} ${this.orderByClause.direction.toUpperCase()}`;
    }
    
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    
    return sql;
  }

  protected buildWhereClause(): string {
    if (this.whereClauses.length === 0) {
      return '';
    }

    return this.whereClauses.map((clause, index) => {
      const paramIndex = index + 1;
      
      if (clause.type === 'in') {
        const placeholders = (clause.value as unknown[])
          .map((_, i) => `$${paramIndex + i}`)
          .join(', ');
        return `${clause.column} IN (${placeholders})`;
      }
      
      return `${clause.column} ${clause.operator} $${paramIndex}`;
    }).join(' AND ');
  }

  protected getWhereParams(): unknown[] {
    return this.whereClauses.flatMap(clause => {
      if (clause.type === 'in') {
        return clause.value as unknown[];
      }
      return [clause.value];
    });
  }
}

interface WhereClause {
  column: string;
  operator: string;
  value: unknown;
  type: 'basic' | 'in';
}
