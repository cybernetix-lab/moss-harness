import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '@agent-harness/core/storage/types';
import { ensureOntologySchema } from './ontologySchema';
import {
  UnifiedOntologyMutationGateway,
  type OntologyIngestObjectCandidateDto
} from './UnifiedOntologyMutationGateway';

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

async function readObjects(storage: IStorage): Promise<Record<string, unknown>[]> {
  const result = await storage.execute(
    `SELECT objectType, objectId, displayName, state, properties
     FROM ontology_objects
     ORDER BY objectType ASC, objectId ASC`
  );

  return result.rows.map((row) => ({
    ...row,
    properties: JSON.parse(String(row.properties))
  }));
}

async function expectSeedObjects(storage: IStorage): Promise<void> {
  await expect(readObjects(storage)).resolves.toEqual([
    {
      objectType: 'Artifact',
      objectId: 'artifact-001',
      displayName: 'Artifact 001',
      state: 'Captured',
      properties: {
        kind: 'Document',
        relatedOrder: {
          objectType: 'Order',
          objectId: 'order-001'
        }
      }
    },
    {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        amount: 1250,
        riskLevel: 'Medium',
        review: {
          objectType: 'Review',
          objectId: 'review-001'
        }
      }
    },
    {
      objectType: 'Review',
      objectId: 'review-001',
      displayName: 'Review 001',
      state: 'Open',
      properties: {
        decision: 'Escalate',
        subject: {
          objectType: 'Order',
          objectId: 'order-001'
        }
      }
    }
  ]);
}

function createObjects(): OntologyIngestObjectCandidateDto[] {
  return [
    {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001 Updated',
      state: 'Approved',
      properties: {
        amount: 999,
        riskLevel: 'High'
      }
    },
    {
      objectType: 'Order',
      objectId: 'order-002',
      displayName: 'Order 002',
      state: 'PendingReview',
      properties: {
        amount: 80,
        riskLevel: 'Low'
      }
    }
  ];
}

afterEach(async () => {
  vi.restoreAllMocks();

  while (openedStorages.length > 0) {
    await openedStorages.pop()?.close();
  }
});

describe('UnifiedOntologyMutationGateway', () => {
  it('空输入时直接返回零计数且不写库', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    const gateway = new UnifiedOntologyMutationGateway(storage);

    await expect(gateway.persistObjects([])).resolves.toEqual({
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0
    });

    await expectSeedObjects(storage);
  });

  it('默认 upsert 模式下更新已存在对象并插入不存在对象', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    const gateway = new UnifiedOntologyMutationGateway(storage);

    await expect(gateway.persistObjects(createObjects())).resolves.toEqual({
      createdCount: 1,
      updatedCount: 1,
      skippedCount: 0
    });

    await expect(readObjects(storage)).resolves.toEqual([
      {
        objectType: 'Artifact',
        objectId: 'artifact-001',
        displayName: 'Artifact 001',
        state: 'Captured',
        properties: {
          kind: 'Document',
          relatedOrder: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001 Updated',
        state: 'Approved',
        properties: {
          amount: 999,
          riskLevel: 'High'
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-002',
        displayName: 'Order 002',
        state: 'PendingReview',
        properties: {
          amount: 80,
          riskLevel: 'Low'
        }
      },
      {
        objectType: 'Review',
        objectId: 'review-001',
        displayName: 'Review 001',
        state: 'Open',
        properties: {
          decision: 'Escalate',
          subject: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      }
    ]);
  });

  it('非 upsert 模式下只插入不存在对象并跳过已存在对象', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    const gateway = new UnifiedOntologyMutationGateway(storage);

    await expect(gateway.persistObjects(createObjects(), { upsert: false })).resolves.toEqual({
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 1
    });

    await expect(readObjects(storage)).resolves.toEqual([
      {
        objectType: 'Artifact',
        objectId: 'artifact-001',
        displayName: 'Artifact 001',
        state: 'Captured',
        properties: {
          kind: 'Document',
          relatedOrder: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: {
          amount: 1250,
          riskLevel: 'Medium',
          review: {
            objectType: 'Review',
            objectId: 'review-001'
          }
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-002',
        displayName: 'Order 002',
        state: 'PendingReview',
        properties: {
          amount: 80,
          riskLevel: 'Low'
        }
      },
      {
        objectType: 'Review',
        objectId: 'review-001',
        displayName: 'Review 001',
        state: 'Open',
        properties: {
          decision: 'Escalate',
          subject: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      }
    ]);
  });

  it('非 upsert 模式下若对象全部已存在则只返回 skippedCount', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    const gateway = new UnifiedOntologyMutationGateway(storage);

    await expect(
      gateway.persistObjects([
        {
          objectType: 'Order',
          objectId: 'order-001',
          displayName: 'Should Not Override',
          state: 'Approved',
          properties: {
            amount: 1
          }
        }
      ], { upsert: false })
    ).resolves.toEqual({
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 1
    });

    await expectSeedObjects(storage);
  });

  it('底层查询失败时透传异常', async () => {
    const expectedError = new Error('database unavailable');
    const gateway = new UnifiedOntologyMutationGateway({
      execute: async () => {
        throw expectedError;
      }
    } as never);

    await expect(gateway.persistObjects(createObjects())).rejects.toBe(expectedError);
  });
});
