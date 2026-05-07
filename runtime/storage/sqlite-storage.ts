/**
 * SQLite Storage Implementation
 *
 * Lightweight file-based storage for development and small deployments
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ITransaction,
  IQueryBuilder,
  StorageConfig,
  QueryResult,
  InsertResult,
  UpdateResult,
  DeleteResult,
} from './types';
import { BaseStorage, BaseQueryBuilder, type Migration } from './base-storage';

export class SQLiteStorage extends BaseStorage {
  private db: Database | null = null;
  private connectionCount = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const filepath = this.config.connection.filepath || ':memory:';
    
    // Ensure directory exists for file-based database
    if (filepath !== ':memory:') {
      const dir = path.dirname(filepath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Dynamic import to avoid bundling issues
    const { default: Database } = await import('better-sqlite3');
    this.db = new Database(filepath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initialized = true;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  query(table: string): IQueryBuilder {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }
    return new SQLiteQueryBuilder(table, this);
  }

  execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      
      // Determine if this is a SELECT query
      const isSelect = sql.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        const rows = params ? stmt.all(...params) : stmt.all();
        return Promise.resolve({
          rows: rows as Record<string, unknown>[],
          rowCount: rows.length,
          command: 'SELECT',
        });
      } else {
        const result = params ? stmt.run(...params) : stmt.run();
        return Promise.resolve({
          rows: [],
          rowCount: result.changes,
          command: result.constructor.name,
        });
      }
    } catch (error) {
      this.healthStats.errors++;
      throw error;
    }
  }

  protected async beginTransaction(): Promise<ITransaction> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }
    
    this.db.exec('BEGIN');
    this.connectionCount++;
    
    return new SQLiteTransaction(this);
  }

  protected async getConnectionCount(): Promise<number> {
    return this.connectionCount;
  }

  protected async createMigrationsTable(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${this.config.migrations?.tableName || 'migrations'} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        version INTEGER NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  protected async getCompletedMigrations(): Promise<string[]> {
    const result = await this.execute(
      `SELECT name FROM ${this.config.migrations?.tableName || 'migrations'} ORDER BY version`
    );
    return result.rows.map(row => row.name as string);
  }

  protected async getPendingMigrations(completed: string[]): Promise<Migration[]> {
    // In a real implementation, this would read from migration files
    // For now, return empty array
    return [];
  }

  protected async executeMigration(migration: Migration): Promise<void> {
    await this.transaction(async (trx) => {
      await trx.execute(migration.up);
      await trx.execute(
        `INSERT INTO ${this.config.migrations?.tableName || 'migrations'} (name, version) VALUES (?, ?)`,
        [migration.name, migration.version]
      );
    });
  }
}

class SQLiteQueryBuilder extends BaseQueryBuilder {
  async get(): Promise<Record<string, unknown>[]> {
    const sql = this.buildSelectQuery();
    const params = this.getWhereParams();
    const result = await this.storage.execute(sql, params);
    return result.rows;
  }

  async first(): Promise<Record<string, unknown> | null> {
    this.limitValue = 1;
    const sql = this.buildSelectQuery();
    const params = this.getWhereParams();
    const result = await this.storage.execute(sql, params);
    return result.rows[0] || null;
  }

  async count(): Promise<number> {
    this.selectColumns = ['COUNT(*) as count'];
    const sql = this.buildSelectQuery();
    const params = this.getWhereParams();
    const result = await this.storage.execute(sql, params);
    return (result.rows[0]?.count as number) || 0;
  }

  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  async insert(data: Record<string, unknown>): Promise<InsertResult> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = await this.storage.execute(sql, values);
    
    // Get last insert id
    const idResult = await this.storage.execute('SELECT last_insert_rowid() as id');
    const id = idResult.rows[0]?.id as number;
    
    return {
      id,
      rowCount: result.rowCount,
    };
  }

  async insertMany(data: Record<string, unknown>[]): Promise<InsertResult> {
    if (data.length === 0) {
      return { id: 0, rowCount: 0 };
    }

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    let lastId = 0;
    let totalRowCount = 0;
    
    for (const row of data) {
      const values = Object.values(row);
      const result = await this.storage.execute(sql, values);
      totalRowCount += result.rowCount;
      
      const idResult = await this.storage.execute('SELECT last_insert_rowid() as id');
      lastId = idResult.rows[0]?.id as number;
    }
    
    return {
      id: lastId,
      rowCount: totalRowCount,
    };
  }

  async update(data: Record<string, unknown>): Promise<UpdateResult> {
    const columns = Object.keys(data);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const values = [...Object.values(data), ...this.getWhereParams()];
    
    const whereClause = this.buildWhereClause();
    const sql = `UPDATE ${this.table} SET ${setClause}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    
    const result = await this.storage.execute(sql, values);
    return {
      rowCount: result.rowCount,
    };
  }

  async delete(): Promise<DeleteResult> {
    const whereClause = this.buildWhereClause();
    const sql = `DELETE FROM ${this.table}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    const params = this.getWhereParams();
    
    const result = await this.storage.execute(sql, params);
    return {
      rowCount: result.rowCount,
    };
  }

  protected buildWhereClause(): string {
    if (this.whereClauses.length === 0) {
      return '';
    }

    return this.whereClauses
      .map((clause) => {
        if (clause.type === 'in') {
          const placeholders = (clause.value as unknown[]).map(() => '?').join(', ');
          return `${clause.column} IN (${placeholders})`;
        }

        return `${clause.column} ${clause.operator} ?`;
      })
      .join(' AND ');
  }
}

class SQLiteTransaction implements ITransaction {
  private storage: SQLiteStorage;
  private committed = false;
  private rolledBack = false;

  constructor(storage: SQLiteStorage) {
    this.storage = storage;
  }

  query(table: string): IQueryBuilder {
    return new SQLiteQueryBuilder(table, this.storage);
  }

  execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.storage.execute(sql, params);
  }

  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }
    await this.storage.execute('COMMIT');
    this.committed = true;
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }
    await this.storage.execute('ROLLBACK');
    this.rolledBack = true;
  }
}

// Type declaration for better-sqlite3
declare class Database {
  constructor(filename: string);
  prepare(sql: string): Statement;
  exec(sql: string): void;
  pragma(pragma: string): unknown;
  close(): void;
}

interface Statement {
  run(...params: unknown[]): { changes: number };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}
