import type { IStorage } from '@agent-harness/core/storage/types';
import type { OntologyIngestObjectCandidateDto } from '@mossclaw/shared';
export type { OntologyIngestObjectCandidateDto } from '@mossclaw/shared';

export interface OntologyMutationResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

export class UnifiedOntologyMutationGateway {
  private readonly objectsTableName = 'ontology_objects';

  constructor(private readonly storage: IStorage) {}

  async persistObjects(
    objects: OntologyIngestObjectCandidateDto[],
    options: { upsert?: boolean } = {}
  ): Promise<OntologyMutationResult> {
    if (objects.length === 0) {
      return {
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0
      };
    }

    if (options.upsert === false) {
      return this.insertMissingObjects(objects);
    }

    return this.upsertObjects(objects);
  }

  private async upsertObjects(
    objects: OntologyIngestObjectCandidateDto[]
  ): Promise<OntologyMutationResult> {
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of objects) {
      const existing = await this.storage.execute(
        `SELECT objectType, objectId
         FROM ${this.objectsTableName}
         WHERE objectType = ? AND objectId = ?
         LIMIT 1`,
        [item.objectType, item.objectId]
      );

      if (existing.rowCount > 0) {
        await this.storage.execute(
          `UPDATE ${this.objectsTableName}
           SET displayName = ?, state = ?, properties = ?
           WHERE objectType = ? AND objectId = ?`,
          [
            item.displayName,
            item.state,
            JSON.stringify(item.properties),
            item.objectType,
            item.objectId
          ]
        );
        updatedCount += 1;
        continue;
      }

      await this.storage.execute(
        `INSERT INTO ${this.objectsTableName} (objectType, objectId, displayName, state, properties)
         VALUES (?, ?, ?, ?, ?)`,
        [
          item.objectType,
          item.objectId,
          item.displayName,
          item.state,
          JSON.stringify(item.properties)
        ]
      );
      createdCount += 1;
    }

    return {
      createdCount,
      updatedCount,
      skippedCount: 0
    };
  }

  private async insertMissingObjects(
    objects: OntologyIngestObjectCandidateDto[]
  ): Promise<OntologyMutationResult> {
    let createdCount = 0;
    let skippedCount = 0;

    for (const item of objects) {
      const existing = await this.storage.execute(
        `SELECT objectType, objectId
         FROM ${this.objectsTableName}
         WHERE objectType = ? AND objectId = ?
         LIMIT 1`,
        [item.objectType, item.objectId]
      );

      if (existing.rowCount > 0) {
        skippedCount += 1;
        continue;
      }

      await this.storage.execute(
        `INSERT INTO ${this.objectsTableName} (objectType, objectId, displayName, state, properties)
         VALUES (?, ?, ?, ?, ?)`,
        [
          item.objectType,
          item.objectId,
          item.displayName,
          item.state,
          JSON.stringify(item.properties)
        ]
      );
      createdCount += 1;
    }

    return {
      createdCount,
      updatedCount: 0,
      skippedCount
    };
  }
}
