import type { IStorage } from '@agent-harness/core/storage/types';
import type { OntologyObject } from '../../domain/models/ontology/OntologyObject';
import type { OntologyQuery } from '../../domain/models/ontology/OntologyQuery';
import type { OntologyObjectType, OntologyProperty } from '../../domain/models/ontology/OntologySchema';
import type { IOntologyRepository } from '../../domain/repositories/IOntologyRepository';

type StorageRow = Record<string, unknown>;
type LogLevel = 'log' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

export class UnifiedOntologyRepository implements IOntologyRepository {
  private readonly objectTypesTableName = 'ontology_object_types';
  private readonly objectsTableName = 'ontology_objects';
  private readonly logPrefix = '[UnifiedOntologyRepository]';

  constructor(private readonly storage: IStorage) {}

  async listObjectTypes(): Promise<OntologyObjectType[]> {
    const method = 'listObjectTypes';
    this.log('log', 'called', { method });

    try {
      this.log('log', 'query_started', {
        method,
        table: this.objectTypesTableName,
        orderBy: ['objectType']
      });

      const rows = await this.select(
        `SELECT objectType, description, properties
         FROM ${this.objectTypesTableName}
         ORDER BY objectType ASC`
      );

      this.log('log', 'query_completed', {
        method,
        count: rows.length
      });

      return rows.map((row) => this.mapToObjectType(row));
    } catch (error) {
      this.logError(method, error);
      throw error;
    }
  }

  async getObject(objectType: string, objectId: string): Promise<OntologyObject | null> {
    const method = 'getObject';
    const context = {
      objectType,
      objectId
    };
    this.log('log', 'called', { method, ...context });

    try {
      this.log('log', 'query_started', { method, ...context });

      const [row] = await this.select(
        `SELECT objectType, objectId, displayName, state, properties
         FROM ${this.objectsTableName}
         WHERE objectType = ? AND objectId = ?
         LIMIT 1`,
        [objectType, objectId]
      );

      if (!row) {
        this.log('warn', 'miss', { method, ...context });
        return null;
      }

      this.log('log', 'hit', { method, ...context });

      return this.mapToObject(row);
    } catch (error) {
      this.logError(method, error, context);
      throw error;
    }
  }

  async queryObjects(filters: OntologyQuery): Promise<OntologyObject[]> {
    const method = 'queryObjects';
    const context = { filters };
    this.log('log', 'called', { method, ...context });

    try {
      this.log('log', 'query_started', { method, ...context });

      const whereClauses: string[] = [];
      const params: unknown[] = [];
      if (filters.objectType) {
        whereClauses.push('objectType = ?');
        params.push(filters.objectType);
      }

      if (filters.state) {
        whereClauses.push('state = ?');
        params.push(filters.state);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const rows = await this.select(
        `SELECT objectType, objectId, displayName, state, properties
         FROM ${this.objectsTableName}
         ${whereClause}
         ORDER BY objectType ASC, objectId ASC`,
        params
      );

      this.log('log', 'query_completed', {
        method,
        count: rows.length,
        ...context
      });

      return rows.map((row) => this.mapToObject(row));
    } catch (error) {
      this.logError(method, error, context);
      throw error;
    }
  }

  private mapToObjectType(row: StorageRow): OntologyObjectType {
    return {
      objectType: String(row.objectType),
      description: this.readOptionalString(row.description),
      properties: this.parseProperties(row.properties)
    };
  }

  private mapToObject(row: StorageRow): OntologyObject {
    return {
      objectType: String(row.objectType),
      objectId: String(row.objectId),
      displayName: String(row.displayName),
      state: String(row.state),
      properties: this.parsePropertiesMap(row.properties)
    };
  }

  private parseProperties(value: unknown): OntologyProperty[] {
    if (Array.isArray(value)) {
      return value as OntologyProperty[];
    }

    return JSON.parse(String(value)) as OntologyProperty[];
  }

  private parsePropertiesMap(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return JSON.parse(String(value)) as Record<string, unknown>;
  }

  private readOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    return value;
  }

  private async select(sql: string, params?: unknown[]): Promise<StorageRow[]> {
    const result = await this.storage.execute(sql, params);
    return result.rows;
  }

  private log(level: LogLevel, event: string, context: LogContext): void {
    console[level](this.logPrefix, event, context);
  }

  private logError(method: string, error: unknown, context: LogContext = {}): void {
    this.log('error', 'failed', {
      method,
      ...context,
      error
    });
  }
}
