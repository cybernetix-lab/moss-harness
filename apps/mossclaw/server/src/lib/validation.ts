export class BadRequestError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export function requireTrimmedString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestError(`${label} is required`);
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new BadRequestError(`${label} is required`);
  }

  return trimmedValue;
}

export function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestError(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

export function isBadRequestError(error: unknown): error is BadRequestError {
  return error instanceof BadRequestError;
}
