import type { Request, Response } from 'express';
import {
  isBadRequestError,
} from '../../lib/validation';
import type { OntologyIngestService } from '../../services/ontologyIngest/OntologyIngestService';
import { OntologyIngestBoundary } from '../../services/ontologyIngest/OntologyIngestBoundary';

type OntologyIngestRoutesApp = {
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

export class OntologyIngestController {
  constructor(
    private readonly ontologyIngestService: Pick<
      OntologyIngestService,
      'previewIngest' | 'submitIngest' | 'getIngestJob' | 'getIngestReport'
    >,
    private readonly ontologyIngestBoundary = new OntologyIngestBoundary()
  ) {}

  async previewIngest(req: Request, res: Response) {
    try {
      const payload = this.ontologyIngestBoundary.normalizePreviewRequest(req.body);
      const result = await this.ontologyIngestService.previewIngest(payload);
      res.status(200).json(result);
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to preview ontology ingest' });
    }
  }

  async submitIngest(req: Request, res: Response) {
    try {
      const payload = this.ontologyIngestBoundary.normalizeSubmitRequest(req.body);
      const result = await this.ontologyIngestService.submitIngest(payload);
      res.status(200).json(result);
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to submit ontology ingest' });
    }
  }

  async getIngestJob(req: Request, res: Response) {
    try {
      const jobId = this.ontologyIngestBoundary.normalizeJobId(req.params.jobId);
      const job = await this.ontologyIngestService.getIngestJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Ontology ingest job not found' });
        return;
      }

      res.status(200).json({ job });
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to load ontology ingest job' });
    }
  }

  async getIngestReport(req: Request, res: Response) {
    try {
      const jobId = this.ontologyIngestBoundary.normalizeJobId(req.params.jobId);
      const report = await this.ontologyIngestService.getIngestReport(jobId);

      if (!report) {
        res.status(404).json({ error: 'Ontology ingest report not found' });
        return;
      }

      res.status(200).json({ report });
    } catch (error) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to load ontology ingest report' });
    }
  }
}

export function registerOntologyIngestRoutes(
  app: OntologyIngestRoutesApp,
  ontologyIngestController: OntologyIngestController
) {
  app.post('/api/ontology/ingest/preview', (req, res) =>
    ontologyIngestController.previewIngest(req, res)
  );
  app.post('/api/ontology/ingest/submit', (req, res) =>
    ontologyIngestController.submitIngest(req, res)
  );
  app.get('/api/ontology/ingest/jobs/:jobId', (req, res) =>
    ontologyIngestController.getIngestJob(req, res)
  );
  app.get('/api/ontology/ingest/jobs/:jobId/report', (req, res) =>
    ontologyIngestController.getIngestReport(req, res)
  );
}
