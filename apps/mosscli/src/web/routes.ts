import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

import { MosscliFileStore } from "../store/file-store.js";
import { getRuntimeRoot } from "../shared/runtime.js";
import { ReportBuilder } from "../core/report-builder.js";
import { executeStatusCommand } from "../commands/status.js";

type LearningCampaign = {
  campaign_id: string;
  route?: string;
  route_state?: string;
  iteration?: number;
  study_plan?: Record<string, unknown>;
  delegated_task_ids?: string[];
};

function readLearningCampaigns(runtimeRoot: string): LearningCampaign[] {
  const dir = path.join(runtimeRoot, "workflows", "learning");
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as LearningCampaign);
}

function summarizeLearningTelemetry(runtimeRoot: string, campaignId: string): { createdTasks: number; skippedTasks: number } {
  const telemetry = path.join(runtimeRoot, "telemetry", "events.jsonl");
  if (!fs.existsSync(telemetry)) {
    return { createdTasks: 0, skippedTasks: 0 };
  }
  let createdTasks = 0;
  let skippedTasks = 0;
  for (const line of fs.readFileSync(telemetry, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const evt = JSON.parse(line) as { type?: string; data?: Record<string, unknown> };
      if (evt.data?.campaign_id !== campaignId) continue;
      if (evt.type === "learning.study.task.created") createdTasks += 1;
      if (evt.type === "learning.study.task.skipped") skippedTasks += 1;
    } catch {
      /* ignore */
    }
  }
  return { createdTasks, skippedTasks };
}

function readLearningTimeline(
  runtimeRoot: string,
  campaignId: string,
): Array<{ type: string; timestamp: string; taskId?: string }> {
  const telemetry = path.join(runtimeRoot, "telemetry", "events.jsonl");
  if (!fs.existsSync(telemetry)) {
    return [];
  }

  const allowed = new Set([
    "learning.iteration.started",
    "learning.study.tasks.spawned",
    "learning.study.task.created",
    "learning.study.task.skipped",
  ]);

  return fs
    .readFileSync(telemetry, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as { type?: string; timestamp?: string; data?: Record<string, unknown> };
      } catch {
        return null;
      }
    })
    .filter((event): event is { type?: string; timestamp?: string; data?: Record<string, unknown> } => event !== null)
    .filter((event) => event.data?.campaign_id === campaignId && typeof event.type === "string" && allowed.has(event.type))
    .sort((left, right) => String(left.timestamp ?? "").localeCompare(String(right.timestamp ?? "")))
    .map((event) => ({
      type: String(event.type),
      timestamp: String(event.timestamp ?? ""),
      taskId: typeof event.data?.task_id === "string" ? String(event.data.task_id) : undefined,
    }));
}

