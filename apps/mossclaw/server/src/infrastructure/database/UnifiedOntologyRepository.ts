import type { IStorage } from '@agent-harness/core/storage/types';
import type { OntologyObject } from '../../domain/models/ontology/OntologyObject';
import type { OntologyQuery } from '../../domain/models/ontology/OntologyQuery';
import type { OntologyObjectType, OntologyProperty } from '../../domain/models/ontology/OntologySchema';
import type { IOntologyRepository } from '../../domain/repositories/IOntologyRepository';

type StorageRow = Record<string, unknown>;

export class UnifiedOntologyRepository implements IOntologyRepository {
  private readonly objectTypesTableName = 'ontology_object_types';
  private readonly objectsTableName = 'ontology_objects';

  constructor(private readonly storage: IStorage) {}

  async listObjectTypes(): Promise<OntologyObjectType[]> {
    console.log('[UnifiedOntologyRepository] listObjectTypes called', {
      method: 'listObjectTypes'
    });

    try {
      console.log('[UnifiedOntologyRepository] listObjectTypes query started', {
        table: this.objectTypesTableName,
        orderBy: ['objectType']
      });

      const rows = await this.select(
        `SELECT objectType, description, properties
         FROM ${this.objectTypesTableName}
         ORDER BY objectType ASC`
      );

      console.log('[UnifiedOntologyRepository] listObjectTypes query completed', {
        count: rows.length
      });

      return rows.map((row) => this.mapToObjectType(row));
    } catch (error) {
      console.error('[UnifiedOntologyRepository] listObjectTypes failed', error);
      throw error;
    }
  }

  async getObject(objectType: string, objectId: string): Promise<OntologyObject | null> {
    console.log('[UnifiedOntologyRepository] getObject called', {
      objectType,
      objectId
    });

    try {
      console.log('[UnifiedOntologyRepository] getObject query started', {
        objectType,
        objectId
      });

      const [row] = await this.select(
        `SELECT objectType, objectId, displayName, state, properties
         FROM ${this.objectsTableName}
         WHERE objectType = ? AND objectId = ?
         LIMIT 1`,
        [objectType, objectId]
      );

      if (!row) {
        console.warn('[UnifiedOntologyRepository] getObject miss', {
          objectType,
          objectId
        });
        return null;
      }

      console.log('[UnifiedOntologyRepository] getObject hit', {
        objectType,
        objectId
      });

      return this.mapToObject(row);
    } catch (error) {
      console.error('[UnifiedOntologyRepository] getObject failed', error);
      throw error;
    }
  }

  async queryObjects(filters: OntologyQuery): Promise<OntologyObject[]> {
    console.log('[UnifiedOntologyRepository] queryObjects called', {
      filters
    });

    try {
      console.log('[UnifiedOntologyRepository] queryObjects query started', {
        filters
      });

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

      console.log('[UnifiedOntologyRepository] queryObjects query completed', {
        count: rows.length,
        filters
      });

      return rows.map((row) => this.mapToObject(row));
    } catch (error) {
      console.error('[UnifiedOntologyRepository] queryObjects failed', error);
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
}
