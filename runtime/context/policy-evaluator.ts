#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import { InformationQualityAnalyzer } from '../telemetry/information-quality.ts';

type JsonObject = Record<string, unknown>;

export type CompactionBlock = {
  id: string;
  source?: string;
  type?: string;
  content?: string;
  messageIndex?: number;
};

type PolicyProfile = {
  signals: {
    entropy_weight: number;
    density_weight: number;
    redundancy_weight: number;
  };
  thresholds: {
    keep_verbatim: number;
    summarize: number;
    persist_and_preview: number;
  };
  persisted_output: {
    preview_chars: number;
    hard_size_threshold: number;
  };
  retention: {
    artifact_priority: Record<string, number>;
  };
};

type PolicyInput = {
  policyPath: string;
  profile?: string;
  blocks?: CompactionBlock[];
};

const analyzer = new InformationQualityAnalyzer();

function parseScalar(raw: string): string | number | boolean {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseSimpleYaml(content: string): JsonObject {
  const root: JsonObject = {};
  const stack: Array<{ indent: number; container: JsonObject }> = [
    { indent: -1, container: root },
  ];

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
      continue;
    }

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].container;
    const key = line.slice(0, separatorIndex).trim();
    const rest = line.slice(separatorIndex + 1).trim();

    if (!rest) {
      const child: JsonObject = {};
      current[key] = child;
      stack.push({ indent, container: child });
      continue;
    }

    current[key] = parseScalar(rest);
  }

  return root;
}

function readPolicy(policyPath: string): JsonObject {
  return parseSimpleYaml(readFileSync(policyPath, 'utf8'));
}

function asProfile(policy: JsonObject, profileName?: string): { name: string; profile: PolicyProfile } {
  const defaults = (policy.defaults ?? {}) as JsonObject;
  const name = profileName ?? String(defaults.profile ?? 'balanced');
  const profiles = (policy.profiles ?? {}) as Record<string, PolicyProfile>;
  const profile = profiles[name];

  if (!profile) {
    throw new Error(`Unknown profile: ${name}`);
  }

  return { name, profile };
}

export function policySummary(policyPath: string): string {
  const policy = readPolicy(policyPath);
  const { name, profile } = asProfile(policy);

  return JSON.stringify({
    profile: name,
    keepThreshold: profile.thresholds.keep_verbatim,
    summarizeThreshold: profile.thresholds.summarize,
    persistThreshold: profile.thresholds.persist_and_preview,
    previewChars: profile.persisted_output.preview_chars,
    hardSizeThreshold: profile.persisted_output.hard_size_threshold,
  });
}

export function evaluatePolicyInput(input: PolicyInput): {
  profile: string;
  windowAverageScore: number;
  actionHistogram: Record<string, number>;
  decisions: Array<{
    id: string;
    source?: string;
    type: string;
    contentLength: number;
    messageIndex?: number;
    action: string;
    actionScore: number;
    compressionPotential: number;
    retentionPriority: number;
  }>;
} {
  const policy = readPolicy(input.policyPath);
  const { name, profile } = asProfile(policy, input.profile);
  const blocks = input.blocks ?? [];

  const decisions = blocks.map(block => {
    const content = block.content ?? '';
    const signals = analyzer.analyzeBlock(content);

    const compressionPotential =
      profile.signals.entropy_weight * (1 - signals.normalizedEntropy) +
      profile.signals.density_weight * (1 - signals.densityNorm) +
      profile.signals.redundancy_weight * signals.redundancyRatio;

    const artifactType = block.type ?? 'conversation_message';
    const artifactPriority = profile.retention.artifact_priority[artifactType] ?? 0.5;
    const retentionPriority = artifactPriority * 0.5;
    const actionScore = compressionPotential - retentionPriority;

    let action = 'keep';
    if (
      content.length >= profile.persisted_output.hard_size_threshold ||
      actionScore >= profile.thresholds.persist_and_preview
    ) {
      action = 'persist_and_preview';
    } else if (actionScore >= profile.thresholds.summarize) {
      action = 'summarize';
    }

    return {
      id: block.id,
      source: block.source,
      type: artifactType,
      contentLength: content.length,
      messageIndex: block.messageIndex,
      action,
      actionScore: Number(actionScore.toFixed(6)),
      compressionPotential: Number(compressionPotential.toFixed(6)),
      retentionPriority: Number(retentionPriority.toFixed(6)),
    };
  });

  const histogram = decisions.reduce<Record<string, number>>((acc, decision) => {
    acc[decision.action] = (acc[decision.action] ?? 0) + 1;
    return acc;
  }, {});

  const average =
    decisions.length > 0
      ? decisions.reduce((sum, decision) => sum + decision.actionScore, 0) / decisions.length
      : 0;

  return {
    profile: name,
    windowAverageScore: Number(average.toFixed(6)),
    actionHistogram: histogram,
    decisions,
  };
}

function evaluate(): string {
  const input = JSON.parse(readFileSync(0, 'utf8')) as PolicyInput;
  return JSON.stringify(evaluatePolicyInput(input));
}

function main(): void {
  const [, , mode, arg] = process.argv;

  if (mode === 'policy-summary') {
    process.stdout.write(policySummary(arg));
    return;
  }

  process.stdout.write(evaluate());
}

if (process.argv[1]) {
  const scriptName = process.argv[1].split(/[\\/]/).pop();
  if (scriptName === 'policy-evaluator.ts' || scriptName === 'policy-evaluator.js') {
    main();
  }
}
