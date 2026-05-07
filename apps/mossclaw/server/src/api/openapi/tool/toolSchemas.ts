export const toolSchemas = {
  ToolError: {
    type: 'object',
    required: ['errorCode', 'description'],
    additionalProperties: false,
    properties: {
      errorCode: { type: 'string' },
      description: { type: 'string' }
    }
  },
  ToolExample: {
    type: 'object',
    required: ['input', 'output'],
    additionalProperties: false,
    properties: {
      input: { type: 'object', additionalProperties: true },
      output: { type: 'object', additionalProperties: true }
    }
  },
  ToolDescriptor: {
    type: 'object',
    required: ['name', 'category', 'description', 'inputSchema', 'outputSchema', 'errors'],
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      category: { type: 'string' },
      description: { type: 'string' },
      inputSchema: { type: 'object', additionalProperties: true },
      outputSchema: { type: 'object', additionalProperties: true },
      errors: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ToolError'
        }
      },
      examples: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ToolExample'
        }
      }
    }
  },
  ToolInvokeRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      arguments: {
        type: 'object',
        additionalProperties: true
      }
    }
  },
  ToolInvokeSuccess: {
    type: 'object',
    required: ['ok', 'toolName', 'result'],
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', const: true },
      toolName: { type: 'string' },
      result: {}
    }
  },
  ToolInvokeError: {
    type: 'object',
    required: ['ok', 'toolName', 'error', 'errorCode'],
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', const: false },
      toolName: { type: 'string' },
      error: { type: 'string' },
      errorCode: { type: 'string' }
    }
  },
  ToolInvokeResult: {
    oneOf: [
      { $ref: '#/components/schemas/ToolInvokeSuccess' },
      { $ref: '#/components/schemas/ToolInvokeError' }
    ]
  }
} as const;
