const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  additionalProperties: false,
  properties: {
    error: {
      type: 'string'
    }
  }
} as const;

const jsonObjectSchema = {
  type: 'object',
  additionalProperties: {
    $ref: '#/components/schemas/JsonValue'
  }
} as const;

const jsonArraySchema = {
  type: 'array',
  items: {
    $ref: '#/components/schemas/JsonValue'
  }
} as const;

const jsonValueSchema = {
  oneOf: [
    { $ref: '#/components/schemas/JsonObject' },
    { $ref: '#/components/schemas/JsonArray' },
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'null' }
  ]
} as const;

export const commonSchemas = {
  ErrorResponse: errorResponseSchema,
  JsonObject: jsonObjectSchema,
  JsonArray: jsonArraySchema,
  JsonValue: jsonValueSchema
} as const;
