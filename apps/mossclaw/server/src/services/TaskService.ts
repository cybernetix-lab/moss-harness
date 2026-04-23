import { ITaskRepository } from '../domain/repositories/ITaskRepository';
import { IAgentRepository } from '../domain/repositories/IAgentRepository';
import type { Task, TaskConfig, TaskEvent, TaskStage } from '../domain/models/task';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  TASK_REALTIME_EVENT_NAMES,
  type AgentLogRealtimeEvent,
  type TaskCompletedRealtimeEvent,
  type TaskFailedRealtimeEvent,
  type TaskRealtimeClientEvents,
  type TaskRealtimeEventName,
  type TaskRealtimeServerEvents,
  type TaskStartedRealtimeEvent
} from '@mossclaw/shared';

// Importing from the linked/aliased core package
import { TaskScheduler } from '@agent-harness/core/subagent';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '@agent-harness/core/storage';
import { SubAgentRegistry } from '@agent-harness/core/subagent/registry';
import { IStorage } from '@agent-harness/core/storage/types';
import { SubAgentTask } from '@agent-harness/core/subagent/types';
import { toTaskDto } from '../api/dtoMappers';

export class TaskService {
  private storage!: IStorage;
  private scheduler!: TaskScheduler;
  private registry!: SubAgentRegistry;
  private isInitialized = false;

  constructor(
    private taskRepository: ITaskRepository,
    private agentRepository: IAgentRepository,
    private io: Server<TaskRealtimeClientEvents, TaskRealtimeServerEvents>
  ) {}

  async init() {
    if (this.isInitialized) return;

    // 1. Initialize Storage
    this.storage = await createStorage(DEFAULT_STORAGE_CONFIG);
    
    // 2. Initialize Registry & Scheduler
    this.registry = new SubAgentRegistry(this.storage);
    this.scheduler = new TaskScheduler(this.storage, 5); // Max 5 concurrent tasks

    await this.registry.initialize();
    await this.scheduler.initialize();
    
    // 3. Start the scheduler
    await this.scheduler.start();

    // 4. Bind Events to WebSocket
    this.scheduler.on('task_started', async (event: any) => {
      const task = await this.taskRepository.findById(event.taskId);
      if (task) {
        task.status = 'running';
        task.events.push(this.buildTaskEvent('task_started', { taskId: task.id }));
        task.updatedAt = new Date();
        await this.taskRepository.update(task);
        this.emitEvent(task.id, TASK_REALTIME_EVENT_NAMES.taskStarted, {
          task: toTaskDto(task)
        });
      }
    });

    this.scheduler.on('task_completed', async (event: any) => {
      const task = await this.taskRepository.findById(event.taskId);
      if (task) {
        task.status = 'completed';
        task.events.push(
          this.buildTaskEvent('task_completed', {
            taskId: task.id,
            result: event.data as Record<string, unknown>
          })
        );
        task.metrics = {
          ...task.metrics,
          completedStages: task.stages.filter((stage: TaskStage) => stage.status === 'completed').length
        };
        task.updatedAt = new Date();
        await this.taskRepository.update(task);
        this.emitEvent(task.id, TASK_REALTIME_EVENT_NAMES.taskCompleted, {
          task: toTaskDto(task),
          result: event.data as Record<string, unknown> | undefined
        });
      }
    });

    this.scheduler.on('task_failed', async (event: any) => {
      const task = await this.taskRepository.findById(event.taskId);
      if (task) {
        task.status = 'failed';
        task.events.push(
          this.buildTaskEvent('task_failed', {
            taskId: task.id,
            error: event.data as Record<string, unknown>
          })
        );
        task.updatedAt = new Date();
        await this.taskRepository.update(task);
        this.emitEvent(task.id, TASK_REALTIME_EVENT_NAMES.taskFailed, {
          task: toTaskDto(task),
          error: event.data as Record<string, unknown> | undefined
        });
      }
    });

    this.isInitialized = true;
    console.log('[TaskService] Successfully initialized Harness TaskScheduler');
  }

