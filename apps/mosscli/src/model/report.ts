import type { FeedbackDecision, FlowRunStatus, StageSnapshot } from "./run.js";

export interface MossHarnessJsonReport {
  run_id: string;
  status: FlowRunStatus;
  goal: string;
  current_stage: string;
  selected_agent: string;
  summary: {
    reworkCount: number;
    retryCount: number;
    completedStages: number;
  };
  feedback: FeedbackDecision[];
  moss_fallback_rate: number;
  moss_rework_rate: number;
  moss_expert_hit_rate: number;
  moss_stage_avg_duration: number;
  metrics: {
    moss_fallback_rate: number;
    moss_rework_rate: number;
    moss_expert_hit_rate: number;
    moss_stage_avg_duration: number;
  };
  systemSignals: {
    summary: string;
    degradedByFallback: boolean;
    reworkObserved: boolean;
  };
  stages: StageSnapshot[];
}

export interface MossLearningJsonReport {
  report_type: "learning";
  campaign_id: string;
  policy_pack: string;
  route: string;
  route_state: string;
  iteration: number;
  study_plan: {
    iteration: number;
    nodes: Array<Record<string, unknown>>;
    dependencies: Array<[string, string]>;
  };
  delegated_task_ids: string[];
  delegated_tasks: Array<Record<string, unknown>>;
  summary: {
    delegatedTasks: number;
    createdTasks: number;
    skippedTasks: number;
  };
}

export type MosscliJsonReport = MossHarnessJsonReport | MossLearningJsonReport;
