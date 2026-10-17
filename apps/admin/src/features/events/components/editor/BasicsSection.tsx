'use client';

import { EVENT_LIMITS, EVENT_TYPE_LABELS, EVENT_TYPES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { EventType } from '@hamdastan/types';
import { Checkbox, Input, Label, Textarea, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';
import { Icon, type IconName } from '@hamdastan/ui/icons';

import { Field, invalid, NEUTRAL_CHECKBOX } from '@/components';

import { TOGGLE_ITEM, type SectionProps } from './types';

/**
 * A. What the event is: title, address, summary, the long description, its
 * type and its categories. The description is a small Markdown subset the
 * product draws as text — never as HTML.
 */
export function BasicsSection({ editor, categories }: SectionProps) {
  const { state, update, errors } = editor;
  // A category switched off stays listed while the event still has it.
  const shown = categories.filter((category) => category.isActive || state.categoryIds.includes(category.id));
  const full = state.categoryIds.length >= EVENT_LIMITS.CATEGORIES_MAX;

  return (
    <div className="flex flex-col gap-5">
      <Field label="عنوان" htmlFor="title" error={errors.title}>
        <Input id="title" value={state.title} onChange={(event) => update({ title: event.target.value })} {...invalid(errors.title)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="نامک (نشانی)" htmlFor="slug" error={errors.slug} hint="حروف کوچک انگلیسی، عدد و خط تیره. خالی بمونه خودکار ساخته می‌شه.">
          <Input
            id="slug"
            dir="ltr"
            placeholder="hogwarts-music-night"
            value={state.slug}
            onChange={(event) => update({ slug: event.target.value })}
            {...invalid(errors.slug)}
          />
        </Field>
        <Field label="خلاصه" htmlFor="summary" error={errors.summary} hint="یک خط، روی کارت رویداد.">
          <Input id="summary" value={state.summary} onChange={(event) => update({ summary: event.target.value })} {...invalid(errors.summary)} />
        </Field>
      </div>

      <Field
        label="توضیحات"
        htmlFor="description"
        error={errors.description}
        hint="پاراگراف‌ها با یک خط خالی جدا می‌شن. **پررنگ**، «# » برای تیتر، «- » برای فهرست و [متن](https://…) برای لینک."
      >
        <Textarea
          id="description"
          rows={10}
          value={state.description}
          onChange={(event) => update({ description: event.target.value })}
          {...invalid(errors.description)}
        />
      </Field>

      <Field label="نوع رویداد" error={errors.type}>
        <ToggleGroup
          type="single"
          value={state.type}
          onValueChange={(type) => type && update({ type: type as EventType })}
          spacing={2}
          className="flex-wrap"
          aria-label="نوع رویداد"
        >
          {EVENT_TYPES.map((type) => (
            <ToggleGroupItem key={type} value={type} className={TOGGLE_ITEM}>
              {EVENT_TYPE_LABELS[type]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field
        label="دسته‌ها"
        error={errors.categoryIds}
        hint={`حداکثر ${toPersianDigits(EVENT_LIMITS.CATEGORIES_MAX)} دسته. دسته‌ها از بخش «دسته‌بندی رویدادها» مدیریت می‌شن.`}
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((category) => {
            const checked = state.categoryIds.includes(category.id);
            return (
              <li key={category.id}>
                <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal has-[button:disabled]:opacity-60">
                  <Checkbox
                    checked={checked}
                    disabled={!checked && full}
                    className={NEUTRAL_CHECKBOX}
                    onCheckedChange={(next) =>
                      update({
                        categoryIds: next ? [...state.categoryIds, category.id] : state.categoryIds.filter((id) => id !== category.id),
                      })
                    }
                  />
                  <Icon name={category.icon as IconName} aria-hidden="true" className="size-4 text-muted-foreground" />
                  {category.name}
                  {!category.isActive && <span className="text-xs text-muted-foreground">(غیرفعال)</span>}
                </Label>
              </li>
            );
          })}
        </ul>
      </Field>
    </div>
  );
}
