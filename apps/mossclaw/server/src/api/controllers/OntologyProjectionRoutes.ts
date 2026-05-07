import type { Request, Response } from 'express';
import { OntologyProjectionController } from './OntologyProjectionController';

type OntologyProjectionRoutesApp = {
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
};

export function registerOntologyProjectionRoutes(
  app: OntologyProjectionRoutesApp,
  ontologyProjectionController: OntologyProjectionController
) {
  app.get('/api/ontology/projection/types', (req, res) =>
    ontologyProjectionController.getTypes(req, res)
  );
  app.get('/api/ontology/projection/objects/:objectType/:objectId/neighbors', (req, res) =>
    ontologyProjectionController.getNeighbors(req, res)
  );
  app.post('/api/ontology/projection/subgraph', (req, res) =>
    ontologyProjectionController.getSubgraph(req, res)
  );
  app.post('/api/ontology/projection/loops/analyze', (req, res) =>
    ontologyProjectionController.analyzeLoops(req, res)
  );
}
