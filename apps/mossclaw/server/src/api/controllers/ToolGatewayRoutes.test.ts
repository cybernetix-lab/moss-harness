import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerToolGatewayRoutes } from './ToolGatewayController';

describe('registerToolGatewayRoutes', () => {
  let server: Server;
  let baseUrl: string;

  const toolGatewayController = {
    listTools: vi.fn((_req, res) => {
      res.json({
        route: 'list'
      });
    }),
    invoke: vi.fn((req, res) => {
      res.status(200).json({
        route: 'invoke',
        toolName: req.params.toolName,
        body: req.body
      });
    })
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerToolGatewayRoutes(app, toolGatewayController as never);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve tool gateway route test server address');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts GET /api/tools', async () => {
    const response = await fetch(`${baseUrl}/api/tools`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'list'
    });
    expect(toolGatewayController.listTools).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/tools/:toolName/invoke', async () => {
    const response = await fetch(`${baseUrl}/api/tools/ontology.get_schema/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          objectType: 'Order'
        }
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'invoke',
      toolName: 'ontology.get_schema',
      body: {
        arguments: {
          objectType: 'Order'
        }
      }
    });
    expect(toolGatewayController.invoke).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/tools/:toolName/invoke for workflow builder tools', async () => {
    const response = await fetch(`${baseUrl}/api/tools/workflow_builder.compile/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
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
        }
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'invoke',
      toolName: 'workflow_builder.compile',
      body: {
        arguments: {
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
        }
      }
    });
    expect(toolGatewayController.invoke).toHaveBeenCalledTimes(1);
  });
});
