import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, type LucideIcon } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';

/**
 * A grouped list of rows — settings, the profile's fields, the hub's way
 * to settings. One frame per group with hairlines between rows, rather
 * than a card per row.
 *
 * A row is a link (`href`), a button (`onClick`) or a container for its own
 * control (`children`, e.g. a switch with its label). Every row is at least
 * 56px tall, so the whole row is the target, not the chevron.
 */

export function ListGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {title && <h2 className="px-1 text-xs font-medium text-muted-foreground">{title}</h2>}
      <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {children}
      </ul>
    </section>
  );
}

const rowClass =
  'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start text-sm outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent';

export function ListRow({
  icon: Icon,
  label,
  value,
  href,
  onClick,
  children,
}: {
  icon?: LucideIcon;
  /** Not needed by a row that holds its own labelled control. */
  label?: ReactNode;
  /** The current value, quietly, before the chevron. */
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** A row that holds its own control instead of navigating. */
  children?: ReactNode;
}) {
  const content = (
    <>
      {Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
      <span className="flex-1">{label}</span>
      {value !== undefined && (
        <span className="max-w-[45%] truncate text-muted-foreground">{value}</span>
      )}
      {/* rtl-ok: "forward" points left in an RTL layout; this is the direction, not an edge. */}
      <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (children) return <li className={cn(rowClass, 'hover:bg-transparent')}>{children}</li>;

  return (
    <li>
      {href ? (
        <Link href={href} className={rowClass}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cn(rowClass, 'cursor-pointer')}>
          {content}
        </button>
      )}
    </li>
  );
}
