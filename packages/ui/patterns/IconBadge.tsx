import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hamdastan/shared/cn';

/**
 * An icon in a tinted, rounded tile — the mark at the top of an empty state,
 * a confirmation or an error screen.
 *
 * It exists because three screens built the same thing by hand and had
 * already drifted apart on radius and size. The tint, the radius and the
 * halo behind it are one decision, made here.
 *
 * `glow` draws `--gradient-hero-glow` behind the tile, spread past its edges
 * by an amount that belongs to the size. It is decorative, so it is hidden
 * from assistive technology and cannot be tapped; the icon passed in should
 * carry `aria-hidden` for the same reason, because the heading beside it is
 * what names the state.
 */

const iconBadgeVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center rounded-2xl',
  {
    variants: {
      tone: {
        primary: 'bg-primary/15 text-primary',
        destructive: 'bg-destructive/15 text-destructive',
        muted: 'bg-muted text-muted-foreground',
      },
      size: {
        md: "size-16 [&>.hero-glow]:-inset-6 [&_svg:not([class*='size-'])]:size-8",
        lg: "size-20 [&>.hero-glow]:-inset-8 [&_svg:not([class*='size-'])]:size-10",
      },
    },
    defaultVariants: { tone: 'primary', size: 'md' },
  }
);

export function IconBadge({
  children,
  className,
  tone,
  size,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Draws the brand halo behind the tile. */
  glow?: boolean;
} & VariantProps<typeof iconBadgeVariants>) {
  return (
    <span className={cn(iconBadgeVariants({ tone, size }), className)}>
      {glow && <span aria-hidden="true" className="hero-glow" />}
      {children}
    </span>
  );
}
