import type { FeedbackDecision, StageSnapshot } from "../model/run.js";

export interface EmergenceMetrics {
  moss_fallback_rate: number;
  moss_rework_rate: number;
  moss_expert_hit_rate: number;
  moss_stage_avg_duration: number;
}

export interface SystemSignals {
  summary: string;
  degradedByFallback: boolean;
  reworkObserved: boolean;
}

export class EmergenceAnalyzer {
  calculateMetrics(stages: StageSnapshot[], feedback: FeedbackDecision[]): EmergenceMetrics {
    const totalStages = stages.length || 1;
    const fallbackCount = stages.filter((stage) => stage.fallback_used).length;
    const expertCount = stages.filter((stage) => stage.selected_mode === "expert").length;
    const reworkCount = feedback.filter((decision) => decision.action === "send_to_previous_stage").length;

    return {
      moss_fallback_rate: fallbackCount / totalStages,
      moss_rework_rate: reworkCount / totalStages,
      moss_expert_hit_rate: expertCount / totalStages,
      moss_stage_avg_duration: 0,
    };
  }

  describeSystemSignals(stages: StageSnapshot[], feedback: FeedbackDecision[]): SystemSignals {
    const degradedByFallback = stages.some((stage) => stage.fallback_used);
    const reworkObserved = feedback.some((decision) => decision.action === "send_to_previous_stage");

    let summary = "Run completed without major adaptive signals.";
    if (reworkObserved) {
      summary = "Reviewer feedback triggered a rework loop.";
    } else if (degradedByFallback) {
      summary = "Run degraded to fallback capacity without an expert hit.";
    }

    return {
      summary,
      degradedByFallback,
      reworkObserved,
    };
  }
}
