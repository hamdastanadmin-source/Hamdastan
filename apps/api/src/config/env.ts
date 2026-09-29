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

  // ─── Database ───────────────────────────────────────────────
  /**
   * PostgreSQL connection string. Optional, so a fresh checkout still boots:
   * without it the repositories stay unbound and `/health` reports the
   * database as `skipped` rather than failing.
   */
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string')
    // An empty value means "unset". `.env` files have no way to say that —
    // `DATABASE_URL=` is an empty string, not an absent key — and the
    // documented way to boot without a database is to leave it blank.
    .or(z.literal('').transform(() => undefined))
    .optional(),
  /**
   * TLS to the database. Off by default because the instance this project
   * points at does not offer it — see the warning in `.env.example`.
   */
  DATABASE_SSL: z.stringbool().default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30_000),
  /**
   * Apply pending migrations during boot. Convenient for a single-container
   * deployment; leave it off where more than one instance starts at once and
   * migrations are a deliberate step. The advisory lock in `data/migrate.ts`
   * makes it safe either way.
   */
  DATABASE_MIGRATE_ON_BOOT: z.stringbool().default(false),

  // ─── Session cookies ────────────────────────────────────────
  /**
   * `Secure` on the session cookies. On by default in production, where the
   * stack is served over TLS; off in development, where `http://localhost`
   * would otherwise drop every cookie the API sets.
   */
  COOKIE_SECURE: z.stringbool().optional(),
  /**
   * Set only when the browser reaches the app and the API on different
   * hostnames. Behind the nginx in `deploy/` they share an origin, so the
   * default — a host-only cookie — is both correct and the narrower one.
   */
  COOKIE_DOMAIN: z.string().optional(),

  // ─── One-time codes ─────────────────────────────────────────
  /**
   * Echoes the freshly issued code back in the API response and, through it,
   * onto the verification screen. It exists so the flow is usable before the
   * SMS provider is connected — turning it off is the entire deployment step
   * on the day it is, and no code changes with it.
   *
   * It is a development switch. On, anyone who can ask for a code for a
   * number can also read it.
   */
  OTP_DEBUG_DISPLAY: z.stringbool().default(false),

  /**
   * The two send caps, overridable.
   *
   * Everything else about a one-time code — its length, its two-minute life,
   * the resend cooldown, the attempt limit — is a constant in
   * `@hamdastan/config`, because the browser has to agree with the server
   * about it. These two are the exception: they are counted only here, and
   * the right number depends on where the traffic comes from. An office
   * behind one NAT is legitimately many people on one address, and a machine
   * running the end-to-end suite is legitimately dozens of sign-ins a minute.
   *
   * Left unset they are the values in `@hamdastan/config`.
   */
  OTP_MAX_SENDS_PER_PHONE: z.coerce.number().int().min(1).optional(),
  OTP_MAX_SENDS_PER_IP: z.coerce.number().int().min(1).optional(),

  // ─── SMS ────────────────────────────────────────────────────
  /** `console` prints the code to the log; `kavenegar` sends it. */
  SMS_PROVIDER: z.enum(['console', 'kavenegar']).default('console'),
  KAVENEGAR_API_KEY: z.string().optional(),
  /** Kaveh-Negar verification template. Required by `kavenegar`. */
  KAVENEGAR_TEMPLATE: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Before the logger exists, so this goes straight to stderr.
  console.error('Invalid environment:', z.treeifyError(parsed.error));
  process.exit(1);
}

const isProduction = parsed.data.NODE_ENV === 'production';

if (parsed.data.SMS_PROVIDER === 'kavenegar' && !parsed.data.KAVENEGAR_API_KEY) {
  console.error('Invalid environment: SMS_PROVIDER=kavenegar requires KAVENEGAR_API_KEY.');
  process.exit(1);
}

if (isProduction && parsed.data.OTP_DEBUG_DISPLAY) {
  // Loud rather than fatal: the flow has to be exercisable on the server in
  // the window before the SMS provider is connected.
  console.warn(
    '[env] OTP_DEBUG_DISPLAY is on in production — one-time codes are being returned to callers.'
  );
}

export const env = {
  ...parsed.data,
  /** TLS-only cookies unless the environment says otherwise. */
  cookieSecure: parsed.data.COOKIE_SECURE ?? isProduction,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

export type Env = typeof env;
