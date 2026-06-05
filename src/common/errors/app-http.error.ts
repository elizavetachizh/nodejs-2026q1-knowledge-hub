export class AppHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly extras?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppHttpError {
  constructor(message: string, extras?: Record<string, unknown>) {
    super(404, message, extras);
  }
}

export class ValidationError extends AppHttpError {
  constructor(message: string, extras?: Record<string, unknown>) {
    super(400, message, extras);
  }
}

export class UnauthorizedError extends AppHttpError {
  constructor(message: string, extras?: Record<string, unknown>) {
    super(401, message, extras);
  }
}

export class ForbiddenError extends AppHttpError {
  constructor(message: string, extras?: Record<string, unknown>) {
    super(403, message, extras);
  }
}

export class UnprocessableEntityError extends AppHttpError {
  constructor(message: string, extras?: Record<string, unknown>) {
    super(422, message, extras);
  }
}

export function isAppHttpError(e: unknown): e is AppHttpError {
  return e instanceof AppHttpError;
}
