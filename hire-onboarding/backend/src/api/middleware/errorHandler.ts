import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';
import { getLogger } from '../../config/logger';

const logger = getLogger('error-handler');

// =============================================================================
// Global Error Handler Middleware
// =============================================================================

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode, details: err.details },
      err.message
    );

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  // Unexpected errors
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
