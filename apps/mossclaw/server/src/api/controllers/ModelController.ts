import type { Request, Response } from 'express';
import { ModelCatalogService } from '../../services/ModelCatalogService';

export class ModelController {
  constructor(private readonly modelCatalogService: ModelCatalogService) {}

  async getModels(_req: Request, res: Response) {
    try {
      const models = await this.modelCatalogService.getModelOptions();
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: String(error?.message ?? 'Failed to load model options') });
    }
  }
}
