import type { ReactNode } from 'react';

/** A section's name on the hub: small, quiet, and the only heading the section needs. */
export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-sm font-semibold text-muted-foreground">
      {children}
    </h2>
  );
}
