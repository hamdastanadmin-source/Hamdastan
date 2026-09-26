import { CircleHelp } from 'lucide-react';

import { Badge, Card, CardContent } from '@hamdastan/ui';

/**
 * One quiz on the home screen.
 *
 * Deliberately not a link or a button: there is nothing behind it yet. It is
 * rendered as an `article` with `aria-disabled`, and carries no hover or
 * pressed state, so it does not offer an interaction the product cannot
 * honour — a card that looks clickable and does nothing is worse than one that
 * plainly says "به‌زودی".
 */
export function QuizCard({ title }: { title: string }) {
  return (
    <Card
      aria-disabled="true"
      className="cursor-default border-border/60 bg-card/60 shadow-none"
    >
      <CardContent className="flex flex-col items-center gap-3 p-4 text-center sm:p-5">
        {/* Filled rather than tinted: the brand navy is dark, so a thin icon
            drawn in it disappears against a dark surface — on the fill it is
            the near-white foreground that carries. */}
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:size-12"
        >
          <CircleHelp className="size-5 sm:size-6" />
        </span>

        <span className="text-sm font-medium text-foreground sm:text-base">{title}</span>

        <Badge variant="outline" className="text-2xs text-muted-foreground">
          به‌زودی
        </Badge>
      </CardContent>
    </Card>
  );
}
