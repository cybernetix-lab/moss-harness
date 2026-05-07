export const modelPaths = {
  '/api/models': {
    get: {
      tags: ['Model'],
      summary: 'List model options',
      responses: {
        '200': {
          description: 'Model options',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ModelOption'
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
  }
} as const;
