/**
 * Task Tool Implementation
 *
 * The task() function for sub-agent invocation
 * Based on DeerFlow design: Internal polling, LLM-unaware
 */

import type {
  TaskTool,
  SubAgentResult,
  TaskDefinition,
  TaskNode,
  TaskEdge,
  TaskExecutionOptions,
  TaskToolOptions,
  SubAgentTask,
  TaskMetadata,
} from './types';
import type { IStorage } from '../storage/types';
import { TaskScheduler } from './scheduler';
import { SubAgentRegistry } from './registry';
import { EventEmitter } from 'events';

export class TaskToolImpl extends EventEmitter implements TaskTool {
  private scheduler: TaskScheduler;
  private registry: SubAgentRegistry;
  private storage: IStorage;
  private defaultOptions: TaskExecutionOptions;

  constructor(
    storage: IStorage,
    registry: SubAgentRegistry,
    scheduler: TaskScheduler,
    options?: Partial<TaskExecutionOptions>
  ) {
    super();
    this.storage = storage;
    this.registry = registry;
    this.scheduler = scheduler;
    this.defaultOptions = {
      maxConcurrent: 5,
      defaultTimeout: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      aggregationStrategy: 'concat',
      conflictResolution: 'merge',
      ...options,
    };
  }

  async execute(
    agentName: string,
    prompt: string,
    options?: Partial<TaskToolOptions>
  ): Promise<SubAgentResult> {
    // Validate agent exists
    const agent = await this.registry.get(agentName);
    if (!agent) {
      throw new Error(`Sub-agent '${agentName}' not found`);
    }

    if (agent.status !== 'active') {
      throw new Error(`Sub-agent '${agentName}' is not active`);
    }

    // Create task
    const taskId = this.generateTaskId();
    const task: SubAgentTask = {
      id: taskId,
      agentName,
      prompt,
      context: options?.context,
      status: 'pending',
      priority: options?.priority || 'normal',
      createdAt: new Date(),
      timeoutAt: options?.timeout
        ? new Date(Date.now() + options.timeout)
        : new Date(Date.now() + this.defaultOptions.defaultTimeout),
      metadata: {
        sessionId: options?.metadata?.sessionId || 'default',
        workflowId: options?.metadata?.workflowId,
        iteration: options?.metadata?.iteration || 0,
        depth: options?.metadata?.depth || 0,
        tags: options?.metadata?.tags || [],
        customData: options?.metadata?.customData || {},
      },
    };

    // Schedule task
    await this.scheduler.schedule(task);

    // Poll for result (internal, LLM-unaware)
    return this.poll(taskId, 5000, options?.timeout || this.defaultOptions.defaultTimeout);
  }

  async executeParallel(
    tasks: TaskDefinition[],
    options?: Partial<TaskExecutionOptions>
  ): Promise<SubAgentResult[]> {
    const execOptions = { ...this.defaultOptions, ...options };

    // Validate all agents exist
    for (const task of tasks) {
      const agent = await this.registry.get(task.agentName);
      if (!agent) {
        throw new Error(`Sub-agent '${task.agentName}' not found`);
      }
      if (agent.status !== 'active') {
        throw new Error(`Sub-agent '${task.agentName}' is not active`);
      }
    }

    // Check parallel limit
    const currentRunning = await this.scheduler.getRunningCount();
    const availableSlots = execOptions.maxConcurrent - currentRunning;

    if (tasks.length > availableSlots) {
      this.emit('parallel_limit_reached', {
        type: 'parallel_limit_reached',
        timestamp: Date.now(),
        taskId: 'batch',
        agentName: 'multiple',
        data: {
          requested: tasks.length,
          available: availableSlots,
          limit: execOptions.maxConcurrent,
        },
      });

      // Batch execution
      const results: SubAgentResult[] = [];
      for (let i = 0; i < tasks.length; i += availableSlots) {
        const batch = tasks.slice(i, i + availableSlots);
        const batchResults = await this.executeBatch(batch, execOptions);
        results.push(...batchResults);
      }
      return results;
    }

    // Execute all in parallel
    return this.executeBatch(tasks, execOptions);
  }

