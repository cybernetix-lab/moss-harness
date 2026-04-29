import type { OntologyQueryRequestDto, ToolErrorDto } from '@mossclaw/shared';
import { BadRequestError, requireObject, requireTrimmedString } from '../../lib/validation';

export type OntologyToolName =
  | 'ontology.get_object'
  | 'ontology.get_schema'
  | 'ontology.query';

const ONTOLOGY_TOOL_NAMES = [
  'ontology.get_object',
  'ontology.get_schema',
  'ontology.query'
] as const satisfies readonly OntologyToolName[];

type GetObjectArgumentLabels = {
  objectType?: string;
  objectId?: string;
};

type QueryArgumentLabels = {
  payload?: string;
  objectType?: string;
  state?: string;
};

const DEFAULT_GET_OBJECT_ARGUMENT_LABELS: Required<GetObjectArgumentLabels> = {
  objectType: 'Ontology objectType',
  objectId: 'Ontology objectId'
};

const DEFAULT_QUERY_ARGUMENT_LABELS: Required<QueryArgumentLabels> = {
  payload: 'Ontology query payload',
  objectType: 'Ontology query payload.objectType',
  state: 'Ontology query payload.state'
};

const ONTOLOGY_TOOL_ERROR_CATALOG = Object.freeze({
  invalidGetSchemaArguments: {
    errorCode: 'INVALID_ARGUMENT',
    description: 'Tool arguments must be empty'
  },
  invalidGetObjectArguments: {
    errorCode: 'INVALID_ARGUMENT',
    description: 'Tool arguments.objectType and arguments.objectId must be non-empty strings'
  },
  objectNotFound: {
    errorCode: 'OBJECT_NOT_FOUND',
    description: 'Ontology object not found',
    responseMessage: 'Ontology object not found'
  },
  schemaLoadFailed: {
    errorCode: 'SCHEMA_LOAD_FAILED',
    description: 'Ontology schema could not be loaded',
    responseMessage: 'Failed to load ontology schema'
  },
  objectLoadFailed: {
    errorCode: 'OBJECT_LOAD_FAILED',
    description: 'Ontology object could not be loaded',
    responseMessage: 'Failed to load ontology object'
  },
  invalidQueryArguments: {
    errorCode: 'INVALID_ARGUMENT',
    description: 'Tool arguments must be an object and optional filters must be non-empty strings'
  },
  queryFailed: {
    errorCode: 'QUERY_FAILED',
    description: 'Ontology objects could not be queried',
    responseMessage: 'Failed to query ontology objects'
  }
});

const TOOL_ERROR_DIRECTORY: Record<
  OntologyToolName,
  ReadonlyArray<keyof typeof ONTOLOGY_TOOL_ERROR_CATALOG>
> = {
  'ontology.get_schema': ['invalidGetSchemaArguments', 'schemaLoadFailed'],
  'ontology.get_object': ['invalidGetObjectArguments', 'objectNotFound', 'objectLoadFailed'],
  'ontology.query': ['invalidQueryArguments', 'queryFailed']
};

export function isOntologyToolName(value: string): value is OntologyToolName {
  return (ONTOLOGY_TOOL_NAMES as readonly string[]).includes(value);
}

export class OntologyToolBoundary {
  normalizeGetSchemaArguments(value: unknown, label = 'Tool arguments'): void {
    if (value === undefined) {
      return;
    }

    if (!isPlainObject(value) || Object.keys(value).length > 0) {
      throw new BadRequestError(`${label} must be empty`);
    }
  }

  normalizeGetObjectArguments(
    value: unknown,
    labels: GetObjectArgumentLabels = DEFAULT_GET_OBJECT_ARGUMENT_LABELS
  ): { objectType: string; objectId: string } {
    const params = requireObject(value, 'Tool arguments');
    assertAllowedKeys(params, ['objectType', 'objectId']);

    return {
      objectType: requireTrimmedString(
        params.objectType,
        labels.objectType ?? DEFAULT_GET_OBJECT_ARGUMENT_LABELS.objectType
      ),
      objectId: requireTrimmedString(
        params.objectId,
        labels.objectId ?? DEFAULT_GET_OBJECT_ARGUMENT_LABELS.objectId
      )
    };
  }

  normalizeQueryArguments(
    value: unknown,
    labels: QueryArgumentLabels = DEFAULT_QUERY_ARGUMENT_LABELS
  ): OntologyQueryRequestDto {
    if (value === undefined) {
      return {};
    }

    const payload = requireObject(value, labels.payload ?? DEFAULT_QUERY_ARGUMENT_LABELS.payload);
    assertAllowedKeys(payload, ['objectType', 'state']);
    const normalized: OntologyQueryRequestDto = {};

    if (payload.objectType !== undefined) {
      normalized.objectType = requireTrimmedString(
        payload.objectType,
        labels.objectType ?? DEFAULT_QUERY_ARGUMENT_LABELS.objectType
      );
    }

    if (payload.state !== undefined) {
      normalized.state = requireTrimmedString(
        payload.state,
        labels.state ?? DEFAULT_QUERY_ARGUMENT_LABELS.state
      );
    }

    return normalized;
  }

  getToolErrors(toolName: OntologyToolName): ToolErrorDto[] {
    return TOOL_ERROR_DIRECTORY[toolName].map((key) => {
      const error = ONTOLOGY_TOOL_ERROR_CATALOG[key];
      return { errorCode: error.errorCode, description: error.description };
    });
  }

  getObjectNotFoundMessage(): string {
    return ONTOLOGY_TOOL_ERROR_CATALOG.objectNotFound.responseMessage;
  }

  getSchemaLoadErrorMessage(): string {
    return ONTOLOGY_TOOL_ERROR_CATALOG.schemaLoadFailed.responseMessage;
  }

  getObjectLoadErrorMessage(): string {
    return ONTOLOGY_TOOL_ERROR_CATALOG.objectLoadFailed.responseMessage;
  }

  getQueryObjectsErrorMessage(): string {
    return ONTOLOGY_TOOL_ERROR_CATALOG.queryFailed.responseMessage;
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  labelPrefix = 'Tool arguments'
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new BadRequestError(`${labelPrefix}.${key} is not supported`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
