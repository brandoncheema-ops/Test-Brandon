import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import path from 'path';
import { getEnv } from './config/env';
import { getLogger } from './config/logger';
import { errorHandler } from './api/middleware/errorHandler';
import authRoutes from './api/routes/authRoutes';
import workflowRoutes from './api/routes/workflowRoutes';
import { initEmailPoller, startEmailPolling } from './jobs/emailPoller';
import { initReminderJob, startReminderSchedule } from './jobs/reminderJob';

// =============================================================================
// Application Entry Point
// =============================================================================

async function main() {
  const env = getEnv();
  const logger = getLogger('app');

  const app = express();

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Session (single-user, Phase 1)
  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true once SSL is confirmed working
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    })
  );

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  app.use('/api/auth', authRoutes);
  app.use('/api/workflows', workflowRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      betaMode: env.BETA_MODE,
      timestamp: new Date().toISOString(),
    });
  });

  // Serve frontend static files
  const frontendPath = path.resolve(__dirname, '../../frontend/dist');
  const fs = require('fs');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    // SPA fallback - serve index.html for non-API routes
    app.get(/^(?!\/api).*/, (_req: any, res: any) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  // Global error handler
  app.use(errorHandler);

  // ---------------------------------------------------------------------------
  // Background Jobs
  // ---------------------------------------------------------------------------
  try {
    initEmailPoller();
    await startEmailPolling();
    logger.info('Email poller started');

    initReminderJob();
    await startReminderSchedule();
    logger.info('Reminder scheduler started');
  } catch (err) {
    logger.warn({ err }, 'Background jobs failed to start (Redis may not be available)');
  }

  // ---------------------------------------------------------------------------
  // Start Server
  // ---------------------------------------------------------------------------
  app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        betaMode: env.BETA_MODE,
        betaDomains: env.BETA_ALLOWED_DOMAINS,
      },
      `Hire Onboarding API running on port ${env.PORT}`
    );
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
