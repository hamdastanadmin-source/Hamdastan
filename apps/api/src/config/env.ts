import { ADMIN_SESSION, SESSION } from '@hamdastan/config';
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
  /**
   * The proxies whose `X-Forwarded-For` the API believes, as addresses or
   * CIDRs, comma-separated. Empty — the default, and right in development,
   * where the browser connects directly — trusts nobody, so `request.ip` is
   * the socket's address.
   *
   * In production it is nginx's fixed address on the `edge` network and
   * nothing wider: a peer that is trusted is a peer that can choose the
   * client's IP. `true` and hop counts are refused for that reason — they
   * trust whatever is leftmost in a header the client wrote.
   */
  TRUST_PROXY: z
    .string()
    .default('')
    .refine((value) => !/^\s*(true|\d+)\s*$/i.test(value), {
      message: 'must list proxy addresses or CIDRs, not true or a hop count',
    }),

  // ─── Request limits ─────────────────────────────────────────
  /** Largest JSON body the API parses. nginx enforces the same at the edge. */
  HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).default(1_048_576),
  /** How long a client may take to send a whole request (slow-loris guard). */
  HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),

  // ─── Rate limits ────────────────────────────────────────────
  /**
   * Off only for a test run that is not about rate limiting. Every number
   * below is a starting point, to be tuned against real traffic — see
   * docs/PRD.md §5 for what each one protects.
   */
  RATE_LIMIT_ENABLED: z.stringbool().default(true),
  /** Per address, on routes with no session (sign-in, refresh without a cookie). */
  RATE_LIMIT_ANONYMOUS_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  /**
   * Per signed-in user: anything that changes state, and reads. Reads are
   * counted apart and allowed more because ordinary use makes many — every
   * navigation and prefetch reads the session on the server, and the
   * questionnaire alone went past 100 a minute in the end-to-end run.
   */
  RATE_LIMIT_USER_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_USER_READ_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  /** Per session, on `POST /auth/refresh`. */
  RATE_LIMIT_REFRESH_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  /** Per user and activity, on `POST /me/activities/:id/submit`. */
  RATE_LIMIT_SUBMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
  /** Per address, on both code-verification routes, over fifteen minutes. */
  RATE_LIMIT_OTP_VERIFY_PER_15_MINUTES: z.coerce.number().int().min(1).default(30),
  /** Per admin: reads, and anything that changes state. */
  RATE_LIMIT_ADMIN_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_ADMIN_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  /** Distinct keys the in-memory store remembers before forgetting the oldest. */
  RATE_LIMIT_MAX_KEYS: z.coerce.number().int().min(100).default(50_000),

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
  /**
   * How long an unused pooled connection is kept. Long enough that a quiet
   * minute does not mean the next request pays to reconnect to a database
   * across the network.
   */
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(300_000),
  /**
   * Apply pending migrations during boot. Convenient for a single-container
   * deployment; leave it off where more than one instance starts at once and
   * migrations are a deliberate step. The advisory lock in `data/migrate.ts`
   * makes it safe either way.
   */
  DATABASE_MIGRATE_ON_BOOT: z.stringbool().default(false),
  /**
   * The longest one statement may run before PostgreSQL cancels it. A slow
   * query then fails one request instead of holding a pooled connection —
   * and, behind it, every request waiting for one. The migration runner
   * lifts it for its own session.
   */
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(15_000),

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

  // ─── Session lifetimes ──────────────────────────────────────
  /**
   * Overrides for the lifetimes in `@hamdastan/config` (SESSION and
   * ADMIN_SESSION), in seconds. Unset is the normal state; they exist so an
   * incident can shorten them without a release.
   */
  SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().min(300).optional(),
  SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().min(300).optional(),
  ADMIN_SESSION_IDLE_SECONDS: z.coerce.number().int().min(60).optional(),

  // ─── Maintenance ────────────────────────────────────────────
  /** The hourly cleanup of expired sessions, tokens and codes. Off in tests. */
  MAINTENANCE_ENABLED: z.stringbool().default(true),
  MAINTENANCE_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(60),
  /**
   * How long an *ended* session — signed out, expired, revoked — is kept
   * before it is deleted, for support and security questions about it.
   */
  SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
  /** How long the log of sent codes is kept, for abuse investigations. */
  OTP_SEND_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),

  // ─── One-time codes ─────────────────────────────────────────
  /**
   * Echoes the freshly issued code back in the API response (`debugCode`), for
   * the end-to-end tests — no screen shows it. Development only: production
   * ignores it.
   *
   * It is a development switch. On, anyone who can ask for a code for a
   * number can also read it.
   */
  OTP_DEBUG_DISPLAY: z.stringbool().default(false),

  /**
   * Wrong codes one number may enter, across every code it is sent, inside
   * the window — after which verification is refused until the window ends.
   * The per-code limit (`OTP.MAX_ATTEMPTS`) burns one code; this is what
   * stops an attacker simply asking for the next one.
   */
  OTP_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  OTP_FAILURE_WINDOW_SECONDS: z.coerce.number().int().min(60).default(900),

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
  /**
   * How long one SMS request may take. A send is never retried: a provider
   * that timed out may still have delivered, and a second attempt is a
   * second message.
   */
  SMS_TIMEOUT_MS: z.coerce.number().int().min(500).default(5_000),
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

// Production fails closed on one-time codes. Neither of these stops the
// boot — that would take the whole site down — but neither can weaken
// sign-in either: the echo is ignored, and without a real provider no code
// is issued at all (`server.ts` leaves the sender unbound; asking for a code
// is a 503).
if (isProduction && parsed.data.OTP_DEBUG_DISPLAY) {
  console.error('[env] OTP_DEBUG_DISPLAY is ignored in production: codes are never returned to callers.');
}
if (isProduction && parsed.data.SMS_PROVIDER === 'console') {
  console.error(
    '[env] SMS_PROVIDER=console in production: no SMS provider, so sign-in is refused (503) ' +
      'until SMS_PROVIDER=kavenegar is set.'
  );
}

export const env = {
  ...parsed.data,
  /**
   * Whether a freshly issued code may be returned to the caller: only outside
   * production, and only with the switch on. There is no production exception.
   */
  otpEchoAllowed: !isProduction && parsed.data.OTP_DEBUG_DISPLAY,
  /** Lifetimes in seconds: the environment's override, else the shared constant. */
  session: {
    idleSeconds: parsed.data.SESSION_IDLE_TTL_SECONDS ?? SESSION.REFRESH_TOKEN_TTL_SECONDS,
    absoluteSeconds: parsed.data.SESSION_ABSOLUTE_TTL_SECONDS ?? SESSION.ABSOLUTE_TTL_SECONDS,
    adminIdleSeconds: parsed.data.ADMIN_SESSION_IDLE_SECONDS ?? ADMIN_SESSION.IDLE_TIMEOUT_SECONDS,
  },
  /** `false` when nothing is trusted, so Fastify reads the socket's address. */
  trustProxy: parsed.data.TRUST_PROXY.trim() === '' ? false : parsed.data.TRUST_PROXY,
  /** TLS-only cookies unless the environment says otherwise. */
  cookieSecure: parsed.data.COOKIE_SECURE ?? isProduction,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

export type Env = typeof env;
