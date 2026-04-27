import { describe, expect, it, vi } from 'vitest';
import type {
  OntologyObjectDto,
  OntologyObjectTypeDto,
  OntologyQueryRequestDto
} from '@mossclaw/shared';
import { OntologyService } from './OntologyService';

async function expectBusinessError<T>(promise: Promise<T>, message: string) {
  const error = await promise.then(
    () => undefined,
    rejectedError => rejectedError
  );

  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(TypeError);
  expect(error).toMatchObject({ message });
}

function createRepositoryStub(overrides: {
  objectTypes?: OntologyObjectTypeDto[];
  object?: OntologyObjectDto | null;
  objects?: OntologyObjectDto[];
} = {}) {
  const objectTypes =
    overrides.objectTypes ??
    [
      {
        objectType: 'Order',
        description: '订单对象',
        properties: [
          { name: 'amount', type: 'number', required: true },
          { name: 'riskLevel', type: 'string', required: true }
        ]
      }
    ];
  const object =
    overrides.object ??
    {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        amount: 1250,
        riskLevel: 'Medium'
      }
    };
  const objects = overrides.objects ?? [object].filter(Boolean);

  return {
    listObjectTypes: vi.fn(async () => objectTypes),
    getObject: vi.fn(async () => object),
    queryObjects: vi.fn(async (input: OntologyQueryRequestDto) => objects)
  };
}

describe('OntologyService', () => {
  it('将 repository 结果映射为 shared ontology dto 响应', async () => {
    const repository = createRepositoryStub();
    const service = new OntologyService(repository);

    await expect(service.getSchema()).resolves.toEqual({
      objectTypes: [
        {
          objectType: 'Order',
          description: '订单对象',
          properties: [
            { name: 'amount', type: 'number', required: true },
            { name: 'riskLevel', type: 'string', required: true }
          ]
        }
      ]
    });
    await expect(service.getObject('Order', 'order-001')).resolves.toEqual({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        amount: 1250,
        riskLevel: 'Medium'
      }
    });
    await expect(service.queryObjects({ objectType: 'Order' })).resolves.toEqual({
      objects: [
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
      ]
    });
  });

  it('对 getObject 入参执行 trim 并透传给 repository', async () => {
    const repository = createRepositoryStub();
    const service = new OntologyService(repository);

    await service.getObject('  Order  ', '  order-001  ');

    expect(repository.getObject).toHaveBeenCalledWith('Order', 'order-001');
  });

  it('对 queryObjects 的可选过滤条件执行 trim 并返回查询结果', async () => {
    const repository = createRepositoryStub({
      objects: [
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
      ]
    });
    const service = new OntologyService(repository);

    await expect(
      service.queryObjects({
        objectType: '  Order  ',
        state: '  Approved  '
      })
    ).resolves.toEqual({
      objects: [
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
      ]
    });
    expect(repository.queryObjects).toHaveBeenCalledWith({
      objectType: 'Order',
      state: 'Approved'
    });
  });

  it('拒绝空白 objectType、objectId 和空白 query 过滤条件', async () => {
    const repository = createRepositoryStub();
    const service = new OntologyService(repository);

    await expect(service.getObject('   ', 'order-001')).rejects.toThrow('objectType is required');
    await expect(service.getObject('Order', '   ')).rejects.toThrow('objectId is required');
    await expect(service.queryObjects({ objectType: '   ' })).rejects.toThrow('objectType is required');
    await expect(service.queryObjects({ state: '   ' })).rejects.toThrow('state is required');
  });

  it('拒绝非字符串 objectType、objectId 和 query 过滤条件，并抛出业务错误', async () => {
    const repository = createRepositoryStub();
    const service = new OntologyService(repository);

    await expectBusinessError(
      service.getObject(123 as unknown as string, 'order-001'),
      'objectType is required'
    );
    await expectBusinessError(
      service.getObject('Order', false as unknown as string),
      'objectId is required'
    );
    await expectBusinessError(
      service.queryObjects({ objectType: 123 as unknown as string }),
      'objectType is required'
    );
    await expectBusinessError(
      service.queryObjects({ state: false as unknown as string }),
      'state is required'
    );
  });

  it('拒绝 null 和非对象 query 输入，并抛出业务错误', async () => {
    const repository = createRepositoryStub();
    const service = new OntologyService(repository);

    await expectBusinessError(
      service.queryObjects(null as unknown as OntologyQueryRequestDto),
      'query input must be an object'
    );
    await expectBusinessError(
      service.queryObjects('invalid' as unknown as OntologyQueryRequestDto),
      'query input must be an object'
    );
    await expectBusinessError(
      service.queryObjects([] as unknown as OntologyQueryRequestDto),
      'query input must be an object'
    );
  });
});
