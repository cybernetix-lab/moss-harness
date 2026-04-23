import type { AgentDto, SkillDto, TaskDto } from '@mossclaw/shared';
import type { Agent } from '../domain/models/Agent';
import type { Skill } from '../domain/models/Skill';
import type { Task, TaskArtifact, TaskEvent, TaskStage } from '../domain/models/task';

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    goal: task.goal,
    status: task.status,
    config: { ...task.config },
    stages: task.stages.map((stage: TaskStage) => ({
      ...stage,
      input: stage.input ? { ...stage.input } : undefined,
      output: stage.output ? { ...stage.output } : undefined,
      feedback: stage.feedback
        ? {
            verdict: stage.feedback.verdict,
            comments: [...stage.feedback.comments],
            suggestions: stage.feedback.suggestions ? [...stage.feedback.suggestions] : undefined
          }
        : undefined
    })),
    artifacts: task.artifacts.map((artifact: TaskArtifact) => ({ ...artifact })),
    events: task.events.map((event: TaskEvent) => ({
      ...event,
      payload: { ...event.payload }
    })),
    metrics: { ...task.metrics },
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function toAgentDto(agent: Agent): AgentDto {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    modelConfig: {
      provider: agent.modelConfig.provider,
      modelName: agent.modelConfig.modelName,
      temperature: agent.modelConfig.temperature,
      maxTokens: agent.modelConfig.maxTokens
    },
    status: agent.status,
    isBuiltin: agent.isBuiltin,
    isDisabled: agent.isDisabled,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString()
  };
}

export function toSkillDto(skill: Skill): SkillDto {
  return {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    version: skill.version,
    description: skill.description,
    author: skill.author,
    triggers: skill.triggers.map((trigger) => ({
      pattern: trigger.pattern,
      confidence: trigger.confidence
    })),
    patterns: skill.patterns.map((pattern) => ({
      name: pattern.name,
      description: pattern.description,
      template: pattern.template
    })),
    actions: skill.actions.map((action) => ({
      type: action.type,
      description: action.description,
      steps: [...action.steps]
    })),
    contextRequirements: {
      requiredFiles: skill.contextRequirements.requiredFiles
        ? [...skill.contextRequirements.requiredFiles]
        : undefined,
      preferredModels: skill.contextRequirements.preferredModels
        ? [...skill.contextRequirements.preferredModels]
        : undefined
    },
    validation: [...skill.validation],
    examples: skill.examples.map((example) => ({
      input: example.input,
      output: example.output,
      explanation: example.explanation
    })),
    uiMetadata: {
      icon: skill.uiMetadata.icon,
      dependencies: skill.uiMetadata.dependencies ? [...skill.uiMetadata.dependencies] : undefined
    },
    isBuiltin: skill.isBuiltin,
    isDisabled: skill.isDisabled,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString()
  };
}
