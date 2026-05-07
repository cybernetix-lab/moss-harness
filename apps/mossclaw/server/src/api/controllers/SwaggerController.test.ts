import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerSwaggerRoutes } from './SwaggerController';

describe('registerSwaggerRoutes', () => {
  describe('when enabled', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      const app = express();
      registerSwaggerRoutes(app, { enabled: true });

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve swagger route test server address');
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

    it('mounts GET /api/openapi.json with priority API paths', async () => {
      const response = await fetch(`${baseUrl}/api/openapi.json`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const document = await response.json();
      expect(document.openapi).toBe('3.1.0');
      expect(document.paths).toHaveProperty('/api/ontology/schema');
      expect(document.paths).toHaveProperty('/api/ontology/ingest/preview');
      expect(document.paths).toHaveProperty('/api/workflow-runtime/runs');
      expect(document.paths).toHaveProperty('/api/tasks');
      expect(document.paths).toHaveProperty('/api/tasks/{id}');
      expect(document.paths).toHaveProperty('/api/tasks/{id}/execute');
      expect(document.paths).toHaveProperty('/api/tasks/{id}/control');
      expect(document.paths).toHaveProperty('/api/agents');
      expect(document.paths).toHaveProperty('/api/agents/{id}');
      expect(document.paths).toHaveProperty('/api/agents/{id}/disable');
      expect(document.paths).toHaveProperty('/api/agents/{id}/enable');
      expect(document.paths).toHaveProperty('/api/tools');
      expect(document.paths).toHaveProperty('/api/tools/{toolName}/invoke');
      expect(document.paths).toHaveProperty('/api/skills');
      expect(document.paths).toHaveProperty('/api/skills/{id}');
      expect(document.paths).toHaveProperty('/api/skills/{id}/disable');
      expect(document.paths).toHaveProperty('/api/skills/{id}/enable');
      expect(document.paths).toHaveProperty('/api/models');
    });

    it('mounts GET /api/docs with swagger ui html', async () => {
      const response = await fetch(`${baseUrl}/api/docs`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain('Swagger UI');
    });
  });

  describe('when disabled', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      const app = express();
      registerSwaggerRoutes(app, { enabled: false });

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve disabled swagger route test server address');
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

    it('does not mount swagger routes', async () => {
      const openapiResponse = await fetch(`${baseUrl}/api/openapi.json`);
      const docsResponse = await fetch(`${baseUrl}/api/docs`);

      expect(openapiResponse.status).toBe(404);
      expect(docsResponse.status).toBe(404);
    });
  });
});
