export interface TaskConfig {
  entryAgentName: string;
  priority?: 'low' | 'medium' | 'high';
  timeoutMinutes?: number;
  selectedSkills?: string[];
  model?: string;
  sandboxMode?: boolean;
  context?: Record<string, unknown>;
}
