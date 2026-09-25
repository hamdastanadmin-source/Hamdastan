/**
 * Auth — ورود با شماره موبایل و کد یک‌بارمصرف.
 *
 * Everything here is safe to import from a client component. The server-only
 * half — reading the session, guarding a route — is exported from `./server`.
 *
 * The flow itself is opaque on purpose: `/login` renders `AuthFlow` and passes
 * it nothing, so the steps and their order stay a detail of this feature.
 */

export { AuthFlow } from './components/AuthFlow';
export { AuthProvider } from './components/AuthProvider';
export { useAuth, useAuthOptional } from './hooks/use-auth';
export { useLogout } from './hooks/use-logout';
