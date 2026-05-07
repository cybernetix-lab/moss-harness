import { describe, expect, it } from 'vitest';
import { ActionCatalog } from './ActionCatalog';

describe('ActionCatalog', () => {
  it('returns a stable in-memory action list', () => {
    const catalog = new ActionCatalog();

    expect(catalog.list()).toEqual([
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
  });

  it('matches a step to one eligible action when capability tags are specific enough', () => {
    const catalog = new ActionCatalog();

    const result = catalog.resolveStep({
      stepId: 'step-1',
      title: 'Find pending orders',
      capabilityTags: ['query']
    });

    expect(result).toEqual({
      kind: 'matched',
      action: {
        actionId: 'ontology.query',
        name: 'ontology.query',
        description: 'Query ontology objects by filters',
        capabilityTags: ['ontology', 'query', 'search'],
        inputHints: ['objectType', 'state'],
        outputHints: ['objects']
      },
      candidates: [
        {
          actionId: 'ontology.query',
          name: 'ontology.query',
          description: 'Query ontology objects by filters',
          capabilityTags: ['ontology', 'query', 'search'],
          inputHints: ['objectType', 'state'],
          outputHints: ['objects']
        }
      ]
    });
  });

  it('returns no_match when a step has no eligible actions', () => {
    const catalog = new ActionCatalog();

    const result = catalog.resolveStep({
      stepId: 'step-2',
      title: 'Send a Slack message',
      capabilityTags: ['notify']
    });

    expect(result).toEqual({
      kind: 'no_match',
      candidates: []
    });
  });

  it('returns ambiguous when more than one action matches the same step', () => {
    const catalog = new ActionCatalog();

    const result = catalog.resolveStep({
      stepId: 'step-3',
      title: 'Analyze risk signals',
      capabilityTags: ['risk', 'analyze']
    });

    expect(result).toEqual({
      kind: 'ambiguous',
      candidates: [
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
      ]
    });
  });
});
