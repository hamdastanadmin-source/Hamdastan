import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@hamdastan/ui';

/**
 * One group on the hub: a shadcn `Card` whose title is the section's `h2`.
 * Every section reads the same way — name (and an optional figure beside
 * it, such as «۲ از ۳»), an optional line under it, the content, and an
 * optional footer for the section's action.
 */
export function SectionCard({
  id,
  title,
  description,
  aside,
  footer,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** A short figure at the end of the title row. */
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="rounded-2xl shadow-none">
        <CardHeader className="gap-1.5 space-y-0 p-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id={id} role="heading" aria-level={2} className="text-base">
              {title}
            </CardTitle>
            {aside}
          </div>
          {description && <CardDescription className="leading-relaxed">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="px-5 pb-5">{children}</CardContent>
        {footer && <CardFooter className="px-5 pb-5">{footer}</CardFooter>}
      </Card>
    </section>
  );
}
