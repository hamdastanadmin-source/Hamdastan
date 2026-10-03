'use client';

import { useState } from 'react';

import { FIRST_SLIDER_ID, type Question } from '@hamdastan/config';
import type { QuestionnaireAnswer } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { ScreenTitle } from '@/components';

import { mergeRanking, selectedCodes } from '../utils/questionnaire-flow';
import { QuestionOptions } from './QuestionOptions';
import { QuestionSlider } from './QuestionSlider';
import { QuestionnaireScreen } from './QuestionnaireScreen';

/**
 * One question, one decision — prompt, answer, move on.
 *
 * What is on the screen, in the order the eye should take it: the question,
 * a short helper only where the question needs one, and the answers right
 * beneath it. Nothing else: no section name, no question number.
 *
 * - **Single choice** saves on the tap and moves on by itself; no button.
 * - **Multi-select** (and Q1) waits for «ادامه», enabled at the first pick.
 *   Its helper states the limit, and says so quietly once it is reached.
 * - **Slider** waits for «ادامه», enabled once the slider has been touched —
 *   a value nobody chose is not an answer. Only the first slider explains
 *   how to use one.
 *
 * A saved answer comes back selected. The component holds only the
 * selection in progress; what counts is what the server returns.
 */

/** Where an untouched slider rests. */
const SLIDER_REST = 5;
const SLIDER_HINT = 'نقطه رو جابه‌جا کن و جایی بذار که بیشتر بهت نزدیکه.';

export function QuestionStep({
  question,
  answer,
  progress,
  isSaving,
  leaving,
  onSubmit,
  onBack,
}: {
  question: Question;
  answer: QuestionnaireAnswer | undefined;
  progress: number;
  isSaving: boolean;
  leaving: boolean;
  onSubmit: (answer: QuestionnaireAnswer, options?: { feedback?: boolean }) => Promise<boolean>;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => selectedCodes(answer));
  const [sliderValue, setSliderValue] = useState(() =>
    answer && 'value' in answer ? answer.value : SLIDER_REST
  );
  const [sliderTouched, setSliderTouched] = useState(() => Boolean(answer && 'value' in answer));

  const titleId = `question-${question.id}`;

  const handleChoice = (codes: string[]) => {
    if (question.kind !== 'single') {
      setSelected(codes);
      return;
    }
    // One tap per save. The options stay enabled rather than disabled while
    // it runs, so the chosen one does not dim at the moment it is confirmed.
    if (isSaving || leaving) return;
    setSelected(codes);
    void onSubmit({ option: codes[0] }, { feedback: true }).then((saved) => {
      // A failed save keeps the person here, showing what is actually stored.
      if (!saved) setSelected(selectedCodes(answer));
    });
  };

  const handleContinue = () => {
    if (question.kind === 'slider') {
      void onSubmit({ value: sliderValue });
    } else if (question.kind === 'ranked') {
      const previous = answer && 'ranked' in answer ? answer.ranked : [];
      void onSubmit({ ranked: mergeRanking(previous, selected) });
    } else {
      void onSubmit({ options: selected });
    }
  };

  const canContinue = question.kind === 'slider' ? sliderTouched : selected.length > 0;
  const max = question.kind === 'slider' ? undefined : question.maxSelections;
  const atCap = max !== undefined && selected.length >= max;

  const helper =
    question.kind === 'slider'
      ? question.id === FIRST_SLIDER_ID
        ? SLIDER_HINT
        : undefined
      : atCap
        ? `${toPersianDigits(max!)} مورد انتخاب شد`
        : question.helper;

  return (
    <QuestionnaireScreen
      progress={progress}
      onBack={onBack}
      leaving={leaving}
      footer={
        question.kind === 'single' ? null : (
          <Button
            type="button"
            size="xl"
            className="w-full"
            disabled={!canContinue}
            loading={isSaving}
            onClick={handleContinue}
          >
            ادامه
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        <div id={titleId}>
          <ScreenTitle size="prompt" title={question.title} />
        </div>
        {helper && (
          // A live region for multi-select, so reaching the limit is heard as well as seen.
          <p
            role={question.kind === 'slider' ? undefined : 'status'}
            aria-live={question.kind === 'slider' ? undefined : 'polite'}
            className={
              atCap ? 'text-sm text-foreground/80 transition-colors' : 'text-sm text-muted-foreground transition-colors'
            }
          >
            {helper}
          </p>
        )}
      </div>

      {question.kind === 'slider' ? (
        <QuestionSlider
          question={question}
          value={sliderValue}
          touched={sliderTouched}
          onChange={(value) => {
            setSliderValue(value);
            setSliderTouched(true);
          }}
          labelledBy={titleId}
        />
      ) : (
        <QuestionOptions
          question={question}
          value={selected}
          onChange={handleChoice}
          labelledBy={titleId}
        />
      )}
    </QuestionnaireScreen>
  );
}
