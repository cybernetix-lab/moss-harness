export type OntologyPropertyTypeDto = 'string' | 'number' | 'boolean' | 'datetime' | 'enum';

interface OntologyPropertyBaseDto {
  name: string;
  required: boolean;
}

export interface OntologyScalarPropertyDto extends OntologyPropertyBaseDto {
  type: Exclude<OntologyPropertyTypeDto, 'enum'>;
}

export interface OntologyEnumPropertyDto extends OntologyPropertyBaseDto {
  type: 'enum';
  enumValues: string[];
}

export type OntologyPropertyDto = OntologyScalarPropertyDto | OntologyEnumPropertyDto;

export interface OntologyObjectTypeDto {
  objectType: string;
  description?: string;
  properties: OntologyPropertyDto[];
}

export interface OntologyObjectDto {
  objectType: string;
  objectId: string;
  displayName: string;
  state: string;
  properties: Record<string, unknown>;
}

export interface OntologyQueryRequestDto {
  objectType?: string;
  state?: string;
}

export interface OntologyQueryResponseDto {
  objects: OntologyObjectDto[];
}

export interface OntologySchemaResponseDto {
  objectTypes: OntologyObjectTypeDto[];
}
