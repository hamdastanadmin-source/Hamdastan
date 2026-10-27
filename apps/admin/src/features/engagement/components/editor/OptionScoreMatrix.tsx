'use client';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ChoiceOption } from '@hamdastan/types';
import { Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hamdastan/ui';

import { invalid } from './Field';

/**
 * A question's scoring matrix: options down, the results they score across
 * — a profile assessment's profiles (`weights`) or a personality
 * assessment's dimensions (`dimensionScores`) — each cell the option's
 * points toward that result: positive, negative, or empty for zero. Kept
 * on the server only; the product never sees it.
 */
export function OptionScoreMatrix({
  options,
  field,
  columns,
  columnName,
  max,
  hint,
  error,
  onChange,
}: {
  options: ChoiceOption[];
  field: 'weights' | 'dimensionScores';
  columns: { id: string; title: string }[];
  /** What one column is, as a word: «پروفایل», «بُعد». */
  columnName: string;
  max: number;
  hint: string;
  error?: string;
  onChange: (options: ChoiceOption[]) => void;
}) {
  const set = (o: number, columnId: string, raw: string) => {
    const points = raw === '' || raw === '-' ? 0 : Math.max(-max, Math.min(max, Math.trunc(Number(raw) || 0)));
    onChange(
      options.map((option, i) => {
        if (i !== o) return option;
        const next = { ...(option[field] ?? {}) };
        if (points === 0) delete next[columnId];
        else next[columnId] = points;
        return { ...option, [field]: Object.keys(next).length ? next : undefined };
      })
    );
  };
  const title = (column: { title: string }, c: number) => column.title || `${columnName} ${toPersianDigits(c + 1)}`;

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        هنوز {columnName}ی تعریف نشده است. آن‌ها را در «روش محاسبه‌ی نتیجه» اضافه کنید.
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
              {columns.map((column, c) => (
                <TableHead key={column.id} className="text-center">
                  {title(column, c)}
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
                  {columns.map((column, c) => (
                    <TableCell key={column.id} className="px-1">
                      <Input
                        type="number"
                        min={-max}
                        max={max}
                        step={1}
                        className="mx-auto h-8 w-20 text-center tabular-nums"
                        aria-label={`امتیاز «${name}» برای «${title(column, c)}»`}
                        value={option[field]?.[column.id] ?? ''}
                        onChange={(event) => set(o, column.id, event.target.value)}
                        {...invalid(error)}
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
        خانه‌ی خالی یعنی صفر. امتیاز می‌تواند مثبت یا منفی باشد (از {toPersianDigits(-max)} تا {toPersianDigits(max)})؛ {hint}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
