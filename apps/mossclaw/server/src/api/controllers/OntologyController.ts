import type { Request, Response } from 'express';
import { OntologyService } from '../../services/OntologyService';
import { OntologyToolBoundary } from '../../services/toolGateway/OntologyToolBoundary';
import { isBadRequestError } from '../../lib/validation';

type OntologyRoutesApp = {
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

export class OntologyController {
  constructor(
    private readonly ontologyService: OntologyService,
    private readonly ontologyToolBoundary = new OntologyToolBoundary()
  ) {}

  async getSchema(_req: Request, res: Response) {
    try {
      const schema = await this.ontologyService.getSchema();
      res.json(schema);
    } catch {
      res.status(500).json({ error: this.ontologyToolBoundary.getSchemaLoadErrorMessage() });
    }
  }

  async getObject(req: Request, res: Response) {
    try {
      const { objectType, objectId } = this.ontologyToolBoundary.normalizeGetObjectArguments({
        objectType: req.params.objectType,
        objectId: req.params.objectId
      });
      const object = await this.ontologyService.getObject(objectType, objectId);

      if (!object) {
        res.status(404).json({ error: this.ontologyToolBoundary.getObjectNotFoundMessage() });
        return;
      }

      res.json(object);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: this.ontologyToolBoundary.getObjectLoadErrorMessage() });
    }
  }

  async queryObjects(req: Request, res: Response) {
    try {
      const payload = this.ontologyToolBoundary.normalizeQueryArguments(req.body);
      const result = await this.ontologyService.queryObjects(payload);
      res.json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: this.ontologyToolBoundary.getQueryObjectsErrorMessage() });
    }
  }
}

export function registerOntologyRoutes(app: OntologyRoutesApp, ontologyController: OntologyController) {
  app.get('/api/ontology/schema', (req, res) => ontologyController.getSchema(req, res));
  app.get('/api/ontology/objects/:objectType/:objectId', (req, res) => ontologyController.getObject(req, res));
  app.post('/api/ontology/query', (req, res) => ontologyController.queryObjects(req, res));
}
