import type { OntologyObjectDto, OntologyProjectionEdgeDto, OntologyProjectionNodeDto } from '@mossclaw/shared';
import { mapObjectTypeToPlane } from './typeProjectionMappers';

interface ProjectionReference {
  objectType: string;
  objectId: string;
  propertyPath: string;
}

interface BuildProjectionNeighborsInput {
  focus: OntologyObjectDto;
  candidates: OntologyObjectDto[];
}

interface BuildProjectionNeighborsResult {
  focusNode: OntologyProjectionNodeDto;
  neighborNodes: OntologyProjectionNodeDto[];
  outboundEdges: OntologyProjectionEdgeDto[];
  inboundEdges: OntologyProjectionEdgeDto[];
  neighborIds: string[];
}

function isReferenceShape(value: unknown): value is { objectType: string; objectId: string } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { objectType?: unknown }).objectType === 'string' &&
      typeof (value as { objectId?: unknown }).objectId === 'string'
  );
}

function collectReferences(value: unknown, path: string, references: ProjectionReference[]) {
  if (isReferenceShape(value)) {
    const objectType = value.objectType.trim();
    const objectId = value.objectId.trim();
    if (objectType && objectId) {
      references.push({
        objectType,
        objectId,
        propertyPath: path
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectReferences(item, `${path}[${index}]`, references);
    });
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const nestedPath = path ? `${path}.${key}` : key;
    collectReferences(nestedValue, nestedPath, references);
  }
}

function extractObjectReferences(object: OntologyObjectDto): ProjectionReference[] {
  const references: ProjectionReference[] = [];
  for (const [key, value] of Object.entries(object.properties)) {
    collectReferences(value, key, references);
  }
  return references;
}

export function buildProjectionNodeId(objectType: string, objectId: string): string {
  return `${objectType}:${objectId}`;
}

export function mapOntologyObjectToProjectionNode(object: OntologyObjectDto): OntologyProjectionNodeDto {
  return {
    id: buildProjectionNodeId(object.objectType, object.objectId),
    kind: 'instance',
    label: object.displayName,
    objectType: object.objectType,
    objectId: object.objectId,
    plane: mapObjectTypeToPlane(object.objectType),
    state: object.state,
    metadata: {
      displayName: object.displayName
    }
  };
}

function buildProjectionEdge(
  source: OntologyObjectDto,
  reference: ProjectionReference
): OntologyProjectionEdgeDto {
  return {
    id: `projection:${source.objectType}:${source.objectId}:${reference.propertyPath}:${reference.objectType}:${reference.objectId}`,
    source: buildProjectionNodeId(source.objectType, source.objectId),
    target: buildProjectionNodeId(reference.objectType, reference.objectId),
    kind: 'projection',
    label: reference.propertyPath,
    edgeSource: 'property-reference'
  };
}

function buildReferencedNeighborNode(reference: ProjectionReference): OntologyProjectionNodeDto {
  return {
    id: buildProjectionNodeId(reference.objectType, reference.objectId),
    kind: 'instance',
    label: reference.objectId,
    objectType: reference.objectType,
    objectId: reference.objectId,
    plane: mapObjectTypeToPlane(reference.objectType),
    metadata: {
      displayName: reference.objectId,
      unresolved: true
    }
  };
}

export function buildProjectionNeighbors(
  input: BuildProjectionNeighborsInput
): BuildProjectionNeighborsResult {
  const { focus, candidates } = input;
  const focusNode = mapOntologyObjectToProjectionNode(focus);
  const focusNodeId = focusNode.id;
  const nodesById = new Map<string, OntologyProjectionNodeDto>();
  const outboundEdgesById = new Map<string, OntologyProjectionEdgeDto>();
  const inboundEdgesById = new Map<string, OntologyProjectionEdgeDto>();

  const candidateById = new Map<string, OntologyObjectDto>();
  for (const candidate of candidates) {
    candidateById.set(buildProjectionNodeId(candidate.objectType, candidate.objectId), candidate);
  }

  for (const reference of extractObjectReferences(focus)) {
    const edge = buildProjectionEdge(focus, reference);
    outboundEdgesById.set(edge.id, edge);
    const candidate = candidateById.get(edge.target);
    nodesById.set(edge.target, candidate ? mapOntologyObjectToProjectionNode(candidate) : buildReferencedNeighborNode(reference));
  }

  for (const candidate of candidates) {
    if (buildProjectionNodeId(candidate.objectType, candidate.objectId) === focusNodeId) {
      continue;
    }

    for (const reference of extractObjectReferences(candidate)) {
      if (reference.objectType !== focus.objectType || reference.objectId !== focus.objectId) {
        continue;
      }

      const edge = buildProjectionEdge(candidate, reference);
      inboundEdgesById.set(edge.id, edge);
      nodesById.set(buildProjectionNodeId(candidate.objectType, candidate.objectId), mapOntologyObjectToProjectionNode(candidate));
    }
  }

  const neighborNodes = Array.from(nodesById.values()).sort((left, right) => left.id.localeCompare(right.id));
  return {
    focusNode,
    neighborNodes,
    outboundEdges: Array.from(outboundEdgesById.values()).sort((left, right) => left.label?.localeCompare(right.label ?? '') ?? 0),
    inboundEdges: Array.from(inboundEdgesById.values()).sort((left, right) => left.id.localeCompare(right.id)),
    neighborIds: neighborNodes.map((node) => node.id)
  };
}
