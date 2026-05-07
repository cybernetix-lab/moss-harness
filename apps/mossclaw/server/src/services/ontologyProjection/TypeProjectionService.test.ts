import { describe, expect, it, vi } from 'vitest';
import type { OntologyObjectTypeDto, OntologySchemaResponseDto } from '@mossclaw/shared';
import { TypeProjectionService } from './TypeProjectionService';

function createOntologyServiceStub(objectTypes: OntologyObjectTypeDto[] = []) {
  const schema: OntologySchemaResponseDto = { objectTypes };
  return {
    getSchema: vi.fn(async () => schema)
  };
}

describe('TypeProjectionService', () => {
  it('maps ontology schema types into sorted projection nodes with plane metadata', async () => {
    const ontologyService = createOntologyServiceStub([
      {
        objectType: 'Task',
        description: '执行面任务对象',
        properties: [{ name: 'state', type: 'string', required: true }]
      },
      {
        objectType: 'RoleLane',
        description: '控制面职责泳道',
        properties: [{ name: 'name', type: 'string', required: true }]
      },
      {
        objectType: 'Artifact',
        description: '证据面产物对象',
        properties: [{ name: 'artifactId', type: 'string', required: true }]
      }
    ]);
    const service = new TypeProjectionService(ontologyService);

    await expect(service.getTypes()).resolves.toEqual({
      nodes: [
        {
          id: 'type:Artifact',
          kind: 'type',
          label: 'Artifact',
          objectType: 'Artifact',
          plane: 'evidence',
          metadata: {
            description: '证据面产物对象',
            propertyCount: 1
          }
        },
        {
          id: 'type:RoleLane',
          kind: 'type',
          label: 'RoleLane',
          objectType: 'RoleLane',
          plane: 'control',
          metadata: {
            description: '控制面职责泳道',
            propertyCount: 1
          }
        },
        {
          id: 'type:Task',
          kind: 'type',
          label: 'Task',
          objectType: 'Task',
          plane: 'execution',
          metadata: {
            description: '执行面任务对象',
            propertyCount: 1
          }
        }
      ],
      edges: []
    });
  });

  it('keeps missing descriptions stable and falls back unknown types to execution plane', async () => {
    const ontologyService = createOntologyServiceStub([
      {
        objectType: 'Order',
        properties: [{ name: 'amount', type: 'number', required: true }]
      }
    ]);
    const service = new TypeProjectionService(ontologyService);

    await expect(service.getTypes()).resolves.toEqual({
      nodes: [
        {
          id: 'type:Order',
          kind: 'type',
          label: 'Order',
          objectType: 'Order',
          plane: 'execution',
          metadata: {
            description: undefined,
            propertyCount: 1
          }
        }
      ],
      edges: []
    });
  });

  it('returns an empty graph when ontology schema is empty', async () => {
    const ontologyService = createOntologyServiceStub();
    const service = new TypeProjectionService(ontologyService);

    await expect(service.getTypes()).resolves.toEqual({
      nodes: [],
      edges: []
    });
  });
});
