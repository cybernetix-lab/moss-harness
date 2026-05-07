export const workflowRuntimeSchemas = {
  WorkflowRunStatus: {
    type: 'string',
    enum: ['created', 'ready', 'running', 'waiting', 'failed', 'succeeded', 'cancelled']
  },
  WorkflowStepExecutionStatus: {
    type: 'string',
    enum: ['pending', 'running', 'waiting', 'failed', 'succeeded', 'cancelled']
  },
  WorkflowExecutionKind: {
    type: 'string',
    enum: ['tool_gateway', 'subagent_task']
  },
  WorkflowRunLogEventType: {
    type: 'string',
    enum: [
      'run_created',
      'run_started',
      'step_started',
      'step_waiting',
      'step_succeeded',
      'step_failed',
      'step_cancelled',
      'run_failed',
      'run_succeeded',
      'run_cancelled',
      'run_resumed'
    ]
  },
  WorkflowRuntimeDiagnostic: {
    type: 'object',
    required: ['code', 'message'],
    additionalProperties: false,
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      nodeId: { type: 'string' },
      retryable: { type: 'boolean' }
    }
  },
  WorkflowObjectRef: {
    type: 'object',
    required: ['objectType', 'objectId'],
    additionalProperties: false,
    properties: {
      objectType: { type: 'string' },
      objectId: { type: 'string' }
    }
  },
  WorkflowGoalRef: {
    type: 'object',
    required: ['title'],
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      objective: { type: 'string' },
      objectType: { type: 'string' },
      objectId: { type: 'string' },
      context: {
        $ref: '#/components/schemas/JsonObject'
      }
    }
  },
  WorkflowNode: {
    type: 'object',
    required: ['nodeId', 'stepId', 'actionId', 'title', 'executionKind'],
    additionalProperties: false,
    properties: {
      nodeId: { type: 'string' },
      stepId: { type: 'string' },
      actionId: { type: 'string' },
      title: { type: 'string' },
      executionKind: { $ref: '#/components/schemas/WorkflowExecutionKind' },
      executionTarget: { type: 'string' },
      inputs: {
        $ref: '#/components/schemas/JsonObject'
      }
    }
  },
  WorkflowEdge: {
    type: 'object',
    required: ['edgeId', 'fromNodeId', 'toNodeId', 'type'],
    additionalProperties: false,
    properties: {
      edgeId: { type: 'string' },
      fromNodeId: { type: 'string' },
      toNodeId: { type: 'string' },
      type: { type: 'string', const: 'sequence' }
    }
  },
  WorkflowDefinition: {
    type: 'object',
    required: ['workflowId', 'version', 'goal', 'nodes', 'edges'],
    additionalProperties: false,
    properties: {
      workflowId: { type: 'string' },
      version: { type: 'string' },
      goal: { $ref: '#/components/schemas/WorkflowGoalRef' },
      nodes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkflowNode'
        }
      },
      edges: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkflowEdge'
        }
      }
    }
  },
  WorkflowRuntimeContext: {
    type: 'object',
    additionalProperties: false,
    properties: {
      goal: { $ref: '#/components/schemas/WorkflowGoalRef' },
      objectRefs: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkflowObjectRef'
        }
      },
      variables: {
        $ref: '#/components/schemas/JsonObject'
      }
    }
  },
  WorkflowRuntimeStartRunRequest: {
    type: 'object',
    required: ['workflow'],
    additionalProperties: false,
    properties: {
      workflow: {
        $ref: '#/components/schemas/WorkflowDefinition'
      },
      context: {
        $ref: '#/components/schemas/WorkflowRuntimeContext'
      }
    }
  },
  WorkflowStepExecution: {
    type: 'object',
    required: [
      'nodeId',
      'stepId',
      'actionId',
      'executionKind',
      'status',
      'attempt',
      'startedAt',
      'completedAt'
    ],
    additionalProperties: false,
    properties: {
      nodeId: { type: 'string' },
      stepId: { type: 'string' },
      actionId: { type: 'string' },
      executionKind: {
        $ref: '#/components/schemas/WorkflowExecutionKind'
      },
      status: {
        $ref: '#/components/schemas/WorkflowStepExecutionStatus'
      },
      attempt: { type: 'integer' },
      startedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      output: {
        $ref: '#/components/schemas/JsonObject'
      },
      errorCode: { type: 'string' }
    }
  },
  WorkflowRun: {
    type: 'object',
    required: [
      'runId',
      'workflowId',
      'workflowVersion',
      'status',
      'startedAt',
      'completedAt',
      'currentNodeIds',
      'lastCompletedNodeIds',
      'steps'
    ],
    additionalProperties: false,
    properties: {
      runId: { type: 'string' },
      workflowId: { type: 'string' },
      workflowVersion: { type: 'string' },
      status: {
        $ref: '#/components/schemas/WorkflowRunStatus'
      },
      startedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      currentNodeIds: {
        type: 'array',
        items: { type: 'string' }
      },
      lastCompletedNodeIds: {
        type: 'array',
        items: { type: 'string' }
      },
      failureCode: { type: 'string' },
      failureMessage: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkflowStepExecution'
        }
      }
    }
  },
  WorkflowRunLog: {
    type: 'object',
    required: ['logId', 'runId', 'eventType', 'timestamp', 'payload'],
    additionalProperties: false,
    properties: {
      logId: { type: 'string' },
      runId: { type: 'string' },
      nodeId: { type: 'string' },
      eventType: {
        $ref: '#/components/schemas/WorkflowRunLogEventType'
      },
      timestamp: { type: 'string', format: 'date-time' },
      payload: {
        $ref: '#/components/schemas/JsonObject'
      }
    }
  },
  WorkflowRuntimeGetRunLogsResponse: {
    type: 'object',
    required: ['ok', 'logs'],
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', const: true },
      logs: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkflowRunLog'
        }
      }
    }
  },
  WorkflowRuntimeRunResult: {
    type: 'object',
    required: ['ok', 'accepted', 'run', 'diagnostics'],
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean' },
      accepted: { type: 'boolean' },
      run: {
        oneOf: [
          { $ref: '#/components/schemas/WorkflowRun' },
          { type: 'null' }
        ]
      },
      diagnostics: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkflowRuntimeDiagnostic'
        }
      }
    }
  }
} as const;
