/** Base HTTP-oriented error for the global exception filter (extends native Error). */
export class AppHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppHttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ValidationError extends AppHttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppHttpError {
  constructor(message: string) {
    super(401, message);
  }
}

export class ForbiddenError extends AppHttpError {
  constructor(message: string) {
    super(403, message);
  }
}

export function isAppHttpError(e: unknown): e is AppHttpError {
  return e instanceof AppHttpError;
}
