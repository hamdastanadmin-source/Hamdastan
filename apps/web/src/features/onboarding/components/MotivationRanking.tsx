'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { QUESTIONS, type ChoiceQuestion } from '@hamdastan/config';
import { Button } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { ScreenTitle } from '@/components';

import { moveItem } from '../utils/questionnaire-flow';
import { QuestionnaireScreen } from './QuestionnaireScreen';

/**
 * Q1's second half: the picked motivations, in order of importance. Only the
 * two or three that were picked — never the whole list of nine.
 *
 * They arrive in the order they were tapped, which is usually the order that
 * mattered. Each moves with a pair of 44px buttons rather than a drag: a drag
 * is hard on a phone, impossible from a keyboard, and invisible to a screen
 * reader. The new position is announced.
 */

const Q1 = QUESTIONS.Q1 as ChoiceQuestion;
const labelOf = (code: string) => Q1.options.find((option) => option.code === code)?.label ?? code;

export function MotivationRanking({
  initialRanking,
  progress,
  isSaving,
  leaving,
  onSubmit,
  onBack,
}: {
  initialRanking: string[];
  progress: number;
  isSaving: boolean;
  leaving: boolean;
  onSubmit: (ranked: string[]) => void;
  onBack: () => void;
}) {
  const [ranked, setRanked] = useState(initialRanking);
  const [announcement, setAnnouncement] = useState('');

  const move = (index: number, direction: -1 | 1) => {
    const next = moveItem(ranked, index, direction);
    setRanked(next);
    const position = index + direction + 1;
    setAnnouncement(`«${labelOf(ranked[index])}» حالا شماره ${toPersianDigits(position)} است`);
  };

  return (
    <QuestionnaireScreen
      progress={progress}
      onBack={onBack}
      leaving={leaving}
      footer={
        <Button
          type="button"
          size="xl"
          className="w-full"
          loading={isSaving}
          onClick={() => onSubmit(ranked)}
        >
          ادامه
        </Button>
      }
    >
      <ScreenTitle size="prompt" title="کدوم برات مهم‌تره؟" description="به ترتیب اهمیت بچین." />

      <ol className="flex flex-col gap-2">
        {ranked.map((code, index) => {
          const label = labelOf(code);
          return (
            <li
              key={code}
              className="flex min-h-13 items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 py-1 ps-4 pe-1 motion-safe:transition-transform"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold tabular-nums text-foreground"
              >
                {toPersianDigits(index + 1)}
              </span>
              <span className="flex-1 text-base leading-relaxed">{label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-touch"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${label}، مهم‌تر`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-touch"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${label}، کم‌اهمیت‌تر`}
                disabled={index === ranked.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ol>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </QuestionnaireScreen>
  );
}
