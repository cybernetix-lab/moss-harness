import type {
  WorkflowDefinitionDto,
  WorkflowNodeDto,
  WorkflowRuntimeDiagnosticDto
} from '@mossclaw/shared';

type GuardAcceptResult = {
  ok: true;
};

type GuardRejectResult = {
  ok: false;
  diagnostics: WorkflowRuntimeDiagnosticDto[];
};

export interface RunPolicyGuardOptions {
  maxNodeCount?: number;
}

const DEFAULT_MAX_NODE_COUNT = 50;
const SUPPORTED_EXECUTION_KINDS = new Set<WorkflowNodeDto['executionKind']>([
  'tool_gateway',
  'subagent_task'
]);

export class RunPolicyGuard {
  private readonly maxNodeCount: number;

  constructor(options: RunPolicyGuardOptions = {}) {
    this.maxNodeCount = options.maxNodeCount ?? DEFAULT_MAX_NODE_COUNT;
  }

  assertRunAllowed(workflow: WorkflowDefinitionDto): GuardAcceptResult | GuardRejectResult {
    if (workflow.nodes.length > this.maxNodeCount) {
      return {
        ok: false,
        diagnostics: [
          this.createPolicyViolationDiagnostic(
            `Workflow "${workflow.workflowId}" exceeds the maximum allowed node count of ${this.maxNodeCount}`
          )
        ]
      };
    }

    for (const node of workflow.nodes) {
      const result = this.assertNodeAllowed(node);
      if (!result.ok) {
        return result;
      }
    }

    return { ok: true };
  }

  assertNodeAllowed(node: WorkflowNodeDto): GuardAcceptResult | GuardRejectResult {
    if (!SUPPORTED_EXECUTION_KINDS.has(node.executionKind)) {
      return {
        ok: false,
        diagnostics: [
          this.createPolicyViolationDiagnostic(
            `Workflow node "${node.nodeId}" requests unsupported execution kind "${node.executionKind}"`
          )
        ]
      };
    }

    return { ok: true };
  }

  private createPolicyViolationDiagnostic(message: string): WorkflowRuntimeDiagnosticDto {
    return {
      code: 'POLICY_VIOLATION',
      message
    };
  }
}
