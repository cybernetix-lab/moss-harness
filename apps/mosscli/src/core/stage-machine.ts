import type { StageDecision, StageName } from "../model/run.js";

const STAGE_ORDER: StageName[] = ["planner", "reviewer", "executor", "evaluator"];

export const MAX_REWORK_COUNT = 2;
export const MAX_RETRY_COUNT = 1;

export interface StageTransitionResult {
  nextStage: StageName | null;
  terminalStatus: "completed" | "failed" | null;
  reworkIncrement: number;
  retryIncrement: number;
}

export function getStageSequence(): StageName[] {
  return [...STAGE_ORDER];
}

export function determineStageTransition(
  stage: StageName,
  decision: StageDecision,
  reworkCount: number,
  retryCount: number,
): StageTransitionResult {
  if (stage === "planner") {
    return {
      nextStage: "reviewer",
      terminalStatus: null,
      reworkIncrement: 0,
      retryIncrement: 0,
    };
  }

  if (stage === "reviewer") {
    if (decision === "rejected") {
      if (reworkCount >= MAX_REWORK_COUNT) {
        return {
          nextStage: null,
          terminalStatus: "failed",
          reworkIncrement: 0,
          retryIncrement: 0,
        };
      }

      return {
        nextStage: "planner",
        terminalStatus: null,
        reworkIncrement: 1,
        retryIncrement: 0,
      };
    }

    return {
      nextStage: "executor",
      terminalStatus: null,
      reworkIncrement: 0,
      retryIncrement: 0,
    };
  }

  if (stage === "executor") {
    if (decision === "failed") {
      if (retryCount >= MAX_RETRY_COUNT) {
        return {
          nextStage: null,
          terminalStatus: "failed",
          reworkIncrement: 0,
          retryIncrement: 0,
        };
      }

      return {
        nextStage: "executor",
        terminalStatus: null,
        reworkIncrement: 0,
        retryIncrement: 1,
      };
    }

    return {
      nextStage: "evaluator",
      terminalStatus: null,
      reworkIncrement: 0,
      retryIncrement: 0,
    };
  }

  if (decision === "passed") {
    return {
      nextStage: null,
      terminalStatus: "completed",
      reworkIncrement: 0,
      retryIncrement: 0,
    };
  }

  return {
    nextStage: null,
    terminalStatus: "failed",
    reworkIncrement: 0,
    retryIncrement: 0,
  };
}
