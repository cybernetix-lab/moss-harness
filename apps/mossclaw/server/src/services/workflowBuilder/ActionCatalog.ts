import type { WorkflowPlanStepDto } from '@mossclaw/shared';

export interface WorkflowActionDefinition {
  actionId: string;
  name: string;
  description: string;
  capabilityTags: string[];
  inputHints: string[];
  outputHints: string[];
}

export type WorkflowActionMatchResult =
  | {
      kind: 'matched';
      action: WorkflowActionDefinition;
      candidates: WorkflowActionDefinition[];
    }
  | {
      kind: 'no_match';
      candidates: WorkflowActionDefinition[];
    }
  | {
      kind: 'ambiguous';
      candidates: WorkflowActionDefinition[];
    };

const DEFAULT_ACTIONS: ReadonlyArray<WorkflowActionDefinition> = Object.freeze([
  {
    actionId: 'ontology.query',
    name: 'ontology.query',
    description: 'Query ontology objects by filters',
    capabilityTags: ['ontology', 'query', 'search'],
    inputHints: ['objectType', 'state'],
    outputHints: ['objects']
  },
  {
    actionId: 'ontology.get_object',
    name: 'ontology.get_object',
    description: 'Load a single ontology object',
    capabilityTags: ['ontology', 'lookup', 'detail'],
    inputHints: ['objectType', 'objectId'],
    outputHints: ['object']
  },
  {
    actionId: 'risk.review',
    name: 'risk.review',
    description: 'Review risk signals from an existing working set',
    capabilityTags: ['risk', 'review', 'analyze'],
    inputHints: ['objects'],
    outputHints: ['riskSummary']
  },
  {
    actionId: 'risk.summarize',
    name: 'risk.summarize',
    description: 'Summarize risk signals for human review',
    capabilityTags: ['risk', 'summarize', 'analyze'],
    inputHints: ['objects'],
    outputHints: ['summary']
  }
]);

export class ActionCatalog {
  list(): WorkflowActionDefinition[] {
    return DEFAULT_ACTIONS.map((action) => cloneAction(action));
  }

  resolveStep(
    step: Pick<WorkflowPlanStepDto, 'stepId' | 'title' | 'capabilityTags'>
  ): WorkflowActionMatchResult {
    const requestedTags = new Set((step.capabilityTags ?? []).map((tag) => tag.trim().toLowerCase()));
    const candidates = DEFAULT_ACTIONS.filter((action) =>
      action.capabilityTags.some((tag) => requestedTags.has(tag.toLowerCase()))
    ).map((action) => cloneAction(action));

    if (candidates.length === 0) {
      return {
        kind: 'no_match',
        candidates
      };
    }

    if (candidates.length > 1) {
      return {
        kind: 'ambiguous',
        candidates
      };
    }

    return {
      kind: 'matched',
      action: candidates[0],
      candidates
    };
  }
}

function cloneAction(action: WorkflowActionDefinition): WorkflowActionDefinition {
  return {
    ...action,
    capabilityTags: [...action.capabilityTags],
    inputHints: [...action.inputHints],
    outputHints: [...action.outputHints]
  };
}
