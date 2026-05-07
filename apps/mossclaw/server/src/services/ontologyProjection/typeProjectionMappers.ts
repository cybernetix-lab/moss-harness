import type {
  OntologyObjectTypeDto,
  OntologyPlaneDto,
  OntologyProjectionNodeDto
} from '@mossclaw/shared';

const CONTROL_PLANE_TYPES = new Set([
  'RoleLane',
  'AgentProfile',
  'RuntimeProfile',
  'PolicySet',
  'StorageProvider',
  'EvolutionProposal'
]);

const EXECUTION_PLANE_TYPES = new Set(['Task', 'Execution']);

const EVIDENCE_PLANE_TYPES = new Set(['Artifact', 'KnowledgeEntry', 'TelemetrySignal']);

export function mapObjectTypeToPlane(objectType: string): OntologyPlaneDto {
  if (CONTROL_PLANE_TYPES.has(objectType)) {
    return 'control';
  }

  if (EVIDENCE_PLANE_TYPES.has(objectType)) {
    return 'evidence';
  }

  if (EXECUTION_PLANE_TYPES.has(objectType)) {
    return 'execution';
  }

  return 'execution';
}

export function mapObjectTypeToProjectionNode(objectType: OntologyObjectTypeDto): OntologyProjectionNodeDto {
  return {
    id: `type:${objectType.objectType}`,
    kind: 'type',
    label: objectType.objectType,
    objectType: objectType.objectType,
    plane: mapObjectTypeToPlane(objectType.objectType),
    metadata: {
      description: objectType.description,
      propertyCount: objectType.properties.length
    }
  };
}
