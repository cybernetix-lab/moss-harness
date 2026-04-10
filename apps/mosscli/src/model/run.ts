export const STAGE_SEQUENCE = ["planner", "reviewer", "executor", "evaluator"] as const;

export type StageName = (typeof STAGE_SEQUENCE)[number];
export type FlowRunStatus = "running" | "completed" | "failed";
export type StageStatus = "claimed" | "completed" | "failed";
export type StageDecision =
  | "planned"
  | "approved"
  | "rejected"
  | "implemented"
  | "passed"
  | "failed";

export interface FlowRun {
  run_id: string;
  goal: string;
  status: FlowRunStatus;
  created_at: string;
  updated_at: string;
  current_stage: StageName;
  current_stage_sequence: number;
  selected_agent: string;
  task_id: string;
  request_id: string;
}

export interface StageSnapshot {
  run_id: string;
  stage: StageName;
  sequence: number;
  status: StageStatus;
  captured_at: string;
  lane: string;
  task_id: string;
  selected_agent: string;
  selected_mode: string;
  selection_reason: string;
  fallback_used: boolean;
  claim_id: string;
  request_id: string;
  artifact_path?: string;
  decision?: StageDecision;
  completed_at?: string;
  summary?: string;
}

export interface ClaimResult {
  task_id: string;
  lane: string;
  selected_agent: string;
  selected_mode: string;
  selection_reason?: string;
  fallback_used: boolean;
  claim_id: string;
  request_id: string;
  run_id?: string;
  stage?: string;
  flow_sequence?: number;
}

export interface StageResultEnvelope {
  run_id: string;
  stage: StageName;
  sequence: number;
  status: Exclude<StageStatus, "claimed">;
  decision: StageDecision;
  summary: string;
  artifact_path: string;
  completed_at: string;
  quality_signal?: {
    confidence?: number;
  };
}

export interface RunSummary {
  run_id: string;
  status: FlowRunStatus;
  reworkCount: number;
  retryCount: number;
  completedStages: number;
  updated_at: string;
}

export interface TimelineEvent {
  type: string;
  timestamp: string;
  run_id: string;
  stage?: StageName;
  sequence?: number;
  source: "mosscli";
  data: Record<string, unknown>;
}

export interface FeedbackDecision {
  id: string;
  runId: string;
  trigger: "review_rejected" | "executor_low_confidence" | "fallback_claim_used";
  sourceStage: StageName;
  action: "send_to_previous_stage" | "retry_same_stage" | "escalate_to_evaluator" | "mark_run_degraded" | "abort_run";
  reason: string;
  createdAt: string;
  applied: boolean;
}
