import type { FeedbackDecision, StageName } from "../model/run.js";

interface FeedbackInput {
  runId: string;
  stage: StageName;
  decision: string;
  fallbackUsed: boolean;
  confidence?: number;
  timestamp: string;
  sequence: number;
}

export class FeedbackController {
  evaluate(input: FeedbackInput): FeedbackDecision[] {
    const decisions: FeedbackDecision[] = [];

    if (input.stage === "reviewer" && input.decision === "rejected") {
      decisions.push({
        id: `${input.runId}-${input.stage}-${input.sequence}-review-rejected`,
        runId: input.runId,
        trigger: "review_rejected",
        sourceStage: input.stage,
        action: "send_to_previous_stage",
        reason: "Reviewer requested a rework.",
        createdAt: input.timestamp,
        applied: true,
      });
    }

    if (input.stage === "executor" && input.confidence !== undefined && input.confidence < 0.8) {
      decisions.push({
        id: `${input.runId}-${input.stage}-${input.sequence}-low-confidence`,
        runId: input.runId,
        trigger: "executor_low_confidence",
        sourceStage: input.stage,
        action: "send_to_previous_stage",
        reason: "Executor confidence dropped below the minimum threshold.",
        createdAt: input.timestamp,
        applied: true,
      });
    }

    if (input.fallbackUsed) {
      decisions.push({
        id: `${input.runId}-${input.stage}-${input.sequence}-fallback`,
        runId: input.runId,
        trigger: "fallback_claim_used",
        sourceStage: input.stage,
        action: "mark_run_degraded",
        reason: "Claim used fallback capacity instead of an expert.",
        createdAt: input.timestamp,
        applied: true,
      });
    }

    return decisions;
  }
}
