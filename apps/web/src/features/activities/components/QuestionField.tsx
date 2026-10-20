'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityAnswerValue, PlayerMatchingQuestion, PlayerQuestion } from '@hamdastan/types';
import { Input, Slider, Textarea, Toggle, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { matchingFromValue, matchingValue, pairNumber, tapMatching, type MatchingSide } from '../utils/matching';

/**
 * One question's control — the product's existing ones, by kind: options
 * as full-width toggle rows (as in the questionnaire), a rating as a row of
 * numbers, a scale as the slider, text as a text area, matching as two
 * columns of tiles to pair (Duolingo's).
 *
 * Selection is a foreground border and a check, never the brand colour;
 * that is the screen's primary action's alone.
 */

const OPTION_CLASS =
  'group/option h-auto min-h-13 w-full justify-start gap-3 whitespace-normal rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-start text-base font-normal leading-relaxed text-foreground transition-[color,background-color,border-color,opacity,transform] duration-150 hover:bg-foreground/10 hover:text-foreground active:scale-[0.98] disabled:opacity-35 data-[state=on]:border-foreground data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground motion-reduce:transition-none motion-reduce:active:scale-100';

const NUMBER_CLASS =
  'h-12 rounded-xl border border-foreground/10 bg-foreground/5 text-base tabular-nums data-[state=on]:border-foreground data-[state=on]:bg-foreground/10 data-[state=on]:font-semibold';

function Option({ value, label, disabled }: { value: string; label: string; disabled?: boolean }) {
  return (
    <ToggleGroupItem value={value} disabled={disabled} className={OPTION_CLASS}>
      <span className="flex-1">{label}</span>
      <Check aria-hidden="true" className="invisible size-4 shrink-0 group-data-[state=on]/option:visible" />
    </ToggleGroupItem>
  );
}

const TILE_CLASS =
  'relative h-auto min-h-14 w-full whitespace-normal rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-3 text-center text-base font-normal leading-snug text-foreground transition-[color,background-color,border-color,opacity,transform] duration-150 hover:bg-foreground/10 hover:text-foreground active:scale-[0.97] data-[state=on]:border-foreground data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground data-[paired=true]:border-foreground/40 data-[paired=true]:text-muted-foreground motion-reduce:transition-none motion-reduce:active:scale-100';

/**
 * Tap a tile in one column, then its partner in the other. A made pair
 * carries the same number on both tiles; tapping either takes it apart. The
 * answer is reported only once every tile is paired — right or wrong is the
 * server's to say, after the fact.
 */
function MatchingField({
  question,
  value,
  onChange,
  labelledBy,
}: {
  question: PlayerMatchingQuestion;
  value: ActivityAnswerValue | undefined;
  onChange: (value: ActivityAnswerValue | undefined) => void;
  labelledBy: string;
}) {
  const [state, setState] = useState(() => matchingFromValue(question, value));

  const tap = (side: MatchingSide, id: string) => {
    const next = tapMatching(state, side, id);
    setState(next);
    onChange(matchingValue(question, next));
  };

  const column = (side: MatchingSide, items: { id: string; label: string }[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const number = pairNumber(question, state, side, item.id);
        return (
          <li key={item.id}>
            <Toggle
              pressed={state.pending?.side === side && state.pending.id === item.id}
              onPressedChange={() => tap(side, item.id)}
              data-paired={number !== null}
              aria-label={number === null ? item.label : `${item.label}، جفت ${toPersianDigits(number)}`}
              className={TILE_CLASS}
            >
              {item.label}
              {number !== null && (
                <span aria-hidden="true" className="absolute start-1.5 top-1.5 text-xs tabular-nums">
                  {toPersianDigits(number)}
                </span>
              )}
            </Toggle>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {`${toPersianDigits(Object.keys(state.pairs).length)} از ${toPersianDigits(question.prompts.length)} جفت شد`}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {column('prompt', question.prompts)}
        {column('match', question.matches)}
      </div>
    </div>
  );
}

export function QuestionField({
  question,
  value,
  onChange,
  labelledBy,
  invalid,
}: {
  question: PlayerQuestion;
  value: ActivityAnswerValue | undefined;
  onChange: (value: ActivityAnswerValue | undefined) => void;
  labelledBy: string;
  invalid: boolean;
}) {
  switch (question.kind) {
    case 'single':
      return (
        <ToggleGroup
          type="single"
          spacing={2}
          value={typeof value === 'string' ? value : ''}
          // Tapping the chosen option again keeps it chosen.
          onValueChange={(next) => next && onChange(next)}
          aria-labelledby={labelledBy}
          className="w-full flex-col items-stretch"
        >
          {question.options.map((option) => (
            <Option key={option.id} value={option.id} label={option.label} />
          ))}
        </ToggleGroup>
      );

    case 'multiple': {
      const picked = Array.isArray(value) ? value : [];
      const atCap = question.maxSelections !== undefined && picked.length >= question.maxSelections;
      return (
        <div className="flex flex-col gap-3">
          {question.maxSelections !== undefined && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {atCap
                ? `${toPersianDigits(picked.length)} مورد انتخاب شد`
                : `حداکثر ${toPersianDigits(question.maxSelections)} مورد`}
            </p>
          )}
          <ToggleGroup
            type="multiple"
            spacing={2}
            value={picked}
            onValueChange={(next) => onChange(next.length ? next : undefined)}
            aria-labelledby={labelledBy}
            className="w-full flex-col items-stretch"
          >
            {question.options.map((option) => (
              <Option
                key={option.id}
                value={option.id}
                label={option.label}
                disabled={atCap && !picked.includes(option.id)}
              />
            ))}
          </ToggleGroup>
        </div>
      );
    }

    case 'text': {
      const props = {
        value: typeof value === 'string' ? value : '',
        maxLength: ENGAGEMENT_LIMITS.TEXT_ANSWER_MAX,
        placeholder: 'جوابت رو بنویس',
        'aria-labelledby': labelledBy,
        'aria-invalid': invalid || undefined,
      };
      return question.multiline ? (
        <Textarea {...props} rows={6} className="text-base" onChange={(event) => onChange(event.target.value || undefined)} />
      ) : (
        <Input {...props} className="h-12 text-base" onChange={(event) => onChange(event.target.value || undefined)} />
      );
    }

    case 'rating':
      return (
        <ToggleGroup
          type="single"
          spacing={2}
          value={typeof value === 'number' ? String(value) : ''}
          onValueChange={(next) => next && onChange(Number(next))}
          aria-labelledby={labelledBy}
          className={cn('grid w-full', question.max === 5 ? 'grid-cols-5' : 'grid-cols-5 gap-y-2')}
        >
          {Array.from({ length: question.max }, (_, i) => (
            <ToggleGroupItem key={i} value={String(i + 1)} className={NUMBER_CLASS} aria-label={`${toPersianDigits(i + 1)} از ${toPersianDigits(question.max)}`}>
              {toPersianDigits(i + 1)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );

    case 'matching':
      return <MatchingField question={question} value={value} onChange={onChange} labelledBy={labelledBy} />;

    case 'scale': {
      const touched = typeof value === 'number';
      const current = touched ? value : Math.round((question.min + question.max) / 2);
      return (
        <div className="flex flex-col gap-3 pt-4">
          <p className="text-center text-2xl font-semibold tabular-nums" aria-hidden="true">
            {touched ? toPersianDigits(current) : '—'}
          </p>
          <Slider
            min={question.min}
            max={question.max}
            step={1}
            value={[current]}
            onValueChange={([next]) => onChange(next)}
            // A tap on the thumb without moving it is still a choice of this value.
            onPointerDown={() => onChange(current)}
            className="py-5"
            trackClassName="bg-foreground/10 data-[orientation=horizontal]:h-1"
            rangeClassName="bg-foreground/35"
            thumbClassName={cn('size-6 border-2 shadow-md', touched ? 'border-foreground' : 'border-foreground/20')}
            thumbProps={{
              'aria-labelledby': labelledBy,
              'aria-valuetext': `${toPersianDigits(current)} از ${toPersianDigits(question.max)}`,
            }}
          />
          <div aria-hidden="true" className="flex justify-between gap-6 text-xs leading-relaxed text-muted-foreground">
            <span>{question.minLabel}</span>
            <span className="text-end">{question.maxLabel}</span>
          </div>
        </div>
      );
    }
  }
}
