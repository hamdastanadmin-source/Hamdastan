'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';

import { INTEREST_CATEGORIES } from '@hamdastan/config';
import type { AudienceEstimate, CampaignOptions, NotificationAudience, NotificationAudienceKind } from '@hamdastan/types';
import {
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { Field, invalid, NEUTRAL_CHECKBOX } from '@/components';
import { formatCount } from '@/lib';

import { AUDIENCE_KINDS } from '../utils/labels';

const TOGGLE_ITEM = 'h-10 rounded-lg border px-4 data-[state=on]:border-foreground data-[state=on]:bg-accent';

const splitPhones = (text: string) => text.split(/[\s,،]+/).filter(Boolean);

const startOf = (kind: NotificationAudienceKind): NotificationAudience => {
  switch (kind) {
    case 'all':
      return { kind };
    case 'users':
      return { kind, phones: [] };
    case 'interests':
      return { kind, categoryIds: [] };
    case 'event':
      return { kind, eventId: '', relation: 'interested' };
    case 'world':
      return { kind, worldIds: [] };
  }
};

/**
 * Who a campaign goes to. «Everyone» is offered only to a role that may
 * broadcast (the API refuses it otherwise). An event's audience is either
 * the people interested or those with a confirmed place — interest is never
 * taken for a booking. A world's audience is the people interested in or
 * confirmed for one of its events: there is no membership to send to yet.
 */
export function AudiencePicker({
  value,
  onChange,
  options,
  estimate,
  canBroadcast,
  errors,
  disabled,
}: {
  value: NotificationAudience;
  onChange: (audience: NotificationAudience) => void;
  options: CampaignOptions | null;
  estimate: AudienceEstimate | null;
  canBroadcast: boolean;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const [phonesText, setPhonesText] = useState(value.kind === 'users' ? value.phones.join('\n') : '');
  const errorUnder = (prefix: string) => Object.entries(errors).find(([path]) => path.startsWith(prefix))?.[1];

  const toggleIn = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((item) => item !== id));

  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup
        type="single"
        value={value.kind}
        onValueChange={(kind) => kind && onChange(kind === 'users' ? { kind, phones: splitPhones(phonesText) } : startOf(kind as NotificationAudienceKind))}
        spacing={2}
        className="flex-wrap"
        aria-label="مخاطب"
        disabled={disabled}
      >
        {AUDIENCE_KINDS.map(({ value: kind, label }) => (
          <ToggleGroupItem key={kind} value={kind} className={TOGGLE_ITEM} disabled={kind === 'all' && !canBroadcast}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {!canBroadcast && <p className="-mt-3 text-xs text-muted-foreground">ارسال به همه‌ی کاربران برای نقش شما مجاز نیست.</p>}

      {value.kind === 'world' && (
        <Field label="دنیاها" error={errorUnder('audience.worldIds')} hint="کاربرانی که به یکی از رویدادهای این دنیاها علاقه نشان داده‌اند یا ثبت‌نام قطعی دارند.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(options?.worlds ?? []).map((world) => (
              <li key={world.id}>
                <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal">
                  <Checkbox
                    checked={value.worldIds.includes(world.id)}
                    className={NEUTRAL_CHECKBOX}
                    disabled={disabled}
                    onCheckedChange={(on) => onChange({ kind: 'world', worldIds: toggleIn(value.worldIds, world.id, Boolean(on)) })}
                  />
                  {world.name}
                </Label>
              </li>
            ))}
          </ul>
        </Field>
      )}

      {value.kind === 'event' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رویداد" error={errorUnder('audience.eventId')}>
            <Select value={value.eventId || undefined} onValueChange={(eventId) => onChange({ ...value, eventId })} disabled={disabled}>
              <SelectTrigger className="w-full" {...invalid(errorUnder('audience.eventId'))}>
                <SelectValue placeholder="یک رویداد منتشرشده انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {(options?.events ?? []).map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="کدام کاربران">
            <ToggleGroup
              type="single"
              value={value.relation}
              onValueChange={(relation) => relation && onChange({ ...value, relation: relation as 'interested' | 'confirmed' })}
              spacing={2}
              aria-label="رابطه با رویداد"
              disabled={disabled}
            >
              <ToggleGroupItem value="interested" className={TOGGLE_ITEM}>
                علاقه‌مندان
              </ToggleGroupItem>
              <ToggleGroupItem value="confirmed" className={TOGGLE_ITEM}>
                ثبت‌نام یا خرید قطعی
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </div>
      )}

      {value.kind === 'interests' && (
        <Field label="گروه‌ها" error={errorUnder('audience.categoryIds')} hint="کاربرانی که در آنبوردینگ دست‌کم یکی از علاقه‌مندی‌های این دسته‌ها را انتخاب کرده‌اند.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEREST_CATEGORIES.map((category) => (
              <li key={category.id}>
                <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal">
                  <Checkbox
                    checked={value.categoryIds.includes(category.id)}
                    className={NEUTRAL_CHECKBOX}
                    disabled={disabled}
                    onCheckedChange={(on) => onChange({ kind: 'interests', categoryIds: toggleIn(value.categoryIds, category.id, Boolean(on)) })}
                  />
                  {category.title}
                </Label>
              </li>
            ))}
          </ul>
        </Field>
      )}

      {value.kind === 'users' && (
        <Field label="شماره‌های موبایل" htmlFor="campaign-phones" error={errorUnder('audience.phones')} hint="هر شماره در یک خط یا جداشده با ویرگول.">
          <Textarea
            id="campaign-phones"
            dir="ltr"
            rows={5}
            className="font-mono tabular-nums"
            value={phonesText}
            disabled={disabled}
            onChange={(event) => {
              setPhonesText(event.target.value);
              onChange({ kind: 'users', phones: splitPhones(event.target.value) });
            }}
            {...invalid(errorUnder('audience.phones'))}
          />
        </Field>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <Users aria-hidden="true" className="size-4" />
        {estimate === null
          ? 'برای محاسبه‌ی تعداد، مخاطب را کامل کنید'
          : `${formatCount(estimate.eligible)} کاربر فعال این اعلان را دریافت می‌کنند؛ ${formatCount(estimate.push)} نفر از آن‌ها روی گوشی نیز`}
      </p>
    </div>
  );
}
