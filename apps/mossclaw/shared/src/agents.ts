export type AgentType =
  | 'planning'
  | 'plan_review'
  | 'execution'
  | 'evaluation'
  | 'research'
  | 'memory_management'
  | 'custom';

export type AgentStatus = 'IDLE' | 'WORK' | 'BUSY' | 'OFFLINE';

export interface AgentModelConfigDto {
  provider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentDto {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  systemPrompt: string;
  modelConfig: AgentModelConfigDto;
  status: AgentStatus;
  isBuiltin: boolean;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}
