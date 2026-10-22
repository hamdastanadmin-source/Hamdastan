'use client';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AssessmentProfile, ChoiceOption } from '@hamdastan/types';
import { Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hamdastan/ui';

/**
 * A profile assessment's scoring matrix for one question: options down,
 * profiles across, each cell the option's weight toward that profile —
 * positive, negative, or empty for zero. Kept on the server only; the
 * product never sees it.
 */
export function OptionProfileWeights({
  options,
  profiles,
  errors,
  path,
  onChange,
}: {
  options: ChoiceOption[];
  profiles: AssessmentProfile[];
  errors: Record<string, string>;
  path: string;
  onChange: (options: ChoiceOption[]) => void;
}) {
  const max = ENGAGEMENT_LIMITS.PROFILE_WEIGHT_MAX;

  const set = (o: number, profileId: string, raw: string) => {
    const weight = raw === '' || raw === '-' ? 0 : Math.max(-max, Math.min(max, Math.trunc(Number(raw) || 0)));
    onChange(
      options.map((option, i) => {
        if (i !== o) return option;
        const next = { ...(option.weights ?? {}) };
        if (weight === 0) delete next[profileId];
        else next[profileId] = weight;
        return { ...option, weights: Object.keys(next).length ? next : undefined };
      })
    );
  };
  const problem = options.map((_, o) => errors[`${path}.options.${o}.weights`]).find(Boolean);

  if (profiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        هنوز پروفایلی تعریف نشده است. پروفایل‌ها را در «روش محاسبه‌ی نتیجه» اضافه کنید.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>گزینه</TableHead>
              {profiles.map((profile, p) => (
                <TableHead key={profile.id} className="text-center">
                  {profile.title || `پروفایل ${toPersianDigits(p + 1)}`}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((option, o) => {
              const name = option.label || `گزینه‌ی ${toPersianDigits(o + 1)}`;
              return (
                <TableRow key={option.id}>
                  <TableCell className="max-w-40 truncate">{name}</TableCell>
                  {profiles.map((profile, p) => (
                    <TableCell key={profile.id} className="px-1">
                      <Input
                        type="number"
                        min={-max}
                        max={max}
                        step={1}
                        className="mx-auto h-8 w-20 text-center tabular-nums"
                        aria-label={`وزن «${name}» برای «${profile.title || `پروفایل ${toPersianDigits(p + 1)}`}»`}
                        value={option.weights?.[profile.id] ?? ''}
                        onChange={(event) => set(o, profile.id, event.target.value)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        خانه‌ی خالی یعنی صفر. وزن می‌تواند مثبت یا منفی باشد (از {toPersianDigits(-max)} تا {toPersianDigits(max)})؛ با انتخاب هر گزینه، وزن
        آن ضرب در ضریب سؤال به امتیاز هر پروفایل افزوده می‌شود.
      </p>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
