import { describe, expectTypeOf, it } from 'vitest';
import type {
  OntologyObjectDto,
  OntologyPropertyDto,
  OntologyQueryRequestDto,
  OntologyQueryResponseDto,
  OntologySchemaResponseDto
} from '@mossclaw/shared';

describe('ontology shared contracts', () => {
  it('暴露稳定的 ontology schema dto 契约', () => {
    const schema: OntologySchemaResponseDto = {
      objectTypes: [
        {
          objectType: 'Order',
          description: 'Order ontology object',
          properties: [
            { name: 'amount', type: 'number', required: true },
            {
              name: 'status',
              type: 'enum',
              required: true,
              enumValues: ['PendingReview', 'Approved']
            } satisfies Extract<OntologyPropertyDto, { type: 'enum' }>
          ]
        }
      ]
    };

    expectTypeOf(schema).toEqualTypeOf<OntologySchemaResponseDto>();
    expectTypeOf<Extract<OntologyPropertyDto, { type: 'enum' }>>().toEqualTypeOf<{
      name: string;
      type: 'enum';
      required: boolean;
      enumValues: string[];
    }>();
  });

  it('暴露稳定的 ontology object 与 query dto 契约', () => {
    const request: OntologyQueryRequestDto = {
      objectType: 'Order',
      state: 'PendingReview'
    };
    const object: OntologyObjectDto = {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        amount: 1250,
        approved: false
      }
    };
    const response: OntologyQueryResponseDto = {
      objects: [object]
    };

    expectTypeOf(request).toEqualTypeOf<OntologyQueryRequestDto>();
    expectTypeOf(response.objects[0]).toEqualTypeOf<OntologyObjectDto>();
  });
});
