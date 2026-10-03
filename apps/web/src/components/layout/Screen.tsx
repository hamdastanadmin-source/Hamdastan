import type { ReactNode } from 'react';

import { cn } from '@hamdastan/shared/cn';

/**
 * The shape every screen in the product has: a short header, a body, and the
 * primary action pinned to the bottom edge.
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
  return (
    <div className={cn('flex min-h-dvh flex-col', className)}>{children}</div>
  );
}

export function ScreenHeader({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        // `min-h` rather than `h`: a header with taller content grows
        // instead of clipping it.
        'flex min-h-14 shrink-0 items-center justify-between gap-2 px-5 pt-[env(safe-area-inset-top)]',
        className
      )}
    >
      {children}
    </header>
  );
}

/**
 * The body.
 *
 * `center` is the difference between a screen and a form floating at the top
 * of one. A short form — a phone number, six digits — left top-aligned leaves
 * two thirds of a phone screen empty above the action bar, which reads as a
 * page that failed to load rather than as a deliberately sparse one. Screens
 * whose content actually fills the column leave it off.
 */
export function ScreenBody({
  children,
  className,
  center = false,
}: {
  children: ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <main
      id="main-content"
      className={cn(
        'flex flex-1 flex-col px-5 pb-8',
        center && 'justify-center',
        className
      )}
    >
      {children}
    </main>
  );
}

/**
 * The title block: one `h1`, one supporting line, one rhythm.
 *
 * Six screens were each writing the same header/h1/p by hand, which is how a
 * type scale drifts. There is exactly one `h1` per screen, and this is it.
 */
const TITLE_SIZE = {
  /** A page's title: the screen's name. */
  page: 'text-2xl font-extrabold leading-tight text-balance',
  /**
   * A question put to the person, often two lines: smaller and lighter, with
   * room between the lines, so it reads as something being asked rather than
   * a heading shouted at them.
   */
  prompt: 'text-xl font-semibold leading-relaxed text-pretty',
} as const;

export function ScreenTitle({
  title,
  description,
  size = 'page',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof TITLE_SIZE;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      <h1 className={TITLE_SIZE[size]}>{title}</h1>
      {description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
    </header>
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
        // No hairline rule: the content is meant to pass *under* the bar as
        // it scrolls, and the `before` strip is the fade that hands off
        // between them — it sits above the footer (`bottom-full`), so the
        // last line of content dissolves into the bar rather than being cut
        // by it. That fade is also why there is no `backdrop-blur` here: a
        // backdrop-filter on a sticky element re-rasterises its backdrop —
        // now including the shell's ambient gradient — on every scroll
        // frame, and it buys nothing the gradient is not already saying.
        'sticky bottom-0 z-10 shrink-0 bg-background/95 px-5 pt-4',
        'before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-8 before:bg-linear-to-t before:from-background before:to-transparent',
        className
      )}
      style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </footer>
  );
}
