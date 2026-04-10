/**
 * Learning Progression Policy (Skeleton)
 *
 * Purpose:
 * - Evaluate learning profile (scope, novelty, evidence gap — TODO: real signals)
 * - Select study route (survey / extract / synthesize / validate / remediate)
 * - Produce a minimal study plan that controllers can expand into lane tasks
 */

import { PolicyRegistry } from "./types.ts";
import type {
  ControlContext,
  ControlDecision,
  PolicyPack,
  Profile,
  RouteDecision,
  StudyPlan,
  WorkItem,
} from "./types.ts";

function buildStudyPlan(route: string): StudyPlan {
  switch (route) {
    case "survey-cycle":
      return {
        iteration: 1,
        nodes: [{ type: "source-discovery", topic: "topic-survey" }],
        dependencies: [],
      };
    case "extraction-cycle":
      return {
        iteration: 1,
        nodes: [{ type: "extraction", batch: "top5" }],
        dependencies: [],
      };
    case "validation-cycle":
      return {
        iteration: 1,
        nodes: [{ type: "validation", on: "representative-task" }],
        dependencies: [],
      };
    case "remediation-cycle":
      return {
        iteration: 1,
        nodes: [
          { type: "source-discovery", topic: "gap-remediation" },
          { type: "gap-analysis", focus: "uncovered-areas" },
        ],
        dependencies: [["source-discovery", "gap-analysis"]],
      };
    case "synthesis-cycle":
    default:
      return {
        iteration: 1,
        nodes: [
          { type: "source-discovery", topic: "topic-discovery" },
          { type: "extraction", batch: "top5" },
          { type: "synthesis", target: "patterns-v1" },
        ],
        dependencies: [
          ["source-discovery", "extraction"],
          ["extraction", "synthesis"],
        ],
      };
  }
}

export const LearningProgressionPolicy: PolicyPack = {
  name: "learning-progression",

  evaluateProfile(input: WorkItem): Profile {
    // TODO: replace with real evidence map, novelty score, and validation need.
    if (input.kind !== "learning") {
      throw new Error("LearningProgressionPolicy expects WorkItem.kind = 'learning'");
    }
    const evidence = input.payload.evidenceSummary ?? {};
    const sources = Number(evidence.sources ?? 0);
    const syntheses = Number(evidence.syntheses ?? 0);
    const validations = Number(evidence.validations ?? 0);

    return {
      scope_score: input.payload.topic ? 40 : 20,
      novelty_score: sources === 0 ? 70 : 40,
      evidence_gap: syntheses === 0 ? 0.8 : validations === 0 ? 0.5 : 0.2,
      validation_need: validations === 0 ? "high" : "medium",
    };
  },

  selectRoute(profile: Profile): RouteDecision {
    const evidenceGap = Number(profile["evidence_gap"] ?? 1);
    const validationNeed = String(profile["validation_need"] ?? "medium");

    let route = "synthesis-cycle";
    if (evidenceGap >= 0.75) route = "survey-cycle";
    else if (evidenceGap >= 0.6) route = "extraction-cycle";
    else if (validationNeed === "high") route = "validation-cycle";
    else if (evidenceGap >= 0.4) route = "synthesis-cycle";
    else route = "remediation-cycle";

    return { route, studyPlan: buildStudyPlan(route) };
  },

  buildExecutionPlan(decision: RouteDecision): RouteDecision {
    return decision;
  },

  decideNextAction(ctx: ControlContext): ControlDecision {
    // TODO: inspect evidence & gap convergence. For now, learning controller may replan externally.
    return { action: "advance" };
  },
};

PolicyRegistry.register(LearningProgressionPolicy);
