import { describe, expect, it } from 'vitest';
import { WorkflowBuilderService } from './WorkflowBuilderService';

describe('WorkflowBuilderService', () => {
  it('validatePlan returns normalized payload with diagnostics', () => {
    const service = new WorkflowBuilderService();

    const result = service.validatePlan({
      goal: {
        title: '  Review pending orders  '
      },
      plan: {
        steps: [
          {
            stepId: '  step-1  ',
            title: '  Find pending orders  ',
            capabilityTags: [' query ']
          }
        ]
      }
    });

    expect(result).toEqual({
      ok: true,
      normalizedGoal: {
        title: 'Review pending orders'
      },
      normalizedPlan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders',
            capabilityTags: ['query']
          }
        ]
      },
      diagnostics: []
    });
  });

  it('compilePlan returns accepted workflow when each step maps to exactly one action', () => {
    const service = new WorkflowBuilderService();

    const result = service.compilePlan({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders',
            capabilityTags: ['query'],
            context: {
              objectType: 'Order',
              state: 'PendingReview'
            }
          },
          {
            stepId: 'step-2',
            title: 'Fetch order detail',
            capabilityTags: ['lookup'],
            context: {
              objectType: 'Order',
              objectId: 'order-001'
            }
          }
        ]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.workflow).toEqual({
      workflowId: 'wf-review-pending-orders',
      version: 'v1',
      goal: {
        title: 'Review pending orders'
      },
      nodes: [
        {
          nodeId: 'node-step-1',
          stepId: 'step-1',
          actionId: 'ontology.query',
          title: 'Find pending orders',
          executionKind: 'tool_gateway',
          executionTarget: 'ontology.query',
          inputs: {
            objectType: 'Order',
            state: 'PendingReview'
          }
        },
        {
          nodeId: 'node-step-2',
          stepId: 'step-2',
          actionId: 'ontology.get_object',
          title: 'Fetch order detail',
          executionKind: 'tool_gateway',
          executionTarget: 'ontology.get_object',
          inputs: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      ],
      edges: [
        {
          edgeId: 'edge-step-1-step-2',
          fromNodeId: 'node-step-1',
          toNodeId: 'node-step-2',
          type: 'sequence'
        }
      ]
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('compilePlan returns accepted=false with diagnostics for no-match and ambiguous steps', () => {
    const service = new WorkflowBuilderService();

    const result = service.compilePlan({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Send a Slack message',
            capabilityTags: ['notify']
          },
          {
            stepId: 'step-2',
            title: 'Analyze risk signals',
            capabilityTags: ['risk', 'analyze']
          }
        ]
      },
      options: {
        preserveDiagnostics: true
      }
    });

    expect(result).toEqual({
      ok: true,
      accepted: false,
      diagnostics: [
        {
          code: 'NO_ELIGIBLE_ACTION',
          severity: 'error',
          message: 'No eligible action matched workflow step "Send a Slack message"',
          stepId: 'step-1'
        },
        {
          code: 'AMBIGUOUS_ACTION_MATCH',
          severity: 'error',
          message: 'Multiple actions matched workflow step "Analyze risk signals"',
          stepId: 'step-2',
          actionCandidates: [
            {
              actionId: 'risk.review',
              name: 'risk.review',
              reason: 'Capability tags matched'
            },
            {
              actionId: 'risk.summarize',
              name: 'risk.summarize',
              reason: 'Capability tags matched'
            }
          ]
        }
      ]
    });
  });

  it('simulatePlan returns preview only and does not execute runtime behavior', () => {
    const service = new WorkflowBuilderService();

    const result = service.simulatePlan({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders',
            capabilityTags: ['query']
          },
          {
            stepId: 'step-2',
            title: 'Analyze risk signals',
            capabilityTags: ['risk', 'analyze']
          }
        ]
      }
    });

    expect(result).toEqual({
      ok: true,
      preview: {
        nodeCount: 1,
        edgeCount: 0,
        actionIds: ['ontology.query']
      },
      diagnostics: [
        {
          code: 'AMBIGUOUS_ACTION_MATCH',
          severity: 'error',
          message: 'Multiple actions matched workflow step "Analyze risk signals"',
          stepId: 'step-2',
          actionCandidates: [
            {
              actionId: 'risk.review',
              name: 'risk.review',
              reason: 'Capability tags matched'
            },
            {
              actionId: 'risk.summarize',
              name: 'risk.summarize',
              reason: 'Capability tags matched'
            }
          ]
        }
      ]
    });
  });
});
