import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '@agent-harness/core/storage/types';
import { OntologyController, registerOntologyRoutes } from './OntologyController';
import { OntologyProjectionController } from './OntologyProjectionController';
import { registerOntologyProjectionRoutes } from './OntologyProjectionRoutes';
import { ensureOntologySchema } from '../../infrastructure/database/ontologySchema';
import { UnifiedOntologyRepository } from '../../infrastructure/database/UnifiedOntologyRepository';
import { OntologyService } from '../../services/OntologyService';
import { LoopAnalysisService } from '../../services/ontologyProjection/LoopAnalysisService';
import { SubgraphProjectionService } from '../../services/ontologyProjection/SubgraphProjectionService';
import { TypeProjectionService } from '../../services/ontologyProjection/TypeProjectionService';

describe('OntologyProjection API smoke', () => {
  let storage: IStorage;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    storage = await createStorage({
      ...DEFAULT_STORAGE_CONFIG,
      backend: 'memory',
      connection: {
        filepath: ':memory:'
      }
    });

    await ensureOntologySchema(storage);

    const ontologyRepository = new UnifiedOntologyRepository(storage);
    const ontologyService = new OntologyService(ontologyRepository);
    const typeProjectionService = new TypeProjectionService(ontologyService);
    const subgraphProjectionService = new SubgraphProjectionService(ontologyService);
    const loopAnalysisService = new LoopAnalysisService();
    const ontologyController = new OntologyController(ontologyService);
    const ontologyProjectionController = new OntologyProjectionController({
      getTypes: () => typeProjectionService.getTypes(),
      getNeighbors: (payload) => subgraphProjectionService.getNeighbors(payload),
      getSubgraph: (payload) => subgraphProjectionService.getSubgraph(payload),
      analyzeLoops: (payload) => loopAnalysisService.analyze(payload)
    });

    const app = express();
    app.use(express.json());
    registerOntologyRoutes(app, ontologyController);
    registerOntologyProjectionRoutes(app, ontologyProjectionController);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve ontology projection smoke test server address');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await storage.close();
  });

  it('exposes seeded schema, object drilldown, subgraph roam, and structural loop analysis as one smoke path', async () => {
    const schemaResponse = await fetch(`${baseUrl}/api/ontology/schema`);
    expect(schemaResponse.status).toBe(200);

    const schemaPayload = await schemaResponse.json();
    expect(schemaPayload.objectTypes.map((item: { objectType: string }) => item.objectType)).toEqual([
      'Artifact',
      'Order',
      'Review'
    ]);

    const objectResponse = await fetch(`${baseUrl}/api/ontology/objects/Order/order-001`);
    expect(objectResponse.status).toBe(200);
    expect(await objectResponse.json()).toMatchObject({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview'
    });

    const subgraphResponse = await fetch(`${baseUrl}/api/ontology/projection/subgraph`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        objectType: 'Order',
        objectId: 'order-001',
        depth: 1
      })
    });
    expect(subgraphResponse.status).toBe(200);

    const subgraphPayload = await subgraphResponse.json();
    expect(subgraphPayload.focusNodeId).toBe('Order:order-001');
    expect(subgraphPayload.nodes.map((item: { id: string }) => item.id)).toEqual([
      'Artifact:artifact-001',
      'Order:order-001',
      'Review:review-001'
    ]);
    expect(subgraphPayload.edges.map((item: { id: string }) => item.id)).toEqual([
      'projection:Artifact:artifact-001:relatedOrder:Order:order-001',
      'projection:Order:order-001:review:Review:review-001',
      'projection:Review:review-001:subject:Order:order-001'
    ]);

    const loopResponse = await fetch(`${baseUrl}/api/ontology/projection/loops/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        subgraph: subgraphPayload
      })
    });
    expect(loopResponse.status).toBe(200);
    expect(await loopResponse.json()).toEqual({
      loops: [
        {
          loopId: 'loop:Order:order-001>Review:review-001',
          nodeIds: ['Order:order-001', 'Review:review-001'],
          edgeIds: [
            'projection:Order:order-001:review:Review:review-001',
            'projection:Review:review-001:subject:Order:order-001'
          ],
          length: 2,
          category: 'structural',
          confidence: 1
        }
      ]
    });
  });
});
