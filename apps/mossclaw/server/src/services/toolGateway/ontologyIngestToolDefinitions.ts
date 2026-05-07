import type { ToolDescriptorDto } from '@mossclaw/shared';
import { OntologyIngestToolBoundary, type OntologyIngestToolName } from './OntologyIngestToolBoundary';

const defaultOntologyIngestToolBoundary = new OntologyIngestToolBoundary();

export function createOntologyIngestToolDefinitions(
  ontologyIngestToolBoundary: Pick<OntologyIngestToolBoundary, 'getToolErrors'> = defaultOntologyIngestToolBoundary
): ToolDescriptorDto[] {
  const definitions: ToolDescriptorDto[] = [
    {
      name: 'ontology.ingest_preview',
      category: 'ontology',
      description: 'Preview ontology ingest and return dry-run summary without mutating storage',
      inputSchema: buildInputSchema(),
      outputSchema: buildSuccessSchema('ontology.ingest_preview', {
        type: 'object',
        properties: {
          ok: { type: 'boolean', const: true },
          preview: { type: 'object', additionalProperties: true }
        },
        required: ['ok', 'preview'],
        additionalProperties: false
      }),
      errors: ontologyIngestToolBoundary.getToolErrors('ontology.ingest_preview'),
      examples: [
        {
          input: {
            source: { kind: 'json' },
            objects: []
          },
          output: {
            ok: true,
            toolName: 'ontology.ingest_preview',
            result: {
              ok: true,
              preview: {
                dryRun: true,
                summary: {
                  totalRecords: 0,
                  acceptedRecords: 0,
                  rejectedRecords: 0,
                  createdObjects: 0,
                  updatedObjects: 0,
                  skippedObjects: 0
                },
                diagnostics: [],
                sampleObjects: []
              }
            }
          }
        }
      ]
    },
    {
      name: 'ontology.ingest_submit',
      category: 'ontology',
      description: 'Submit ontology ingest and persist objects through the ontology ingest pipeline',
      inputSchema: buildInputSchema(),
      outputSchema: buildSuccessSchema('ontology.ingest_submit', {
        type: 'object',
        properties: {
          ok: { type: 'boolean', const: true },
          job: { type: 'object', additionalProperties: true }
        },
        required: ['ok', 'job'],
        additionalProperties: false
      }),
      errors: ontologyIngestToolBoundary.getToolErrors('ontology.ingest_submit'),
      examples: [
        {
          input: {
            source: { kind: 'json' },
            objects: []
          },
          output: {
            ok: true,
            toolName: 'ontology.ingest_submit',
            result: {
              ok: true,
              job: {
                jobId: 'ingest-job-001',
                status: 'succeeded',
                createdAt: '2026-04-29T10:00:00.000Z',
                source: { kind: 'json' }
              }
            }
          }
        }
      ]
    }
  ];

  return definitions.map((tool) => deepFreeze(tool));
}

export const ontologyIngestToolDefinitions = createOntologyIngestToolDefinitions();

function buildInputSchema() {
  return {
    type: 'object',
    properties: {
      source: { type: 'object' },
      objects: { type: 'array' },
      options: { type: 'object' }
    },
    required: ['source', 'objects'],
    additionalProperties: false
  };
}

function buildSuccessSchema(toolName: OntologyIngestToolName, resultSchema: Record<string, unknown>) {
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
