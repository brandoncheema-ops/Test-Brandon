import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getEnv } from '../../config/env';
import { loginSchema } from '../validators/workflowValidators';
import { getLogger } from '../../config/logger';

const logger = getLogger('auth-routes');
const router = Router();

// =============================================================================
// Auth Routes - Single-user dashboard authentication (Phase 1)
// =============================================================================

/**
 * POST /api/auth/login
 * Authenticates the dashboard user.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const env = getEnv();

    if (username !== env.DASHBOARD_USERNAME) {
      logger.warn({ username }, 'Login failed: invalid username');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (env.DASHBOARD_PASSWORD_HASH) {
      const valid = await bcrypt.compare(password, env.DASHBOARD_PASSWORD_HASH);
      if (!valid) {
        logger.warn({ username }, 'Login failed: invalid password');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      // Development fallback: if no hash configured, accept "admin" password
      if (password !== 'admin') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    req.session.authenticated = true;
    req.session.username = username;

    logger.info({ username }, 'Login successful');
    res.json({ success: true, username });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, 'Session destroy failed');
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/me
 */
router.get('/me', (req: Request, res: Response) => {
  if (req.session?.authenticated) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
