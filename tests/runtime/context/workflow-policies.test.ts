import { classifyIntent } from "../../../runtime/orchestration/intent-classifier.ts";
import { LearningProgressionPolicy } from "../../../runtime/context/policies/learning-progression.ts";
import { TaskGovernancePolicy } from "../../../runtime/context/policies/task-governance.ts";
import type { WorkItem } from "../../../runtime/context/policies/types.ts";
import { evaluateWorkflowRequest } from "../../../runtime/orchestration/workflow-orchestrator.ts";

test("classifyIntent should select task-governance for delivery work", () => {
  const result = classifyIntent({ text: "Implement a local bugfix in the CLI router" });

  expect(result.workItemType).toBe("task");
  expect(result.candidatePolicyPack).toBe("task-governance");
});

test("classifyIntent should select learning-progression for study work", () => {
  const result = classifyIntent({ text: "Study feedback control and collect research material" });

  expect(result.workItemType).toBe("learning");
  expect(result.candidatePolicyPack).toBe("learning-progression");
});

test("TaskGovernancePolicy should route risky task to full governance", () => {
  const item: WorkItem = {
    kind: "task",
    payload: {
      title: "Migrate public API auth schema",
      description: "Design security migration and deploy auth change",
    },
  };

  const profile = TaskGovernancePolicy.evaluateProfile(item);
  const decision = TaskGovernancePolicy.selectRoute(profile);

  expect(decision.route).toBe("full-governance-path");
  expect("lanePlan" in decision).toBe(true);
});

test("LearningProgressionPolicy should route empty evidence to survey cycle", () => {
  const item: WorkItem = {
    kind: "learning",
    payload: {
      topic: "feedback control",
      objective: "Build a knowledge map",
      evidenceSummary: {
        sources: 0,
        syntheses: 0,
        validations: 0,
      },
    },
  };

  const profile = LearningProgressionPolicy.evaluateProfile(item);
  const decision = LearningProgressionPolicy.selectRoute(profile);

  expect(decision.route).toBe("survey-cycle");
  expect("studyPlan" in decision).toBe(true);
});

test("evaluateWorkflowRequest should classify task request into task-governance plan", () => {
  const result = evaluateWorkflowRequest({
    text: "Implement a local bugfix",
    taskId: "task-1",
    taskType: "bugfix",
    tags: ["cli", "test"],
  });

  expect(result.workItemType).toBe("task");
  expect(result.policyPack).toBe("task-governance");
  expect(result.route).toBe("fast-path");
  expect(result.firstLane).toBe("coordinator");
});

test("evaluateWorkflowRequest should classify campaign request into learning-progression plan", () => {
  const result = evaluateWorkflowRequest({
    campaign: "Study feedback control",
    campaignId: "learn-1",
    tags: ["control"],
  });

  expect(result.workItemType).toBe("learning");
  expect(result.policyPack).toBe("learning-progression");
  expect(result.route).toBe("synthesis-cycle");
  expect(result.studyPlan).toBeDefined();
  expect(result.studyPlan?.nodes).toHaveLength(3);
  expect(result.studyPlan?.nodes[0]?.type).toBe("source-discovery");
  expect(result.studyPlan?.dependencies).toEqual([
    ["source-discovery", "extraction"],
    ["extraction", "synthesis"],
  ]);
});
