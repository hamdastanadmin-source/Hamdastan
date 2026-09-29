'use client';

import { LogOut } from 'lucide-react';

import { Button } from '@hamdastan/ui';

import { useAuthActions } from '../hooks/use-auth-actions';

/**
 * Ends the session and goes back to Welcome.
 *
 * A client component because signing out is a call plus a navigation, and
 * because the page that hosts it is otherwise a server component — this is
 * the only part of it that needs to ship JavaScript.
 */
export function SignOutButton() {
  const { logout } = useAuthActions();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-me-2 text-muted-foreground"
      onClick={() => void logout()}
    >
      <LogOut aria-hidden="true" />
      خروج
    </Button>
  );
}
