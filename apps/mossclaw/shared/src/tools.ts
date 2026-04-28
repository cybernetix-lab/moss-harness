export type ToolErrorDto = {
  errorCode: string;
  description: string;
};

export type ToolExampleDto = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export interface ToolDescriptorDto {
  name: string;
  category: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  errors: ToolErrorDto[];
  examples?: ToolExampleDto[];
}

export interface ToolInvokeRequestDto {
  arguments?: Record<string, unknown>;
}

export interface ToolInvokeSuccessDto {
  ok: true;
  toolName: string;
  result: unknown;
}

export interface ToolInvokeErrorDto {
  ok: false;
  toolName: string;
  error: string;
  errorCode: string;
}

export type ToolInvokeResultDto = ToolInvokeSuccessDto | ToolInvokeErrorDto;
