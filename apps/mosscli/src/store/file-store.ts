import fs from "node:fs";
import path from "node:path";

import type {
  FlowRun,
  FeedbackDecision,
  RunSummary,
  StageResultEnvelope,
  StageSnapshot,
  TimelineEvent,
} from "../model/run.js";
import {
  getMossHarnessArtifactsDir,
  formatStageSnapshotFileName,
  getMossHarnessRoot,
  getMossHarnessRunDir,
  getMossHarnessStagesDir,
  getMossHarnessFeedbackPath,
  getMossHarnessSummaryPath,
  getMossHarnessTimelinePath,
} from "../shared/runtime.js";

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath: string, payload: unknown): void {
  ensureDir(path.dirname(filePath));
  const tempFile = `${filePath}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(payload), "utf8");
  fs.renameSync(tempFile, filePath);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export class MosscliFileStore {
  writeCurrentRun(run: FlowRun): void {
    writeJsonFile(path.join(getMossHarnessRoot(), "run.json"), run);
  }

  writeRun(run: FlowRun): void {
    writeJsonFile(path.join(getMossHarnessRunDir(run.run_id), "run.json"), run);
  }

  writeStageSnapshot(runId: string, snapshot: StageSnapshot): void {
    const fileName = formatStageSnapshotFileName(snapshot.sequence, snapshot.stage);
    writeJsonFile(path.join(getMossHarnessStagesDir(runId), fileName), snapshot);
  }

  writeStageResult(runId: string, result: StageResultEnvelope): void {
    const fileName = formatStageSnapshotFileName(result.sequence, result.stage);
    writeJsonFile(path.join(getMossHarnessStagesDir(runId), fileName.replace(".json", ".result.json")), result);
  }

  writeArtifact(runId: string, fileName: string, content: string): string {
    const artifactPath = path.join(getMossHarnessArtifactsDir(runId), fileName);
    ensureDir(path.dirname(artifactPath));
    fs.writeFileSync(artifactPath, content, "utf8");
    return artifactPath;
  }

  appendTimelineEvent(runId: string, event: TimelineEvent): void {
    const timelinePath = getMossHarnessTimelinePath(runId);
    ensureDir(path.dirname(timelinePath));
    fs.appendFileSync(timelinePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  readTimeline(runId: string): TimelineEvent[] {
    const timelinePath = getMossHarnessTimelinePath(runId);
    if (!fs.existsSync(timelinePath)) {
      return [];
    }

    return fs
      .readFileSync(timelinePath, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TimelineEvent);
  }

  writeSummary(runId: string, summary: RunSummary): void {
    writeJsonFile(getMossHarnessSummaryPath(runId), summary);
  }

  readSummary(runId: string): RunSummary {
    return readJsonFile<RunSummary>(getMossHarnessSummaryPath(runId));
  }

  readStageSnapshots(runId: string): StageSnapshot[] {
    const stagesDir = getMossHarnessStagesDir(runId);
    if (!fs.existsSync(stagesDir)) {
      return [];
    }

    return fs
      .readdirSync(stagesDir)
      .filter((entry) => entry.endsWith(".json") && !entry.endsWith(".result.json"))
      .sort()
      .map((entry) => readJsonFile<StageSnapshot>(path.join(stagesDir, entry)));
  }

  appendFeedbackDecision(runId: string, decision: FeedbackDecision): void {
    const filePath = getMossHarnessFeedbackPath(runId);
    ensureDir(path.dirname(filePath));
    let decisions: FeedbackDecision[] = [];
    if (fs.existsSync(filePath)) {
      decisions = JSON.parse(fs.readFileSync(filePath, "utf8")) as FeedbackDecision[];
    }
    decisions.push(decision);
    decisions.sort((left, right) => {
      const leftPriority = left.action === "send_to_previous_stage" ? 0 : 1;
      const rightPriority = right.action === "send_to_previous_stage" ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
    writeJsonFile(filePath, decisions);
  }

  readFeedbackDecisions(runId: string): FeedbackDecision[] {
    const filePath = getMossHarnessFeedbackPath(runId);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    return readJsonFile<FeedbackDecision[]>(filePath);
  }

  readRuns(): FlowRun[] {
    const runsDir = path.join(getMossHarnessRoot(), "runs");
    if (!fs.existsSync(runsDir)) {
      return [];
    }

    return fs
      .readdirSync(runsDir)
      .map((runId) => path.join(runsDir, runId, "run.json"))
      .filter((filePath) => fs.existsSync(filePath))
      .map((filePath) => readJsonFile<FlowRun>(filePath))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  readRun(runId?: string): FlowRun {
    const filePath = runId
      ? path.join(getMossHarnessRunDir(runId), "run.json")
      : path.join(getMossHarnessRoot(), "run.json");

    return readJsonFile<FlowRun>(filePath);
  }

  readStageSnapshot(runId: string, sequence: number, stage: string): StageSnapshot {
    const fileName = formatStageSnapshotFileName(sequence, stage);
    return readJsonFile<StageSnapshot>(path.join(getMossHarnessStagesDir(runId), fileName));
  }
}
