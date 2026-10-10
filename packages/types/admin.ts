/**
 * The admin panel's wire contract.
 *
 * An admin user is not a product user: they are rows in `v2_admin_users`,
 * created only from the panel itself, and signing in to the product never
 * makes one.
 */

export type AdminUserStatus = 'active' | 'inactive';

/**
 * Who an admin is in the panel. Access is decided by *permission*, never by
 * comparing role names: a route asks "may this admin revoke XP?", and the
 * table below answers. Adding a role is a row here, not an `if` in a handler.
 */
export const ADMIN_ROLES = ['system_admin', 'content_manager', 'mission_reviewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  /** The admin allow-list: add, edit, deactivate, delete admins and set their role. */
  'admins.manage',
  /** A product account's sessions: see them, end them. */
  'sessions.manage',
  /** Engagement Studio: see activities, their history, preview an audience. */
  'activities.read',
  /** Create, edit, duplicate. */
  'activities.write',
  /** Publish, pause, close, archive. */
  'activities.publish',
  /** The aggregate dashboard — counts and charts, no one person's answers. */
  'results.read',
  /** One person's answers: the submissions list — what a reviewer judges. */
  'results.individual',
  /** Who was paid what: the per-person XP grants list. */
  'xp.read',
  /** The CSV export — every response, in bulk. */
  'results.export',
  /** Approve or reject a mission submission (which may pay XP). */
  'submissions.review',
  /** Take back XP already granted. */
  'xp.revoke',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** The whole access model. `apps/api` enforces it; `apps/admin` only hides what it would refuse. */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  system_admin: ADMIN_PERMISSIONS,
  content_manager: ['activities.read', 'activities.write', 'activities.publish', 'results.read'],
  mission_reviewer: ['activities.read', 'results.read', 'results.individual', 'submissions.review'],
};

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  /** Normalised to `09xxxxxxxxx`. */
  phone: string;
  status: AdminUserStatus;
  role: AdminRole;
  /** ISO timestamp; null until the first sign-in. */
  lastLoginAt: string | null;
  createdAt: string;
};

/** `GET /admin/me`, and the body of a successful admin verify. */
export type AdminSessionResponse = {
  admin: AdminUser;
};

/** A product account, as the session manager shows it. */
export type AppUserSummary = {
  id: string;
  phone: string;
  /** Null until the person fills in the profile form. */
  firstName: string | null;
  lastName: string | null;
  suspended: boolean;
};

/** One live sign-in of a product account. Timestamps are ISO. */
export type AppUserSession = {
  id: string;
  createdAt: string;
  /** The last refresh — within fifteen minutes of the last use. */
  lastSeenAt: string | null;
  /** When it ends if unused (the seven-day idle limit). */
  expiresAt: string;
  /** When it ends regardless; null until its first refresh, for sessions older than the rule. */
  absoluteExpiresAt: string | null;
  /** As recorded at sign-in. */
  userAgent: string | null;
  ip: string | null;
};

/** `POST /admin/app-users/sessions/lookup` and `GET /admin/app-users/:id/sessions`. */
export type AppUserSessions = {
  user: AppUserSummary;
  sessions: AppUserSession[];
};

/** The stable `code` values the admin panel switches on. */
export const ADMIN_ERROR_CODES = {
  /** The code was right, but the number is not an active admin. */
  ADMIN_ACCESS_DENIED: 'ADMIN_ACCESS_DENIED',
  ADMIN_PHONE_TAKEN: 'ADMIN_PHONE_TAKEN',
  ADMIN_SELF_DEACTIVATION: 'ADMIN_SELF_DEACTIVATION',
  ADMIN_SELF_DELETION: 'ADMIN_SELF_DELETION',
  /** An admin may not change their own role — it is what keeps a system admin in charge. */
  ADMIN_SELF_ROLE_CHANGE: 'ADMIN_SELF_ROLE_CHANGE',
  /** Signed in, but this admin's role does not grant the permission. */
  ADMIN_PERMISSION_DENIED: 'ADMIN_PERMISSION_DENIED',
} as const;
