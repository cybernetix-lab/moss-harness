export const toolPaths = {
    '/api/tools': {
      get: {
        tags: ['Tool Gateway'],
        summary: 'List available tools',
        responses: {
          '200': {
            description: 'Tool directory',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ToolDescriptor'
                  }
                }
              }
            }
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/tools/{toolName}/invoke': {
      post: {
        tags: ['Tool Gateway'],
        summary: 'Invoke one tool',
        parameters: [
          {
            name: 'toolName',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ToolInvokeRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Tool invocation result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ToolInvokeResult'
                }
              }
            }
          },
          '400': {
            description: 'Invalid invocation payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    }
} as const;
