export const ontologyPaths = {
    '/api/ontology/schema': {
      get: {
        tags: ['Ontology'],
        summary: 'Get ontology schema',
        responses: {
          '200': {
            description: 'Ontology schema payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OntologySchemaResponse'
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
    '/api/ontology/objects/{objectType}/{objectId}': {
      get: {
        tags: ['Ontology'],
        summary: 'Get one ontology object by type and id',
        parameters: [
          {
            name: 'objectType',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'objectId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Ontology object payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OntologyObject'
                }
              }
            }
          },
          '404': {
            description: 'Object not found',
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
    },
    '/api/ontology/query': {
      post: {
        tags: ['Ontology'],
        summary: 'Query ontology objects',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OntologyQueryRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Query result payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OntologyQueryResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid query payload',
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
    },
    '/api/ontology/ingest/preview': {
      post: {
        tags: ['Ontology Ingest'],
        summary: 'Preview ontology ingest result without persisting objects',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PreviewOntologyIngestRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Preview ingest result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PreviewOntologyIngestResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid ingest payload',
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
    },
    '/api/ontology/ingest/submit': {
      post: {
        tags: ['Ontology Ingest'],
        summary: 'Submit ontology ingest job',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PreviewOntologyIngestRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Submitted ingest job',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SubmitOntologyIngestResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid ingest payload',
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
    },
    '/api/ontology/ingest/jobs/{jobId}': {
      get: {
        tags: ['Ontology Ingest'],
        summary: 'Get ontology ingest job status',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Ontology ingest job',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetOntologyIngestJobResponse'
                }
              }
            }
          },
          '404': {
            description: 'Job not found',
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
    },
    '/api/ontology/ingest/jobs/{jobId}/report': {
      get: {
        tags: ['Ontology Ingest'],
        summary: 'Get ontology ingest job report',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Ontology ingest report',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetOntologyIngestReportResponse'
                }
              }
            }
          },
          '404': {
            description: 'Report not found',
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