  async createTask(goal: string, config: TaskConfig): Promise<Task> {
    if (!config.entryAgentName) {
      throw new Error('Task config.entryAgentName is required');
    }

    const task: Task = {
      id: uuidv4(),
      goal,
      status: 'pending',
      config,
      stages: [],
      artifacts: [],
      events: [],
      metrics: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.taskRepository.create(task);
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return this.taskRepository.findAll();
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.taskRepository.findById(id);
  }

  async retryTask(id: string): Promise<Task> {
    const existingTask = await this.taskRepository.findById(id);
    if (!existingTask) {
      throw new Error('Task not found');
    }

    const retriedTask: Task = {
      ...existingTask,
      id: uuidv4(),
      status: 'pending',
      stages: [],
      artifacts: [],
      events: [],
      metrics: {
        ...existingTask.metrics,
        retryCount: (existingTask.metrics.retryCount ?? 0) + 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.taskRepository.create(retriedTask);
    return retriedTask;
  }

  async executeTask(id: string): Promise<void> {
    await this.init(); // Ensure scheduler is ready

    const task = await this.taskRepository.findById(id);
    if (!task) throw new Error('Task not found');

    const agentName = task.config.entryAgentName;
    const agent = await this.agentRepository.findByName(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    if (agent.isDisabled) {
      throw new Error(`Agent is disabled: ${agentName}`);
    }

    // Check if agent is registered (mock check for now, in real scenario we should register it first)
    // await this.registry.register({ name: agentName, capabilities: [] });

    const subAgentTask: SubAgentTask = {
      id: task.id, // Map our business Task ID to the SubAgentTask ID
      agentName,
      prompt: task.goal,
      status: 'pending',
      priority: 'normal',
      createdAt: new Date(),
      metadata: {
        sessionId: 'MossClaw',
        iteration: 0,
        depth: 0,
        tags: [],
        customData: {}
      }
    };

    // Schedule the task via the real Harness Scheduler
    await this.scheduler.schedule(subAgentTask);

    task.events.push(
      this.buildTaskEvent('agent_log', {
        taskId: id,
        stage: 'Scheduling',
        content: 'Task has been submitted to Harness TaskScheduler...'
      })
    );
    task.updatedAt = new Date();
    await this.taskRepository.update(task);

    // Note: The task_started and task_completed events are handled in the init() method listeners
    this.emitEvent(id, TASK_REALTIME_EVENT_NAMES.agentLog, {
      taskId: id,
      stage: 'Scheduling',
      content: 'Task has been submitted to Harness TaskScheduler...',
      timestamp: new Date().toISOString()
    });
  }

  private emitEvent(
    taskId: string,
    eventName: TaskRealtimeEventName,
    payload:
      | AgentLogRealtimeEvent
      | TaskStartedRealtimeEvent
      | TaskCompletedRealtimeEvent
      | TaskFailedRealtimeEvent
  ) {
    const room = this.io.to(`task_${taskId}`);
    switch (eventName) {
      case TASK_REALTIME_EVENT_NAMES.agentLog:
        room.emit(eventName, payload as AgentLogRealtimeEvent);
        break;
      case TASK_REALTIME_EVENT_NAMES.taskStarted:
        room.emit(eventName, payload as TaskStartedRealtimeEvent);
        break;
      case TASK_REALTIME_EVENT_NAMES.taskCompleted:
        room.emit(eventName, payload as TaskCompletedRealtimeEvent);
        break;
      case TASK_REALTIME_EVENT_NAMES.taskFailed:
        room.emit(eventName, payload as TaskFailedRealtimeEvent);
        break;
    }
    console.log(`[Event Emitted] ${eventName} for task ${taskId}`);
  }

  private buildTaskEvent(type: string, payload: Record<string, unknown>): TaskEvent {
    return {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      payload
    };
  }
}
