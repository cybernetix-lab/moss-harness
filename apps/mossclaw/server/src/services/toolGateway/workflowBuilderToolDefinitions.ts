import type { ToolDescriptorDto } from '@mossclaw/shared';
import type { WorkflowBuilderToolName } from './WorkflowBuilderToolAdapter';

export function createWorkflowBuilderToolDefinitions(): ToolDescriptorDto[] {
  const definitions: ToolDescriptorDto[] = [
    {
      name: 'workflow_builder.validate_plan',
      category: 'workflow_builder',
      description: 'Validate and normalize a workflow plan without compiling it',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'object' },
          plan: { type: 'object' }
        },
        required: ['goal', 'plan'],
        additionalProperties: false
      },
      outputSchema: buildSuccessSchema('workflow_builder.validate_plan', {
        type: 'object',
        properties: {
          ok: { type: 'boolean', const: true },
          normalizedGoal: { type: 'object', additionalProperties: true },
          normalizedPlan: { type: 'object', additionalProperties: true },
          diagnostics: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        required: ['ok', 'normalizedGoal', 'normalizedPlan', 'diagnostics'],
        additionalProperties: false
      }),
      errors: [
        {
          errorCode: 'INVALID_ARGUMENT',
          description: 'Tool arguments must contain a valid workflow goal and plan'
        },
        {
          errorCode: 'VALIDATE_PLAN_FAILED',
          description: 'Workflow plan validation could not be completed'
        }
      ],
      examples: [
        {
          input: {
            goal: {
              title: 'Review pending orders'
            },
            plan: {
              steps: [
                {
                  stepId: 'step-1',
                  title: 'Find pending orders'
                }
              ]
            }
          },
          output: {
            ok: true,
            toolName: 'workflow_builder.validate_plan',
            result: {
              ok: true,
              normalizedGoal: {
                title: 'Review pending orders'
              },
              normalizedPlan: {
                steps: [
                  {
                    stepId: 'step-1',
                    title: 'Find pending orders'
                  }
                ]
              },
              diagnostics: []
            }
          }
        }
      ]
    },
    {
      name: 'workflow_builder.compile',
      category: 'workflow_builder',
      description: 'Compile a workflow plan into a workflow definition',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'object' },
          plan: { type: 'object' },
          options: { type: 'object' }
        },
        required: ['goal', 'plan'],
        additionalProperties: false
      },
      outputSchema: buildSuccessSchema('workflow_builder.compile', {
        type: 'object',
        properties: {
          ok: { type: 'boolean', const: true },
          accepted: { type: 'boolean' },
          workflow: {
            type: 'object',
            additionalProperties: true
          },
          diagnostics: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        required: ['ok', 'accepted', 'diagnostics'],
        additionalProperties: false
      }),
      errors: [
        {
          errorCode: 'INVALID_ARGUMENT',
          description: 'Tool arguments must contain a valid workflow compile request'
        },
        {
          errorCode: 'COMPILE_FAILED',
          description: 'Workflow plan compilation could not be completed'
        }
      ],
      examples: [
        {
          input: {
            goal: {
              title: 'Review pending orders'
            },
            plan: {
              steps: [
                {
                  stepId: 'step-1',
                  title: 'Find pending orders',
                  capabilityTags: ['query']
                }
              ]
            }
          },
          output: {
            ok: true,
            toolName: 'workflow_builder.compile',
            result: {
              ok: true,
              accepted: true,
              workflow: {
                workflowId: 'wf-review-pending-orders',
                goal: {
                  title: 'Review pending orders'
                },
                nodes: [
                  {
                    nodeId: 'node-step-1',
                    stepId: 'step-1',
                    actionId: 'ontology.query',
                    title: 'Find pending orders'
                  }
                ],
                edges: []
              },
              diagnostics: []
            }
          }
        }
      ]
    },
    {
      name: 'workflow_builder.simulate',
      category: 'workflow_builder',
      description: 'Simulate workflow plan compilation and return preview diagnostics',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'object' },
          plan: { type: 'object' }
        },
        required: ['goal', 'plan'],
        additionalProperties: false
      },
      outputSchema: buildSuccessSchema('workflow_builder.simulate', {
        type: 'object',
        properties: {
          ok: { type: 'boolean', const: true },
          preview: {
            type: 'object',
            additionalProperties: true
          },
          diagnostics: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        required: ['ok', 'preview', 'diagnostics'],
        additionalProperties: false
      }),
      errors: [
        {
          errorCode: 'INVALID_ARGUMENT',
          description: 'Tool arguments must contain a valid workflow simulation request'
        },
        {
          errorCode: 'SIMULATE_FAILED',
          description: 'Workflow plan simulation could not be completed'
        }
      ],
      examples: [
        {
          input: {
            goal: {
              title: 'Review pending orders'
            },
            plan: {
              steps: [
                {
                  stepId: 'step-1',
                  title: 'Find pending orders',
                  capabilityTags: ['query']
                }
              ]
            }
          },
          output: {
            ok: true,
            toolName: 'workflow_builder.simulate',
            result: {
              ok: true,
              preview: {
                nodeCount: 1,
                edgeCount: 0,
                actionIds: ['ontology.query']
              },
              diagnostics: []
            }
          }
        }
      ]
    }
  ];

  return definitions.map((tool) => deepFreeze(tool));
}

export const workflowBuilderToolDefinitions = createWorkflowBuilderToolDefinitions();

function buildSuccessSchema(toolName: WorkflowBuilderToolName, resultSchema: Record<string, unknown>) {
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
