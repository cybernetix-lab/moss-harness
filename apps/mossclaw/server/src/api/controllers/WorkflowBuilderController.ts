import type { Request, Response } from 'express';
import { isBadRequestError } from '../../lib/validation';
import { WorkflowBuilderService } from '../../services/workflowBuilder/WorkflowBuilderService';
import { WorkflowBuilderBoundary } from '../../services/workflowBuilder/WorkflowBuilderBoundary';

type WorkflowBuilderRoutesApp = {
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

export class WorkflowBuilderController {
  constructor(
    private readonly workflowBuilderService: Pick<
      WorkflowBuilderService,
      'validatePlan' | 'compilePlan' | 'simulatePlan'
    >,
    private readonly workflowBuilderBoundary = new WorkflowBuilderBoundary()
  ) {}

  async validatePlan(req: Request, res: Response) {
    try {
      const payload = this.workflowBuilderBoundary.normalizeValidateRequest(req.body);
      const result = await this.workflowBuilderService.validatePlan(payload);
      res.status(200).json(result);
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to validate workflow plan' });
    }
  }

  async compilePlan(req: Request, res: Response) {
    try {
      const payload = this.workflowBuilderBoundary.normalizeCompileRequest(req.body);
      const result = await this.workflowBuilderService.compilePlan(payload);
      res.status(200).json(result);
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to compile workflow plan' });
    }
  }

  async simulatePlan(req: Request, res: Response) {
    try {
      const payload = this.workflowBuilderBoundary.normalizeSimulateRequest(req.body);
      const result = await this.workflowBuilderService.simulatePlan(payload);
      res.status(200).json(result);
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to simulate workflow plan' });
    }
  }
}

export function registerWorkflowBuilderRoutes(
  app: WorkflowBuilderRoutesApp,
  workflowBuilderController: WorkflowBuilderController
) {
  app.post('/api/workflow-builder/validate', (req, res) =>
    workflowBuilderController.validatePlan(req, res)
  );
  app.post('/api/workflow-builder/compile', (req, res) =>
    workflowBuilderController.compilePlan(req, res)
  );
  app.post('/api/workflow-builder/simulate', (req, res) =>
    workflowBuilderController.simulatePlan(req, res)
  );
}
