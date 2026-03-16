import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Beta mode
  BETA_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  BETA_ALLOWED_DOMAINS: z
    .string()
    .transform((v) => v.split(',').map((d) => d.trim().toLowerCase()))
    .default('balcpa.com'),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Session
  SESSION_SECRET: z.string().min(16),

  // Dashboard auth
  DASHBOARD_USERNAME: z.string().default('admin'),
  DASHBOARD_PASSWORD_HASH: z.string().optional(),

  // Azure / Microsoft Graph (optional in demo mode)
  AZURE_TENANT_ID: z.string().default('demo'),
  AZURE_CLIENT_ID: z.string().default('demo'),
  AZURE_CLIENT_SECRET: z.string().default('demo'),

  // Automation inbox
  AUTOMATION_INBOX_EMAIL: z.string().default('hire-automation@balcpa.com'),
  EMAIL_POLL_INTERVAL_SECONDS: z.coerce.number().default(60),

  // SharePoint (optional in demo mode)
  SHAREPOINT_SITE_ID: z.string().default('demo'),
  SHAREPOINT_DRIVE_ID: z.string().default('demo'),
  SHAREPOINT_CONTRACTS_FOLDER: z.string().default('Contracts/Employees'),

  // LLM (optional in demo mode)
  ANTHROPIC_API_KEY: z.string().default('demo'),
  LLM_MODEL: z.string().default('claude-sonnet-4-6'),
  LLM_MAX_TOKENS: z.coerce.number().default(4096),
  LLM_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),

  // Documents
  TEMPLATES_DIR: z.string().default('./templates'),
  LIBREOFFICE_PATH: z.string().default('/usr/bin/libreoffice'),
  OUTPUT_DIR: z.string().default('./output'),

  // Reminders
  REMINDER_DAYS_THRESHOLD: z.coerce.number().default(7),
  REMINDER_CRON: z.string().default('0 9 * * 1-5'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Environment validation failed:');
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
      }
      throw new Error('Invalid environment configuration. See errors above.');
    }
    _env = result.data;
  }
  return _env;
}

/**
 * For testing: override env with partial values.
 */
export function setEnvOverrides(overrides: Partial<Env>): void {
  const current = getEnv();
  _env = { ...current, ...overrides };
}
