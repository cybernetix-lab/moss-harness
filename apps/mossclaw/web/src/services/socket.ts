import { io, type Socket } from 'socket.io-client';
import {
  TASK_REALTIME_EVENT_NAMES,
  TASK_SUBSCRIPTION_EVENT,
  type AgentLogRealtimeEvent,
  type TaskCompletedRealtimeEvent,
  type TaskFailedRealtimeEvent,
  type TaskRealtimeClientEvents,
  type TaskRealtimeServerEvents,
  type TaskStartedRealtimeEvent,
} from '@mossclaw/shared';
import { API_BASE_URL } from './api';

export interface TaskSocketHandlers {
  onTaskStarted?: (payload: TaskStartedRealtimeEvent) => void;
  onTaskCompleted?: (payload: TaskCompletedRealtimeEvent) => void;
  onTaskFailed?: (payload: TaskFailedRealtimeEvent) => void;
  onAgentLog?: (payload: AgentLogRealtimeEvent) => void;
}

export function createTaskSocket(taskId: string, handlers: TaskSocketHandlers): Socket<TaskRealtimeServerEvents, TaskRealtimeClientEvents> {
  const socket: Socket<TaskRealtimeServerEvents, TaskRealtimeClientEvents> = io(API_BASE_URL);

  socket.on('connect', () => {
    socket.emit(TASK_SUBSCRIPTION_EVENT, taskId);
  });

  if (handlers.onTaskStarted) {
    socket.on(TASK_REALTIME_EVENT_NAMES.taskStarted, handlers.onTaskStarted);
  }
  if (handlers.onTaskCompleted) {
    socket.on(TASK_REALTIME_EVENT_NAMES.taskCompleted, handlers.onTaskCompleted);
  }
  if (handlers.onTaskFailed) {
    socket.on(TASK_REALTIME_EVENT_NAMES.taskFailed, handlers.onTaskFailed);
  }
  if (handlers.onAgentLog) {
    socket.on(TASK_REALTIME_EVENT_NAMES.agentLog, handlers.onAgentLog);
  }

  return socket;
}
