import { Check } from 'lucide-react';

import type { ChoiceQuestion } from '@hamdastan/config';
import { ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

/**
 * A choice question's options, as quiet full-width rows.
 *
 * Neutral until chosen: a faint surface and a hairline border, regular
 * weight. Chosen is the one place colour appears — a primary border, a light
 * tint and a small check mark, so selection never rests on colour alone —
 * and it is meant to read as "this one", not to shout. A press gives a
 * 0.98 scale. Each row is a stock `ToggleGroupItem`: `single` gives radio
 * semantics, `multiple` gives pressed buttons, and Radix handles the arrows.
 *
 * At a multi-select's cap the remaining rows fade back and stop taking taps;
 * the line above the list says why. No error, no popup.
 */

const OPTION_CLASS =
  'group/option h-auto min-h-13 w-full justify-start gap-3 whitespace-normal rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-start text-base font-normal leading-relaxed text-foreground transition-[color,background-color,border-color,opacity,transform] duration-150 hover:bg-foreground/10 hover:text-foreground active:scale-[0.98] disabled:opacity-35 data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground motion-reduce:transition-none motion-reduce:active:scale-100';

function OptionCard({ value, label, disabled }: { value: string; label: string; disabled: boolean }) {
  return (
    <ToggleGroupItem value={value} disabled={disabled} className={OPTION_CLASS}>
      <span className="flex-1">{label}</span>
      <Check
        aria-hidden="true"
        className="invisible size-4 shrink-0 text-primary group-data-[state=on]/option:visible"
      />
    </ToggleGroupItem>
  );
}

export function QuestionOptions({
  question,
  value,
  onChange,
  disabled = false,
  labelledBy,
}: {
  question: ChoiceQuestion;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  labelledBy: string;
}) {
  const atCap =
    question.kind !== 'single' &&
    question.maxSelections !== undefined &&
    value.length >= question.maxSelections;

  const items = question.options.map((option) => (
    <OptionCard
      key={option.code}
      value={option.code}
      label={option.label}
      disabled={disabled || (atCap && !value.includes(option.code))}
    />
  ));

  const groupClass = 'w-full flex-col items-stretch';

  if (question.kind === 'single') {
    return (
      <ToggleGroup
        type="single"
        spacing={2}
        value={value[0] ?? ''}
        // Tapping the selected option again reports an empty value. It is
        // still an answer — the same one — so it is passed on unchanged.
        onValueChange={(next) => onChange(next ? [next] : value)}
        aria-labelledby={labelledBy}
        className={groupClass}
      >
        {items}
      </ToggleGroup>
    );
  }

  return (
    <ToggleGroup
      type="multiple"
      spacing={2}
      value={value}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      className={groupClass}
    >
      {items}
    </ToggleGroup>
  );
}
