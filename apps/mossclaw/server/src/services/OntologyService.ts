import type {
  OntologyObjectDto,
  OntologyQueryRequestDto,
  OntologyQueryResponseDto,
  OntologySchemaResponseDto
} from '@mossclaw/shared';
import type { IOntologyRepository } from '../domain/repositories/IOntologyRepository';

export class OntologyService {
  constructor(private readonly ontologyRepository: IOntologyRepository) {}

  async getSchema(): Promise<OntologySchemaResponseDto> {
    const objectTypes = await this.ontologyRepository.listObjectTypes();
    return { objectTypes };
  }

  async getObject(objectType: string, objectId: string): Promise<OntologyObjectDto | null> {
    return this.ontologyRepository.getObject(
      requireTrimmedString(objectType, 'objectType'),
      requireTrimmedString(objectId, 'objectId')
    );
  }

  async queryObjects(input: OntologyQueryRequestDto = {}): Promise<OntologyQueryResponseDto> {
    const filters = normalizeQueryInput(input);
    const objects = await this.ontologyRepository.queryObjects(filters);
    return { objects };
  }
}

function requireTrimmedString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} is required`);
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error(`${label} is required`);
  }

  return trimmedValue;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function normalizeQueryInput(input: OntologyQueryRequestDto): OntologyQueryRequestDto {
  const rawInput = requireObject(input, 'query input');
  const normalized: OntologyQueryRequestDto = {};

  if (rawInput.objectType !== undefined) {
    normalized.objectType = requireTrimmedString(rawInput.objectType, 'objectType');
  }

  if (rawInput.state !== undefined) {
    normalized.state = requireTrimmedString(rawInput.state, 'state');
  }

  return normalized;
}
