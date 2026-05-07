import type { Request, RequestHandler, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

import { openApiDocument } from '../openapi/openapiDocument';

type SwaggerRoutesApp = {
  get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown;
  use: (path: string, ...handlers: Array<RequestHandler | RequestHandler[]>) => unknown;
};

export interface SwaggerRouteOptions {
  enabled: boolean;
}

export function registerSwaggerRoutes(
  app: SwaggerRoutesApp,
  options: SwaggerRouteOptions
) {
  if (!options.enabled) {
    return;
  }

  app.get('/api/openapi.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      explorer: true,
      swaggerOptions: {
        url: '/api/openapi.json'
      }
    })
  );
}
