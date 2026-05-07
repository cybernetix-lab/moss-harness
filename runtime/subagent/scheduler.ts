/**
 * Task Scheduler
 *
 * Manages task queue and parallel execution
 * Based on Control Theory: Feedback-driven scheduling with adaptive control
 */

import type {
  SubAgentTask,
  TaskStatus,
  ITaskScheduler,
  SchedulerStats,
  TaskPriority,
  SubAgentResult,
} from './types';
import type { IStorage } from '../storage/types';
import { EventEmitter } from 'events';

interface QueuedTask {
  task: SubAgentTask;
  resolve: (result: SubAgentResult) => void;
  reject: (error: Error) => void;
}

export class TaskScheduler extends EventEmitter implements ITaskScheduler {
  private storage: IStorage;
  private maxConcurrent: number;
  private queue: QueuedTask[] = [];
  private running: Map<string, QueuedTask> = new Map();
  private stats: SchedulerStats = {
    totalScheduled: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalCancelled: 0,
    averageExecutionTime: 0,
    currentQueueLength: 0,
    currentRunningCount: 0,
  };
  private isRunning = false;
  private isPaused = false;
  private executionTimes: number[] = [];

  constructor(storage: IStorage, maxConcurrent: number = 5) {
    super();
    this.storage = storage;
    this.maxConcurrent = maxConcurrent;
  }

  async initialize(): Promise<void> {
    // Create tasks table if not exists
    await this.storage.execute(`
      CREATE TABLE IF NOT EXISTS subagent_tasks (
        id TEXT PRIMARY KEY,
        parent_task_id TEXT,
        agent_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        context TEXT, -- JSON
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        timeout_at DATETIME,
        result TEXT, -- JSON
        error TEXT, -- JSON
        metadata TEXT NOT NULL -- JSON
      )
    `);
  }

  async schedule(task: SubAgentTask): Promise<string> {
    await this.initialize();

    // Store task in database
    await this.storage.execute(
      `INSERT INTO subagent_tasks 
       (id, parent_task_id, agent_name, prompt, context, status, priority, timeout_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.parentTaskId || null,
        task.agentName,
        task.prompt,
        task.context ? JSON.stringify(task.context) : null,
        task.status,
        task.priority,
        task.timeoutAt?.toISOString() || null,
        JSON.stringify(task.metadata),
      ]
    );

    // Enqueue task for scheduler loop execution.
    this.queue.push({
      task,
      resolve: () => {},
      reject: () => {}
    });

    this.stats.totalScheduled++;
    this.stats.currentQueueLength++;

    // Emit event
    this.emit('task_scheduled', {
      type: 'task_scheduled',
      timestamp: Date.now(),
      taskId: task.id,
      agentName: task.agentName,
      data: { priority: task.priority },
    });

    // If scheduler is running, try to process queue
    if (this.isRunning && !this.isPaused) {
      this.processQueue();
    }

    return task.id;
  }

  async scheduleMany(tasks: SubAgentTask[]): Promise<string[]> {
    const ids: string[] = [];
    for (const task of tasks) {
      const id = await this.schedule(task);
      ids.push(id);
    }
    return ids;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.processQueue();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    // Cancel all running tasks
    for (const [taskId, queuedTask] of this.running) {
      await this.cancel(taskId);
    }
  }

  async pause(): Promise<void> {
    this.isPaused = true;
  }

  async resume(): Promise<void> {
    this.isPaused = false;
    this.processQueue();
  }

  async getStatus(taskId: string): Promise<TaskStatus> {
    const result = await this.storage.execute(
      'SELECT status FROM subagent_tasks WHERE id = ?',
      [taskId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Task ${taskId} not found`);
    }

