import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { ensureOntologySchema } from './ontologySchema';
import { UnifiedOntologyRepository } from './UnifiedOntologyRepository';

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
  vi.restoreAllMocks();

  while (openedStorages.length > 0) {
    await openedStorages.pop()?.close();
  }
});

describe('UnifiedOntologyRepository', () => {
  it('返回 object type 定义、对象详情与按条件过滤的对象列表', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    await storage.execute(
      'INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
      ['Order', 'order-002', 'Order 002', 'Approved', JSON.stringify({ amount: 80, riskLevel: 'Low' })]
    );

    const repository = new UnifiedOntologyRepository(storage);

    await expect(repository.listObjectTypes()).resolves.toEqual([
      {
        objectType: 'Order',
        description: '订单对象',
        properties: [
          { name: 'amount', type: 'number', required: true },
          { name: 'riskLevel', type: 'string', required: true }
        ]
      }
    ]);
    await expect(repository.getObject('Order', 'order-001')).resolves.toEqual({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        amount: 1250,
        riskLevel: 'Medium'
      }
    });
    await expect(
      repository.queryObjects({
        objectType: 'Order',
        state: 'PendingReview'
      })
    ).resolves.toEqual([
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: {
          amount: 1250,
          riskLevel: 'Medium'
        }
      }
    ]);
  });

  it('记录方法入参、查询开始、结果条数和命中状态日志', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);

    const repository = new UnifiedOntologyRepository(storage);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await repository.listObjectTypes();
    await repository.getObject('Order', 'order-001');
    await repository.getObject('Order', 'order-404');
    await repository.queryObjects({
      objectType: 'Order',
      state: 'PendingReview'
    });

    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] listObjectTypes called',
      { method: 'listObjectTypes' }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] listObjectTypes query started',
      { table: 'ontology_object_types', orderBy: ['objectType'] }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] listObjectTypes query completed',
      { count: 1 }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] getObject called',
      { objectType: 'Order', objectId: 'order-001' }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] getObject query started',
      { objectType: 'Order', objectId: 'order-001' }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] getObject hit',
      { objectType: 'Order', objectId: 'order-001' }
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] getObject miss',
      { objectType: 'Order', objectId: 'order-404' }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] queryObjects called',
      { filters: { objectType: 'Order', state: 'PendingReview' } }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] queryObjects query started',
      { filters: { objectType: 'Order', state: 'PendingReview' } }
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] queryObjects query completed',
      { count: 1, filters: { objectType: 'Order', state: 'PendingReview' } }
    );
  });

  it('在底层查询异常时记录错误日志并继续抛出异常', async () => {
    const expectedError = new Error('database unavailable');
    const repository = new UnifiedOntologyRepository({
      execute: async () => {
        throw expectedError;
      }
    } as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(repository.listObjectTypes()).rejects.toThrow('database unavailable');

    expect(errorSpy).toHaveBeenCalledWith(
      '[UnifiedOntologyRepository] listObjectTypes failed',
      expectedError
    );
  });
});
