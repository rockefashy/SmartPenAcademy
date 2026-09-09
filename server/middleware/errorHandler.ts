// server/middleware/errorHandler.ts
// Smart Pen Academy - Centralized Express Error Middleware & Async Handler

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors';
import { Logger } from '../logger';

const apiLogger = Logger.get('API');

/**
 * Wraps asynchronous Express route handlers to forward any unhandled promise rejections
 * directly to the next(err) handler, eliminating redundant try/catch blocks.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Terminal Express global error handler. Formats clean, structured client responses,
 * logs errors with sanitized metadata and domain tags, and prevents stack/secret leaks.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    return next(err);
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : (Number(err.statusCode || err.status) || 500);
  const errorCode = isAppError ? err.errorCode : (err.code || 'INTERNAL_SERVER_ERROR');
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, never expose internal 500 error messages or raw DB errors to clients
  const clientMessage = isAppError
    ? err.message
    : (statusCode < 500 ? (err.message || 'Client error') : 'An unexpected internal server error occurred.');

  const logMeta = {
    path: req.path,
    method: req.method,
    statusCode,
    errorCode,
    userId: (req as any).user?.id || 'anonymous',
    ip: req.ip
  };

  if (statusCode >= 500) {
    apiLogger.error(err.message || 'Internal Server Error', err, logMeta);
  } else {
    apiLogger.warn(err.message || 'Client Request Error', {
      ...logMeta,
      details: isAppError ? err.details : undefined
    });
  }

  const responsePayload: Record<string, any> = {
    error: clientMessage,
    code: errorCode,
    statusCode
  };

  if (isAppError && err.details !== undefined) {
    responsePayload.details = err.details;
  } else if (!isProduction && err.stack && statusCode >= 500) {
    // Only in non-production development for developer velocity
    responsePayload.debugStack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
};
