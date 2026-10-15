'use client';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { PlayerStep } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

import { answerText } from '../../utils/journey';

/** A finished day read back: each question and the answer given. Nothing here can change it. */
export function DayReview({
  day,
  number,
  answers,
  onBack,
}: {
  day: PlayerStep;
  number: number;
  answers: Record<string, unknown>;
  onBack: () => void;
}) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack onClick={onBack} label="بازگشت به چالش" />
      </ScreenHeader>
      <ScreenBody className="gap-6 pt-2">
        <ScreenTitle title={day.title || `روز ${toPersianDigits(number)}`} description="پاسخ‌هایی که این روز دادی." />
        <ol className="flex flex-col gap-3">
          {day.questions.map((question, i) => (
            <li key={question.id} className="flex flex-col gap-1 rounded-xl border p-4">
              <span className="text-xs text-muted-foreground">سؤال {toPersianDigits(i + 1)}</span>
              <span className="font-medium leading-relaxed">{question.title}</span>
              <span className="text-sm text-muted-foreground">{answerText(question, answers[question.id])}</span>
            </li>
          ))}
        </ol>
      </ScreenBody>
      <ScreenFooter>
        <Button size="xl" variant="outline" className="w-full" onClick={onBack}>
          بازگشت به چالش
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
