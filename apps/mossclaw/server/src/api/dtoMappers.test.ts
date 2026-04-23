import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Agent } from '../domain/models/Agent';
import type { Skill } from '../domain/models/Skill';
import type { Task } from '../domain/models/task';
import type {
  AgentDto,
  CreateTaskRequestDto,
  ExecuteTaskResponseDto,
  SkillDto,
  TaskDto
} from '@mossclaw/shared';
import { toAgentDto, toSkillDto, toTaskDto } from './dtoMappers';

describe('dtoMappers', () => {
  it('应将 Task 领域模型映射为共享 Task DTO 并保留 goal/config/stages/artifacts/events/metrics 结构', () => {
    const task: Task = {
      id: 'task-1',
      goal: 'Create shared task contracts for mossclaw',
      status: 'running',
      config: {
        entryAgentName: 'planner',
        priority: 'high',
        selectedSkills: ['typescript-patterns']
      },
      stages: [
        {
          id: 'stage-1',
          name: 'planner',
          status: 'completed',
          agentName: 'planner',
          startedAt: '2026-04-14T10:00:00.000Z',
          completedAt: '2026-04-14T10:02:00.000Z',
          input: { brief: 'shared contract migration' },
          output: { plan: 'use split shared modules' },
          feedback: {
            verdict: 'approved',
            comments: ['looks good']
          }
        }
      ],
      artifacts: [
        {
          id: 'artifact-1',
          stageId: 'stage-1',
          type: 'document',
          name: 'plan.md',
          path: '/tmp/plan.md',
          size: 128,
          mimeType: 'text/markdown',
          createdAt: '2026-04-14T10:02:30.000Z'
        }
      ],
      events: [
        {
          id: 'event-1',
          type: 'task_started',
          timestamp: '2026-04-14T10:00:30.000Z',
          payload: { taskId: 'task-1' }
        }
      ],
      metrics: {
        durationMs: 300000,
        completedStages: 1
      },
      createdAt: new Date('2026-04-14T10:00:00.000Z'),
      updatedAt: new Date('2026-04-14T10:05:00.000Z')
    };

    const dto = toTaskDto(task);

    expect(dto).toEqual({
      id: 'task-1',
      goal: 'Create shared task contracts for mossclaw',
      status: 'running',
      config: {
        entryAgentName: 'planner',
        priority: 'high',
        selectedSkills: ['typescript-patterns']
      },
      stages: [
        {
          id: 'stage-1',
          name: 'planner',
          status: 'completed',
          agentName: 'planner',
          startedAt: '2026-04-14T10:00:00.000Z',
          completedAt: '2026-04-14T10:02:00.000Z',
          input: { brief: 'shared contract migration' },
          output: { plan: 'use split shared modules' },
          feedback: {
            verdict: 'approved',
            comments: ['looks good']
          }
        }
      ],
      artifacts: [
        {
          id: 'artifact-1',
          stageId: 'stage-1',
          type: 'document',
          name: 'plan.md',
          path: '/tmp/plan.md',
          size: 128,
          mimeType: 'text/markdown',
          createdAt: '2026-04-14T10:02:30.000Z'
        }
      ],
      events: [
        {
          id: 'event-1',
          type: 'task_started',
          timestamp: '2026-04-14T10:00:30.000Z',
          payload: { taskId: 'task-1' }
        }
      ],
      metrics: {
        durationMs: 300000,
        completedStages: 1
      },
      createdAt: '2026-04-14T10:00:00.000Z',
      updatedAt: '2026-04-14T10:05:00.000Z'
    } satisfies TaskDto);
  });

  it('应将 Agent 领域模型映射为共享 Agent DTO 并保留能力配置', () => {
    const agent: Agent = {
      id: 'agent-1',
      name: 'planner',
      type: 'planning',
      description: 'Plans work',
      systemPrompt: 'plan carefully',
      modelConfig: {
        provider: 'anthropic',
        modelName: 'claude-sonnet-4',
        temperature: 0.3,
        maxTokens: 8192
      },
      status: 'IDLE',
      isBuiltin: true,
      isDisabled: false,
      createdAt: new Date('2026-04-14T09:00:00.000Z'),
      updatedAt: new Date('2026-04-14T09:30:00.000Z')
    };

    const dto = toAgentDto(agent);

    expect(dto).toEqual({
      id: 'agent-1',
      name: 'planner',
      type: 'planning',
      description: 'Plans work',
      systemPrompt: 'plan carefully',
      modelConfig: {
        provider: 'anthropic',
        modelName: 'claude-sonnet-4',
        temperature: 0.3,
        maxTokens: 8192
      },
      status: 'IDLE',
      isBuiltin: true,
      isDisabled: false,
      createdAt: '2026-04-14T09:00:00.000Z',
      updatedAt: '2026-04-14T09:30:00.000Z'
    } satisfies AgentDto);
  });

  it('应将 Skill 领域模型映射为共享 Skill DTO 并保留嵌套结构', () => {
    const skill: Skill = {
      id: 'skill-1',
      name: 'react-hooks',
      category: 'coding',
      version: '1.0.0',
      description: 'React hooks best practices',
      author: 'moss',
      triggers: [{ pattern: 'useEffect', confidence: 0.8 }],
      patterns: [{ name: 'effect', description: 'effect pattern', template: '...' }],
      actions: [{ type: 'review', description: 'Review hook usage', steps: ['inspect'] }],
      contextRequirements: { requiredFiles: ['src/App.tsx'], preferredModels: ['claude'] },
      validation: ['npm test'],
      examples: [{ input: 'bad hook', output: 'good hook', explanation: 'fixed deps' }],
      uiMetadata: { icon: 'code', dependencies: ['react'] },
      isBuiltin: true,
      isDisabled: false,
      createdAt: new Date('2026-04-14T08:00:00.000Z'),
      updatedAt: new Date('2026-04-14T08:30:00.000Z')
    };

    const dto = toSkillDto(skill);

    expect(dto).toEqual({
      id: 'skill-1',
      name: 'react-hooks',
      category: 'coding',
      version: '1.0.0',
      description: 'React hooks best practices',
      author: 'moss',
      triggers: [{ pattern: 'useEffect', confidence: 0.8 }],
      patterns: [{ name: 'effect', description: 'effect pattern', template: '...' }],
      actions: [{ type: 'review', description: 'Review hook usage', steps: ['inspect'] }],
      contextRequirements: { requiredFiles: ['src/App.tsx'], preferredModels: ['claude'] },
      validation: ['npm test'],
      examples: [{ input: 'bad hook', output: 'good hook', explanation: 'fixed deps' }],
      uiMetadata: { icon: 'code', dependencies: ['react'] },
      isBuiltin: true,
      isDisabled: false,
      createdAt: '2026-04-14T08:00:00.000Z',
      updatedAt: '2026-04-14T08:30:00.000Z'
    } satisfies SkillDto);
  });

  it('共享 DTO 应覆盖当前 task API 的请求与执行响应契约', () => {
    const request: CreateTaskRequestDto = {
      goal: 'Backfill shared task contract',
      config: {
        entryAgentName: 'planner',
        priority: 'medium'
      }
    };
    const response: ExecuteTaskResponseDto = {
      message: 'Task execution started',
      taskId: 'task-1'
    };

    expect(request.config.entryAgentName).toBe('planner');
    expect(response.message).toBe('Task execution started');
    expectTypeOf(request).toMatchTypeOf<CreateTaskRequestDto>();
    expectTypeOf(response).toMatchTypeOf<ExecuteTaskResponseDto>();
  });
});
