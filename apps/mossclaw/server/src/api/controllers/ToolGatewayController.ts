import type { Request, Response } from 'express';
import type { ToolDescriptorDto, ToolInvokeRequestDto, ToolInvokeResultDto } from '@mossclaw/shared';
import { isBadRequestError, requireObject, requireTrimmedString } from './requestParams';
import type { ToolGatewayService } from '../../services/toolGateway/ToolGatewayService';

type ToolGatewayRoutesApp = {
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

export class ToolGatewayController {
  constructor(private readonly toolGatewayService: Pick<ToolGatewayService, 'listTools' | 'invoke'>) {}

  async listTools(_req: Request, res: Response) {
    try {
      const tools = this.toolGatewayService.listTools();
      res.json(tools);
    } catch {
      res.status(500).json({ error: 'Failed to load tool directory' });
    }
  }

  async invoke(req: Request, res: Response) {
    try {
      const toolName = requireTrimmedString(req.params.toolName, 'Tool name');
      const payload = normalizeToolInvokePayload(req.body);
      const result = await this.toolGatewayService.invoke(toolName, payload);
      res.status(200).json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to invoke tool' });
    }
  }
}

export function registerToolGatewayRoutes(
  app: ToolGatewayRoutesApp,
  toolGatewayController: ToolGatewayController
) {
  app.get('/api/tools', (req, res) => toolGatewayController.listTools(req, res));
  app.post('/api/tools/:toolName/invoke', (req, res) => toolGatewayController.invoke(req, res));
}

function normalizeToolInvokePayload(value: unknown): ToolInvokeRequestDto {
  if (value === undefined) {
    return {};
  }

  const payload = requireObject(value, 'Tool invocation payload');
  return payload as ToolInvokeRequestDto;
}
