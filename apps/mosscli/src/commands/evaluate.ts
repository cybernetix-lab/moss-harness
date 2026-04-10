import { ReportBuilder } from "../core/report-builder.js";

export function executeEvaluateCommand(options: {
  runId: string;
  format: "md" | "json";
}): string {
  const builder = new ReportBuilder();

  if (options.format === "json") {
    return JSON.stringify(builder.buildJson(options.runId));
  }

  return builder.buildMarkdown(options.runId);
}
