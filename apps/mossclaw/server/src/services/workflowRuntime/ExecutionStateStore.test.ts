import { describe, expect, it } from 'vitest';
import { ExecutionStateStore } from './ExecutionStateStore';

describe('ExecutionStateStore', () => {
  it('tracks step outputs and retry counts per run', () => {
    const store = new ExecutionStateStore();

    store.recordStepSuccess('run-001', 'node-1', { orderId: 'o-1' });
    store.incrementRetry('run-001', 'node-1');
    store.incrementRetry('run-001', 'node-1');

    expect(store.getNodeOutput('run-001', 'node-1')).toEqual({ orderId: 'o-1' });
    expect(store.getRetryCount('run-001', 'node-1')).toBe(2);
  });

  it('tracks the last error per node', () => {
    const store = new ExecutionStateStore();

    store.recordStepFailure('run-001', 'node-2', 'STEP_TIMEOUT', 'executor timed out');

    expect(store.getLastError('run-001', 'node-2')).toEqual({
      code: 'STEP_TIMEOUT',
      message: 'executor timed out'
    });
  });

  it('serializes and hydrates snapshots for recovery', () => {
    const store = new ExecutionStateStore();

    store.recordStepSuccess('run-001', 'node-1', { orderId: 'o-1' });
    store.incrementRetry('run-001', 'node-1');
    store.markNodeWaiting('run-001', 'node-2', 'child-task-001');

    const snapshot = store.toSnapshot('run-001');
    const recovered = new ExecutionStateStore();
    recovered.hydrate('run-001', snapshot);

    expect(recovered.toSnapshot('run-001')).toEqual(snapshot);
  });
});
