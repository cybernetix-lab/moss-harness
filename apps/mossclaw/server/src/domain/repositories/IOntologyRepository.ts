import type { OntologyObject } from '../models/ontology/OntologyObject';
import type { OntologyQuery } from '../models/ontology/OntologyQuery';
import type { OntologyObjectType } from '../models/ontology/OntologySchema';

export interface IOntologyRepository {
  listObjectTypes(): Promise<OntologyObjectType[]>;
  getObject(objectType: string, objectId: string): Promise<OntologyObject | null>;
  queryObjects(filters: OntologyQuery): Promise<OntologyObject[]>;
}
