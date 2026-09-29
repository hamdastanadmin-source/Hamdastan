import type { ReactNode } from 'react';

import { cn } from '@hamdastan/shared/cn';

/**
 * The shape every screen in the product has: a short header, content that
 * starts at the top, and the primary action pinned to the bottom edge.
 *
 * The footer is `sticky` rather than `fixed` so it stays inside the 430px
 * column instead of spanning the browser — a fixed bar is the usual way a
 * "mobile layout on a laptop" gives itself away. `env(safe-area-inset-bottom)`
 * keeps it clear of the iOS home indicator; the `max()` is what stops it
 * adding padding on a device that has none.
 */

export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex min-h-dvh flex-col', className)}>{children}</div>;
}

export function ScreenHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-5 pt-[env(safe-area-inset-top)]">
      {children}
    </header>
  );
}

export function ScreenBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main id="main-content" className={cn("flex-1 px-5 pb-8", className)}>
      {children}
    </main>
  );
}

export function ScreenFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        'sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-background/90 px-5 pt-4 backdrop-blur-sm',
        className
      )}
      style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </footer>
  );
}
