export interface Agent {
  id: string;
  name: string;
  type: 'planning' | 'plan_review' | 'execution' | 'evaluation' | 'research' | 'memory_management' | 'custom';
  description: string;
  systemPrompt: string;
  modelConfig: {
    provider: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
  };
  status: 'IDLE' | 'WORK' | 'BUSY' | 'OFFLINE';
  isBuiltin: boolean;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
