import type {
  AgentDto,
  CompileWorkflowPlanRequestDto,
  CompileWorkflowPlanResponseDto,
  CreateTaskRequestDto,
  ExecuteTaskResponseDto,
  GetOntologyIngestJobResponseDto,
  GetOntologyIngestReportResponseDto,
  ModelOptionDto,
  OntologyLoopAnalysisRequestDto,
  OntologyLoopAnalysisResponseDto,
  OntologyObjectDto,
  OntologyProjectionNeighborsResponseDto,
  OntologyProjectionSubgraphDto,
  OntologyProjectionSubgraphRequestDto,
  OntologyProjectionTypesResponseDto,
  PreviewOntologyIngestRequestDto,
  PreviewOntologyIngestResponseDto,
  OntologyQueryRequestDto,
  OntologyQueryResponseDto,
  OntologySchemaResponseDto,
  SimulateWorkflowPlanRequestDto,
  SimulateWorkflowPlanResponseDto,
  SkillDto,
  SubmitOntologyIngestRequestDto,
  SubmitOntologyIngestResponseDto,
  TaskControlResponseDto,
  TaskDto,
  ToolDescriptorDto,
  ToolInvokeRequestDto,
  ToolInvokeResultDto,
  ValidateWorkflowPlanRequestDto,
  ValidateWorkflowPlanResponseDto,
} from '@mossclaw/shared';

export const API_BASE_URL = 'http://localhost:3001';

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return requestJson<T>(input, init);
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: {
    preserveClientErrorBody?: boolean;
  } = {}
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, options.preserveClientErrorBody === true));
  }

  return response.json() as Promise<T>;
}

async function postToolInvoke(
  url: string,
  payload: ToolInvokeRequestDto = {}
): Promise<ToolInvokeResultDto> {
  return requestJson<ToolInvokeResultDto>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, {
    preserveClientErrorBody: true,
  });
}

async function getErrorMessage(response: Response, preserveClientErrorBody: boolean): Promise<string> {
  if (preserveClientErrorBody && response.status >= 400 && response.status < 500) {
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    } catch {
      // Ignore JSON parse failures and fall back to generic status message.
    }
  }

  return `Request failed with status ${response.status}`;
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

export function getOntologySchema(): Promise<OntologySchemaResponseDto> {
  return fetchJson<OntologySchemaResponseDto>(`${API_BASE_URL}/api/ontology/schema`);
}

export function getOntologyObject(objectType: string, objectId: string): Promise<OntologyObjectDto> {
  return fetchJson<OntologyObjectDto>(`${API_BASE_URL}/api/ontology/objects/${objectType}/${objectId}`);
}

export function queryOntology(payload: OntologyQueryRequestDto): Promise<OntologyQueryResponseDto> {
  return fetchJson<OntologyQueryResponseDto>(`${API_BASE_URL}/api/ontology/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function getOntologyProjectionTypes(): Promise<OntologyProjectionTypesResponseDto> {
  return fetchJson<OntologyProjectionTypesResponseDto>(`${API_BASE_URL}/api/ontology/projection/types`);
}

export function getOntologyProjectionNeighbors(
  objectType: string,
  objectId: string,
  depth?: number
): Promise<OntologyProjectionNeighborsResponseDto> {
  const params = new URLSearchParams();
  if (depth !== undefined) {
    params.set('depth', String(depth));
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return fetchJson<OntologyProjectionNeighborsResponseDto>(
    `${API_BASE_URL}/api/ontology/projection/objects/${objectType}/${objectId}/neighbors${suffix}`
  );
}

export function getOntologyProjectionSubgraph(
  payload: OntologyProjectionSubgraphRequestDto
): Promise<OntologyProjectionSubgraphDto> {
  return fetchJson<OntologyProjectionSubgraphDto>(`${API_BASE_URL}/api/ontology/projection/subgraph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function analyzeOntologyProjectionLoops(
  payload: OntologyLoopAnalysisRequestDto
): Promise<OntologyLoopAnalysisResponseDto> {
  return fetchJson<OntologyLoopAnalysisResponseDto>(
    `${API_BASE_URL}/api/ontology/projection/loops/analyze`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

export function previewOntologyIngest(
  payload: PreviewOntologyIngestRequestDto
): Promise<PreviewOntologyIngestResponseDto> {
  return fetchJson<PreviewOntologyIngestResponseDto>(`${API_BASE_URL}/api/ontology/ingest/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function submitOntologyIngest(
  payload: SubmitOntologyIngestRequestDto
): Promise<SubmitOntologyIngestResponseDto> {
  return fetchJson<SubmitOntologyIngestResponseDto>(`${API_BASE_URL}/api/ontology/ingest/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function getOntologyIngestJob(jobId: string): Promise<GetOntologyIngestJobResponseDto> {
  return fetchJson<GetOntologyIngestJobResponseDto>(
    `${API_BASE_URL}/api/ontology/ingest/jobs/${encodeURIComponent(jobId)}`
  );
}

export function getOntologyIngestReport(jobId: string): Promise<GetOntologyIngestReportResponseDto> {
  return fetchJson<GetOntologyIngestReportResponseDto>(
    `${API_BASE_URL}/api/ontology/ingest/jobs/${encodeURIComponent(jobId)}/report`
  );
}

export function validateWorkflowPlan(
  payload: ValidateWorkflowPlanRequestDto
): Promise<ValidateWorkflowPlanResponseDto> {
  return fetchJson<ValidateWorkflowPlanResponseDto>(`${API_BASE_URL}/api/workflow-builder/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function compileWorkflowPlan(
  payload: CompileWorkflowPlanRequestDto
): Promise<CompileWorkflowPlanResponseDto> {
  return fetchJson<CompileWorkflowPlanResponseDto>(`${API_BASE_URL}/api/workflow-builder/compile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function simulateWorkflowPlan(
  payload: SimulateWorkflowPlanRequestDto
): Promise<SimulateWorkflowPlanResponseDto> {
  return fetchJson<SimulateWorkflowPlanResponseDto>(`${API_BASE_URL}/api/workflow-builder/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function listTools(): Promise<ToolDescriptorDto[]> {
  return fetchJson<ToolDescriptorDto[]>(`${API_BASE_URL}/api/tools`);
}

export function invokeTool(
  toolName: string,
  payload: ToolInvokeRequestDto = {}
): Promise<ToolInvokeResultDto> {
  return postToolInvoke(
    `${API_BASE_URL}/api/tools/${encodeURIComponent(toolName)}/invoke`,
    payload
  );
}

export function invokeOntologyIngestPreviewTool(
  payload: PreviewOntologyIngestRequestDto
): Promise<ToolInvokeResultDto> {
  return invokeTool('ontology.ingest_preview', {
    arguments: payload as unknown as Record<string, unknown>,
  });
}

export function invokeOntologyIngestSubmitTool(
  payload: SubmitOntologyIngestRequestDto
): Promise<ToolInvokeResultDto> {
  return invokeTool('ontology.ingest_submit', {
    arguments: payload as unknown as Record<string, unknown>,
  });
}
