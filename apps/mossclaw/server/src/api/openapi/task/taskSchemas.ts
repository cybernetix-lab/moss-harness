export const taskSchemas = {
      TaskConfig: {
        type: 'object',
        required: ['entryAgentName'],
        properties: {
          entryAgentName: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          timeoutMinutes: { type: 'number' },
          selectedSkills: { type: 'array', items: { type: 'string' } },
          model: { type: 'string' },
          sandboxMode: { type: 'boolean' },
          context: { type: 'object', additionalProperties: true }
        }
      },
      CreateTaskRequest: {
        type: 'object',
        required: ['goal', 'config'],
        properties: {
          goal: { type: 'string' },
          config: { $ref: '#/components/schemas/TaskConfig' }
        }
      },
      TaskControlResponse: {
        type: 'object',
        required: ['retriedFromTaskId', 'newTaskId'],
        properties: {
          retriedFromTaskId: { type: 'string' },
          newTaskId: { type: 'string' }
        }
      },
      Task: {
        type: 'object',
        required: ['id', 'goal', 'status', 'config', 'stages', 'artifacts', 'events', 'metrics', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          goal: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
          config: { $ref: '#/components/schemas/TaskConfig' },
          stages: { type: 'array', items: { type: 'object', additionalProperties: true } },
          artifacts: { type: 'array', items: { type: 'object', additionalProperties: true } },
          events: { type: 'array', items: { type: 'object', additionalProperties: true } },
          metrics: { type: 'object', additionalProperties: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
} as const;
