import type { WorkflowNodeDto, WorkflowRunLogEventTypeDto } from '@mossclaw/shared';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowRunRecord, WorkflowRunStateSnapshot } from '../../domain/repositories/IWorkflowRunRepository';
import type { WorkflowExecutionLogInput } from '../../domain/repositories/IWorkflowExecutionLogRepository';
import { ExecutionStateStore } from './ExecutionStateStore';
import { RunPolicyGuard } from './RunPolicyGuard';
import { StepExecutorRegistry } from './StepExecutorRegistry';
import type { ExecutionTickResult, RuntimeExecutionContext, RuntimeStepResult } from './types';

const TERMINAL_STATUSES = new Set<WorkflowRunRecord['status']>(['cancelled', 'succeeded']);

export class ExecutionEngine {
  constructor(
    private readonly stepExecutorRegistry: StepExecutorRegistry,
    private readonly executionStateStore: ExecutionStateStore,
    private readonly runPolicyGuard: RunPolicyGuard
  ) {}

  async tick(run: WorkflowRunRecord): Promise<ExecutionTickResult> {
    if (TERMINAL_STATUSES.has(run.status)) {
      return {
        run,
        status: run.status,
        stateSnapshot: run.stateSnapshot,
        logs: []
      };
    }

    const policyResult = this.runPolicyGuard.assertRunAllowed(run.definitionSnapshot);
    if (!policyResult.ok) {
      return this.failRun(
        run,
        'POLICY_VIOLATION',
        policyResult.diagnostics[0]?.message ?? 'Workflow runtime policy rejected the run'
      );
    }

    this.executionStateStore.hydrate(run.runId, run.stateSnapshot);
    const logs: WorkflowExecutionLogInput[] = [];
    const mutableRun: WorkflowRunRecord = {
      ...run,
      status: 'running',
      startedAt: run.startedAt ?? new Date().toISOString()
    };

    while (true) {
      const snapshot = this.executionStateStore.toSnapshot(mutableRun.runId);
      const nextNode = this.getNextExecutableNode(mutableRun.definitionSnapshot.nodes, snapshot, mutableRun);

      if (!nextNode) {
        if (snapshot.waitingNodeIds.length > 0) {
          return this.finishTick(mutableRun, 'waiting', snapshot, logs);
        }

        if (snapshot.completedNodeIds.length === mutableRun.definitionSnapshot.nodes.length) {
          logs.push(this.createLog(mutableRun.runId, 'run_succeeded'));
          return this.finishTick(
            {
              ...mutableRun,
              completedAt: new Date().toISOString()
            },
            'succeeded',
            {
              ...snapshot,
              currentNodeIds: []
            },
            logs
          );
        }

        return this.failRun(
          mutableRun,
          'RUNTIME_INTERNAL_ERROR',
          'Workflow run has no executable nodes but did not reach a terminal state',
          logs
        );
      }

      const activeSnapshot = this.executionStateStore.toSnapshot(mutableRun.runId);
      activeSnapshot.currentNodeIds = [nextNode.nodeId];
      mutableRun.stateSnapshot = activeSnapshot;

      logs.push(this.createLog(mutableRun.runId, 'step_started', nextNode.nodeId, { stepId: nextNode.stepId }));

      let stepResult: RuntimeStepResult;
      try {
        const executor = this.stepExecutorRegistry.resolve(nextNode);
        stepResult = await executor.execute(nextNode, this.createExecutionContext(mutableRun, activeSnapshot));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Workflow step execution failed';
        return this.failNode(mutableRun, nextNode, 'UNSUPPORTED_EXECUTOR', message, logs);
      }

      if (stepResult.status === 'waiting') {
        this.executionStateStore.markNodeWaiting(
          mutableRun.runId,
          nextNode.nodeId,
          stepResult.handle.childTaskId
        );

        logs.push(
          this.createLog(mutableRun.runId, 'step_waiting', nextNode.nodeId, {
            stepId: nextNode.stepId,
            childTaskId: stepResult.handle.childTaskId
          })
        );

        return this.finishTick(
          mutableRun,
          'waiting',
          {
            ...this.executionStateStore.toSnapshot(mutableRun.runId),
            currentNodeIds: [nextNode.nodeId]
          },
          logs
        );
      }

      if (stepResult.status === 'failed') {
        return this.failNode(
          mutableRun,
          nextNode,
          stepResult.error.code,
          stepResult.error.message,
          logs
        );
      }

      this.executionStateStore.recordStepSuccess(
        mutableRun.runId,
        nextNode.nodeId,
        stepResult.output ?? {}
      );
      logs.push(
        this.createLog(mutableRun.runId, 'step_succeeded', nextNode.nodeId, {
          stepId: nextNode.stepId,
          output: stepResult.output ?? {}
        })
      );

      const updatedSnapshot = this.executionStateStore.toSnapshot(mutableRun.runId);
      updatedSnapshot.currentNodeIds = [];
      mutableRun.stateSnapshot = updatedSnapshot;
    }
  }

