export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskConfigDto {
  entryAgentName: string;
  priority?: TaskPriority;
  timeoutMinutes?: number;
  selectedSkills?: string[];
  model?: string;
  sandboxMode?: boolean;
  context?: Record<string, unknown>;
}

export interface CreateTaskRequestDto {
  goal: string;
  config: TaskConfigDto;
}

export interface TaskFeedbackDto {
  verdict: 'approved' | 'approved_with_suggestions' | 'needs_revision';
  comments: string[];
  suggestions?: string[];
}

export interface TaskStageDto {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  agentName?: string;
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  feedback?: TaskFeedbackDto;
}

export interface TaskArtifactDto {
  id: string;
  stageId?: string;
  type: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  createdAt: string;
}

export interface TaskEventDto {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface TaskMetricsDto {
  durationMs?: number;
  tokenCount?: number;
  cost?: number;
  reworkCount?: number;
  retryCount?: number;
  completedStages?: number;
}

export interface TaskDto {
  id: string;
  goal: string;
  status: TaskStatus;
  config: TaskConfigDto;
  stages: TaskStageDto[];
  artifacts: TaskArtifactDto[];
  events: TaskEventDto[];
  metrics: TaskMetricsDto;
  createdAt: string;
  updatedAt: string;
}

export interface ExecuteTaskResponseDto {
  message: string;
  taskId: string;
}

export type TaskControlAction = 'retry';

export interface TaskControlResponseDto {
  retriedFromTaskId: string;
  newTaskId: string;
}
