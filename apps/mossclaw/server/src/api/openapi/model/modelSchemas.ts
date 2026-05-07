export const modelSchemas = {
      ModelOption: {
        type: 'object',
        required: ['id', 'provider', 'model'],
        properties: {
          id: { type: 'string' },
          provider: { type: 'string' },
          model: { type: 'string' },
          profile: { type: 'string' },
          description: { type: 'string' }
        }
      }
} as const;
