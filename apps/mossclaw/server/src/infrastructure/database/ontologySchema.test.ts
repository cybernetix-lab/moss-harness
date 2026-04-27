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

  it('拒绝写入未定义 objectType 的 ontology object', async () => {
    const storage = await createTestStorage();

    await ensureOntologySchema(storage);

    expect(() =>
      storage.execute(
        'INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
        ['MissingType', 'order-404', 'Order 404', 'PendingReview', JSON.stringify({ amount: 404 })]
      )
    ).toThrow(/foreign key constraint failed/i);
  });

  it('会把旧版 ontology_objects 表升级为带 objectType 外键的结构', async () => {
    const storage = await createTestStorage();

    await storage.execute(`CREATE TABLE ontology_object_types (
      objectType TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      properties TEXT NOT NULL
    );`);
    await storage.execute(`CREATE TABLE ontology_objects (
      objectType TEXT NOT NULL,
      objectId TEXT NOT NULL,
      displayName TEXT NOT NULL,
      state TEXT NOT NULL,
      properties TEXT NOT NULL,
      PRIMARY KEY (objectType, objectId)
    );`);

    await ensureOntologySchema(storage);

    expect(() =>
      storage.execute(
        'INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
        ['MissingType', 'order-405', 'Order 405', 'PendingReview', JSON.stringify({ amount: 405 })]
      )
    ).toThrow(/foreign key constraint failed/i);
  });

  it('升级带 legacy ontology object 数据的旧表时，会先补齐 objectType 再回填对象', async () => {
    const storage = await createTestStorage();

    await storage.execute(`CREATE TABLE ontology_objects (
      objectType TEXT NOT NULL,
      objectId TEXT NOT NULL,
      displayName TEXT NOT NULL,
      state TEXT NOT NULL,
      properties TEXT NOT NULL,
      PRIMARY KEY (objectType, objectId)
    );`);
    await storage.execute(
      'INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
      ['Order', 'legacy-order-001', 'Legacy Order 001', 'PendingReview', JSON.stringify({ amount: 88, riskLevel: 'Low' })]
    );

    await expect(ensureOntologySchema(storage)).resolves.toBeUndefined();

    const orderTypeResult = await storage.execute(
      'SELECT objectType, description FROM ontology_object_types WHERE objectType = ?',
      ['Order']
    );
    const legacyObjectResult = await storage.execute(
      'SELECT objectType, objectId, displayName, state, properties FROM ontology_objects WHERE objectType = ? AND objectId = ?',
      ['Order', 'legacy-order-001']
    );
    const orderType = orderTypeResult.rows[0];
    const legacyObject = legacyObjectResult.rows[0];

    expect(orderType).toMatchObject({
      objectType: 'Order',
      description: '订单对象'
    });
    expect(legacyObject).toMatchObject({
      objectType: 'Order',
      objectId: 'legacy-order-001',
      displayName: 'Legacy Order 001',
      state: 'PendingReview'
    });
    expect(JSON.parse(String(legacyObject?.properties))).toEqual({
      amount: 88,
      riskLevel: 'Low'
    });
  });
});
