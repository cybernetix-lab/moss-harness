import type { OntologyProjectionTypesResponseDto, OntologySchemaResponseDto } from '@mossclaw/shared';
import type { OntologyService } from '../OntologyService';
import { mapObjectTypeToProjectionNode } from './typeProjectionMappers';

type OntologySchemaReader = Pick<OntologyService, 'getSchema'> | { getSchema: () => Promise<OntologySchemaResponseDto> };

export class TypeProjectionService {
  constructor(private readonly ontologyService: OntologySchemaReader) {}

  async getTypes(): Promise<OntologyProjectionTypesResponseDto> {
    const schema = await this.ontologyService.getSchema();
    const nodes = schema.objectTypes
      .map(mapObjectTypeToProjectionNode)
      .sort((left, right) => left.label.localeCompare(right.label));

    return {
      nodes,
      edges: []
    };
  }
}
