import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);

function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && process.env.PROJECT_ROOT.length > 0) {
    return process.env.PROJECT_ROOT;
  }

  return path.resolve(CURRENT_DIR, "../../../../");
}

export function getProjectRoot(): string {
  return resolveProjectRoot();
}

export function getRuntimeRoot(): string {
  const configured = process.env.MOSS_RUNTIME_DIR;
  if (configured && configured.length > 0) {
    return configured;
  }

  return path.join(getProjectRoot(), ".runtime");
}

export function getMossHarnessRoot(): string {
  return path.join(getRuntimeRoot(), "moss-harness");
}

export function getMossHarnessRunDir(runId: string): string {
  return path.join(getMossHarnessRoot(), "runs", runId);
}

export function getMossHarnessStagesDir(runId: string): string {
  return path.join(getMossHarnessRunDir(runId), "stages");
}

export function getMossHarnessArtifactsDir(runId: string): string {
  return path.join(getMossHarnessRunDir(runId), "artifacts");
}

export function getMossHarnessTimelinePath(runId: string): string {
  return path.join(getMossHarnessRunDir(runId), "timeline.jsonl");
}

export function getMossHarnessSummaryPath(runId: string): string {
  return path.join(getMossHarnessRunDir(runId), "summary.json");
}

export function getMossHarnessFeedbackPath(runId: string): string {
  return path.join(getMossHarnessRunDir(runId), "feedback.json");
}

export function getScriptPath(scriptName: string): string {
  return path.join(getProjectRoot(), "scripts", scriptName);
}

export function createRunId(now: Date): string {
  const compactTimestamp = now.toISOString().replace(/[-:.TZ]/g, "");
  return `mossrun_${compactTimestamp}`;
}

export function formatStageSnapshotFileName(sequence: number, stage: string): string {
  return `${String(sequence).padStart(2, "0")}-${stage}.json`;
}

export function nowIsoString(now: Date = new Date()): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}
