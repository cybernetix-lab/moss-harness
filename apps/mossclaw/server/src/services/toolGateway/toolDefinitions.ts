import type { ToolDescriptorDto } from '@mossclaw/shared';
import { OntologyToolBoundary, type OntologyToolName } from './OntologyToolBoundary';

const defaultOntologyToolBoundary = new OntologyToolBoundary();

export function createOntologyToolDefinitions(
  ontologyToolBoundary: Pick<OntologyToolBoundary, 'getToolErrors'> = defaultOntologyToolBoundary
): ToolDescriptorDto[] {
  const definitions: ToolDescriptorDto[] = [
    {
      name: 'ontology.get_object',
      category: 'ontology',
      description: 'Return a single ontology object by objectType and objectId',
      inputSchema: {
        type: 'object',
        properties: {
          objectType: { type: 'string' },
          objectId: { type: 'string' }
        },
        required: ['objectType', 'objectId'],
        additionalProperties: false
      },
      outputSchema: buildSuccessSchema('ontology.get_object', {
        type: 'object',
        properties: {
          objectType: { type: 'string' },
          objectId: { type: 'string' },
          displayName: { type: 'string' },
          state: { type: 'string' },
          properties: {
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['objectType', 'objectId', 'displayName', 'state', 'properties']
      }),
      errors: ontologyToolBoundary.getToolErrors('ontology.get_object'),
      examples: [
        {
          input: {
            objectType: 'Order',
            objectId: 'order-001'
          },
          output: {
            ok: true,
            toolName: 'ontology.get_object',
            result: {
              objectType: 'Order',
              objectId: 'order-001',
              displayName: 'Order 001',
              state: 'PendingReview',
              properties: {
                amount: 1250
              }
            }
          }
        }
      ]
    },
    {
      name: 'ontology.get_schema',
      category: 'ontology',
      description: 'Return ontology schema with all object types and properties',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      outputSchema: buildSuccessSchema('ontology.get_schema', {
        type: 'object',
        properties: {
          objectTypes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                objectType: { type: 'string' },
                description: { type: 'string' },
                properties: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      required: { type: 'boolean' },
                      enumValues: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    },
                    required: ['name', 'type', 'required']
                  }
                }
              },
              required: ['objectType', 'properties']
            }
          }
        },
        required: ['objectTypes']
      }),
      errors: ontologyToolBoundary.getToolErrors('ontology.get_schema'),
      examples: [
        {
          input: {},
          output: {
            ok: true,
            toolName: 'ontology.get_schema',
            result: {
              objectTypes: [
                {
                  objectType: 'Order',
                  description: 'Order business object',
                  properties: [
                    {
                      name: 'amount',
                      type: 'number',
                      required: true
                    }
                  ]
                }
              ]
            }
          }
        }
      ]
    },
    {
      name: 'ontology.query',
      category: 'ontology',
      description: 'Query ontology objects by optional objectType and state filters',
      inputSchema: {
        type: 'object',
        properties: {
          objectType: { type: 'string' },
          state: { type: 'string' }
        },
        additionalProperties: false
      },
      outputSchema: buildSuccessSchema('ontology.query', {
        type: 'object',
        properties: {
          objects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                objectType: { type: 'string' },
                objectId: { type: 'string' },
                displayName: { type: 'string' },
                state: { type: 'string' },
                properties: {
                  type: 'object',
                  additionalProperties: true
                }
              },
              required: ['objectType', 'objectId', 'displayName', 'state', 'properties']
            }
          }
        },
        required: ['objects']
      }),
      errors: ontologyToolBoundary.getToolErrors('ontology.query'),
      examples: [
        {
          input: {
            objectType: 'Order',
            state: 'PendingReview'
          },
          output: {
            ok: true,
            toolName: 'ontology.query',
            result: {
              objects: [
                {
                  objectType: 'Order',
                  objectId: 'order-001',
                  displayName: 'Order 001',
                  state: 'PendingReview',
                  properties: {
                    amount: 1250
                  }
                }
              ]
            }
          }
        }
      ]
    }
  ];

  return definitions.map((tool) => deepFreeze(tool));
}

export const ontologyToolDefinitions = createOntologyToolDefinitions();

function buildSuccessSchema(toolName: OntologyToolName, resultSchema: Record<string, unknown>) {
  return {
    type: 'object',
    properties: {
      ok: {
        type: 'boolean',
        const: true
      },
      toolName: {
        type: 'string',
        const: toolName
      },
      result: resultSchema
    },
    required: ['ok', 'toolName', 'result'],
    additionalProperties: false
  };
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const nestedValue of Object.values(objectValue)) {
    deepFreeze(nestedValue);
  }

  return Object.freeze(value);
}
