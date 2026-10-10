import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AssessmentResult } from '@hamdastan/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@hamdastan/ui';

/** A neutral bar: figures are not the primary action. */
const BAR = 'bg-muted [&>[data-slot=progress-indicator]]:bg-foreground/70';

/**
 * An assessment's result as the person sees it, when the admin allowed it:
 * a knowledge score with its pass mark, or the personality outcome with
 * every dimension's share.
 */
export function ResultCard({ result }: { result: AssessmentResult }) {
  if (result.mode === 'knowledge') {
    return (
      <Card className="gap-3">
        <CardHeader>
          <CardDescription>نمره‌ی تو</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{toPersianDigits(result.score ?? 0)}٪</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={result.score ?? 0} className={BAR} aria-label="نمره" />
          {result.passed !== null && (
            <p className={result.passed ? 'text-sm font-semibold text-success' : 'text-sm text-muted-foreground'}>
              {result.passed ? 'قبول شدی!' : 'این بار به حد قبولی نرسیدی.'}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardDescription>نتیجه‌ی تو</CardDescription>
        <CardTitle className="text-xl">{result.outcome?.title ?? '—'}</CardTitle>
        {result.outcome?.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{result.outcome.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {result.dimensions.map((dimension) => (
            <li key={dimension.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{dimension.title}</span>
                <span className="tabular-nums text-muted-foreground">{toPersianDigits(dimension.value)}٪</span>
              </div>
              <Progress value={dimension.value} className={BAR} aria-label={dimension.title} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
