import { EvaluationBuilder } from "../core/evaluation-builder.js";

export function executeEvaluateCommand(options: {
  runId: string;
  format: "md" | "json";
}): string {
  const builder = new EvaluationBuilder();

  const evaluation = builder.buildJson(options.runId);
  if (options.format === "json") {
    return JSON.stringify(evaluation);
  }

  return builder.buildMarkdown(options.runId);
}
