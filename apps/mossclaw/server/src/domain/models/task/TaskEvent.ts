export interface TaskEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
