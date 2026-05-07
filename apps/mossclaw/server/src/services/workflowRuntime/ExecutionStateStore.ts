import type { WorkflowRunStateSnapshot } from '../../domain/repositories/IWorkflowRunRepository';
import type { RuntimeNodeState, RuntimeStepError } from './types';

type MutableWorkflowRunState = WorkflowRunStateSnapshot & {
  nodeStates: Record<string, RuntimeNodeState>;
};

const EMPTY_STATE: WorkflowRunStateSnapshot = {
  currentNodeIds: [],
  completedNodeIds: [],
  waitingNodeIds: [],
  nodeStates: {},
  variables: {}
};

export class ExecutionStateStore {
  private readonly runStates = new Map<string, MutableWorkflowRunState>();

  recordStepSuccess(runId: string, nodeId: string, output: Record<string, unknown>): void {
    const state = this.getOrCreateRunState(runId);
    const nodeState = this.getOrCreateNodeState(state, nodeId);

    nodeState.output = cloneRecord(output);
    nodeState.lastError = undefined;
    nodeState.waitingHandle = undefined;
    this.removeId(state.waitingNodeIds, nodeId);
    this.addUniqueId(state.completedNodeIds, nodeId);
  }

  recordStepFailure(runId: string, nodeId: string, code: string, message: string): void {
    const state = this.getOrCreateRunState(runId);
    const nodeState = this.getOrCreateNodeState(state, nodeId);

    nodeState.lastError = { code, message };
    nodeState.waitingHandle = undefined;
    this.removeId(state.waitingNodeIds, nodeId);
  }

  incrementRetry(runId: string, nodeId: string): number {
    const nodeState = this.getOrCreateNodeState(this.getOrCreateRunState(runId), nodeId);
    nodeState.retryCount += 1;
    return nodeState.retryCount;
  }

  markNodeWaiting(runId: string, nodeId: string, childTaskId: string): void {
    const state = this.getOrCreateRunState(runId);
    const nodeState = this.getOrCreateNodeState(state, nodeId);

    nodeState.waitingHandle = { childTaskId };
    this.addUniqueId(state.waitingNodeIds, nodeId);
  }

  getNodeOutput(runId: string, nodeId: string): Record<string, unknown> | undefined {
    const output = this.getNodeState(runId, nodeId)?.output;
    return output ? cloneRecord(output) : undefined;
  }

  getRetryCount(runId: string, nodeId: string): number {
    return this.getNodeState(runId, nodeId)?.retryCount ?? 0;
  }

  getLastError(runId: string, nodeId: string): RuntimeStepError | undefined {
    const error = this.getNodeState(runId, nodeId)?.lastError;
    return error ? { ...error } : undefined;
  }

  toSnapshot(runId: string): WorkflowRunStateSnapshot {
    return this.cloneRunState(this.getOrCreateRunState(runId));
  }

  hydrate(runId: string, snapshot: WorkflowRunStateSnapshot | Record<string, unknown>): void {
    const normalized = this.normalizeSnapshot(snapshot);
    this.runStates.set(runId, normalized);
  }

  private getNodeState(runId: string, nodeId: string): RuntimeNodeState | undefined {
    return this.runStates.get(runId)?.nodeStates[nodeId];
  }

  private getOrCreateRunState(runId: string): MutableWorkflowRunState {
    const existing = this.runStates.get(runId);
    if (existing) {
      return existing;
    }

    const created = this.normalizeSnapshot(EMPTY_STATE);
    this.runStates.set(runId, created);
    return created;
  }

  private getOrCreateNodeState(state: MutableWorkflowRunState, nodeId: string): RuntimeNodeState {
    const existing = state.nodeStates[nodeId];
    if (existing) {
      return existing;
    }

    const created: RuntimeNodeState = {
      retryCount: 0
    };
    state.nodeStates[nodeId] = created;
    return created;
  }

  private normalizeSnapshot(snapshot: WorkflowRunStateSnapshot | Record<string, unknown>): MutableWorkflowRunState {
    const baseState = isObject(snapshot) ? snapshot : {};
    const rawNodeStates = isObject(baseState.nodeStates) ? baseState.nodeStates : {};

    const nodeStates: Record<string, RuntimeNodeState> = {};
    for (const [nodeId, value] of Object.entries(rawNodeStates)) {
      const rawState = isObject(value) ? value : {};
      const output = isObject(rawState.output) ? cloneRecord(rawState.output) : undefined;
      const lastError = isObject(rawState.lastError)
        ? {
            code: typeof rawState.lastError.code === 'string' ? rawState.lastError.code : '',
            message: typeof rawState.lastError.message === 'string' ? rawState.lastError.message : ''
          }
        : undefined;
      const waitingHandle = isObject(rawState.waitingHandle)
        ? {
            childTaskId:
              typeof rawState.waitingHandle.childTaskId === 'string'
                ? rawState.waitingHandle.childTaskId
                : ''
          }
        : undefined;

      nodeStates[nodeId] = {
        retryCount: typeof rawState.retryCount === 'number' ? rawState.retryCount : 0,
        ...(output ? { output } : {}),
        ...(lastError ? { lastError } : {}),
        ...(waitingHandle?.childTaskId ? { waitingHandle } : {})
      };
    }

    return {
      currentNodeIds: toStringArray(baseState.currentNodeIds),
      completedNodeIds: toStringArray(baseState.completedNodeIds),
      waitingNodeIds: toStringArray(baseState.waitingNodeIds),
      nodeStates,
      variables: isObject(baseState.variables) ? cloneRecord(baseState.variables) : {}
    };
  }

  private cloneRunState(state: MutableWorkflowRunState): WorkflowRunStateSnapshot {
    return {
      currentNodeIds: [...state.currentNodeIds],
      completedNodeIds: [...state.completedNodeIds],
      waitingNodeIds: [...state.waitingNodeIds],
      nodeStates: cloneNodeStates(state.nodeStates),
      variables: cloneRecord(state.variables)
    };
  }

  private addUniqueId(collection: string[], value: string): void {
    if (!collection.includes(value)) {
      collection.push(value);
    }
  }

  private removeId(collection: string[], value: string): void {
    const index = collection.indexOf(value);
    if (index >= 0) {
      collection.splice(index, 1);
    }
  }
}

function cloneNodeStates(nodeStates: Record<string, RuntimeNodeState>): Record<string, unknown> {
  const cloned: Record<string, unknown> = {};

  for (const [nodeId, state] of Object.entries(nodeStates)) {
    cloned[nodeId] = {
      retryCount: state.retryCount,
      ...(state.output ? { output: cloneRecord(state.output) } : {}),
      ...(state.lastError ? { lastError: { ...state.lastError } } : {}),
      ...(state.waitingHandle ? { waitingHandle: { ...state.waitingHandle } } : {})
    };
  }

  return cloned;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
