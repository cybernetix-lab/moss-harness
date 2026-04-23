import type { TaskDto } from './tasks';

export const TASK_SUBSCRIPTION_EVENT = 'subscribe_task' as const;

export const TASK_REALTIME_EVENT_NAMES = {
  taskStarted: 'task_started',
  taskCompleted: 'task_completed',
  taskFailed: 'task_failed',
  agentLog: 'agent_log'
} as const;

export type TaskRealtimeEventName =
  (typeof TASK_REALTIME_EVENT_NAMES)[keyof typeof TASK_REALTIME_EVENT_NAMES];

export interface SubscribeTaskRealtimeRequest {
  taskId: string;
}

export interface AgentLogRealtimeEvent {
  taskId: string;
  stage: string;
  content: string;
  timestamp: string;
}

export interface TaskStartedRealtimeEvent {
  task: TaskDto;
}

export interface TaskCompletedRealtimeEvent {
  task: TaskDto;
  result?: Record<string, unknown>;
}

export interface TaskFailedRealtimeEvent {
  task: TaskDto;
  error?: Record<string, unknown>;
}

export interface TaskRealtimeServerEvents {
  task_started: (payload: TaskStartedRealtimeEvent) => void;
  task_completed: (payload: TaskCompletedRealtimeEvent) => void;
  task_failed: (payload: TaskFailedRealtimeEvent) => void;
  agent_log: (payload: AgentLogRealtimeEvent) => void;
}

export interface TaskRealtimeClientEvents {
  subscribe_task: (taskId: string) => void;
}
