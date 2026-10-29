'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';

import { isQuizType, RESULT_SECTION_LABELS, type ResultSectionId } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityType, ResultPageSettings } from '@hamdastan/types';
import { Button, Input, Textarea } from '@hamdastan/ui';

import { MediaField } from '@/features/media';

import { Field, invalid } from './Field';

/** The blocks this type's done screen can have; the others are kept in the order but never shown. */
function sectionsFor(type: ActivityType): ResultSectionId[] {
  const quiz = isQuizType(type);
  return [
    'message',
    ...(quiz ? (['outcome'] as const) : []),
    ...(type === 'competition' ? (['rank'] as const) : []),
    ...(quiz ? (['review'] as const) : []),
    'xp',
  ];
}

/**
 * What the person sees after «ثبت نهایی»: the admin's own title, message and
 * image in place of «ممنون که وقت گذاشتی», and the order of the screen's
 * blocks. An empty title or message keeps the default.
 */
export function ResultPagePanel({
  type,
  settings,
  errors,
  onChange,
}: {
  type: ActivityType;
  settings: ResultPageSettings;
  errors: Record<string, string>;
  onChange: (settings: ResultPageSettings) => void;
}) {
  const shown = settings.sections.filter((id) => sectionsFor(type).includes(id));
  /** Swaps a shown block with its shown neighbour, wherever the hidden ones sit. */
  const move = (index: number, offset: -1 | 1) => {
    const a = settings.sections.indexOf(shown[index]);
    const b = settings.sections.indexOf(shown[index + offset]);
    const sections = [...settings.sections];
    [sections[a], sections[b]] = [sections[b], sections[a]];
    onChange({ ...settings, sections });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h3 className="text-base font-semibold">صفحه‌ی نتیجه</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          صفحه‌ای که کاربر بعد از «ثبت نهایی» می‌بیند. اگر عنوان یا متن خالی بماند، متن پیش‌فرض نمایش داده می‌شود.
        </p>
      </div>
      <Field label="عنوان (اختیاری)" htmlFor="result-title" hint="خالی: عنوان فعالیت." error={errors['definition.resultPage.title']}>
        <Input
          id="result-title"
          value={settings.title}
          placeholder="مثلاً «تبریک! به پایان رسیدی»"
          onChange={(event) => onChange({ ...settings, title: event.target.value })}
          {...invalid(errors['definition.resultPage.title'])}
        />
      </Field>
      <Field
        label="متن (اختیاری)"
        htmlFor="result-message"
        hint="خالی: «ممنون که وقت گذاشتی» — و اگر نتیجه‌ای نمایش داده شود، هیچ متنی."
        error={errors['definition.resultPage.message']}
      >
        <Textarea
          id="result-message"
          rows={3}
          value={settings.message}
          onChange={(event) => onChange({ ...settings, message: event.target.value })}
          {...invalid(errors['definition.resultPage.message'])}
        />
      </Field>
      <Field label="تصویر (اختیاری)" hint="به جای آیکن تیک، بالای عنوان نمایش داده می‌شود.">
        <MediaField
          value={settings.imageId ?? undefined}
          onChange={(imageId) => onChange({ ...settings, imageId: imageId ?? null })}
          kind="image"
          category="result"
          pickerTitle="تصویر صفحه‌ی نتیجه"
          invalid={Boolean(errors['definition.resultPage.imageId'])}
        />
      </Field>
      <Field
        label="ترتیب بخش‌ها"
        error={errors['definition.resultPage.sections']}
        hint="بخشی که برای کاربر چیزی برای نمایش ندارد — مثلاً XP وقتی پرداخت نشده — حذف می‌شود."
      >
        <ol className="flex flex-col gap-2">
          {shown.map((id, index) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{toPersianDigits(index + 1)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{RESULT_SECTION_LABELS[id]}</span>
              <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label="بالاتر">
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={index === shown.length - 1}
                onClick={() => move(index, 1)}
                aria-label="پایین‌تر"
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      </Field>
    </div>
  );
}
