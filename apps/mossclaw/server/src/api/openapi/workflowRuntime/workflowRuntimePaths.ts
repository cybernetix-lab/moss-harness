export const workflowRuntimePaths = {
    '/api/workflow-runtime/runs': {
      post: {
        tags: ['Workflow Runtime'],
        summary: 'Start one workflow run',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WorkflowRuntimeStartRunRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Workflow runtime result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowRuntimeRunResult'
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
    '/api/workflow-runtime/runs/{runId}/resume': {
      post: {
        tags: ['Workflow Runtime'],
        summary: 'Resume one workflow run',
        parameters: [
          {
            name: 'runId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Workflow runtime result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowRuntimeRunResult'
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
    '/api/workflow-runtime/runs/{runId}/cancel': {
      post: {
        tags: ['Workflow Runtime'],
        summary: 'Cancel one workflow run',
        parameters: [
          {
            name: 'runId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Workflow runtime result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowRuntimeRunResult'
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
    '/api/workflow-runtime/runs/{runId}': {
      get: {
        tags: ['Workflow Runtime'],
        summary: 'Get one workflow run',
        parameters: [
          {
            name: 'runId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Workflow runtime result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowRuntimeRunResult'
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
    '/api/workflow-runtime/runs/{runId}/logs': {
      get: {
        tags: ['Workflow Runtime'],
        summary: 'Get workflow run logs',
        parameters: [
          {
            name: 'runId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Workflow run logs',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowRuntimeGetRunLogsResponse'
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
