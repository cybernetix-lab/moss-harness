import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { TaskController } from './TaskController';
import type { Task } from '../../domain/models/task';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

describe('TaskController', () => {
  it('creates a task from goal and config payload', async () => {
    const task: Task = {
      id: 'task-1',
      goal: '生成前端页面',
      status: 'pending',
      config: {
        entryAgentName: 'planner',
        priority: 'high',
      },
      stages: [],
      artifacts: [],
      events: [],
      metrics: {},
      createdAt: new Date('2026-04-14T10:00:00.000Z'),
      updatedAt: new Date('2026-04-14T10:00:00.000Z'),
    };

    const controller = new TaskController({
      createTask: vi.fn().mockResolvedValue(task),
    } as never);

    const req = {
      body: {
        goal: '生成前端页面',
        config: {
          entryAgentName: 'planner',
          priority: 'high',
        },
      },
    } as Request;
    const res = buildMockResponse();

    await controller.createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        goal: '生成前端页面',
        config: expect.objectContaining({
          entryAgentName: 'planner',
          priority: 'high',
        }),
      })
    );
  });

  it('returns accepted response when retrying a task', async () => {
    const controller = new TaskController({
      retryTask: vi.fn().mockResolvedValue({
        id: 'task-2',
      }),
    } as never);

    const req = {
      params: { id: 'task-1' },
      body: { action: 'retry' },
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.controlTask(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      retriedFromTaskId: 'task-1',
      newTaskId: 'task-2',
    });
  });

  it('trims goal and entry agent name before creating a task', async () => {
    const createTask = vi.fn().mockResolvedValue({
      id: 'task-3',
      goal: '生成前端页面',
      status: 'pending',
      config: {
        entryAgentName: 'planner',
        priority: 'high',
      },
      stages: [],
      artifacts: [],
      events: [],
      metrics: {},
      createdAt: new Date('2026-04-14T10:00:00.000Z'),
      updatedAt: new Date('2026-04-14T10:00:00.000Z'),
    } satisfies Task);
    const controller = new TaskController({
      createTask,
    } as never);

    const req = {
      body: {
        goal: '  生成前端页面  ',
        config: {
          entryAgentName: '  planner  ',
          priority: 'high',
        },
      },
    } as Request;
    const res = buildMockResponse();

    await controller.createTask(req, res);

    expect(createTask).toHaveBeenCalledWith('生成前端页面', {
      entryAgentName: 'planner',
      priority: 'high',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when task goal is blank', async () => {
    const createTask = vi.fn();
    const controller = new TaskController({
      createTask,
    } as never);

    const req = {
      body: {
        goal: '   ',
        config: {
          entryAgentName: 'planner',
          priority: 'high',
        },
      },
    } as Request;
    const res = buildMockResponse();

    await controller.createTask(req, res);

    expect(createTask).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Task goal is required',
    });
  });

  it('returns 400 when task priority is invalid', async () => {
    const createTask = vi.fn();
    const controller = new TaskController({
      createTask,
    } as never);

    const req = {
      body: {
        goal: '生成前端页面',
        config: {
          entryAgentName: 'planner',
          priority: 'urgent',
        },
      },
    } as Request;
    const res = buildMockResponse();

    await controller.createTask(req, res);

    expect(createTask).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Task config.priority must be low, medium, or high',
    });
  });

  it('returns 400 when retry task id is blank', async () => {
    const retryTask = vi.fn();
    const controller = new TaskController({
      retryTask,
    } as never);

    const req = {
      params: { id: '   ' },
      body: { action: 'retry' },
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.controlTask(req, res);

    expect(retryTask).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Task id is required',
    });
  });

  it('returns 400 when task control action is missing', async () => {
    const retryTask = vi.fn();
    const controller = new TaskController({
      retryTask,
    } as never);

    const req = {
      params: { id: 'task-1' },
      body: {},
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.controlTask(req, res);

    expect(retryTask).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Task control action is required',
    });
  });

  it('returns 400 when task control action is unsupported', async () => {
    const retryTask = vi.fn();
    const controller = new TaskController({
      retryTask,
    } as never);

    const req = {
      params: { id: 'task-1' },
      body: { action: 'pause' },
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.controlTask(req, res);

    expect(retryTask).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unsupported task control action: pause',
    });
  });
});
