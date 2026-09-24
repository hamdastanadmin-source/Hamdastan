import { z } from '@hamdastan/validation';

/**
 * Environment, parsed once at boot.
 *
 * Reading `process.env` anywhere else is what lets a typo become a runtime
 * surprise in production. Import `env` instead — a missing or malformed
 * variable fails the process immediately, with the reason.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  /** Origins allowed to call the API with credentials, comma-separated. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Before the logger exists, so this goes straight to stderr.
  console.error('Invalid environment:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

export type Env = typeof env;
