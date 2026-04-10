import path from "node:path";

import { ClaimEngineAdapter } from "../adapters/claim-engine-adapter.js";
import { TaskBoardAdapter } from "../adapters/task-board-adapter.js";
import { bootstrapLanePresence } from "../bootstrap/presence-bootstrap.js";
import type {
  ClaimResult,
  FlowRun,
  RunSummary,
  StageDecision,
  StageName,
  StageResultEnvelope,
  StageSnapshot,
  TimelineEvent,
} from "../model/run.js";
import { MosscliFileStore } from "../store/file-store.js";
import { nowIsoString, createRunId } from "../shared/runtime.js";
import { FeedbackController } from "./feedback-controller.js";
import { determineStageTransition } from "./stage-machine.js";

interface FlowRunnerOptions {
  goal: string;
}

interface StageExecutionResult {
  envelope: StageResultEnvelope;
  snapshot: StageSnapshot;
  timelineEvents: TimelineEvent[];
}

export interface FlowRunnerResult {
  run: FlowRun;
  summary: RunSummary;
}

const STAGE_TO_ARTIFACT: Record<StageName, string> = {
  planner: "plan.md",
  reviewer: "review.md",
  executor: "execution.md",
  evaluator: "evaluation.md",
};

export class FlowRunner {
  private readonly store = new MosscliFileStore();
  private readonly taskBoard = new TaskBoardAdapter();
  private readonly claimEngine = new ClaimEngineAdapter();
  private readonly feedbackController = new FeedbackController();

  run(options: FlowRunnerOptions): FlowRunnerResult {
    const startedAt = new Date();
    const runId = createRunId(startedAt);
    const createdAt = nowIsoString(startedAt);
    let stage: StageName = "planner";
    let sequence = 1;
    let reworkCount = 0;
    let retryCount = 0;
    let currentTimestamp = createdAt;
    let latestClaim: ClaimResult | null = null;

    let run: FlowRun = {
      run_id: runId,
      goal: options.goal,
      status: "running",
      created_at: createdAt,
      updated_at: createdAt,
      current_stage: stage,
      current_stage_sequence: sequence,
      selected_agent: "",
      task_id: "",
      request_id: "",
    };

    this.store.writeCurrentRun(run);
    this.store.writeRun(run);
    this.store.appendTimelineEvent(runId, {
      type: "run_created",
      timestamp: createdAt,
      run_id: runId,
      source: "mosscli",
      data: {
        goal: options.goal,
      },
    });

    while (true) {
      const executedStage = this.executeStage(runId, options.goal, stage, sequence);
      latestClaim = {
        task_id: executedStage.snapshot.task_id,
        lane: executedStage.snapshot.lane,
        selected_agent: executedStage.snapshot.selected_agent,
        selected_mode: executedStage.snapshot.selected_mode,
        selection_reason: executedStage.snapshot.selection_reason,
        fallback_used: executedStage.snapshot.fallback_used,
        claim_id: executedStage.snapshot.claim_id,
        request_id: executedStage.snapshot.request_id,
        run_id: runId,
        stage,
        flow_sequence: sequence,
      };
      currentTimestamp = executedStage.envelope.completed_at;

      for (const event of executedStage.timelineEvents) {
        this.store.appendTimelineEvent(runId, event);
      }

      const feedbackDecisions = this.feedbackController.evaluate({
        runId,
        stage,
        decision: executedStage.envelope.decision,
        fallbackUsed: executedStage.snapshot.fallback_used,
        confidence: executedStage.envelope.quality_signal?.confidence,
        timestamp: currentTimestamp,
        sequence,
      });
      for (const feedbackDecision of feedbackDecisions) {
        this.store.appendFeedbackDecision(runId, feedbackDecision);
      }

      const transition = determineStageTransition(stage, executedStage.envelope.decision, reworkCount, retryCount);
      reworkCount += transition.reworkIncrement;
      retryCount += transition.retryIncrement;

      if (transition.terminalStatus) {
        run = {
          ...run,
          status: transition.terminalStatus,
          updated_at: currentTimestamp,
          current_stage: stage,
          current_stage_sequence: sequence,
          selected_agent: latestClaim.selected_agent,
          task_id: latestClaim.task_id,
          request_id: latestClaim.request_id,
        };
        break;
      }

      if (transition.nextStage === null) {
        run = {
          ...run,
          status: "failed",
          updated_at: currentTimestamp,
          current_stage: stage,
          current_stage_sequence: sequence,
          selected_agent: latestClaim.selected_agent,
          task_id: latestClaim.task_id,
          request_id: latestClaim.request_id,
        };
        break;
      }

      stage = transition.nextStage;
      sequence += 1;
      run = {
        ...run,
        updated_at: currentTimestamp,
        current_stage: stage,
        current_stage_sequence: sequence,
        selected_agent: latestClaim.selected_agent,
        task_id: latestClaim.task_id,
        request_id: latestClaim.request_id,
      };
    }

    this.store.writeCurrentRun(run);
    this.store.writeRun(run);

    const summary: RunSummary = {
      run_id: runId,
      status: run.status,
      reworkCount,
      retryCount,
      completedStages: sequence,
      updated_at: currentTimestamp,
    };
    this.store.writeSummary(runId, summary);

    return { run, summary };
  }

