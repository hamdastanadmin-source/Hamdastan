'use client';

import { Eye } from 'lucide-react';

import { EVENT_VISIBILITY_LABELS, EVENT_VISIBILITIES } from '@hamdastan/config';
import type { EventVisibility } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Checkbox, Label, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { Field, NEUTRAL_CHECKBOX } from '@/components';
import { AudienceField } from '@/features/engagement';

import { TOGGLE_ITEM, type SectionProps } from './types';

const VISIBILITY_HINTS: Record<EventVisibility, string> = {
  public: 'توی «رویدادها»ی محصول برای همه، و توی صفحه‌ی دنیاهایی که بهشون وصله.',
  world: 'فقط توی صفحه‌ی دنیاهای انتخاب‌شده؛ نه توی فهرست کلی و نه توی جستجو. لینک مستقیمش برای همه باز می‌شه.',
  restricted: 'فقط برای مخاطب انتخاب‌شده. برای بقیه — حتی با لینک مستقیم — وجود نداره.',
};

/**
 * C. Which worlds the event belongs to and where it may appear — two
 * separate choices: a public event can belong to worlds too. Ends with where
 * it will show once published, as the API will decide it.
 */
export function AudienceSection({ editor, worlds }: SectionProps) {
  const { state, update, errors } = editor;
  const shown = worlds.filter((world) => world.isActive || state.worldIds.includes(world.id));
  const chosen = worlds.filter((world) => state.worldIds.includes(world.id)).map((world) => world.name);
  const worldList = chosen.length ? chosen.map((name) => `«${name}»`).join('، ') : null;

  const surfaces: string[] =
    state.visibility === 'public'
      ? ['فهرست کلی «رویدادها»، جستجو و تقویم — برای همه', worldList ? `صفحه‌ی دنیاهای ${worldList}` : 'به هیچ دنیایی وصل نیست']
      : state.visibility === 'world'
        ? [worldList ? `فقط صفحه‌ی دنیاهای ${worldList} — برای همه` : 'هیچ‌جا: حداقل یک دنیا انتخاب کن', 'نه در فهرست کلی، نه در جستجو']
        : [
            `فهرست کلی${worldList ? ` و صفحه‌ی دنیاهای ${worldList}` : ''} — فقط برای مخاطب انتخاب‌شده`,
            'برای بقیه هیچ‌جا، حتی با لینک مستقیم',
          ];

  return (
    <div className="flex flex-col gap-6">
      <Field label="دنیاها" error={errors.worldIds} hint="اختیاری برای رویداد عمومی؛ لازم برای «فقط در دنیاها».">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز دنیایی تعریف نشده.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((world) => {
              const checked = state.worldIds.includes(world.id);
              return (
                <li key={world.id}>
                  <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal">
                    <Checkbox
                      checked={checked}
                      className={NEUTRAL_CHECKBOX}
                      onCheckedChange={(next) =>
                        update({ worldIds: next ? [...state.worldIds, world.id] : state.worldIds.filter((id) => id !== world.id) })
                      }
                    />
                    {world.name}
                    {!world.isActive && <span className="text-xs text-muted-foreground">(غیرفعال)</span>}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </Field>

      <Field label="کجا دیده بشه" error={errors.visibility} hint={VISIBILITY_HINTS[state.visibility]}>
        <ToggleGroup
          type="single"
          value={state.visibility}
          onValueChange={(visibility) => visibility && update({ visibility: visibility as EventVisibility })}
          spacing={2}
          className="flex-wrap"
          aria-label="محل نمایش"
        >
          {EVENT_VISIBILITIES.map((visibility) => (
            <ToggleGroupItem key={visibility} value={visibility} className={TOGGLE_ITEM}>
              {EVENT_VISIBILITY_LABELS[visibility]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {state.visibility === 'restricted' && (
        <Field label="مخاطب" error={errors.audience}>
          <AudienceField
            value={state.audience}
            onChange={(audience) => update({ audience })}
            errors={errors}
            extraKinds={['اعضای دنیا (به‌زودی)']}
          />
        </Field>
      )}

      <Alert>
        <Eye aria-hidden="true" />
        <AlertTitle>بعد از انتشار کجا دیده می‌شه</AlertTitle>
        <AlertDescription>
          <ul className="list-disc ps-4">
            {surfaces.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
