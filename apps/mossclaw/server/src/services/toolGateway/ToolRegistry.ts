import type { ToolDescriptorDto } from '@mossclaw/shared';
import { ontologyToolDefinitions } from './toolDefinitions';

export class ToolRegistry {
  private readonly tools: ToolDescriptorDto[];

  constructor(tools: ToolDescriptorDto[]) {
    this.tools = tools.map((tool) => cloneFrozenToolDescriptor(tool));
  }

  list(): ToolDescriptorDto[] {
    return this.tools
      .map((tool) => cloneFrozenToolDescriptor(tool))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  get(name: string): ToolDescriptorDto | undefined {
    const tool = this.tools.find((candidate) => candidate.name === name);
    return tool ? cloneFrozenToolDescriptor(tool) : undefined;
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry(ontologyToolDefinitions);
}

function cloneFrozenToolDescriptor(tool: ToolDescriptorDto): ToolDescriptorDto {
  return deepFreeze(deepClone(tool));
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, deepClone(nestedValue)])
    ) as T;
  }

  return value;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const nestedValue of Object.values(objectValue)) {
    deepFreeze(nestedValue);
  }

  return Object.freeze(value);
}