  async executeGraph(
    tasks: TaskNode[],
    edges: TaskEdge[],
    options?: Partial<TaskExecutionOptions>
  ): Promise<Map<string, SubAgentResult>> {
    const results = new Map<string, SubAgentResult>();
    const completed = new Set<string>();
    const inProgress = new Set<string>();

    // Build dependency graph
    const dependencies = new Map<string, string[]>();
    for (const edge of edges) {
      if (!dependencies.has(edge.to)) {
        dependencies.set(edge.to, []);
      }
      dependencies.get(edge.to)!.push(edge.from);
    }

    // Execute tasks in dependency order
    while (completed.size < tasks.length) {
      // Find ready tasks (all dependencies completed)
      const readyTasks = tasks.filter(
        (task) =>
          !completed.has(task.id) &&
          !inProgress.has(task.id) &&
          (dependencies.get(task.id) || []).every((dep) => completed.has(dep))
      );

      if (readyTasks.length === 0 && inProgress.size === 0) {
        throw new Error('Dependency cycle detected or invalid graph');
      }

      // Execute ready tasks in parallel
      const taskDefs: TaskDefinition[] = readyTasks.map((task) => ({
        agentName: task.agentName,
        prompt: task.prompt,
        id: task.id,
        priority: task.priority,
      }));

      for (const task of readyTasks) {
        inProgress.add(task.id);
      }

      const taskResults = await this.executeParallel(taskDefs, options);

      // Store results
      for (let i = 0; i < readyTasks.length; i++) {
        const task = readyTasks[i];
        const result = taskResults[i];
        results.set(task.id, result);
        completed.add(task.id);
        inProgress.delete(task.id);
      }
    }

    return results;
  }

  async poll(
    taskId: string,
    interval: number = 5000,
    timeout: number = 300000
  ): Promise<SubAgentResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.scheduler.getStatus(taskId);

      if (status === 'completed') {
        const result = await this.getTaskResult(taskId);
        if (result) return result;
      }

      if (status === 'failed') {
        const error = await this.getTaskError(taskId);
        throw new Error(error?.message || 'Task failed');
      }

      if (status === 'cancelled') {
        throw new Error('Task was cancelled');
      }

      // Wait before next poll
      await this.sleep(interval);
    }

    throw new Error(`Task polling timed out after ${timeout}ms`);
  }

  async cancel(taskId: string): Promise<boolean> {
    // Implementation depends on scheduler's cancel capability
    // For now, update status in database
    await this.storage.execute(
      'UPDATE subagent_tasks SET status = ? WHERE id = ?',
      ['cancelled', taskId]
    );
    return true;
  }

  private async executeBatch(
    tasks: TaskDefinition[],
    options: TaskExecutionOptions
  ): Promise<SubAgentResult[]> {
    const promises = tasks.map(async (taskDef) => {
      const taskId = taskDef.id || this.generateTaskId();
      const task: SubAgentTask = {
        id: taskId,
        agentName: taskDef.agentName,
        prompt: taskDef.prompt,
        status: 'pending',
        priority: taskDef.priority || 'normal',
        createdAt: new Date(),
        timeoutAt: new Date(Date.now() + options.defaultTimeout),
        metadata: {
          sessionId: 'default',
          iteration: 0,
          depth: 0,
          tags: [],
          customData: {},
        },
      };

      await this.scheduler.schedule(task);
      return this.poll(taskId, 5000, options.defaultTimeout);
    });

    return Promise.all(promises);
  }

  private async getTaskResult(taskId: string): Promise<SubAgentResult | null> {
    const result = await this.storage.execute(
      'SELECT result FROM subagent_tasks WHERE id = ?',
      [taskId]
    );

    if (result.rows.length === 0 || !result.rows[0].result) {
      return null;
    }

    return JSON.parse(result.rows[0].result as string);
  }

  private async getTaskError(taskId: string): Promise<{ message: string } | null> {
    const result = await this.storage.execute(
      'SELECT error FROM subagent_tasks WHERE id = ?',
      [taskId]
    );

    if (result.rows.length === 0 || !result.rows[0].error) {
      return null;
    }

    return JSON.parse(result.rows[0].error as string);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
