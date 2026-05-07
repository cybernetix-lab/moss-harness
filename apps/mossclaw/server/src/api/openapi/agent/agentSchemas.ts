const agentTypeSchema = {
  type: 'string',
  enum: [
    'planning',
    'plan_review',
    'execution',
    'evaluation',
    'research',
    'memory_management',
    'custom'
  ]
} as const;

const agentStatusSchema = {
  type: 'string',
  enum: ['IDLE', 'WORK', 'BUSY', 'OFFLINE']
} as const;

export const agentSchemas = {
  AgentModelConfig: {
    type: 'object',
    required: ['provider', 'modelName', 'temperature', 'maxTokens'],
    additionalProperties: false,
    properties: {
      provider: { type: 'string' },
      modelName: { type: 'string' },
      temperature: { type: 'number' },
      maxTokens: { type: 'integer' }
    }
  },
  CreateAgentRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      type: agentTypeSchema,
      description: { type: 'string' },
      systemPrompt: { type: 'string' },
      modelConfig: { $ref: '#/components/schemas/AgentModelConfig' },
      isBuiltin: { type: 'boolean' },
      isDisabled: { type: 'boolean' }
    }
  },
  UpdateAgentRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      type: agentTypeSchema,
      description: { type: 'string' },
      systemPrompt: { type: 'string' },
      modelConfig: { $ref: '#/components/schemas/AgentModelConfig' },
      status: agentStatusSchema,
      isBuiltin: { type: 'boolean' },
      isDisabled: { type: 'boolean' }
    }
  },
  Agent: {
    type: 'object',
    required: [
      'id',
      'name',
      'type',
      'description',
      'systemPrompt',
      'modelConfig',
      'status',
      'isBuiltin',
      'isDisabled',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: agentTypeSchema,
      description: { type: 'string' },
      systemPrompt: { type: 'string' },
      modelConfig: { $ref: '#/components/schemas/AgentModelConfig' },
      status: agentStatusSchema,
      isBuiltin: { type: 'boolean' },
      isDisabled: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  }
} as const;
