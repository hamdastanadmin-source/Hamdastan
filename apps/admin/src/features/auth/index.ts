/**
 * Auth — public surface, client-safe. The server-only session read is in
 * `./server`.
 */

export { LoginForm } from './components/LoginForm';
export { useAdminAuth } from './hooks/use-admin-auth';
export { AdminAccessProvider, useAdminCan } from './hooks/use-admin-access';