  private createExecutionContext(
    run: WorkflowRunRecord,
    stateSnapshot: WorkflowRunStateSnapshot
  ): RuntimeExecutionContext {
    return {
      runId: run.runId,
      workflow: run.definitionSnapshot,
      stateSnapshot,
      objectRefs: [],
      variables: stateSnapshot.variables
    };
  }

  private getNextExecutableNode(
    nodes: WorkflowNodeDto[],
    snapshot: WorkflowRunStateSnapshot,
    run: WorkflowRunRecord
  ): WorkflowNodeDto | undefined {
    if (snapshot.waitingNodeIds.length > 0) {
      return nodes.find((node) => snapshot.waitingNodeIds.includes(node.nodeId));
    }

    const completed = new Set(snapshot.completedNodeIds);
    const waiting = new Set(snapshot.waitingNodeIds);
    const incomingEdges = new Map<string, string[]>();

    for (const edge of run.definitionSnapshot.edges) {
      const parents = incomingEdges.get(edge.toNodeId) ?? [];
      parents.push(edge.fromNodeId);
      incomingEdges.set(edge.toNodeId, parents);
    }

    return nodes.find((node) => {
      if (completed.has(node.nodeId) || waiting.has(node.nodeId)) {
        return false;
      }

      const requiredParents = incomingEdges.get(node.nodeId) ?? [];
      return requiredParents.every((parentNodeId) => completed.has(parentNodeId));
    });
  }

  private failNode(
    run: WorkflowRunRecord,
    node: WorkflowNodeDto,
    code: string,
    message: string,
    logs: WorkflowExecutionLogInput[]
  ): ExecutionTickResult {
    this.executionStateStore.recordStepFailure(run.runId, node.nodeId, code, message);
    logs.push(
      this.createLog(run.runId, 'step_failed', node.nodeId, {
        stepId: node.stepId,
        errorCode: code,
        message
      })
    );

    return this.failRun(run, code, message, logs);
  }

  private failRun(
    run: WorkflowRunRecord,
    code: string,
    message: string,
    logs: WorkflowExecutionLogInput[] = []
  ): ExecutionTickResult {
    logs.push(
      this.createLog(run.runId, 'run_failed', undefined, {
        errorCode: code,
        message
      })
    );

    return this.finishTick(
      {
        ...run,
        completedAt: new Date().toISOString(),
        failureCode: code,
        failureMessage: message
      },
      'failed',
      {
        ...this.executionStateStore.toSnapshot(run.runId),
        currentNodeIds: []
      },
      logs
    );
  }

  private finishTick(
    run: WorkflowRunRecord,
    status: WorkflowRunRecord['status'],
    stateSnapshot: WorkflowRunStateSnapshot,
    logs: WorkflowExecutionLogInput[]
  ): ExecutionTickResult {
    const updatedRun: WorkflowRunRecord = {
      ...run,
      status,
      stateSnapshot
    };

    return {
      run: updatedRun,
      status,
      stateSnapshot,
      logs
    };
  }

  private createLog(
    runId: string,
    eventType: WorkflowRunLogEventTypeDto,
    nodeId?: string,
    payload: Record<string, unknown> = {}
  ): WorkflowExecutionLogInput {
    return {
      logId: uuidv4(),
      runId,
      ...(nodeId ? { nodeId } : {}),
      eventType,
      payload,
      createdAt: new Date().toISOString()
    };
  }
}
