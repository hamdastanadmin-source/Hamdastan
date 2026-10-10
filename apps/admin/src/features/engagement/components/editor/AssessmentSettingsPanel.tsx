'use client';

import { Plus, X } from 'lucide-react';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AssessmentSettings } from '@hamdastan/types';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from '@hamdastan/ui';

import { newKey } from '../../utils/draft';
import { Field, invalid, SwitchRow } from './Field';

/** The assessment's scoring: its mode, its dimensions or pass mark, and whether people see a result. */
export function AssessmentSettingsPanel({
  settings,
  errors,
  onChange,
}: {
  settings: AssessmentSettings;
  errors: Record<string, string>;
  onChange: (settings: AssessmentSettings) => void;
}) {
  const dimensionsError = errors['definition.assessment.dimensions'];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h3 className="text-base font-semibold">روش محاسبه‌ی نتیجه</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          دانشی: هر سؤال گزینه‌ای یک جواب درست داره و نمره درصد جواب‌های درسته. شخصیت‌شناسی: هر سؤال یک بُعد رو
          می‌سنجه؛ بُعدی که بالاتر بیاد نتیجه‌ست.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <Field label="نوع آزمون" htmlFor="assessment-mode">
          <Select
            value={settings.mode}
            onValueChange={(mode) => onChange({ ...settings, mode: mode as AssessmentSettings['mode'] })}
          >
            <SelectTrigger id="assessment-mode" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="knowledge">دانش و مهارت</SelectItem>
              <SelectItem value="personality">شخصیت‌شناسی</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {settings.mode === 'knowledge' ? (
          <Field
            label="حداقل نمره‌ی قبولی (٪، اختیاری)"
            htmlFor="passing-score"
            hint="خالی یعنی آزمون قبولی و ردی نداره."
            error={errors['definition.assessment.passingScore']}
          >
            <Input
              id="passing-score"
              type="number"
              min={0}
              max={100}
              className="w-28 tabular-nums"
              value={settings.passingScore ?? ''}
              onChange={(event) =>
                onChange({
                  ...settings,
                  passingScore: event.target.value === '' ? null : Math.min(100, Math.max(0, Math.trunc(Number(event.target.value)))),
                })
              }
            />
          </Field>
        ) : (
          <Field label="ابعاد ارزیابی" error={dimensionsError}>
            <ul className="flex flex-col gap-3">
              {settings.dimensions.map((dimension, index) => (
                <li key={dimension.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={dimension.title}
                      placeholder={`عنوان بُعد ${toPersianDigits(index + 1)} — مثلاً «اجتماعی»`}
                      aria-label={`عنوان بُعد ${toPersianDigits(index + 1)}`}
                      onChange={(event) =>
                        onChange({
                          ...settings,
                          dimensions: settings.dimensions.map((d) => (d.id === dimension.id ? { ...d, title: event.target.value } : d)),
                        })
                      }
                      {...invalid(errors[`definition.assessment.dimensions.${index}.title`])}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onChange({ ...settings, dimensions: settings.dimensions.filter((d) => d.id !== dimension.id) })}
                      aria-label={`حذف بُعد ${toPersianDigits(index + 1)}`}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={dimension.description}
                    placeholder="متنی که اگه این بُعد نتیجه‌ی کاربر باشه، می‌بینه"
                    aria-label={`توضیح بُعد ${toPersianDigits(index + 1)}`}
                    onChange={(event) =>
                      onChange({
                        ...settings,
                        dimensions: settings.dimensions.map((d) =>
                          d.id === dimension.id ? { ...d, description: event.target.value } : d
                        ),
                      })
                    }
                  />
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={settings.dimensions.length >= ENGAGEMENT_LIMITS.DIMENSIONS_MAX}
              onClick={() =>
                onChange({ ...settings, dimensions: [...settings.dimensions, { id: newKey(), title: '', description: '' }] })
              }
            >
              <Plus aria-hidden="true" />
              بُعد جدید
            </Button>
          </Field>
        )}

        <SwitchRow id="show-result" label="نمایش نتیجه به کاربر" hint="خاموش باشه، کاربر فقط پیام تکمیل رو می‌بینه.">
          <Switch
            id="show-result"
            checked={settings.showResult}
            onCheckedChange={(showResult) => onChange({ ...settings, showResult })}
          />
        </SwitchRow>
      </div>
    </div>
  );
}
