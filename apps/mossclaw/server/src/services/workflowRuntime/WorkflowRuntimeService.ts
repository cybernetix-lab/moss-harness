import type {
  WorkflowRunDto,
  WorkflowRunLogDto,
  WorkflowRunStatusDto,
  WorkflowRuntimeDiagnosticDto,
  WorkflowRuntimeGetRunLogsResponseDto,
  WorkflowRuntimeRunResultDto,
  WorkflowRuntimeStartRunRequestDto,
  WorkflowStepExecutionDto
} from '@mossclaw/shared';
import { v4 as uuidv4 } from 'uuid';
import type {
  IWorkflowRunRepository,
  PersistedWorkflowRunRecord,
  WorkflowRunRecord
} from '../../domain/repositories/IWorkflowRunRepository';
import type {
  IWorkflowExecutionLogRepository,
  WorkflowExecutionLogInput,
  WorkflowExecutionLogRecord
} from '../../domain/repositories/IWorkflowExecutionLogRepository';
import { WorkflowRuntimeBoundary } from './WorkflowRuntimeBoundary';

type ExecutionEngineLike = {
  tick(run: WorkflowRunRecord): Promise<{
    run: WorkflowRunRecord;
    status: WorkflowRunStatusDto;
    stateSnapshot: WorkflowRunRecord['stateSnapshot'];
    logs: WorkflowExecutionLogInput[];
  }>;
};

export class WorkflowRuntimeService {
  constructor(
    private readonly workflowRunRepository: IWorkflowRunRepository,
    private readonly workflowExecutionLogRepository: IWorkflowExecutionLogRepository,
    private readonly executionEngine: ExecutionEngineLike,
    private readonly workflowRuntimeBoundary = new WorkflowRuntimeBoundary(),
    private readonly runIdFactory: () => string = () => uuidv4()
  ) {}

  async startRun(payload: unknown): Promise<WorkflowRuntimeRunResultDto> {
    const normalized = this.workflowRuntimeBoundary.normalizeStartRunRequest(payload);
    if (!normalized.ok) {
      return {
        ok: true,
        accepted: false,
        run: null,
        diagnostics: normalized.diagnostics
      };
    }

    const run: WorkflowRunRecord = {
      runId: this.runIdFactory(),
      workflowId: normalized.value.workflow.workflowId,
      workflowVersion: normalized.value.workflow.version,
      status: 'created',
      definitionSnapshot: normalized.value.workflow,
      stateSnapshot: {
        currentNodeIds: [],
        completedNodeIds: [],
        waitingNodeIds: [],
        nodeStates: {},
        variables: normalized.value.context.variables
      },
      startedAt: null,
      completedAt: null
    };

    await this.workflowRunRepository.create(run);
    await this.workflowExecutionLogRepository.append(
      this.createLog(run.runId, 'run_created', undefined, {
        status: 'created'
      })
    );

    const tickResult = await this.executionEngine.tick(run);
    await this.persistTickResult(tickResult.run, tickResult.logs);

    return {
      ok: true,
      accepted: true,
      run: this.toRunDto(tickResult.run),
      diagnostics: []
    };
  }

  async resumeRun(runId: string): Promise<WorkflowRuntimeRunResultDto> {
    const persistedRun = await this.workflowRunRepository.getById(runId);
    if (!persistedRun) {
      return this.reject('Workflow run not found');
    }

    const transition = this.workflowRuntimeBoundary.assertResumeAllowed(persistedRun.status);
    if (!transition.ok) {
      return {
        ok: true,
        accepted: false,
        run: null,
        diagnostics: transition.diagnostics
      };
    }

    await this.workflowExecutionLogRepository.append(
      this.createLog(runId, 'run_resumed', undefined, {
        fromStatus: persistedRun.status
      })
    );

    const tickResult = await this.executionEngine.tick(this.toWorkflowRunRecord(persistedRun));
    await this.persistTickResult(tickResult.run, tickResult.logs);

    return {
      ok: true,
      accepted: true,
      run: this.toRunDto(tickResult.run),
      diagnostics: []
    };
  }

  async cancelRun(runId: string): Promise<WorkflowRuntimeRunResultDto> {
    const persistedRun = await this.workflowRunRepository.getById(runId);
    if (!persistedRun) {
      return this.reject('Workflow run not found');
    }

    const transition = this.workflowRuntimeBoundary.assertCancelAllowed(persistedRun.status);
    if (!transition.ok) {
      return {
        ok: true,
        accepted: false,
        run: null,
        diagnostics: transition.diagnostics
      };
    }

    const cancelledRun: WorkflowRunRecord = {
      ...this.toWorkflowRunRecord(persistedRun),
      status: 'cancelled',
      completedAt: new Date().toISOString(),
      stateSnapshot: {
        ...persistedRun.stateSnapshot,
        currentNodeIds: []
      }
    };

    await this.workflowRunRepository.update(cancelledRun);
    await this.workflowExecutionLogRepository.append(
      this.createLog(runId, 'run_cancelled', undefined, {
        fromStatus: persistedRun.status
      })
    );

    return {
      ok: true,
      accepted: true,
      run: this.toRunDto(cancelledRun),
      diagnostics: []
    };
  }

