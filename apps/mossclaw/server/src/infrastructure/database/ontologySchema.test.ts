import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { ensureOntologySchema } from './ontologySchema';

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

describe('ensureOntologySchema', () => {
  it('会幂等创建 ontology 表并写入固定 seed 数据', async () => {
    const storage = await createTestStorage();

    await ensureOntologySchema(storage);
    await ensureOntologySchema(storage);

    const objectTypes = await storage.query('ontology_object_types').orderBy('objectType').get();
    const objects = await storage.query('ontology_objects').orderBy('objectType').orderBy('objectId').get();

    expect(objectTypes).toHaveLength(1);
    expect(objects).toHaveLength(1);
    expect(objectTypes[0]).toMatchObject({
      objectType: 'Order',
      description: '订单对象'
    });
    expect(JSON.parse(String(objectTypes[0]?.properties))).toEqual([
      { name: 'amount', type: 'number', required: true },
      { name: 'riskLevel', type: 'string', required: true }
    ]);
    expect(objects[0]).toMatchObject({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview'
    });
    expect(JSON.parse(String(objects[0]?.properties))).toEqual({
      amount: 1250,
      riskLevel: 'Medium'
    });
  });
});
