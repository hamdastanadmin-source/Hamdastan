'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, UserRound, type LucideIcon } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';

/**
 * The bar at the bottom of the top-level screens — and only those: a screen
 * one step down (edit profile, settings) has a back control instead.
 *
 * Two destinations, because two exist. A tab for a section that is not built
 * would be a promise the product cannot keep yet.
 *
 * Sticky, like `ScreenFooter` and for the same reason: a fixed bar spans the
 * browser on a laptop instead of the column. The current tab is told apart
 * by weight and full-strength text, never by the brand colour — violet is
 * the primary action's alone.
 */

const ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/', label: 'خانه', icon: House },
  { href: '/profile', label: 'پروفایل', icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-2xs transition-colors',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
