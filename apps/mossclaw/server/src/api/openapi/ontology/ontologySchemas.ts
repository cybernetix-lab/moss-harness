const ontologyObjectCandidateSchema = {
  type: 'object',
  required: ['objectType', 'objectId', 'displayName', 'state', 'properties'],
  additionalProperties: false,
  properties: {
    objectType: { type: 'string' },
    objectId: { type: 'string' },
    displayName: { type: 'string' },
    state: { type: 'string' },
    properties: {
      $ref: '#/components/schemas/JsonObject'
    }
  }
} as const;

export const ontologySchemas = {
  OntologyPropertyType: {
    type: 'string',
    enum: ['string', 'number', 'boolean', 'datetime', 'enum']
  },
  OntologyScalarProperty: {
    type: 'object',
    required: ['name', 'required', 'type'],
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      required: { type: 'boolean' },
      type: {
        type: 'string',
        enum: ['string', 'number', 'boolean', 'datetime']
      }
    }
  },
  OntologyEnumProperty: {
    type: 'object',
    required: ['name', 'required', 'type', 'enumValues'],
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      required: { type: 'boolean' },
      type: { type: 'string', const: 'enum' },
      enumValues: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  },
  OntologyProperty: {
    oneOf: [
      { $ref: '#/components/schemas/OntologyScalarProperty' },
      { $ref: '#/components/schemas/OntologyEnumProperty' }
    ]
  },
  OntologyObjectType: {
    type: 'object',
    required: ['objectType', 'properties'],
    additionalProperties: false,
    properties: {
      objectType: { type: 'string' },
      description: { type: 'string' },
      properties: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OntologyProperty'
        }
      }
    }
  },
  OntologySchemaResponse: {
    type: 'object',
    required: ['objectTypes'],
    additionalProperties: false,
    properties: {
      objectTypes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OntologyObjectType'
        }
      }
    }
  },
  OntologyObject: ontologyObjectCandidateSchema,
  OntologyQueryRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      objectType: { type: 'string' },
      state: { type: 'string' }
    }
  },
  OntologyQueryResponse: {
    type: 'object',
    required: ['objects'],
    additionalProperties: false,
    properties: {
      objects: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OntologyObject'
        }
      }
    }
  },
  OntologyIngestSource: {
    type: 'object',
    required: ['kind'],
    additionalProperties: false,
    properties: {
      kind: {
        type: 'string',
        enum: ['json', 'csv', 'api', 'rdf']
      },
      uri: { type: 'string' },
      contentType: { type: 'string' },
      payload: {
        $ref: '#/components/schemas/JsonObject'
      },
      records: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/JsonObject'
        }
      }
    }
  },
  OntologyIngestObjectCandidate: ontologyObjectCandidateSchema,
  OntologyIngestOptions: {
    type: 'object',
    additionalProperties: false,
    properties: {
      dryRun: { type: 'boolean' },
      upsert: { type: 'boolean' }
    }
  },
  PreviewOntologyIngestRequest: {
    type: 'object',
    required: ['source', 'objects'],
    additionalProperties: false,
    properties: {
      source: {
        $ref: '#/components/schemas/OntologyIngestSource'
      },
      objects: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OntologyIngestObjectCandidate'
        }
      },
      options: {
        $ref: '#/components/schemas/OntologyIngestOptions'
      }
    }
  },
  OntologyIngestDiagnostic: {
    type: 'object',
    required: ['code', 'severity', 'message'],
    additionalProperties: false,
    properties: {
      code: { type: 'string' },
      severity: {
        type: 'string',
        enum: ['error', 'warning', 'info']
      },
      message: { type: 'string' },
      recordIndex: { type: 'integer' },
      field: { type: 'string' }
    }
  },
  OntologyIngestSummary: {
    type: 'object',
    required: [
      'totalRecords',
      'acceptedRecords',
      'rejectedRecords',
      'createdObjects',
      'updatedObjects',
      'skippedObjects'
    ],
    additionalProperties: false,
    properties: {
      totalRecords: { type: 'integer' },
      acceptedRecords: { type: 'integer' },
      rejectedRecords: { type: 'integer' },
      createdObjects: { type: 'integer' },
      updatedObjects: { type: 'integer' },
      skippedObjects: { type: 'integer' }
    }
  },
  OntologyIngestJob: {
    type: 'object',
    required: ['jobId', 'status', 'createdAt', 'source'],
    additionalProperties: false,
    properties: {
      jobId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled']
      },
      createdAt: { type: 'string', format: 'date-time' },
      startedAt: { type: 'string', format: 'date-time' },
      finishedAt: { type: 'string', format: 'date-time' },
      source: {
        $ref: '#/components/schemas/OntologyIngestSource'
      },
      summary: {
        $ref: '#/components/schemas/OntologyIngestSummary'
      }
    }
  },
  OntologyIngestReport: {
    type: 'object',
    required: ['dryRun', 'summary', 'diagnostics', 'sampleObjects'],
    additionalProperties: false,
    properties: {
      jobId: { type: 'string' },
      dryRun: { type: 'boolean' },
      summary: {
        $ref: '#/components/schemas/OntologyIngestSummary'
      },
      diagnostics: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OntologyIngestDiagnostic'
        }
      },
      sampleObjects: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/OntologyIngestObjectCandidate'
        }
      }
    }
  },
  PreviewOntologyIngestResponse: {
    type: 'object',
    required: ['ok', 'preview'],
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', const: true },
      preview: {
        $ref: '#/components/schemas/OntologyIngestReport'
      }
    }
  },
  SubmitOntologyIngestResponse: {
    type: 'object',
    required: ['ok', 'job'],
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', const: true },
      job: {
        $ref: '#/components/schemas/OntologyIngestJob'
      }
    }
  },
  GetOntologyIngestJobResponse: {
    type: 'object',
    required: ['job'],
    additionalProperties: false,
    properties: {
      job: {
        $ref: '#/components/schemas/OntologyIngestJob'
      }
    }
  },
  GetOntologyIngestReportResponse: {
    type: 'object',
    required: ['report'],
    additionalProperties: false,
    properties: {
      report: {
        $ref: '#/components/schemas/OntologyIngestReport'
      }
    }
  }
} as const;
