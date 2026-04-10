import fs from "node:fs";
import path from "node:path";

import type {
  MossHarnessJsonReport,
  MossLearningJsonReport,
  MosscliJsonReport,
} from "../model/report.js";
import type { StageSnapshot } from "../model/run.js";
import { EmergenceAnalyzer } from "./emergence-analyzer.js";
import { MosscliFileStore } from "../store/file-store.js";

export class ReportBuilder {
  private readonly store = new MosscliFileStore();
  private readonly analyzer = new EmergenceAnalyzer();
  private readonly runtimeRoot = process.env.MOSS_RUNTIME_DIR ?? path.join(process.cwd(), ".runtime");

  private getLearningCampaignPath(runId: string): string {
    return path.join(this.runtimeRoot, "workflows", "learning", `${runId}.json`);
  }

  private readLearningCampaign(runId: string): Record<string, unknown> | null {
    const filePath = this.getLearningCampaignPath(runId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  }

  private readDelegatedLearningTasks(campaignId: string): Array<Record<string, unknown>> {
    const boardDir = path.join(this.runtimeRoot, "task-board");
    if (!fs.existsSync(boardDir)) {
      return [];
    }

    const tasks: Array<Record<string, unknown>> = [];
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
          ) as Record<string, unknown>;
          if (payload["campaign_id"] === campaignId) {
            tasks.push(payload);
          }
        }
      }
    }

    return tasks;
  }

  private summarizeLearningTelemetry(campaignId: string): { createdTasks: number; skippedTasks: number } {
    const telemetryPath = path.join(this.runtimeRoot, "telemetry", "events.jsonl");
    if (!fs.existsSync(telemetryPath)) {
      return { createdTasks: 0, skippedTasks: 0 };
    }

    let createdTasks = 0;
    let skippedTasks = 0;
    for (const line of fs.readFileSync(telemetryPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { type?: string; data?: Record<string, unknown> };
      if (event.data?.["campaign_id"] !== campaignId) continue;
      if (event.type === "learning.study.task.created") createdTasks += 1;
      if (event.type === "learning.study.task.skipped") skippedTasks += 1;
    }

    return { createdTasks, skippedTasks };
  }

  private buildLearningJson(runId: string, campaign: Record<string, unknown>): MossLearningJsonReport {
    const delegatedTasks = this.readDelegatedLearningTasks(runId);
    const telemetrySummary = this.summarizeLearningTelemetry(runId);
    const studyPlan = (campaign["study_plan"] ?? {
      iteration: Number(campaign["iteration"] ?? 1),
      nodes: [],
      dependencies: [],
    }) as MossLearningJsonReport["study_plan"];

    return {
      report_type: "learning",
      campaign_id: String(campaign["campaign_id"] ?? runId),
      policy_pack: String(campaign["policy_pack"] ?? "learning-progression"),
      route: String(campaign["route"] ?? "unknown"),
      route_state: String(campaign["route_state"] ?? "unknown"),
      iteration: Number(campaign["iteration"] ?? 1),
      study_plan: {
        iteration: Number(studyPlan.iteration ?? 1),
        nodes: Array.isArray(studyPlan.nodes) ? studyPlan.nodes : [],
        dependencies: Array.isArray(studyPlan.dependencies) ? studyPlan.dependencies as Array<[string, string]> : [],
      },
      delegated_task_ids: Array.isArray(campaign["delegated_task_ids"])
        ? (campaign["delegated_task_ids"] as string[])
        : [],
      delegated_tasks: delegatedTasks,
      summary: {
        delegatedTasks: delegatedTasks.length,
        createdTasks: telemetrySummary.createdTasks,
        skippedTasks: telemetrySummary.skippedTasks,
      },
    };
  }

  buildJson(runId: string): MosscliJsonReport {
    const learningCampaign = this.readLearningCampaign(runId);
    if (learningCampaign) {
      return this.buildLearningJson(runId, learningCampaign);
    }

    const run = this.store.readRun(runId);
    const summary = this.store.readSummary(runId);
    const stages = this.store.readStageSnapshots(runId);
    const feedback = this.store.readFeedbackDecisions(runId);
    const metrics = this.analyzer.calculateMetrics(stages, feedback);
    const systemSignals = this.analyzer.describeSystemSignals(stages, feedback);

    return {
      run_id: run.run_id,
      status: run.status,
      goal: run.goal,
      current_stage: run.current_stage,
      selected_agent: run.selected_agent,
      summary: {
        reworkCount: summary.reworkCount,
        retryCount: summary.retryCount,
        completedStages: summary.completedStages,
      },
      feedback,
      moss_fallback_rate: metrics.moss_fallback_rate,
      moss_rework_rate: metrics.moss_rework_rate,
      moss_expert_hit_rate: metrics.moss_expert_hit_rate,
      moss_stage_avg_duration: metrics.moss_stage_avg_duration,
      metrics,
      systemSignals,
      stages,
    };
  }

  buildMarkdown(runId: string): string {
    const report = this.buildJson(runId);
    if ("report_type" in report && report.report_type === "learning") {
      return [
        "# Learning Campaign Report",
        "",
        `- Campaign ID: ${report.campaign_id}`,
        `- Route: ${report.route}`,
        `- Route State: ${report.route_state}`,
        `- Iteration: ${report.iteration}`,
        `- Study Nodes: ${report.study_plan.nodes.length}`,
        `- Delegated Tasks: ${report.summary.delegatedTasks}`,
        `- Created Tasks: ${report.summary.createdTasks}`,
        `- Skipped Tasks: ${report.summary.skippedTasks}`,
      ].join("\n");
    }

    const runReport = report as MossHarnessJsonReport;
    const stageLines = runReport.stages.map(
      (stage: StageSnapshot) =>
        `- ${stage.sequence}. ${stage.stage}: ${stage.status} (${stage.selected_agent})`,
    );

    return [
      "# Moss-Harness Run Report",
      "",
      `- Run ID: ${runReport.run_id}`,
      `- Goal: ${runReport.goal}`,
      `- Status: ${runReport.status}`,
      `- Current Stage: ${runReport.current_stage}`,
      `- Selected Agent: ${runReport.selected_agent}`,
      `- Rework Count: ${runReport.summary.reworkCount}`,
      `- Retry Count: ${runReport.summary.retryCount}`,
      `- Completed Stages: ${runReport.summary.completedStages}`,
      "",
      "## Stages",
      ...stageLines,
    ].join("\n");
  }
}
