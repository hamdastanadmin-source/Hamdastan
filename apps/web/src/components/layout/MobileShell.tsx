import type { ReactNode } from 'react';

/**
 * The app is a mobile product wherever it is opened.
 *
 * On a laptop it does not become a dashboard — it becomes the same phone
 * screen, centred in a column of `--shell-max-width` (430px) with the page
 * behind it a shade darker. That is a product decision, not a responsive
 * accident, so it is expressed once here.
 *
 * **This is the only place in the app with a breakpoint.** Pages below it
 * have no `sm:`, `md:` or `lg:` of their own: they are written for one width
 * and they get one width. Anything that would otherwise escape the column —
 * a sticky button, a sheet, a toast — is constrained to `max-w-shell` where
 * it is used, because a portalled element is not a descendant of this div.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-surface-0">
      <div
        data-shell
        // `isolate` keeps the glow's negative z-index inside this column
        // rather than letting it fall behind the page.
        className="relative isolate flex w-full max-w-shell flex-col bg-background shell:border-x shell:border-border/70 shell:shadow-2xl shell:shadow-black/40"
      >
        {/* The column's light source: a brand-hued wash falling from the top
            edge, so the screen reads as lit rather than as one flat fill.
            `shell-ambient` carries its own position, height and z-index — it
            must not intercept a tap and it must not be announced. */}
        <div aria-hidden="true" className="shell-ambient" />
        {children}
      </div>
    </div>
  );
}
