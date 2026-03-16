import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../../config/logger';

const logger = getLogger('auth-middleware');

// =============================================================================
// Authentication Middleware
// Phase 1: Simple session-based auth for single-user dashboard
// =============================================================================

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    username: string;
  }
}

/**
 * Ensures the request is from an authenticated session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    return next();
  }

  logger.warn({ path: req.path, ip: req.ip }, 'Unauthorized access attempt');
  res.status(401).json({ error: 'Authentication required' });
}