    return result.rows[0].status as TaskStatus;
  }

  async getQueueLength(): Promise<number> {
    return this.queue.length;
  }

  async getRunningCount(): Promise<number> {
    return this.running.size;
  }

  async getStats(): Promise<SchedulerStats> {
    return {
      ...this.stats,
      currentQueueLength: this.queue.length,
      currentRunningCount: this.running.size,
    };
  }

  private async processQueue(): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    // Check if we can run more tasks
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      // Sort queue by priority
      this.sortQueue();

      const queuedTask = this.queue.shift();
      if (!queuedTask) break;

      const { task } = queuedTask;

      // Update status to running
      task.status = 'running';
      task.startedAt = new Date();

      await this.storage.execute(
        'UPDATE subagent_tasks SET status = ?, started_at = ? WHERE id = ?',
        ['running', task.startedAt.toISOString(), task.id]
      );

      this.running.set(task.id, queuedTask);
      this.stats.currentQueueLength--;

      // Emit event
      this.emit('task_started', {
        type: 'task_started',
        timestamp: Date.now(),
        taskId: task.id,
        agentName: task.agentName,
        data: {},
      });

      // Execute task
      this.executeTask(queuedTask);
    }
  }

  private async executeTask(queuedTask: QueuedTask): Promise<void> {
    const { task, resolve, reject } = queuedTask;
    const startTime = Date.now();

    try {
      // TODO: Integrate with actual agent execution
      // For now, simulate execution
      const result = await this.simulateExecution(task);

      const executionTime = Date.now() - startTime;
      this.recordExecutionTime(executionTime);

      // Update task as completed
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      await this.storage.execute(
        'UPDATE subagent_tasks SET status = ?, completed_at = ?, result = ? WHERE id = ?',
        ['completed', task.completedAt.toISOString(), JSON.stringify(result), task.id]
      );

      this.stats.totalCompleted++;

      // Emit event
      this.emit('task_completed', {
        type: 'task_completed',
        timestamp: Date.now(),
        taskId: task.id,
        agentName: task.agentName,
        data: { executionTime },
      });

      resolve(result);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordExecutionTime(executionTime);

      // Update task as failed
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = {
        code: 'EXECUTION_ERROR',
        message: (error as Error).message,
        recoverable: false,
      };

      await this.storage.execute(
        'UPDATE subagent_tasks SET status = ?, completed_at = ?, error = ? WHERE id = ?',
        ['failed', task.completedAt.toISOString(), JSON.stringify(task.error), task.id]
      );

      this.stats.totalFailed++;

      // Emit event
      this.emit('task_failed', {
        type: 'task_failed',
        timestamp: Date.now(),
        taskId: task.id,
        agentName: task.agentName,
        data: { error: task.error },
      });

      reject(error as Error);
    } finally {
      this.running.delete(task.id);
      this.processQueue();
    }
  }

  private async simulateExecution(task: SubAgentTask): Promise<SubAgentResult> {
    // This is a placeholder - actual implementation would call the agent
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          content: `Simulated result for task ${task.id}`,
          format: 'text',
          confidence: 0.8,
          tokenUsage: {
            input: 100,
            output: 50,
            total: 150,
          },
          executionTime: 1000,
        });
      }, 1000);
    });
  }

  private sortQueue(): void {
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    this.queue.sort((a, b) => {
      return priorityOrder[a.task.priority] - priorityOrder[b.task.priority];
    });
  }

  private recordExecutionTime(time: number): void {
    this.executionTimes.push(time);
    // Keep last 100 execution times
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }

    // Update average
    this.stats.averageExecutionTime =
      this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
  }

  private async cancel(taskId: string): Promise<boolean> {
    const queuedTask = this.running.get(taskId);
    if (!queuedTask) return false;

    // Update status
    queuedTask.task.status = 'cancelled';
    await this.storage.execute(
      'UPDATE subagent_tasks SET status = ? WHERE id = ?',
      ['cancelled', taskId]
    );

    this.stats.totalCancelled++;
    this.running.delete(taskId);

    // Reject the promise
    queuedTask.reject(new Error('Task cancelled'));

    // Emit event
    this.emit('task_cancelled', {
      type: 'task_cancelled',
      timestamp: Date.now(),
      taskId,
      agentName: queuedTask.task.agentName,
      data: {},
    });

    return true;
  }
}
