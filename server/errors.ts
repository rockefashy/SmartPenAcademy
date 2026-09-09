// server/errors.ts
// Smart Pen Academy - Typed AppError Hierarchy

export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(message: string, isOperational = true, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Client supplied invalid body, params, or schema validation failed
 */
export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_ERROR';

  constructor(message: string = 'Validation failed', details?: any) {
    super(message, true, details);
  }
}

/**
 * 401 Unauthorized - Authentication credentials missing or invalid
 */
export class AuthenticationError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication required', details?: any) {
    super(message, true, details);
  }
}

/**
 * 403 Forbidden - Authenticated user lacks permission or access rights
 */
export class AuthorizationError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Access denied', details?: any) {
    super(message, true, details);
  }
}

/**
 * 404 Not Found - Requested resource was not found
 */
export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'NOT_FOUND';

  constructor(message: string = 'Resource not found', details?: any) {
    super(message, true, details);
  }
}

/**
 * 409 Conflict - Resource state conflict (e.g. duplicate key, concurrent modification)
 */
export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly errorCode = 'CONFLICT';

  constructor(message: string = 'Resource conflict', details?: any) {
    super(message, true, details);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  public readonly statusCode = 429;
  public readonly errorCode = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Too many requests. Please try again later.', details?: any) {
    super(message, true, details);
  }
}

/**
 * 500 Internal Server Error (Database) - Database query execution, connection, or transaction failure
 */
export class DatabaseError extends AppError {
  public readonly statusCode = 500;
  public readonly errorCode = 'DATABASE_ERROR';

  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, true, details);
  }
}

/**
 * 502 Bad Gateway - Third-party service failure (e.g. Resend, Gemini AI API)
 */
export class ExternalServiceError extends AppError {
  public readonly statusCode = 502;
  public readonly errorCode = 'EXTERNAL_SERVICE_ERROR';

  constructor(message: string = 'External service communication failed', details?: any) {
    super(message, true, details);
  }
}

/**
 * 500 Internal Server Error - Unexpected operational/programming failure
 */
export class InternalServerError extends AppError {
  public readonly statusCode = 500;
  public readonly errorCode = 'INTERNAL_SERVER_ERROR';

  constructor(message: string = 'An unexpected internal server error occurred', details?: any) {
    super(message, false, details);
  }
}
