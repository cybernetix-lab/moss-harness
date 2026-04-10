/**
 * Task Governance Policy (Skeleton)
 *
 * Purpose:
 * - Evaluate task profile (complexity/risk/hard gates — TODO: connect real signals)
 * - Select governance route (fast / standard / full-governance)
 * - Produce a minimal lane plan
 *
 * This is a placeholder: it returns deterministic defaults so that
 * router/controllers can be wired before real scoring is ready.
 */

import { PolicyRegistry } from "./types.ts";
import type {
  ControlContext,
  ControlDecision,
  LanePlan,
  PolicyPack,
  Profile,
  RouteDecision,
  WorkItem,
} from "./types.ts";

function defaultLanePlan(route: string): LanePlan {
  if (route === "fast-path") {
    return {
      required_lanes: ["coordinator", "executor"],
      optional_support_lanes: ["researcher"],
      current_lane: "coordinator",
      next_lane: "executor",
    };
  }
  if (route === "full-governance-path") {
    return {
      required_lanes: ["coordinator", "planner", "reviewer", "executor", "evaluator", "memory_curator"],
      optional_support_lanes: ["researcher"],
      current_lane: "planner",
      next_lane: "reviewer",
    };
  }
  // standard-path default
  return {
    required_lanes: ["coordinator", "planner", "executor", "evaluator"],
    conditional_lanes: ["reviewer", "memory_curator"],
    optional_support_lanes: ["researcher"],
    current_lane: "planner",
    next_lane: "executor",
  };
}

export const TaskGovernancePolicy: PolicyPack = {
  name: "task-governance",

  evaluateProfile(input: WorkItem): Profile {
    // TODO: replace with real scoring (complexity, risk, hard gates)
    if (input.kind !== "task") {
      throw new Error("TaskGovernancePolicy expects WorkItem.kind = 'task'");
    }
    const text =
      (input.payload.title ?? "") + " " + (input.payload.description ?? "");
    const hardGate = /\b(auth|schema|security|api|deploy|migration)\b/i.test(text);
    const heuristicComplexity =
      (text.match(/\b(design|architecture|refactor|integrate|migrate)\b/gi)?.length ??
        0) * 10;
    const heuristicRisk = hardGate ? 80 : Math.min(heuristicComplexity + 20, 70);
    return {
      complexity_score: Math.max(0, Math.min(heuristicComplexity, 100)),
      risk_score: Math.max(0, Math.min(heuristicRisk, 100)),
      hard_gates: hardGate ? ["critical_keyword_detected"] : [],
    };
  },

  selectRoute(profile: Profile): RouteDecision {
    const complexity = Number(profile["complexity_score"] ?? 0);
    const risk = Number(profile["risk_score"] ?? 0);
    const hard = Array.isArray(profile["hard_gates"]) && (profile["hard_gates"] as unknown[]).length > 0;

    let route = "standard-path";
    if (hard || risk >= 70 || (risk >= 55 && complexity >= 60)) {
      route = "full-governance-path";
    } else if (risk < 30 && complexity < 35) {
      route = "fast-path";
    }
    return { route, lanePlan: defaultLanePlan(route) };
  },

  buildExecutionPlan(decision: RouteDecision): RouteDecision {
    // Task policy returns lanePlan already; this function is an idempotent normalizer.
    return decision;
  },

  decideNextAction(ctx: ControlContext): ControlDecision {
    // TODO: implement upgrade pressure + retry/revise limits
    // For now, always advance; controllers will enforce handoff checks.
    return { action: "advance" };
  },
};

// Register on import
PolicyRegistry.register(TaskGovernancePolicy);
