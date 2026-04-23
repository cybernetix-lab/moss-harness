import type { TaskArtifact } from './TaskArtifact';
import type { TaskConfig } from './TaskConfig';
import type { TaskEvent } from './TaskEvent';
import type { TaskMetrics } from './TaskMetrics';
import type { TaskStage } from './TaskStage';
import type { TaskStatus } from './TaskStatus';

export interface Task {
  id: string;
  goal: string;
  status: TaskStatus;
  config: TaskConfig;
  stages: TaskStage[];
  artifacts: TaskArtifact[];
  events: TaskEvent[];
  metrics: TaskMetrics;
  createdAt: Date;
  updatedAt: Date;
}
