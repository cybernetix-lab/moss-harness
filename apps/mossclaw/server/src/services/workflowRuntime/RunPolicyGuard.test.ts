import { describe, expect, it } from 'vitest';
import { RunPolicyGuard } from './RunPolicyGuard';

describe('RunPolicyGuard', () => {
  it('rejects nodes that request unsupported execution kinds', () => {
    const guard = new RunPolicyGuard();

    const result = guard.assertNodeAllowed({
      nodeId: 'node-1',
      stepId: 'step-1',
      actionId: 'review.order',
      title: 'Review order',
      executionKind: 'raw_http' as never
    });

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'POLICY_VIOLATION',
          message: 'Workflow node "node-1" requests unsupported execution kind "raw_http"'
        }
      ]
    });
  });

  it('rejects workflows that exceed the configured node limit', () => {
    const guard = new RunPolicyGuard({ maxNodeCount: 1 });

    const result = guard.assertRunAllowed({
      workflowId: 'wf-001',
      version: 'v1',
      goal: {
        title: 'Handle high risk order'
      },
      nodes: [
        {
          nodeId: 'node-1',
          stepId: 'step-1',
          actionId: 'review.order',
          title: 'Review order',
          executionKind: 'tool_gateway'
        },
        {
          nodeId: 'node-2',
          stepId: 'step-2',
          actionId: 'notify.owner',
          title: 'Notify owner',
          executionKind: 'tool_gateway'
        }
      ],
      edges: []
    });

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'POLICY_VIOLATION',
          message: 'Workflow "wf-001" exceeds the maximum allowed node count of 1'
        }
      ]
    });
  });

  it('accepts valid workflow nodes and definitions', () => {
    const guard = new RunPolicyGuard();

    expect(
      guard.assertNodeAllowed({
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'review.order',
        title: 'Review order',
        executionKind: 'tool_gateway'
      })
    ).toEqual({ ok: true });

    expect(
      guard.assertRunAllowed({
        workflowId: 'wf-001',
        version: 'v1',
        goal: {
          title: 'Handle high risk order'
        },
        nodes: [
          {
            nodeId: 'node-1',
            stepId: 'step-1',
            actionId: 'review.order',
            title: 'Review order',
            executionKind: 'tool_gateway'
          }
        ],
        edges: []
      })
    ).toEqual({ ok: true });
  });
});
