/**
 * Typed application errors. Throw these from services / repositories
 * instead of bare `new Error(...)` so the central error handler in
 * `apps/server/src/bootstrap.ts` can map them to the right HTTP status
 * and machine-readable error code. Bare errors leak as 500s, making
 * legitimate client failures (404 on a missing row, 409 on a
 * duplicate, 422 on a bad input) indistinguishable from real bugs.
 */

export class AppError extends Error {
  /** HTTP status the central error handler should respond with. */
  readonly status: number;
  /** Short machine-readable code (`NotFound`, `Conflict`, ...). */
  readonly code: string;
  /** Optional structured detail (Zod issues, conflict target, ...). */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} ${id} not found` : `${resource} not found`;
    super(404, "NotFound", msg);
  }
}

export class ValidationFailedError extends AppError {
  constructor(details: unknown, message = "Validation failed") {
    super(422, "ValidationFailed", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "Conflict", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "Unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "Forbidden", message);
  }
}

/**
 * Type guard used by the central error handler. Centralizing it keeps
 * the catch site free of instanceof checks for every concrete subclass.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}