export interface TaskMetrics {
  durationMs?: number;
  tokenCount?: number;
  cost?: number;
  reworkCount?: number;
  retryCount?: number;
  completedStages?: number;
}
