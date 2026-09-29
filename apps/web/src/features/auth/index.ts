/**
 * Auth — public surface.
 *
 * The four screens of the sign-in flow, the provider that carries the session
 * into the client tree, and the hooks that read it. Everything here is safe
 * to import from a client component; the server-only half (the session read
 * and the route guards) is exported from `./server`.
 */

export { AuthProvider } from './components/AuthProvider';
export { WelcomeScreen } from './components/WelcomeScreen';
export { PhoneForm } from './components/PhoneForm';
export { OtpForm } from './components/OtpForm';
export { BasicInfoForm } from './components/BasicInfoForm';
export { SignOutButton } from './components/SignOutButton';
export { useAuth, useAuthOptional } from './hooks/use-auth';
export { useAuthActions } from './hooks/use-auth-actions';
