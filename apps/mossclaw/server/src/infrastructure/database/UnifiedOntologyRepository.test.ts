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

function expectLogCall(
  calls: unknown[][],
  level: 'log' | 'warn' | 'error',
  event: string,
  context: Record<string, unknown>
): void {
  expect(calls).toContainEqual([
    level,
    '[UnifiedOntologyRepository]',
    event,
    expect.objectContaining(context)
  ]);
}

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
    const calls: unknown[][] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      calls.push(['log', ...args]);
    });
    vi.spyOn(console, 'warn').mockImplementation((...args) => {
      calls.push(['warn', ...args]);
    });

    await repository.listObjectTypes();
    await repository.getObject('Order', 'order-001');
    await repository.getObject('Order', 'order-404');
    await repository.queryObjects({
      objectType: 'Order',
      state: 'PendingReview'
    });

    expectLogCall(calls, 'log', 'called', { method: 'listObjectTypes' });
    expectLogCall(calls, 'log', 'query_started', {
      method: 'listObjectTypes',
      table: 'ontology_object_types',
      orderBy: ['objectType']
    });
    expectLogCall(calls, 'log', 'query_completed', {
      method: 'listObjectTypes',
      count: 1
    });
    expectLogCall(calls, 'log', 'called', {
      method: 'getObject',
      objectType: 'Order',
      objectId: 'order-001'
    });
    expectLogCall(calls, 'log', 'query_started', {
      method: 'getObject',
      objectType: 'Order',
      objectId: 'order-001'
    });
    expectLogCall(calls, 'log', 'hit', {
      method: 'getObject',
      objectType: 'Order',
      objectId: 'order-001'
    });
    expectLogCall(calls, 'warn', 'miss', {
      method: 'getObject',
      objectType: 'Order',
      objectId: 'order-404'
    });
    expectLogCall(calls, 'log', 'called', {
      method: 'queryObjects',
      filters: { objectType: 'Order', state: 'PendingReview' }
    });
    expectLogCall(calls, 'log', 'query_started', {
      method: 'queryObjects',
      filters: { objectType: 'Order', state: 'PendingReview' }
    });
    expectLogCall(calls, 'log', 'query_completed', {
      method: 'queryObjects',
      count: 1,
      filters: { objectType: 'Order', state: 'PendingReview' }
    });
  });

  it('在底层查询异常时为各查询方法记录错误日志并继续抛出异常', async () => {
    const expectedError = new Error('database unavailable');
    const repository = new UnifiedOntologyRepository({
      execute: async () => {
        throw expectedError;
      }
    } as never);
    const errorCalls: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errorCalls.push(args);
    });
    const filters = {
      objectType: 'Order',
      state: 'PendingReview'
    };

    await expect(repository.listObjectTypes()).rejects.toBe(expectedError);
    await expect(repository.getObject('Order', 'order-001')).rejects.toBe(expectedError);
    await expect(repository.queryObjects(filters)).rejects.toBe(expectedError);

    expect(errorCalls).toEqual([
      [
        '[UnifiedOntologyRepository]',
        'failed',
        expect.objectContaining({ method: 'listObjectTypes', error: expectedError })
      ],
      [
        '[UnifiedOntologyRepository]',
        'failed',
        expect.objectContaining({ method: 'getObject', error: expectedError })
      ],
      [
        '[UnifiedOntologyRepository]',
        'failed',
        expect.objectContaining({ method: 'queryObjects', filters, error: expectedError })
      ]
    ]);
  });

  it('支持 queryObjects 按 objectType、state 和空过滤条件动态查询', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    await storage.execute(
      'INSERT INTO ontology_object_types (objectType, description, properties) VALUES (?, ?, ?)',
      ['Invoice', '发票对象', JSON.stringify([{ name: 'amount', type: 'number', required: true }])]
    );
    await storage.execute(
      'INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
      ['Order', 'order-002', 'Order 002', 'Approved', JSON.stringify({ amount: 80, riskLevel: 'Low' })]
    );
    await storage.execute(
      'INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
      ['Invoice', 'invoice-001', 'Invoice 001', 'PendingReview', JSON.stringify({ amount: 300 })]
    );

    const repository = new UnifiedOntologyRepository(storage);

    await expect(repository.queryObjects({ objectType: 'Order' })).resolves.toEqual([
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: {
          amount: 1250,
          riskLevel: 'Medium'
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-002',
        displayName: 'Order 002',
        state: 'Approved',
        properties: {
          amount: 80,
          riskLevel: 'Low'
        }
      }
    ]);
    await expect(repository.queryObjects({ state: 'PendingReview' })).resolves.toEqual([
      {
        objectType: 'Invoice',
        objectId: 'invoice-001',
        displayName: 'Invoice 001',
        state: 'PendingReview',
        properties: {
          amount: 300
        }
      },
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
    await expect(repository.queryObjects({})).resolves.toEqual([
      {
        objectType: 'Invoice',
        objectId: 'invoice-001',
        displayName: 'Invoice 001',
        state: 'PendingReview',
        properties: {
          amount: 300
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: {
          amount: 1250,
          riskLevel: 'Medium'
        }
      },
      {
        objectType: 'Order',
        objectId: 'order-002',
        displayName: 'Order 002',
        state: 'Approved',
        properties: {
          amount: 80,
          riskLevel: 'Low'
        }
      }
    ]);
  });
});
