export type OntologyPropertyType = 'string' | 'number' | 'boolean' | 'datetime' | 'enum';

interface OntologyPropertyBase {
  name: string;
  required: boolean;
}

export interface OntologyScalarProperty extends OntologyPropertyBase {
  type: Exclude<OntologyPropertyType, 'enum'>;
}

export interface OntologyEnumProperty extends OntologyPropertyBase {
  type: 'enum';
  enumValues: string[];
}

export type OntologyProperty = OntologyScalarProperty | OntologyEnumProperty;

export interface OntologyObjectType {
  objectType: string;
  description?: string;
  properties: OntologyProperty[];
}
