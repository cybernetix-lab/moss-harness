import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import type { ModelOptionDto } from '@mossclaw/shared';

interface ModelProfileDocument {
  profiles?: Record<string, { provider?: string; model?: string; description?: string }>;
}

export function extractModelOptions(documents: ModelProfileDocument[]): ModelOptionDto[] {
  const options = new Map<string, ModelOptionDto>();

  for (const document of documents) {
    for (const [profile, config] of Object.entries(document.profiles ?? {})) {
      if (!config.provider || !config.model) {
        continue;
      }

      const id = `${config.provider}:${config.model}`;
      if (!options.has(id)) {
        options.set(id, {
          id,
          provider: config.provider,
          model: config.model,
          profile,
          description: config.description,
        });
      }
    }
  }

  return Array.from(options.values());
}

export class ModelCatalogService {
  constructor(private readonly configPaths: string[]) {}

  async getModelOptions(): Promise<ModelOptionDto[]> {
    const documents = await Promise.all(
      this.configPaths.map(async (configPath) => {
        const content = await fs.readFile(configPath, 'utf8');
        return yaml.parse(content) as ModelProfileDocument;
      })
    );

    return extractModelOptions(documents);
  }
}

export function createDefaultModelCatalogService(): ModelCatalogService {
  const projectRoot = path.resolve(__dirname, '../../../../../');
  return new ModelCatalogService([
    path.join(projectRoot, 'configs/agents/models.yaml'),
    path.join(projectRoot, 'configs/orchestration/models.yaml'),
  ]);
}