  private executeStage(
    runId: string,
    goal: string,
    stage: StageName,
    sequence: number,
  ): StageExecutionResult {
    const taskId = `${runId}-${stage}-${String(sequence).padStart(2, "0")}`;
    const stageStartedAt = nowIsoString(new Date());

    bootstrapLanePresence(stage);
    this.taskBoard.createTask({
      lane: stage,
      taskId,
      taskType: "flow_stage",
      tags: [stage, "mosscli"],
      priority: "high",
      runId,
      stage,
      flowSequence: sequence,
    });

    const claim = this.claimEngine.claimTask({
      lane: stage,
      taskId,
      runId,
      stage,
      flowSequence: sequence,
    });

    const handlerResult = this.runStageHandler(runId, goal, stage, sequence, claim);
    const artifactPath = this.store.writeArtifact(runId, STAGE_TO_ARTIFACT[stage], handlerResult.content);
    const completedAt = nowIsoString(new Date());

    const envelope: StageResultEnvelope = {
      run_id: runId,
      stage,
      sequence,
      status: handlerResult.status,
      decision: handlerResult.decision,
      summary: handlerResult.summary,
      artifact_path: artifactPath,
      completed_at: completedAt,
      quality_signal: handlerResult.confidence === undefined
        ? undefined
        : { confidence: handlerResult.confidence },
    };

    const snapshot: StageSnapshot = {
      run_id: runId,
      stage,
      sequence,
      status: envelope.status,
      captured_at: completedAt,
      lane: claim.lane,
      task_id: taskId,
      selected_agent: claim.selected_agent,
      selected_mode: claim.selected_mode,
      selection_reason: claim.selection_reason ?? "",
      fallback_used: claim.fallback_used,
      claim_id: claim.claim_id,
      request_id: claim.request_id,
      artifact_path: artifactPath,
      decision: envelope.decision,
      completed_at: completedAt,
      summary: envelope.summary,
    };

    this.store.writeStageSnapshot(runId, snapshot);
    this.store.writeStageResult(runId, envelope);

    return {
      envelope,
      snapshot,
      timelineEvents: [
        {
          type: "stage_claimed",
          timestamp: stageStartedAt,
          run_id: runId,
          stage,
          sequence,
          source: "mosscli",
          data: {
            task_id: taskId,
            selected_agent: claim.selected_agent,
            selected_mode: claim.selected_mode,
          },
        },
        {
          type: "stage_completed",
          timestamp: completedAt,
          run_id: runId,
          stage,
          sequence,
          source: "mosscli",
          data: {
            decision: envelope.decision,
            artifact_path: path.basename(artifactPath),
            summary: envelope.summary,
          },
        },
      ],
    };
  }

  private runStageHandler(
    runId: string,
    goal: string,
    stage: StageName,
    sequence: number,
    claim: ClaimResult,
  ): {
    status: "completed" | "failed";
    decision: StageDecision;
    content: string;
    summary: string;
    confidence?: number;
  } {
    if (stage === "planner") {
      return {
        status: "completed",
        decision: "planned",
        content: `# Plan\n\nRun: ${runId}\nGoal: ${goal}\nSequence: ${sequence}\nPlanner: ${claim.selected_agent}\n`,
        summary: "Planner generated the implementation plan.",
      };
    }

    if (stage === "reviewer") {
      const forcedReject = process.env.MOSSCLI_FORCE_REVIEW_REJECT === "1";
      return {
        status: "completed",
        decision: forcedReject ? "rejected" : "approved",
        content: `# Review\n\nRun: ${runId}\nDecision: ${forcedReject ? "rejected" : "approved"}\nReviewer: ${claim.selected_agent}\n`,
        summary: forcedReject
          ? "Reviewer requested a rework."
          : "Reviewer approved the plan.",
      };
    }

    if (stage === "executor") {
      return {
        status: "completed",
        decision: "implemented",
        content: `# Execution\n\nRun: ${runId}\nExecutor: ${claim.selected_agent}\nImplementation completed.\n`,
        summary: "Executor produced the implementation artifact.",
        confidence: 0.92,
      };
    }

    return {
      status: "completed",
      decision: "passed",
      content: `# Evaluation\n\nRun: ${runId}\nEvaluator: ${claim.selected_agent}\nEvaluation passed.\n`,
      summary: "Evaluator passed the run.",
    };
  }
}
