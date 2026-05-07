import type { Request, Response } from 'express';
import { WorkflowRuntimeService } from '../../services/workflowRuntime/WorkflowRuntimeService';

type WorkflowRuntimeRoutesApp = {
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

export class WorkflowRuntimeController {
  constructor(
    private readonly workflowRuntimeService: Pick<
      WorkflowRuntimeService,
      'startRun' | 'resumeRun' | 'cancelRun' | 'getRun' | 'getRunLogs'
    >
  ) {}

  async startRun(req: Request, res: Response) {
    try {
      const result = await this.workflowRuntimeService.startRun(req.body);
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: 'Failed to start workflow run' });
    }
  }

  async resumeRun(req: Request, res: Response) {
    try {
      const result = await this.workflowRuntimeService.resumeRun(getSingleParam(req.params.runId));
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: 'Failed to resume workflow run' });
    }
  }

  async cancelRun(req: Request, res: Response) {
    try {
      const result = await this.workflowRuntimeService.cancelRun(getSingleParam(req.params.runId));
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: 'Failed to cancel workflow run' });
    }
  }

  async getRun(req: Request, res: Response) {
    try {
      const result = await this.workflowRuntimeService.getRun(getSingleParam(req.params.runId));
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: 'Failed to load workflow run' });
    }
  }

  async getRunLogs(req: Request, res: Response) {
    try {
      const result = await this.workflowRuntimeService.getRunLogs(getSingleParam(req.params.runId));
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: 'Failed to load workflow run logs' });
    }
  }
}

export function registerWorkflowRuntimeRoutes(
  app: WorkflowRuntimeRoutesApp,
  workflowRuntimeController: WorkflowRuntimeController
) {
  app.post('/api/workflow-runtime/runs', (req, res) => workflowRuntimeController.startRun(req, res));
  app.post('/api/workflow-runtime/runs/:runId/resume', (req, res) =>
    workflowRuntimeController.resumeRun(req, res)
  );
  app.post('/api/workflow-runtime/runs/:runId/cancel', (req, res) =>
    workflowRuntimeController.cancelRun(req, res)
  );
  app.get('/api/workflow-runtime/runs/:runId', (req, res) =>
    workflowRuntimeController.getRun(req, res)
  );
  app.get('/api/workflow-runtime/runs/:runId/logs', (req, res) =>
    workflowRuntimeController.getRunLogs(req, res)
  );
}

function getSingleParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
