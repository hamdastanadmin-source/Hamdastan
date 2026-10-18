'use client';

import { JOURNEY_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ChoiceOption, JourneyTrait } from '@hamdastan/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Input } from '@hamdastan/ui';

/**
 * How much each option of a journey question shows of each trait: a small
 * grid, options down, traits across. An empty cell is no points. Kept on
 * the server only — the product never sees it.
 */
export function OptionTraitPoints({
  options,
  traits,
  errors,
  path,
  onChange,
}: {
  options: ChoiceOption[];
  traits: JourneyTrait[];
  errors: Record<string, string>;
  path: string;
  onChange: (options: ChoiceOption[]) => void;
}) {
  const set = (o: number, traitId: string, raw: string) => {
    const points = raw === '' ? 0 : Math.max(-JOURNEY_LIMITS.TRAIT_POINTS_MAX, Math.min(JOURNEY_LIMITS.TRAIT_POINTS_MAX, Math.trunc(Number(raw) || 0)));
    onChange(
      options.map((option, i) => {
        if (i !== o) return option;
        const next = { ...(option.traits ?? {}) };
        if (points === 0) delete next[traitId];
        else next[traitId] = points;
        return { ...option, traits: Object.keys(next).length ? next : undefined };
      })
    );
  };
  const problem = options.map((_, o) => errors[`${path}.options.${o}.traits`]).find(Boolean);
  const scored = options.some((option) => Object.keys(option.traits ?? {}).length > 0);

  return (
    <Accordion type="single" collapsible defaultValue={scored ? 'traits' : undefined} className="rounded-lg border px-4">
      <AccordionItem value="traits" className="border-b-0">
        <AccordionTrigger>امتیاز ویژگی‌ها برای کارت شخصیت</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-2 text-start font-medium">گزینه</th>
                  {traits.map((trait) => (
                    <th key={trait.id} className="px-1 py-2 text-center font-medium">
                      {trait.title || 'بی‌نام'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.map((option, o) => (
                  <tr key={option.id} className="border-t">
                    <td className="max-w-40 truncate py-2 pe-2">{option.label || `گزینه‌ی ${toPersianDigits(o + 1)}`}</td>
                    {traits.map((trait) => (
                      <td key={trait.id} className="px-1 py-2">
                        <Input
                          type="number"
                          min={-JOURNEY_LIMITS.TRAIT_POINTS_MAX}
                          max={JOURNEY_LIMITS.TRAIT_POINTS_MAX}
                          className="mx-auto h-8 w-16 text-center tabular-nums"
                          aria-label={`امتیاز «${option.label || `گزینه‌ی ${o + 1}`}» برای «${trait.title}»`}
                          value={option.traits?.[trait.id] ?? ''}
                          onChange={(event) => set(o, trait.id, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">خانه‌ی خالی یعنی صفر. با انتخاب هر گزینه، امتیازهای آن به ویژگی‌ها افزوده می‌شود.</p>
          {problem && <p className="text-xs text-destructive">{problem}</p>}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
