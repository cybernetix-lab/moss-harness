import { describe, expect, it } from 'vitest';
import { WorkflowRuntimeBoundary } from './WorkflowRuntimeBoundary';

describe('WorkflowRuntimeBoundary', () => {
  it('returns INVALID_RUNTIME_REQUEST when workflow is missing', () => {
    const boundary = new WorkflowRuntimeBoundary();

    const result = boundary.normalizeStartRunRequest({});

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'INVALID_RUNTIME_REQUEST',
          message: 'Workflow runtime request must include a workflow definition'
        }
      ]
    });
  });

  it('returns normalized workflow and default context when request is valid', () => {
    const boundary = new WorkflowRuntimeBoundary();

    const result = boundary.normalizeStartRunRequest({
      workflow: {
        workflowId: 'wf-001',
        version: 'v1',
        goal: {
          title: 'Handle high risk order'
        },
        nodes: [],
        edges: []
      }
    });

    expect(result).toEqual({
      ok: true,
      value: {
        workflow: {
          workflowId: 'wf-001',
          version: 'v1',
          goal: {
            title: 'Handle high risk order'
          },
          nodes: [],
          edges: []
        },
        context: {
          objectRefs: [],
          variables: {}
        }
      }
    });
  });

  it('returns INVALID_RUN_TRANSITION when resuming a succeeded run', () => {
    const boundary = new WorkflowRuntimeBoundary();

    const result = boundary.assertResumeAllowed('succeeded');

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'INVALID_RUN_TRANSITION',
          message: 'Cannot resume workflow run from status "succeeded"'
        }
      ]
    });
  });

  it('allows resume only for failed and waiting runs', () => {
    const boundary = new WorkflowRuntimeBoundary();

    expect(boundary.assertResumeAllowed('failed')).toEqual({ ok: true });
    expect(boundary.assertResumeAllowed('waiting')).toEqual({ ok: true });
  });

  it('returns INVALID_RUN_TRANSITION when cancelling a terminal run', () => {
    const boundary = new WorkflowRuntimeBoundary();

    const result = boundary.assertCancelAllowed('cancelled');

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'INVALID_RUN_TRANSITION',
          message: 'Cannot cancel workflow run from status "cancelled"'
        }
      ]
    });
  });
});
