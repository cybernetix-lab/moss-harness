import { Request, Response } from 'express';
import type { CreateTaskRequestDto, ExecuteTaskResponseDto, TaskConfigDto, TaskPriority } from '@mossclaw/shared';
import { TaskService } from '../../services/TaskService';
import { toTaskDto } from '../dtoMappers';
import { BadRequestError, isBadRequestError, requireObject, requireTrimmedString } from './requestParams';

const VALID_TASK_PRIORITIES: ReadonlySet<TaskPriority> = new Set(['low', 'medium', 'high']);

function normalizeTaskConfig(value: unknown): TaskConfigDto {
  const rawConfig = requireObject(value, 'Task config');
  const entryAgentName = requireTrimmedString(rawConfig.entryAgentName, 'Task config.entryAgentName');

  const config: TaskConfigDto = { entryAgentName };

  if (rawConfig.priority !== undefined) {
    const priority = requireTrimmedString(rawConfig.priority, 'Task config.priority') as TaskPriority;
    if (!VALID_TASK_PRIORITIES.has(priority)) {
      throw new BadRequestError('Task config.priority must be low, medium, or high');
    }
    config.priority = priority;
  }

  if (rawConfig.timeoutMinutes !== undefined) {
    if (typeof rawConfig.timeoutMinutes !== 'number' || !Number.isFinite(rawConfig.timeoutMinutes) || rawConfig.timeoutMinutes <= 0) {
      throw new BadRequestError('Task config.timeoutMinutes must be a positive number');
    }
    config.timeoutMinutes = rawConfig.timeoutMinutes;
  }

  if (rawConfig.selectedSkills !== undefined) {
    if (!Array.isArray(rawConfig.selectedSkills)) {
      throw new BadRequestError('Task config.selectedSkills must be an array');
    }
    config.selectedSkills = rawConfig.selectedSkills.map((skill, index) =>
      requireTrimmedString(skill, `Task config.selectedSkills[${index}]`)
    );
  }

  if (rawConfig.model !== undefined) {
    config.model = requireTrimmedString(rawConfig.model, 'Task config.model');
  }

  if (rawConfig.sandboxMode !== undefined) {
    if (typeof rawConfig.sandboxMode !== 'boolean') {
      throw new BadRequestError('Task config.sandboxMode must be a boolean');
    }
    config.sandboxMode = rawConfig.sandboxMode;
  }

  if (rawConfig.context !== undefined) {
    config.context = requireObject(rawConfig.context, 'Task config.context');
  }

  return config;
}

export class TaskController {
  constructor(private taskService: TaskService) {}

  async createTask(req: Request, res: Response) {
    try {
      const payload = requireObject(req.body, 'Task payload') as Record<string, unknown>;
      const goal = requireTrimmedString(payload.goal, 'Task goal');
      const config = normalizeTaskConfig(payload.config);
      const task = await this.taskService.createTask(goal, config);
      res.status(201).json(toTaskDto(task));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async getTasks(req: Request, res: Response) {
    try {
      const tasks = await this.taskService.getAllTasks();
      res.json(tasks.map(toTaskDto));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTask(req: Request, res: Response) {
    try {
      const taskId = requireTrimmedString(req.params.id, 'Task id');
      const task = await this.taskService.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(toTaskDto(task));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async executeTask(req: Request, res: Response) {
    try {
      const taskId = requireTrimmedString(req.params.id, 'Task id');
      await this.taskService.executeTask(taskId);
      const response: ExecuteTaskResponseDto = {
        message: 'Task execution started',
        taskId
      };
      res.json(response);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      const message = String(error?.message || '');
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
        return;
      }
      if (message.includes('disabled')) {
        res.status(409).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  }

  async controlTask(req: Request, res: Response) {
    try {
      const taskId = requireTrimmedString(req.params.id, 'Task id');
      const payload = requireObject(req.body, 'Task control payload');
      const action = requireTrimmedString(payload.action, 'Task control action');
      if (action !== 'retry') {
        res.status(400).json({ error: `Unsupported task control action: ${action}` });
        return;
      }

      const task = await this.taskService.retryTask(taskId);
      res.status(202).json({
        retriedFromTaskId: taskId,
        newTaskId: task.id
      });
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      const message = String(error?.message || '');
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
        return;
      }

      res.status(500).json({ error: message });
    }
  }
}
