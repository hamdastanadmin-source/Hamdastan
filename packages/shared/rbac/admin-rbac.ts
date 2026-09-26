/**
 * Which admin role may do what.
 *
 * One list, read by both sides: `apps/admin` hides a menu the signed-in admin
 * has no permission for, and `apps/api` refuses the request behind it. The UI
 * half is cosmetic — the backend re-checks every time, so a hidden menu is a
 * convenience and never a boundary.
 *
 * It lives here rather than in a database because no data layer has been
 * chosen. The eventual `admin_roles` table is designed in
 * `docs/architecture/admin-data-model.md`; an admin row references a role by
 * its `code`, so seeding that table later changes nothing that is stored.
 *
 * Adding a role is two lines below plus its code in `AdminRoleCode`. Adding a
 * permission is one line in `AdminPermission` and one guard on the route it
 * protects — nothing infers permissions from a name.
 */

import type { AdminPermission, AdminRole, AdminRoleCode } from '@hamdastan/types';

/** Every permission the backend guards, in the order they are documented. */
export const ADMIN_PERMISSIONS = [
  'dashboard.view',
  'users.view',
  'users.create',
  'users.edit',
  'users.reset_password',
  'forms.view',
  'forms.create',
  'forms.edit',
  'forms.publish',
  'forms.delete',
  'forms.responses.view',
  'forms.responses.export',
] as const satisfies readonly AdminPermission[];

/** Everything «فرم‌ها و نظرسنجی‌ها» needs, for the roles that own that area. */
const FORM_PERMISSIONS = [
  'forms.view',
  'forms.create',
  'forms.edit',
  'forms.publish',
  'forms.delete',
  'forms.responses.view',
  'forms.responses.export',
] as const satisfies readonly AdminPermission[];

/**
 * The role codes, as a tuple, so `packages/validation` can build an enum from
 * them and a role that is not in this catalogue cannot be assigned.
 */
export const ADMIN_ROLE_CODES = [
  'super_admin',
  'user_manager',
  'form_manager',
  'support',
] as const;

export const ADMIN_ROLES: readonly AdminRole[] = [
  {
    code: 'super_admin',
    name: 'مدیر ارشد',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    code: 'user_manager',
    name: 'مدیر کاربران',
    permissions: [
      'dashboard.view',
      'users.view',
      'users.create',
      'users.edit',
      'users.reset_password',
    ],
  },
  {
    // Owns the forms area and nothing else: it can build, publish and read
    // answers, but cannot touch admin accounts.
    code: 'form_manager',
    name: 'مدیر فرم‌ها',
    permissions: ['dashboard.view', ...FORM_PERMISSIONS],
  },
  {
    // Sees the dashboard and nothing else. The role that proves the guard
    // works: with it, the users menu is hidden *and* the API refuses.
    code: 'support',
    name: 'پشتیبان',
    permissions: ['dashboard.view'],
  },
];

/** The role, or null if the code is not in the catalogue. */
export function findAdminRole(code: string): AdminRole | null {
  return ADMIN_ROLES.find((role) => role.code === code) ?? null;
}

/**
 * The permissions a role carries. Empty for an unknown code, which fails
 * closed: an account whose role disappeared can do nothing rather than
 * everything.
 */
export function adminRolePermissions(code: string): readonly AdminPermission[] {
  return findAdminRole(code)?.permissions ?? [];
}

/** The Persian label, or the raw code if the catalogue has never heard of it. */
export function adminRoleName(code: string): string {
  return findAdminRole(code)?.name ?? code;
}

export function hasAdminPermission(
  permissions: readonly AdminPermission[],
  permission: AdminPermission
): boolean {
  return permissions.includes(permission);
}

/** Narrows a string to a known role code, for a value that came off the wire. */
export function isAdminRoleCode(value: string): value is AdminRoleCode {
  return findAdminRole(value) !== null;
}
