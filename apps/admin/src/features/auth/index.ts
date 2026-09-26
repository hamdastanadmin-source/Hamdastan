/**
 * Admin auth — ورود مدیران با نام کاربری و رمز عبور.
 *
 * Everything here is safe to import from a client component. The server-only
 * half — reading the session, guarding a route — is exported from `./server`.
 *
 * The screens are opaque on purpose: `/login` renders `AdminLoginForm` and
 * `/change-password` renders `ChangePasswordForm`, and both are passed nothing,
 * so where an admin goes next stays a detail of this feature.
 */

export { AdminLoginForm } from './components/AdminLoginForm';
export { ChangePasswordForm } from './components/ChangePasswordForm';
export { AdminProvider } from './components/AdminProvider';
export { useAdmin, useHasPermission } from './hooks/use-admin';
export { useAdminLogout } from './hooks/use-admin-auth';
