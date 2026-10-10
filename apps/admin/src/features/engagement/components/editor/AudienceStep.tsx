'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';

import { INTEREST_CATEGORIES } from '@hamdastan/config';
import type { ActivityAudience } from '@hamdastan/types';
import { Checkbox, Label, Textarea, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { formatCount } from '@/lib';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { useAudienceCount } from '../../hooks/use-audience-count';
import { Field, invalid, NEUTRAL_CHECKBOX } from './Field';

const KINDS: { value: ActivityAudience['kind']; label: string }[] = [
  { value: 'all', label: 'همه‌ی کاربران' },
  { value: 'interests', label: 'گروه‌ها (علاقه‌مندی)' },
  { value: 'users', label: 'کاربران منتخب' },
];

const TOGGLE_ITEM = 'h-10 rounded-lg border px-4 data-[state=on]:border-foreground data-[state=on]:bg-accent';

/** Whitespace, commas or new lines between numbers. */
const splitPhones = (text: string) => text.split(/[\s,،]+/).filter(Boolean);

/**
 * Step 4: who sees the activity. Interest categories from onboarding are
 * the product's only groups today; an event's participants need the events
 * module first. The count is the API's, for the audience as it stands now.
 */
export function AudienceStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, update, errors } = editor;
  const audience = state.audience;
  const eligible = useAudienceCount(audience);
  // The text as typed; the audience holds it split into numbers.
  const [phonesText, setPhonesText] = useState(audience.kind === 'users' ? audience.phones.join('\n') : '');

  const setKind = (kind: ActivityAudience['kind']) =>
    update({
      audience:
        kind === 'all'
          ? { kind }
          : kind === 'users'
            ? { kind, phones: splitPhones(phonesText) }
            : { kind, categoryIds: audience.kind === 'interests' ? audience.categoryIds : [] },
    });

  const phonesError = Object.entries(errors).find(([path]) => path.startsWith('audience.phones'))?.[1];

  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup
        type="single"
        value={audience.kind}
        onValueChange={(kind) => kind && setKind(kind as ActivityAudience['kind'])}
        spacing={2}
        className="flex-wrap"
        aria-label="مخاطبان"
      >
        {KINDS.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value} className={TOGGLE_ITEM}>
            {label}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="events" disabled className={TOGGLE_ITEM}>
          شرکت‌کنندگان رویداد (به‌زودی)
        </ToggleGroupItem>
      </ToggleGroup>

      {audience.kind === 'interests' && (
        <Field label="گروه‌ها" error={errors['audience.categoryIds']} hint="کسانی که توی آنبوردینگ دست‌کم یکی از علاقه‌مندی‌های این دسته‌ها رو انتخاب کردن.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEREST_CATEGORIES.map((category) => {
              const checked = audience.categoryIds.includes(category.id);
              return (
                <li key={category.id}>
                  <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal">
                    <Checkbox
                      checked={checked}
                      className={NEUTRAL_CHECKBOX}
                      onCheckedChange={(next) =>
                        update({
                          audience: {
                            kind: 'interests',
                            categoryIds: next
                              ? [...audience.categoryIds, category.id]
                              : audience.categoryIds.filter((id) => id !== category.id),
                          },
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

      {audience.kind === 'users' && (
        <Field
          label="شماره‌های موبایل"
          htmlFor="phones"
          error={phonesError}
          hint="هر شماره در یک خط، یا با ویرگول جدا. فقط همین افراد فعالیت رو می‌بینن."
        >
          <Textarea
            id="phones"
            dir="ltr"
            rows={6}
            className="font-mono tabular-nums"
            value={phonesText}
            onChange={(event) => {
              setPhonesText(event.target.value);
              update({ audience: { kind: 'users', phones: splitPhones(event.target.value) } });
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
