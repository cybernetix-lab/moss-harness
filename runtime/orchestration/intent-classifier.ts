/**
 * Intent Classifier (Skeleton)
 *
 * This stage only selects the policy family and captures basic intent metadata.
 * It must not make the final route decision.
 */

export type IntentRecognitionResult = {
  workItemType: "task" | "learning";
  candidatePolicyPack: "task-governance" | "learning-progression";
  confidence: number;
  domainTags: string[];
  initialGoal: string;
};

export function classifyIntent(input: {
  text: string;
  domainTags?: string[];
}): IntentRecognitionResult {
  const text = input.text.trim();
  const tags = [...(input.domainTags ?? [])];
  const learningHint = /\b(learn|study|research|survey|synthesize|knowledge|阅读|学习|调研|资料)\b/i.test(
    text,
  );

  return {
    workItemType: learningHint ? "learning" : "task",
    candidatePolicyPack: learningHint
      ? "learning-progression"
      : "task-governance",
    confidence: learningHint ? 0.82 : 0.78,
    domainTags: tags,
    initialGoal: text,
  };
}

