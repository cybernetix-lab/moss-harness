import type { Request, Response } from 'express';
import type { OntologyQueryRequestDto } from '@mossclaw/shared';
import { OntologyService } from '../../services/OntologyService';
import { isBadRequestError, requireObject, requireTrimmedString } from './requestParams';

type OntologyRoutesApp = {
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

const SCHEMA_LOAD_ERROR = 'Failed to load ontology schema';
const OBJECT_LOAD_ERROR = 'Failed to load ontology object';
const QUERY_OBJECTS_ERROR = 'Failed to query ontology objects';

export class OntologyController {
  constructor(private readonly ontologyService: OntologyService) {}

  async getSchema(_req: Request, res: Response) {
    try {
      const schema = await this.ontologyService.getSchema();
      res.json(schema);
    } catch {
      res.status(500).json({ error: SCHEMA_LOAD_ERROR });
    }
  }

  async getObject(req: Request, res: Response) {
    try {
      const objectType = requireTrimmedString(req.params.objectType, 'Ontology objectType');
      const objectId = requireTrimmedString(req.params.objectId, 'Ontology objectId');
      const object = await this.ontologyService.getObject(objectType, objectId);

      if (!object) {
        res.status(404).json({ error: 'Ontology object not found' });
        return;
      }

      res.json(object);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: OBJECT_LOAD_ERROR });
    }
  }

  async queryObjects(req: Request, res: Response) {
    try {
      const payload = normalizeQueryPayload(req.body);
      const result = await this.ontologyService.queryObjects(payload);
      res.json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: QUERY_OBJECTS_ERROR });
    }
  }
}

export function registerOntologyRoutes(app: OntologyRoutesApp, ontologyController: OntologyController) {
  app.get('/api/ontology/schema', (req, res) => ontologyController.getSchema(req, res));
  app.get('/api/ontology/objects/:objectType/:objectId', (req, res) => ontologyController.getObject(req, res));
  app.post('/api/ontology/query', (req, res) => ontologyController.queryObjects(req, res));
}

function normalizeQueryPayload(value: unknown): OntologyQueryRequestDto {
  if (value === undefined) {
    return {};
  }

  const payload = requireObject(value, 'Ontology query payload');
  const normalized: OntologyQueryRequestDto = {};

  if (payload.objectType !== undefined) {
    normalized.objectType = requireTrimmedString(payload.objectType, 'Ontology query payload.objectType');
  }

  if (payload.state !== undefined) {
    normalized.state = requireTrimmedString(payload.state, 'Ontology query payload.state');
  }

  return normalized;
}
