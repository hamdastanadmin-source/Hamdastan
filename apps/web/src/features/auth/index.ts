/**
 * Auth — public surface.
 *
 * Everything here is safe to import from a client component. The server-only
 * half (session lookup, route guards) is exported from `./server`.
 */

export { AuthProvider } from './components/AuthProvider';
export { useAuth, useAuthOptional } from './hooks/use-auth';
export { loginAction, logoutAction } from './services/auth.actions';
