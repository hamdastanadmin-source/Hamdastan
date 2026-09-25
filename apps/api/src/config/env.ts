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

  // ─── Session ──────────────────────────────────────────────────────────────
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  /**
   * Cookie domain. Empty means host-only, which is what localhost wants. In
   * production the API and the web app sit on sibling hosts, so the cookie
   * has to be scoped to the parent domain (`.hamdastan.ir`).
   */
  SESSION_COOKIE_DOMAIN: z.string().optional(),

  // ─── One-time codes ───────────────────────────────────────────────────────
  /** Lifetime of a code. Also the length of the resend countdown. */
  OTP_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(120),
  /** Wrong codes allowed before the challenge locks and a new one is needed. */
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  /** Codes a single number may be sent inside `OTP_SEND_WINDOW_MINUTES`. */
  OTP_MAX_SENDS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_SEND_WINDOW_MINUTES: z.coerce.number().int().min(1).max(180).default(15),
  /** Which delivery adapter to bind. Only the mock exists so far. */
  OTP_PROVIDER: z.enum(['mock']).default('mock'),
  /**
   * Echoes the generated code back in the API response so the flow can be
   * walked without an SMS gateway. Ignored when NODE_ENV=production.
   */
  SHOW_DEV_OTP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Before the logger exists, so this goes straight to stderr.
  console.error('Invalid environment:', z.treeifyError(parsed.error));
  process.exit(1);
}

const isProduction = parsed.data.NODE_ENV === 'production';

if (isProduction && parsed.data.SHOW_DEV_OTP) {
  console.warn('SHOW_DEV_OTP is set in production and is being ignored.');
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction,
  isDevelopment: parsed.data.NODE_ENV === 'development',
  /**
   * The one flag that decides whether a code ever leaves the backend in a
   * response. Production cannot switch it on, whatever the environment says.
   */
  showDevOtp: parsed.data.SHOW_DEV_OTP && !isProduction,
};

export type Env = typeof env;