function readLearningTasks(runtimeRoot: string, campaignId: string): Array<{ task_id: string; lane: string; status?: string; study_node_type?: string }> {
  const boardDir = path.join(runtimeRoot, "task-board");
  if (!fs.existsSync(boardDir)) return [];
  const tasks: Array<{ task_id: string; lane: string; status?: string; study_node_type?: string }> = [];
  for (const lane of fs.readdirSync(boardDir)) {
    const laneDir = path.join(boardDir, lane);
    if (!fs.statSync(laneDir).isDirectory()) continue;
    for (const state of fs.readdirSync(laneDir)) {
      const stateDir = path.join(laneDir, state);
      if (!fs.statSync(stateDir).isDirectory()) continue;
      for (const entry of fs.readdirSync(stateDir)) {
        if (!entry.endsWith(".json")) continue;
        try {
          const payload = JSON.parse(fs.readFileSync(path.join(stateDir, entry), "utf8")) as Record<string, unknown>;
          if (payload["campaign_id"] !== campaignId) continue;
          tasks.push({
            task_id: String(payload["task_id"] ?? entry.replace(/\.json$/, "")),
            lane: `${lane}/${state}`,
            status: typeof payload["status"] === "string" ? (payload["status"] as string) : undefined,
            study_node_type: typeof payload["study_node_type"] === "string" ? (payload["study_node_type"] as string) : undefined,
          });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return tasks;
}

export function handleMosscliRequest(req: IncomingMessage, res: ServerResponse): void {
  const store = new MosscliFileStore();
  const url = req.url ?? "/";
  const runtimeRoot = getRuntimeRoot();

  if (url === "/runs") {
    const runs = store.readRuns();
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(runs));
    return;
  }

  if (url.startsWith("/runs/")) {
      const artifactMatch = url.match(/^\/runs\/([^/]+)\/artifacts\/(\d+)$/);
      if (artifactMatch) {
        const runId = artifactMatch[1];
        const sequence = parseInt(artifactMatch[2], 10);
        try {
          const stages = store.readStageSnapshots(runId);
          const snapshot = stages.find(s => s.sequence === sequence);
          if (!snapshot || !snapshot.artifact_path || !fs.existsSync(snapshot.artifact_path)) {
            res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
            res.end("<!doctype html><title>Not Found</title><h1>Artifact Not Found</h1>");
            return;
          }
          const content = fs.readFileSync(snapshot.artifact_path, "utf8");
          const lines: string[] = [];
          lines.push("<!doctype html>");
          lines.push("<style>");
          lines.push("body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; background: #f8fafc; }");
          lines.push("pre { background: #fff; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }");
          lines.push(".nav { margin-bottom: 2rem; font-size: 0.9em; }");
          lines.push("a { color: #0066cc; text-decoration: none; }");
          lines.push("a:hover { text-decoration: underline; }");
          lines.push("</style>");
          lines.push(`<title>Artifact View - Stage ${sequence}</title>`);
          lines.push(`<div class="nav"><a href="/runs/${runId}/view">&larr; Back to Run</a></div>`);
          lines.push(`<h1>Artifact: Stage ${sequence} (${snapshot.stage})</h1>`);
          lines.push(`<pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(lines.join("\n"));
          return;
        } catch (err) {
          res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
          res.end(`<!doctype html><title>Error</title><h1>Error reading artifact</h1><pre>${err instanceof Error ? err.message : String(err)}</pre>`);
          return;
        }
      }

    if (url.endsWith("/view")) {
      const runId = url.replace("/runs/", "").replace("/view", "");
      let run: import("../model/run.js").FlowRun | undefined;
      try {
        run = store.readRun(runId);
      } catch {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("<!doctype html><title>Not Found</title><h1>Run Not Found</h1>");
        return;
      }

      const builder = new ReportBuilder();
      let evaluation: Record<string, unknown> = {};
      try {
        evaluation = builder.buildJson(runId) as unknown as Record<string, unknown>;
      } catch (err) {
        evaluation = { error: err instanceof Error ? err.message : String(err) };
      }

      const timeline = store.readTimeline(runId);

      const lines: string[] = [];
      lines.push("<!doctype html>");
      lines.push("<style>");
      lines.push("body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; background-color: #f8fafc; color: #0f172a; }");
      lines.push("h1, h2 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 0; }");
      lines.push("pre { background: #f1f5f9; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.9em; }");
      lines.push(".card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }");
      lines.push(".timeline-event { padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; }");
      lines.push(".timeline-event:last-child { border-bottom: none; }");
      lines.push(".badge { display: inline-block; padding: 0.25em 0.6em; font-size: 0.85em; font-weight: 600; border-radius: 0.25rem; background-color: #e2e8f0; color: #334155; }");
      lines.push(".badge-completed { background-color: #dcfce7; color: #166534; }");
      lines.push(".badge-running { background-color: #dbeafe; color: #1e40af; }");
      lines.push(".badge-failed { background-color: #fee2e2; color: #991b1b; }");
      lines.push(".badge-approved { background-color: #dcfce7; color: #166534; }");
      lines.push(".badge-rejected { background-color: #fee2e2; color: #991b1b; }");
      lines.push(".nav { margin-bottom: 2rem; font-size: 0.9em; }");
      lines.push("a { color: #2563eb; text-decoration: none; }");
      lines.push("a:hover { text-decoration: underline; }");
      lines.push(".metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }");
      lines.push(".metric-card { background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; }");
      lines.push(".metric-value { font-size: 2rem; font-weight: bold; color: #0f172a; }");
      lines.push(".metric-label { font-size: 0.875rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.5rem; }");
      lines.push(".stage-item { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 1rem; background: #fff; }");
      lines.push(".stage-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }");
      lines.push(".stage-meta { font-size: 0.9em; color: #475569; margin-bottom: 0.5rem; }");
      lines.push(".btn { display: inline-block; padding: 0.4rem 0.8rem; background: #0f172a; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.875em; font-weight: 500; }");
      lines.push(".btn:hover { background: #1e293b; text-decoration: none; color: #fff; }");
      lines.push("</style>");
      lines.push("<title>Run View - " + runId + "</title>");
      lines.push('<div class="nav"><a href="/">&larr; Back to Dashboard</a></div>');
      lines.push("<h1>Run Details: " + runId + "</h1>");

      const badgeClass = run?.status === 'completed' ? 'badge-completed' : run?.status === 'failed' ? 'badge-failed' : 'badge-running';
      lines.push('<div class="card">');
      lines.push("<h2>Goal & Status</h2>");
      lines.push(`<p style="font-size: 1.1em; margin-top: 0;"><strong>Goal:</strong> ${run?.goal ?? 'Unknown'}</p>`);
      lines.push(`<p><strong>Status:</strong> <span class="badge ${badgeClass}">${run?.status ?? 'Unknown'}</span></p>`);
      lines.push(`<p><strong>Current Stage:</strong> ${run?.current_stage ?? 'Unknown'}</p>`);
      lines.push("</div>");

      lines.push('<div class="card">');
      lines.push("<h2>Analytics (Evaluation Metrics)</h2>");
      lines.push('<div class="metrics-grid">');
      lines.push(`<div class="metric-card"><div class="metric-value">${typeof evaluation.moss_fallback_rate === 'number' ? (evaluation.moss_fallback_rate * 100).toFixed(0) + '%' : 'N/A'}</div><div class="metric-label">Fallback Rate</div></div>`);
      lines.push(`<div class="metric-card"><div class="metric-value">${typeof evaluation.moss_expert_hit_rate === 'number' ? (evaluation.moss_expert_hit_rate * 100).toFixed(0) + '%' : 'N/A'}</div><div class="metric-label">Expert Hit Rate</div></div>`);
      lines.push(`<div class="metric-card"><div class="metric-value">${typeof evaluation.moss_rework_rate === 'number' ? (evaluation.moss_rework_rate * 100).toFixed(0) + '%' : 'N/A'}</div><div class="metric-label">Rework Rate</div></div>`);
      const summaryObj = (evaluation.summary as Record<string, unknown>) || {};
      lines.push(`<div class="metric-card"><div class="metric-value">${summaryObj.completedStages ?? 0}</div><div class="metric-label">Completed Stages</div></div>`);
      lines.push('</div>');
      const sysSignals = (evaluation.systemSignals as Record<string, unknown>) || {};
      if (sysSignals.summary) {
        lines.push(`<p><strong>System Signal:</strong> ${sysSignals.summary}</p>`);
      }
      lines.push("</div>");

      lines.push('<div class="card">');
      lines.push("<h2>Execution Tracing (Stages)</h2>");
      const stages = Array.isArray(evaluation.stages) ? evaluation.stages : [];
      if (stages.length > 0) {
        for (const stage of stages) {
          lines.push('<div class="stage-item">');
          lines.push(`<div class="stage-header">`);
          lines.push(`<strong>Stage ${stage.sequence}: ${stage.stage}</strong>`);
          lines.push(`<span class="badge badge-${stage.status}">${stage.status}</span>`);
          lines.push(`</div>`);
          lines.push(`<div class="stage-meta"><strong>Agent:</strong> ${stage.selected_agent} (${stage.selected_mode}) &nbsp;|&nbsp; <strong>Decision:</strong> <span class="badge badge-${stage.decision}">${stage.decision || 'N/A'}</span></div>`);
          if (stage.summary) {
            lines.push(`<p style="margin: 0.5rem 0;">${stage.summary}</p>`);
          }
          if (stage.artifact_path) {
            lines.push(`<div style="margin-top: 1rem;"><a class="btn" href="/runs/${runId}/artifacts/${stage.sequence}">View Artifact</a></div>`);
          }
          lines.push('</div>');
        }
      } else {
        lines.push("<p>(no stages recorded)</p>");
      }
      lines.push("</div>");

      const feedback = Array.isArray(evaluation.feedback) ? evaluation.feedback : [];
      if (feedback.length > 0) {
        lines.push('<div class="card">');
        lines.push("<h2>Feedback & Rework Decisions</h2>");
        lines.push("<ul>");
        for (const fb of feedback) {
          lines.push(`<li style="margin-bottom: 0.5rem;"><strong>[${fb.sourceStage}] &rarr; ${fb.action}</strong>: ${fb.reason} <br><small style="color: #64748b;">Trigger: ${fb.trigger}</small></li>`);
        }
        lines.push("</ul>");
        lines.push("</div>");
      }

      lines.push('<div class="card">');
      lines.push("<h2>Fact Chain (Timeline Events)</h2>");
      if (timeline.length > 0) {
        lines.push('<div class="timeline">');
        for (const event of timeline) {
          const time = new Date(event.timestamp).toLocaleTimeString();
          lines.push(`<div class="timeline-event">`);
          lines.push(`<strong>[${time}]</strong> <span class="badge">${event.type}</span>`);
          if (event.stage) lines.push(` <span>Stage: ${event.stage}</span>`);
          if (event.data) {
            lines.push(`<pre style="margin-top: 0.5rem; padding: 0.5rem; font-size: 0.85em; background: #f8fafc;">${JSON.stringify(event.data, null, 2)}</pre>`);
          }
          lines.push(`</div>`);
        }
        lines.push('</div>');
      } else {
        lines.push("<p>(no trace events found)</p>");
      }
      lines.push("</div>");

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(lines.join("\n"));
      return;
    }
  }

  if (url === "/learning") {
    const campaigns = readLearningCampaigns(runtimeRoot).map((c) => {
      const telemetry = summarizeLearningTelemetry(runtimeRoot, c.campaign_id);
      return {
        campaign_id: c.campaign_id,
        route: c.route ?? "unknown",
        route_state: c.route_state ?? "unknown",
        iteration: c.iteration ?? 1,
        delegated_task_ids: Array.isArray(c.delegated_task_ids) ? c.delegated_task_ids : [],
        delegatedTasks: Array.isArray(c.delegated_task_ids) ? c.delegated_task_ids.length : 0,
        createdTasks: telemetry.createdTasks,
        skippedTasks: telemetry.skippedTasks,
      };
    });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(campaigns));
    return;
  }

  if (url.startsWith("/learning/")) {
    // HTML view endpoint: /learning/:id/view
    if (url.endsWith("/view")) {
      const campaignId = url.replace("/learning/", "").replace("/view", "");
      const campaigns = readLearningCampaigns(runtimeRoot);
      const found = campaigns.find((c) => c.campaign_id === campaignId);
      if (!found) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("<!doctype html><title>Not Found</title><h1>Not Found</h1>");
        return;
      }
      const tasks = readLearningTasks(runtimeRoot, campaignId);
      const telemetry = summarizeLearningTelemetry(runtimeRoot, campaignId);
      const timeline = readLearningTimeline(runtimeRoot, campaignId);
      const deps: Array<[string, string]> = Array.isArray(found.study_plan?.["dependencies"])
        ? (found.study_plan?.["dependencies"] as Array<[string, string]>)
        : [];
      const lines: string[] = [];
      lines.push("<!doctype html>");
      lines.push("<style>");
      lines.push("body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; }");
      lines.push("h1, h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }");
      lines.push("pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }");
      lines.push(".card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }");
      lines.push(".timeline-event { padding: 0.5rem 0; border-bottom: 1px solid #eee; }");
      lines.push(".timeline-event:last-child { border-bottom: none; }");
      lines.push(".badge { display: inline-block; padding: 0.25em 0.5em; font-size: 0.85em; font-weight: 700; border-radius: 0.25rem; background-color: #e9ecef; color: #495057; }");
      lines.push(".nav { margin-bottom: 2rem; }");
      lines.push("</style>");
      lines.push("<title>Learning Campaign - " + found.campaign_id + "</title>");
      lines.push('<div class="nav"><a href="/">&larr; Back to Home</a></div>');
      lines.push("<h1>Learning Campaign: " + found.campaign_id + "</h1>");

      lines.push('<div class="card">');
      lines.push("<h2>Overview</h2>");
      lines.push(`<p>Route: <strong>${found.route ?? "unknown"}</strong></p>`);
      lines.push(`<p>Iteration: <strong>${found.iteration ?? 1}</strong></p>`);
      lines.push(`<p>Created Tasks: <strong>${telemetry.createdTasks}</strong></p>`);
      lines.push(`<p>Skipped Tasks: <strong>${telemetry.skippedTasks}</strong></p>`);
      lines.push('</div>');

      lines.push('<div class="card">');
      lines.push("<h2>Dependencies</h2>");
      if (deps.length > 0) {
        lines.push("<ul>");
        for (const [from, to] of deps) {
          lines.push(`<li>${from} &rarr; ${to}</li>`);
        }
        lines.push("</ul>");
      } else {
        lines.push("<p>(none)</p>");
      }
      lines.push('</div>');

      lines.push('<div class="card">');
      lines.push("<h2>Delegated Tasks</h2>");
      if (tasks.length > 0) {
        lines.push("<ul>");
        for (const t of tasks) {
          lines.push(`<li><strong>${t.task_id}</strong> [${t.lane}] (${t.study_node_type ?? "unknown"})</li>`);
        }
        lines.push("</ul>");
      } else {
        lines.push("<p>(none)</p>");
      }
      lines.push('</div>');

      lines.push('<div class="card">');
      lines.push("<h2>Trace Timeline (mosscli trace)</h2>");
      if (timeline.length > 0) {
        lines.push('<div class="timeline">');
        for (const event of timeline) {
          lines.push(`<div class="timeline-event">`);
          lines.push(`<strong>[${event.timestamp}]</strong> <span class="badge">${event.type}</span>${event.taskId ? ` <span>Task: ${event.taskId}</span>` : ""}`);
          lines.push(`</div>`);
        }
        lines.push('</div>');
      } else {
        lines.push("<p>(none)</p>");
      }
      lines.push('</div>');
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(lines.join(""));
      return;
    }

    const campaignId = url.replace("/learning/", "");
    const campaigns = readLearningCampaigns(runtimeRoot);
    const found = campaigns.find((c) => c.campaign_id === campaignId);
    if (!found) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    const telemetry = summarizeLearningTelemetry(runtimeRoot, campaignId);
    const detail = {
      ...found,
      delegated_task_ids: Array.isArray(found.delegated_task_ids) ? found.delegated_task_ids : [],
      delegatedTasks: Array.isArray(found.delegated_task_ids) ? found.delegated_task_ids.length : 0,
      createdTasks: telemetry.createdTasks,
      skippedTasks: telemetry.skippedTasks,
    };
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(detail));
    return;
  }

  if (url === "/") {
    const campaigns = readLearningCampaigns(runtimeRoot);
    const runs = store.readRuns();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    const lines = [
      "<!doctype html>",
      "<style>",
      "body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; }",
      "h1, h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }",
      ".card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }",
      ".list-item { padding: 0.5rem 0; border-bottom: 1px solid #eee; }",
      ".list-item:last-child { border-bottom: none; }",
      "a { color: #0066cc; text-decoration: none; }",
      "a:hover { text-decoration: underline; }",
      ".badge { display: inline-block; padding: 0.25em 0.5em; font-size: 0.85em; font-weight: 700; border-radius: 0.25rem; background-color: #e9ecef; color: #495057; }",
      ".badge-running { background-color: #cce5ff; color: #004085; }",
      ".badge-completed { background-color: #d4edda; color: #155724; }",
      ".badge-failed { background-color: #f8d7da; color: #721c24; }",
      "</style>",
      "<title>Mosscli Dashboard</title>",
      "<h1>mosscli Observability Panel</h1>",
    ];

    lines.push('<div class="card">');
    lines.push('<h2>Recent Runs</h2>');
    lines.push('<p><a href="/runs">Raw JSON</a></p>');
    if (runs.length > 0) {
      lines.push("<ul>");
      for (const run of runs) {
        const time = new Date(run.created_at).toLocaleString();
        const badgeClass = run.status === 'completed' ? 'badge-completed' : run.status === 'failed' ? 'badge-failed' : 'badge-running';
        lines.push(
          `<li class="list-item"><a href="/runs/${run.run_id}/view"><strong>${run.run_id}</strong></a> - ${run.goal} <span class="badge ${badgeClass}">${run.status}</span> <small>(${time})</small></li>`,
        );
      }
      lines.push("</ul>");
    } else {
      lines.push("<p>(none)</p>");
    }
    lines.push("</div>");

    lines.push('<div class="card">');
    lines.push('<h2>Learning Campaigns</h2>');
    lines.push('<p><a href="/learning">Raw JSON</a></p>');
    if (campaigns.length > 0) {
      lines.push("<ul>");
      for (const campaign of campaigns) {
        const telemetry = summarizeLearningTelemetry(runtimeRoot, campaign.campaign_id);
        lines.push(
          `<li class="list-item"><a href="/learning/${campaign.campaign_id}/view"><strong>${campaign.campaign_id}</strong></a> - ${campaign.route ?? "unknown"} - Iteration: ${campaign.iteration ?? 1} - Created: ${telemetry.createdTasks} - Skipped: ${telemetry.skippedTasks}</li>`,
        );
      }
      lines.push("</ul>");
    } else {
      lines.push("<p>(none)</p>");
    }
    lines.push("</div>");

    res.end(lines.join(""));
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "not_found" }));
}
