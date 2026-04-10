#!/usr/bin/env node

import { classifyIntent } from "./intent-classifier.ts";
import { LearningProgressionPolicy } from "../context/policies/learning-progression.ts";
import { TaskGovernancePolicy } from "../context/policies/task-governance.ts";
import type { RouteDecision, WorkItem, StudyPlan } from "../context/policies/types.ts";

export type WorkflowEvaluationInput = {
  text?: string;
  taskId?: string;
  taskType?: string;
  campaign?: string;
  campaignId?: string;
  tags?: string[];
};

export type WorkflowEvaluationResult = {
  workItemType: "task" | "learning";
  policyPack: "task-governance" | "learning-progression";
  route: string;
  firstLane?: string;
  taskId?: string;
  campaignId?: string;
  studyPlan?: StudyPlan;
};

function getFirstLane(decision: RouteDecision): string | undefined {
  if ("lanePlan" in decision) {
    return decision.lanePlan.current_lane ?? decision.lanePlan.required_lanes[0];
  }
  return undefined;
}

function buildStudyPlanForRoute(route: string): StudyPlan {
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

export function evaluateWorkflowRequest(input: WorkflowEvaluationInput): WorkflowEvaluationResult {
  if (input.campaign) {
    const explicitSurvey = /\b(survey|资料|收集|检索)\b/i.test(input.campaign);
    const route = explicitSurvey ? "survey-cycle" : "synthesis-cycle";
    return {
      workItemType: "learning",
      policyPack: "learning-progression",
      route,
      campaignId: input.campaignId,
      studyPlan: buildStudyPlanForRoute(route),
    };
  }

  const text = input.text ?? "";
  const intent = classifyIntent({ text, domainTags: input.tags });

  if (intent.workItemType === "learning") {
    const workItem: WorkItem = {
      kind: "learning",
      payload: {
        campaignId: input.campaignId,
        topic: text,
        objective: intent.initialGoal,
        domainTags: intent.domainTags,
      },
    };
    const profile = LearningProgressionPolicy.evaluateProfile(workItem);
    const decision = LearningProgressionPolicy.selectRoute(profile);
    return {
      workItemType: "learning",
      policyPack: "learning-progression",
      route: decision.route,
      campaignId: input.campaignId,
      studyPlan: "studyPlan" in decision ? decision.studyPlan : undefined,
    };
  }

  const workItem: WorkItem = {
    kind: "task",
    payload: {
      taskId: input.taskId,
      title: input.text,
      description: input.text,
      domainTags: input.tags,
    },
  };
  const profile = TaskGovernancePolicy.evaluateProfile(workItem);
  const decision = TaskGovernancePolicy.selectRoute(profile);
  return {
    workItemType: "task",
    policyPack: "task-governance",
    route: decision.route,
    firstLane: getFirstLane(decision),
    taskId: input.taskId,
  };
}

function main(): void {
  const raw = process.argv[2];
  if (!raw) {
    process.stderr.write("workflow-orchestrator.ts expects a JSON payload argument\n");
    process.exit(1);
  }

  const input = JSON.parse(raw) as WorkflowEvaluationInput;
  process.stdout.write(JSON.stringify(evaluateWorkflowRequest(input)));
}

if (process.argv[1]) {
  const scriptName = process.argv[1].split(/[\\/]/).pop();
  if (scriptName === "workflow-orchestrator.ts" || scriptName === "workflow-orchestrator.js") {
    main();
  }
}
