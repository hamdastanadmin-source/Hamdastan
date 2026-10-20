import { CircleCheck, CircleX } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AnswerReview, PlayerActivity } from '@hamdastan/types';

import { reviewedQuestions } from '../../utils/quiz';

/**
 * A quiz's answers, once the API reveals them: each question, whether the
 * person had it, the right answer and why. Right is told by an icon and a
 * word as well as colour, so it never rests on colour alone.
 */
export function AnswerReviewList({ activity, review }: { activity: PlayerActivity; review: AnswerReview[] }) {
  const items = reviewedQuestions(activity, review);
  if (items.length === 0) return null;
  const right = items.filter((item) => item.correct).length;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="answer-review">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="answer-review" className="text-lg font-bold leading-tight">
          پاسخ‌های درست
        </h2>
        <span className="text-sm text-muted-foreground">
          {toPersianDigits(right)} از {toPersianDigits(items.length)} درست
        </span>
      </div>
      <ol className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.questionId} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold leading-relaxed">
              {toPersianDigits(index + 1)}. {item.title}
            </p>
            <p className={item.correct ? 'flex items-center gap-1.5 text-sm text-success' : 'flex items-center gap-1.5 text-sm text-muted-foreground'}>
              {item.correct ? <CircleCheck aria-hidden="true" className="size-4 shrink-0" /> : <CircleX aria-hidden="true" className="size-4 shrink-0" />}
              {item.correct ? 'درست جواب دادی' : 'این یکی رو اشتباه زدی'}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">پاسخ درست: </span>
              <span className="font-semibold">{item.rightLabels.join('، ')}</span>
            </p>
            {item.explanation && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.explanation}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