  async getRun(runId: string): Promise<WorkflowRuntimeRunResultDto> {
    const persistedRun = await this.workflowRunRepository.getById(runId);
    if (!persistedRun) {
      return this.reject('Workflow run not found');
    }

    return {
      ok: true,
      accepted: true,
      run: this.toRunDto(this.toWorkflowRunRecord(persistedRun)),
      diagnostics: []
    };
  }

  async getRunLogs(runId: string): Promise<WorkflowRuntimeGetRunLogsResponseDto> {
    const logs = await this.workflowExecutionLogRepository.findByRunId(runId);
    return {
      ok: true,
      logs: logs.map((log) => this.toRunLogDto(log))
    };
  }

  private async persistTickResult(run: WorkflowRunRecord, logs: WorkflowExecutionLogInput[]): Promise<void> {
    await this.workflowRunRepository.update(run);
    for (const log of logs) {
      await this.workflowExecutionLogRepository.append(log);
    }
  }

  private reject(message: string): WorkflowRuntimeRunResultDto {
    return {
      ok: true,
      accepted: false,
      run: null,
      diagnostics: [this.workflowRuntimeBoundary.createInvalidRuntimeRequestDiagnostic(message)]
    };
  }

  private toRunDto(run: WorkflowRunRecord): WorkflowRunDto {
    return {
      runId: run.runId,
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      currentNodeIds: [...run.stateSnapshot.currentNodeIds],
      lastCompletedNodeIds: [...run.stateSnapshot.completedNodeIds],
      ...(run.failureCode ? { failureCode: run.failureCode } : {}),
      ...(run.failureMessage ? { failureMessage: run.failureMessage } : {}),
      steps: run.definitionSnapshot.nodes.map((node) => this.toStepExecutionDto(run, node))
    };
  }

  private toStepExecutionDto(
    run: WorkflowRunRecord,
    node: WorkflowRunRecord['definitionSnapshot']['nodes'][number]
  ): WorkflowStepExecutionDto {
    const rawNodeState = run.stateSnapshot.nodeStates[node.nodeId];
    const nodeState = isRecord(rawNodeState) ? rawNodeState : {};
    const retryCount = typeof nodeState.retryCount === 'number' ? nodeState.retryCount : 0;
    const output = isRecord(nodeState.output) ? nodeState.output : undefined;
    const lastError = isRecord(nodeState.lastError) ? nodeState.lastError : undefined;

    let status: WorkflowStepExecutionDto['status'] = 'pending';
    if (run.stateSnapshot.completedNodeIds.includes(node.nodeId)) {
      status = 'succeeded';
    } else if (run.stateSnapshot.waitingNodeIds.includes(node.nodeId)) {
      status = 'waiting';
    } else if (lastError) {
      status = 'failed';
    } else if (run.stateSnapshot.currentNodeIds.includes(node.nodeId)) {
      status = 'running';
    } else if (run.status === 'cancelled') {
      status = 'cancelled';
    }

    const completedAt =
      status === 'succeeded' || status === 'failed' || status === 'cancelled'
        ? run.completedAt
        : null;

    return {
      nodeId: node.nodeId,
      stepId: node.stepId,
      actionId: node.actionId,
      executionKind: node.executionKind,
      status,
      attempt: retryCount + 1,
      startedAt: null,
      completedAt,
      ...(output ? { output } : {}),
      ...(typeof lastError?.code === 'string' ? { errorCode: lastError.code } : {})
    };
  }

  private toRunLogDto(log: WorkflowExecutionLogRecord): WorkflowRunLogDto {
    return {
      logId: log.logId,
      runId: log.runId,
      ...(log.nodeId ? { nodeId: log.nodeId } : {}),
      eventType: log.eventType,
      timestamp: log.createdAt.toISOString(),
      payload: { ...log.payload }
    };
  }

  private toWorkflowRunRecord(run: PersistedWorkflowRunRecord): WorkflowRunRecord {
    return {
      ...run,
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null
    };
  }

  private createLog(
    runId: string,
    eventType: WorkflowExecutionLogInput['eventType'],
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

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
