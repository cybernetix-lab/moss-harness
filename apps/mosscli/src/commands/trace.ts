import fs from "node:fs";
import path from "node:path";
import { TelemetryAdapter } from "../adapters/telemetry-adapter.js";

type LearningTaskRecord = {
  task_id: string;
  status?: string;
  campaign_id?: string;
  study_node_type?: string;
  lane?: string;
};

type LearningEventRecord = {
  type?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
};

function readLearningTasks(runtimeRoot: string, campaignId: string): LearningTaskRecord[] {
  const boardDir = path.join(runtimeRoot, "task-board");
  if (!fs.existsSync(boardDir)) {
    return [];
  }

  const tasks: LearningTaskRecord[] = [];
  for (const lane of fs.readdirSync(boardDir)) {
    const laneDir = path.join(boardDir, lane);
    if (!fs.statSync(laneDir).isDirectory()) {
      continue;
    }

    for (const state of fs.readdirSync(laneDir)) {
      const stateDir = path.join(laneDir, state);
      if (!fs.statSync(stateDir).isDirectory()) {
        continue;
      }

      for (const entry of fs.readdirSync(stateDir)) {
        if (!entry.endsWith(".json")) {
          continue;
        }

        const payload = JSON.parse(
          fs.readFileSync(path.join(stateDir, entry), "utf8"),
        ) as LearningTaskRecord;

        if (payload.campaign_id !== campaignId) {
          continue;
        }

        tasks.push({
          ...payload,
          lane: `${lane}/${state}`,
        });
      }
    }
  }

  return tasks.sort((left, right) => left.task_id.localeCompare(right.task_id));
}

function readLearningEvents(runtimeRoot: string, campaignId: string): LearningEventRecord[] {
  const telemetryPath = path.join(runtimeRoot, "telemetry", "events.jsonl");
  if (!fs.existsSync(telemetryPath)) {
    return [];
  }

  return fs
    .readFileSync(telemetryPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LearningEventRecord)
    .filter((event) => event.data?.campaign_id === campaignId)
    .sort((left, right) => (left.timestamp ?? "").localeCompare(right.timestamp ?? ""));
}

function formatEventTime(timestamp?: string): string {
  if (!timestamp) {
    return "--:--:--";
  }

  const match = timestamp.match(/T(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : timestamp;
}

export function executeTraceCommand(options: { runId: string }): string {
  const { runId } = options;
  const runtimeRoot = process.env.MOSS_RUNTIME_DIR ?? path.join(process.cwd(), ".runtime");
  const campaignPath = path.join(runtimeRoot, "workflows", "learning", `${runId}.json`);

  if (fs.existsSync(campaignPath)) {
    const campaign = JSON.parse(fs.readFileSync(campaignPath, "utf8"));
    const output: string[] = [];
    const tasks = readLearningTasks(runtimeRoot, campaign.campaign_id as string);
    const events = readLearningEvents(runtimeRoot, campaign.campaign_id as string);

    output.push("Learning Campaign Replay");
    output.push(`Campaign ID: ${campaign.campaign_id}`);
    output.push(`Route: ${campaign.route}`);
    output.push("");
    output.push("## Dependencies");

    if (campaign.study_plan && Array.isArray(campaign.study_plan.dependencies)) {
      campaign.study_plan.dependencies.forEach((dep: [string, string]) => {
        output.push(`${dep[0]} -> ${dep[1]}`);
      });
    }

    output.push("");
    output.push("## Tasks");
    for (const task of tasks) {
      output.push(
        `- ${task.task_id} [${task.lane ?? "unknown"}] (${task.study_node_type ?? "unknown"})`,
      );
    }

    output.push("");
    output.push("## Timeline");
    for (const event of events) {
      const taskId = typeof event.data?.task_id === "string" ? ` ${event.data.task_id}` : "";
      output.push(`[${formatEventTime(event.timestamp)}] ${event.type ?? "unknown"}${taskId}`);
    }

    if (tasks.length === 0 && Array.isArray(campaign.delegated_task_ids)) {
      output.push("");
      output.push("## Delegated Task IDs");
      campaign.delegated_task_ids.forEach((id: string) => {
        output.push(id);
      });
    }

    return output.join("\n");
  }

  const telemetry = new TelemetryAdapter();
  try {
    const events = telemetry.readReplaySafeTimeline(runId);
    return events.map((event) => JSON.stringify(event)).join("\n");
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return `Error: No trace data found for run ID "${runId}".`;
    }
    throw error;
  }
}
