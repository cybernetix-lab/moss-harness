export interface TaskArtifact {
  id: string;
  stageId?: string;
  type: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  createdAt: string;
}
