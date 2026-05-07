import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { ToolDescriptorDto, ToolInvokeResultDto } from '@mossclaw/shared';
import { ToolGatewayController } from './ToolGatewayController';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function buildToolGatewayServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    listTools: vi.fn(),
    invoke: vi.fn(),
    ...overrides
  };
}

function buildController(serviceOverrides: Record<string, unknown> = {}) {
  const toolGatewayService = buildToolGatewayServiceMock(serviceOverrides);
  const controller = new ToolGatewayController(toolGatewayService as never);
  return { controller, toolGatewayService };
}

function buildToolDescriptor(overrides: Partial<ToolDescriptorDto> = {}): ToolDescriptorDto {
  return {
    name: 'ontology.get_schema',
    category: 'ontology',
    description: 'Return ontology schema',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    errors: [],
    ...overrides
  };
}

describe('ToolGatewayController', () => {
  it('returns tool descriptors from the tool gateway service', async () => {
    const { controller, toolGatewayService } = buildController({
      listTools: vi.fn().mockReturnValue([
        buildToolDescriptor(),
        buildToolDescriptor({
          name: 'ontology.query',
          description: 'Query ontology objects'
        }),
        buildToolDescriptor({
          name: 'workflow_builder.compile',
          category: 'workflow_builder',
          description: 'Compile workflow plan into a workflow definition'
        })
      ])
    });
    const req = {} as Request;
    const res = buildMockResponse();

    await controller.listTools(req, res);

    expect(toolGatewayService.listTools).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith([
      buildToolDescriptor(),
      buildToolDescriptor({
        name: 'ontology.query',
        description: 'Query ontology objects'
      }),
      buildToolDescriptor({
        name: 'workflow_builder.compile',
        category: 'workflow_builder',
        description: 'Compile workflow plan into a workflow definition'
      })
    ]);
  });

  it('invokes tools through the service and trims the tool name', async () => {
    const result: ToolInvokeResultDto = {
      ok: true,
      toolName: 'ontology.get_schema',
      result: {
        objectTypes: []
      }
    };
    const { controller, toolGatewayService } = buildController({
      invoke: vi.fn().mockResolvedValue(result)
    });
    const req = {
      params: {
        toolName: '  ontology.get_schema  '
      },
      body: undefined
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.invoke(req, res);

    expect(toolGatewayService.invoke).toHaveBeenCalledWith('ontology.get_schema', {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 200 with structured business errors from the service', async () => {
    const result: ToolInvokeResultDto = {
      ok: false,
      toolName: 'ontology.get_object',
      error: 'Ontology object not found',
      errorCode: 'OBJECT_NOT_FOUND'
    };
    const { controller, toolGatewayService } = buildController({
      invoke: vi.fn().mockResolvedValue(result)
    });
    const req = {
      params: {
        toolName: 'ontology.get_object'
      },
      body: {
        arguments: {
          objectType: 'Order',
          objectId: 'missing'
        }
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.invoke(req, res);

    expect(toolGatewayService.invoke).toHaveBeenCalledWith('ontology.get_object', {
      arguments: {
        objectType: 'Order',
        objectId: 'missing'
      }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 200 with workflow builder compile result payload', async () => {
    const result: ToolInvokeResultDto = {
      ok: true,
      toolName: 'workflow_builder.compile',
      result: {
        ok: true,
        accepted: false,
        diagnostics: [
          {
            code: 'NO_ELIGIBLE_ACTION',
            severity: 'error',
            message: 'No eligible action matched workflow step "Send a Slack message"',
            stepId: 'step-1'
          }
        ]
      }
    };
    const { controller, toolGatewayService } = buildController({
      invoke: vi.fn().mockResolvedValue(result)
    });
    const req = {
      params: {
        toolName: 'workflow_builder.compile'
      },
      body: {
        arguments: {
          goal: {
            title: 'Review pending orders'
          },
          plan: {
            steps: [
              {
                stepId: 'step-1',
                title: 'Send a Slack message',
                capabilityTags: ['notify']
              }
            ]
          }
        }
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.invoke(req, res);

    expect(toolGatewayService.invoke).toHaveBeenCalledWith('workflow_builder.compile', {
      arguments: {
        goal: {
          title: 'Review pending orders'
        },
        plan: {
          steps: [
            {
              stepId: 'step-1',
              title: 'Send a Slack message',
              capabilityTags: ['notify']
            }
          ]
        }
      }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 400 when tool invocation envelope is not an object', async () => {
    const { controller, toolGatewayService } = buildController();
    const req = {
      params: {
        toolName: 'ontology.query'
      },
      body: []
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.invoke(req, res);

    expect(toolGatewayService.invoke).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Tool invocation payload must be an object'
    });
  });

  it('returns 400 when tool name is blank', async () => {
    const { controller, toolGatewayService } = buildController();
    const req = {
      params: {
        toolName: '   '
      },
      body: {}
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.invoke(req, res);

    expect(toolGatewayService.invoke).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Tool name is required'
    });
  });

  it('returns 500 with a stable message when invoke throws unexpectedly', async () => {
    const { controller } = buildController({
      invoke: vi.fn().mockRejectedValue(new Error('database offline'))
    });
    const req = {
      params: {
        toolName: 'ontology.get_schema'
      },
      body: {}
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.invoke(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to invoke tool'
    });
  });

  it('returns 500 with a stable message when listTools throws unexpectedly', async () => {
    const { controller } = buildController({
      listTools: vi.fn(() => {
        throw new Error('registry unavailable');
      })
    });
    const req = {} as Request;
    const res = buildMockResponse();

    await controller.listTools(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to load tool directory'
    });
  });
});
