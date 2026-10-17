'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';

import { INTEREST_CATEGORIES } from '@hamdastan/config';
import type { ActivityAudience } from '@hamdastan/types';
import { Checkbox, Label, Textarea, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { Field, invalid, NEUTRAL_CHECKBOX } from '@/components';
import { formatCount } from '@/lib';

import { useAudienceCount } from '../../hooks/use-audience-count';

const KINDS: { value: ActivityAudience['kind']; label: string }[] = [
  { value: 'all', label: 'همه‌ی کاربران' },
  { value: 'interests', label: 'گروه‌ها (علاقه‌مندی)' },
  { value: 'users', label: 'کاربران منتخب' },
];

const TOGGLE_ITEM = 'h-10 rounded-lg border px-4 data-[state=on]:border-foreground data-[state=on]:bg-accent';

/** Whitespace, commas or new lines between numbers. */
const splitPhones = (text: string) => text.split(/[\s,،]+/).filter(Boolean);

/**
 * Who something is for — everyone, interest groups, or chosen numbers — and
 * how many active people that is today, counted by the API. Engagement
 * Studio's activities and restricted events use the same audience.
 * `errors` are keyed by path under `audience`.
 */
export function AudienceField({
  value,
  onChange,
  errors,
  extraKinds,
}: {
  value: ActivityAudience;
  onChange: (audience: ActivityAudience) => void;
  errors: Record<string, string>;
  /** Kinds shown but not yet possible, after the real ones. */
  extraKinds?: string[];
}) {
  const eligible = useAudienceCount(value);
  // The text as typed; the audience holds it split into numbers.
  const [phonesText, setPhonesText] = useState(value.kind === 'users' ? value.phones.join('\n') : '');

  const setKind = (kind: ActivityAudience['kind']) =>
    onChange(
      kind === 'all'
        ? { kind }
        : kind === 'users'
          ? { kind, phones: splitPhones(phonesText) }
          : { kind, categoryIds: value.kind === 'interests' ? value.categoryIds : [] }
    );

  const phonesError = Object.entries(errors).find(([path]) => path.startsWith('audience.phones'))?.[1];

  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup
        type="single"
        value={value.kind}
        onValueChange={(kind) => kind && setKind(kind as ActivityAudience['kind'])}
        spacing={2}
        className="flex-wrap"
        aria-label="مخاطبان"
      >
        {KINDS.map(({ value: kind, label }) => (
          <ToggleGroupItem key={kind} value={kind} className={TOGGLE_ITEM}>
            {label}
          </ToggleGroupItem>
        ))}
        {extraKinds?.map((label) => (
          <ToggleGroupItem key={label} value={label} disabled className={TOGGLE_ITEM}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {value.kind === 'interests' && (
        <Field
          label="گروه‌ها"
          error={errors['audience.categoryIds']}
          hint="کسانی که توی آنبوردینگ دست‌کم یکی از علاقه‌مندی‌های این دسته‌ها رو انتخاب کردن."
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEREST_CATEGORIES.map((category) => {
              const checked = value.categoryIds.includes(category.id);
              return (
                <li key={category.id}>
                  <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal">
                    <Checkbox
                      checked={checked}
                      className={NEUTRAL_CHECKBOX}
                      onCheckedChange={(next) =>
                        onChange({
                          kind: 'interests',
                          categoryIds: next
                            ? [...value.categoryIds, category.id]
                            : value.categoryIds.filter((id) => id !== category.id),
                        })
                      }
                    />
                    {category.title}
                  </Label>
                </li>
              );
            })}
          </ul>
        </Field>
      )}

      {value.kind === 'users' && (
        <Field
          label="شماره‌های موبایل"
          htmlFor="phones"
          error={phonesError}
          hint="هر شماره در یک خط، یا با ویرگول جدا. فقط همین افراد می‌بینن."
        >
          <Textarea
            id="phones"
            dir="ltr"
            rows={6}
            className="font-mono tabular-nums"
            value={phonesText}
            onChange={(event) => {
              setPhonesText(event.target.value);
              onChange({ kind: 'users', phones: splitPhones(event.target.value) });
            }}
            {...invalid(phonesError)}
          />
        </Field>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <Users aria-hidden="true" className="size-4" />
        {eligible === null ? 'در حال شمردن…' : `${formatCount(eligible)} کاربر فعال واجد شرایط`}
      </p>
    </div>
  );
}
