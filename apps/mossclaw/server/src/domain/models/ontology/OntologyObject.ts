export interface OntologyObject {
  objectType: string;
  objectId: string;
  displayName: string;
  state: string;
  properties: Record<string, unknown>;
}
