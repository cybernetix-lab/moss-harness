import type { TaskFeedback } from './TaskFeedback';

export interface TaskStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  agentName?: string;
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  feedback?: TaskFeedback;
}
