import { describe, expect, it } from 'vitest';
import { extractModelOptions } from './ModelCatalogService';

describe('ModelCatalogService', () => {
  it('extracts unique model options from profile config', () => {
    const options = extractModelOptions([
      {
        profiles: {
          balanced: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
            description: 'Balanced model',
          },
          fast: {
            provider: 'anthropic',
            model: 'claude-3-haiku',
            description: 'Fast model',
          },
        },
      },
      {
        profiles: {
          balanced: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
            description: 'Balanced model',
          },
          economical: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            description: 'Cheap model',
          },
        },
      },
    ]);

    expect(options).toEqual([
      {
        id: 'anthropic:claude-3-5-sonnet',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        profile: 'balanced',
        description: 'Balanced model',
      },
      {
        id: 'anthropic:claude-3-haiku',
        provider: 'anthropic',
        model: 'claude-3-haiku',
        profile: 'fast',
        description: 'Fast model',
      },
      {
        id: 'openai:gpt-3.5-turbo',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        profile: 'economical',
        description: 'Cheap model',
      },
    ]);
  });
});
