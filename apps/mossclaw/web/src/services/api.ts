import type {
  AgentDto,
  CreateTaskRequestDto,
  ExecuteTaskResponseDto,
  ModelOptionDto,
  SkillDto,
  TaskControlResponseDto,
  TaskDto,
} from '@mossclaw/shared';

export const API_BASE_URL = 'http://localhost:3001';

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function listTasks(): Promise<TaskDto[]> {
  return fetchJson<TaskDto[]>(`${API_BASE_URL}/api/tasks`);
}

export function getTask(taskId: string): Promise<TaskDto> {
  return fetchJson<TaskDto>(`${API_BASE_URL}/api/tasks/${taskId}`);
}

export function createTask(payload: CreateTaskRequestDto): Promise<TaskDto> {
  return fetchJson<TaskDto>(`${API_BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function executeTask(taskId: string): Promise<ExecuteTaskResponseDto> {
  return fetchJson<ExecuteTaskResponseDto>(`${API_BASE_URL}/api/tasks/${taskId}/execute`, {
    method: 'POST',
  });
}

export function retryTask(taskId: string): Promise<TaskControlResponseDto> {
  return fetchJson<TaskControlResponseDto>(`${API_BASE_URL}/api/tasks/${taskId}/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'retry' }),
  });
}

export function listAgents(): Promise<AgentDto[]> {
  return fetchJson<AgentDto[]>(`${API_BASE_URL}/api/agents`);
}

export function listModels(): Promise<ModelOptionDto[]> {
  return fetchJson<ModelOptionDto[]>(`${API_BASE_URL}/api/models`);
}

export function listSkills(): Promise<SkillDto[]> {
  return fetchJson<SkillDto[]>(`${API_BASE_URL}/api/skills`);
}

export function setSkillDisabled(skillId: string, isDisabled: boolean): Promise<SkillDto> {
  const action = isDisabled ? 'disable' : 'enable';
  return fetchJson<SkillDto>(`${API_BASE_URL}/api/skills/${skillId}/${action}`, {
    method: 'PATCH',
  });
}
