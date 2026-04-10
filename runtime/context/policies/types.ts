/**
 * Workflow Orchestrator Policy Interfaces (Skeleton)
 *
 * This module defines the thin, stable interfaces that both Task Governance Policy
 * and Learning Progression Policy implement. Keep this file minimal and durable.
 *
 * Notes:
 * - Do not perform I/O in policy implementations. Policies are pure decision layers.
 * - Controllers and router scripts handle side-effects (task creation, state moves).
 */

export type WorkItem =
  | { kind: "task"; payload: TaskBrief }
  | { kind: "learning"; payload: CampaignSnapshot };

export type TaskBrief = {
  taskId?: string;
  title?: string;
  description?: string;
  domainTags?: string[];
};

export type CampaignSnapshot = {
  campaignId?: string;
  topic?: string;
  objective?: string;
  // Optional summary of current evidence & artifacts (policy may use to decide next step)
  evidenceSummary?: {
    sources?: number;
    extractions?: number;
    syntheses?: number;
    validations?: number;
  };
  domainTags?: string[];
};

export type Profile = Record<string, unknown>;

export type LanePlan = {
  required_lanes: string[];
  conditional_lanes?: string[];
  optional_support_lanes?: string[];
  current_lane?: string | null;
  next_lane?: string | null;
};

export type StudyNode =
  | { type: "source-discovery"; topic: string }
  | { type: "extraction"; batch: string }
  | { type: "synthesis"; target: string }
  | { type: "validation"; on: string }
  | { type: "gap-analysis"; focus?: string };

export type StudyPlan = {
  iteration: number;
  nodes: StudyNode[];
  dependencies: Array<[string, string]>; // simple pair deps by node labels (impl-specific)
};

export type RouteDecision =
  | { route: string; lanePlan: LanePlan } // task governance
  | { route: string; studyPlan: StudyPlan }; // learning progression

export type ControlDecision =
  | { action: "advance" }
  | { action: "retry" }
  | { action: "revise"; reason?: string }
  | { action: "upgrade"; to?: string; reason?: string }
  | { action: "replan"; reason?: string }
  | { action: "stop" }
  | { action: "fail"; reason?: string };

export type ControlContext = {
  workItem: WorkItem;
  lastDecision?: RouteDecision;
  // minimal evidence hook; controllers may enrich at runtime
  evidence?: Record<string, unknown>;
};

export interface PolicyPack {
  name: "task-governance" | "learning-progression";
  evaluateProfile(input: WorkItem): Profile;
  selectRoute(profile: Profile): RouteDecision;
  buildExecutionPlan(decision: RouteDecision): RouteDecision; // idempotent normalize
  decideNextAction(ctx: ControlContext): ControlDecision;
}

/**
 * Simple in-memory registry so router/controllers can fetch active policies.
 * Replace with DI if/when needed.
 */
class Registry {
  private packs = new Map<PolicyPack["name"], PolicyPack>();

  register(pack: PolicyPack): void {
    this.packs.set(pack.name, pack);
  }

  get(name: PolicyPack["name"]): PolicyPack {
    const pack = this.packs.get(name);
    if (!pack) throw new Error(`PolicyPack not registered: ${name}`);
    return pack;
  }
}

export const PolicyRegistry = new Registry();

