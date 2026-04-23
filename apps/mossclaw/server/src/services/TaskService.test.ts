import { describe, expect, it, vi } from 'vitest';
import { TaskService } from './TaskService';
import type { Task } from '../domain/models/task';
import type { Agent } from '../domain/models/Agent';

const scheduleMock = vi.fn();

vi.mock('@agent-harness/core/subagent', () => ({
  TaskScheduler: class {
    on() {}
    async initialize() {}
    async start() {}
    async schedule(task: unknown) {
      await scheduleMock(task);
    }
  }
}));

vi.mock('@agent-harness/core/storage', () => ({
  DEFAULT_STORAGE_CONFIG: {},
  createStorage: async () => ({})
}));

vi.mock('@agent-harness/core/subagent/registry', () => ({
  SubAgentRegistry: class {
    async initialize() {}
  }
}));

class StubTaskRepository {
  constructor(private task: Task | null) {}

  async findById(): Promise<Task | null> {
    return this.task;
  }

  async findAll(): Promise<Task[]> {
    return this.task ? [this.task] : [];
  }

  async create(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
}

class StubAgentRepository {
  constructor(private agent: Agent | null) {}

  async findById(): Promise<Agent | null> {
    return this.agent;
  }

  async findByName(): Promise<Agent | null> {
    return this.agent;
  }

  async findAll(): Promise<Agent[]> {
    return this.agent ? [this.agent] : [];
  }

  async create(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
}

describe('TaskService', () => {
  it('创建任务时应初始化新的 task contract 结构', async () => {
    const createSpy = vi.fn();
    const service = new TaskService(
      {
        findById: async () => null,
        findAll: async () => [],
        create: createSpy,
        update: async () => undefined,
        delete: async () => undefined
      } as never,
      new StubAgentRepository(null) as never,
      { to: () => ({ emit: () => undefined }) } as never
    );

    const task = await service.createTask('Ship the shared contract migration', {
      entryAgentName: 'planner',
      priority: 'high'
    });

    expect(task.goal).toBe('Ship the shared contract migration');
    expect(task.config).toEqual({
      entryAgentName: 'planner',
      priority: 'high'
    });
    expect(task.stages).toEqual([]);
    expect(task.artifacts).toEqual([]);
    expect(task.events).toEqual([]);
    expect(task.metrics).toEqual({});
    expect(createSpy).toHaveBeenCalledWith(task);
  });

  it('执行任务前应拦截已禁用的 Agent', async () => {
    const task: Task = {
      id: 'task-1',
      goal: 'blocked-task',
      status: 'pending',
      config: {
        entryAgentName: 'planner'
      },
      stages: [],
      artifacts: [],
      events: [],
      metrics: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const agent: Agent = {
      id: 'agent-1',
      name: 'planner',
      type: 'planning',
      description: '',
      systemPrompt: '',
      modelConfig: {
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        temperature: 0.3,
        maxTokens: 4096
      },
      status: 'IDLE',
      isBuiltin: true,
      isDisabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const service = new TaskService(
      new StubTaskRepository(task) as never,
      new StubAgentRepository(agent) as never,
      { to: () => ({ emit: () => undefined }) } as never
    );

    service.init = async () => undefined;

    await expect(service.executeTask('task-1')).rejects.toThrow('Agent is disabled: planner');
  });

  it('执行任务时应使用 goal 作为 prompt，并从 config.entryAgentName 读取执行入口', async () => {
    scheduleMock.mockReset();

    const task: Task = {
      id: 'task-2',
      goal: 'Refactor shared DTO contract',
      status: 'pending',
      config: {
        entryAgentName: 'planner',
        priority: 'medium'
      },
      stages: [],
      artifacts: [],
      events: [],
      metrics: {},
      createdAt: new Date('2026-04-14T10:00:00.000Z'),
      updatedAt: new Date('2026-04-14T10:00:00.000Z')
    };

    const agent: Agent = {
      id: 'agent-1',
      name: 'planner',
      type: 'planning',
      description: '',
      systemPrompt: '',
      modelConfig: {
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        temperature: 0.3,
        maxTokens: 4096
      },
      status: 'IDLE',
      isBuiltin: true,
      isDisabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updateSpy = vi.fn();
    const service = new TaskService(
      {
        findById: async () => task,
        findAll: async () => [task],
        create: async () => undefined,
        update: updateSpy,
        delete: async () => undefined
      } as never,
      new StubAgentRepository(agent) as never,
      { to: () => ({ emit: () => undefined }) } as never
    );

    await service.init();
    await service.executeTask('task-2');

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-2',
        agentName: 'planner',
        prompt: 'Refactor shared DTO contract',
        metadata: expect.objectContaining({
          sessionId: 'MossClaw'
        })
      })
    );
    expect(updateSpy).toHaveBeenCalled();
    expect(task.events).toHaveLength(1);
    expect(task.events[0]?.type).toBe('agent_log');
  });

  it('重试任务时应复制为新任务并重置为 pending 状态', async () => {
    const existingTask: Task = {
      id: 'task-3',
      goal: 'Retry the failed task',
      status: 'failed',
      config: {
        entryAgentName: 'reviewer',
        priority: 'medium'
      },
      stages: [
        {
          id: 'stage-1',
          name: 'scheduled',
          status: 'failed'
        }
      ],
      artifacts: [
        {
          id: 'artifact-1',
          type: 'log',
          name: 'failure.log',
          path: '/tmp/failure.log',
          size: 128,
          createdAt: '2026-04-14T12:00:00.000Z'
        }
      ],
      events: [
        {
          id: 'event-1',
          type: 'task_failed',
          timestamp: '2026-04-14T12:00:00.000Z',
          payload: { reason: 'boom' }
        }
      ],
      metrics: {
        retryCount: 1
      },
      createdAt: new Date('2026-04-14T11:50:00.000Z'),
      updatedAt: new Date('2026-04-14T12:00:00.000Z')
    };

    const createdTasks: Task[] = [];
    const service = new TaskService(
      {
        findById: async () => existingTask,
        findAll: async () => [existingTask],
        create: async (task: Task) => {
          createdTasks.push(task);
        },
        update: async () => undefined,
        delete: async () => undefined
      } as never,
      new StubAgentRepository(null) as never,
      { to: () => ({ emit: () => undefined }) } as never
    );

    const retriedTask = await service.retryTask('task-3');

    expect(retriedTask.id).not.toBe('task-3');
    expect(retriedTask.goal).toBe(existingTask.goal);
    expect(retriedTask.status).toBe('pending');
    expect(retriedTask.stages).toEqual([]);
    expect(retriedTask.artifacts).toEqual([]);
    expect(retriedTask.events).toEqual([]);
    expect(retriedTask.metrics.retryCount).toBe(2);
    expect(createdTasks).toHaveLength(1);
    expect(createdTasks[0]).toEqual(retriedTask);
  });
});
