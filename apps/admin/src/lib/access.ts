import {
  ADMIN_ROLE_PERMISSIONS,
  type AdminPermission,
  type AdminRole,
} from '@hamdastan/types';

/**
 * What the panel shows an admin, from the same role table the API enforces.
 * Hiding is a courtesy — a hidden button's route still answers 403 — so the
 * panel never offers what would only fail.
 */

export function can(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}

/** The panel's sections, in menu order, and the permission each needs. */
export const SECTIONS = [
  { href: '/users', label: 'مدیریت کاربران', permission: 'admins.manage' },
  { href: '/engagement', label: 'استودیو', permission: 'activities.read' },
  { href: '/sessions', label: 'نشست‌های کاربران', permission: 'sessions.manage' },
] as const satisfies ReadonlyArray<{ href: string; label: string; permission: AdminPermission }>;

/** Where an admin lands: the first section their role opens. */
export function homeFor(role: AdminRole): string {
  return SECTIONS.find((section) => can(role, section.permission))?.href ?? '/login';
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  system_admin: 'مدیر سیستم',
  content_manager: 'مدیر محتوا',
  mission_reviewer: 'بازبین مأموریت',
};
