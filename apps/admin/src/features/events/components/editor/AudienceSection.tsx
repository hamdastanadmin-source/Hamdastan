'use client';

import { Eye } from 'lucide-react';

import { EVENT_VISIBILITY_LABELS, EVENT_VISIBILITIES, WORLD_STATUS_LABELS } from '@hamdastan/config';
import type { EventVisibility } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Checkbox, Label, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { Field, NEUTRAL_CHECKBOX } from '@/components';
import { AudienceField } from '@/features/engagement';

import { TOGGLE_ITEM, type SectionProps } from './types';

const VISIBILITY_HINTS: Record<EventVisibility, string> = {
  public: 'در بخش «رویدادها»ی اپلیکیشن برای همه، و در صفحه‌ی دنیاهایی که به آن‌ها متصل است.',
  world: 'فقط در صفحه‌ی دنیاهای انتخاب‌شده؛ نه در فهرست کلی و نه در جست‌وجو. لینک مستقیم آن برای همه باز می‌شود.',
  restricted: 'فقط برای مخاطب انتخاب‌شده. برای دیگران — حتی با لینک مستقیم — در دسترس نیست.',
};

/**
 * C. Which worlds the event belongs to and where it may appear — two
 * separate choices: a public event can belong to worlds too. Ends with where
 * it will show once published, as the API will decide it.
 */
export function AudienceSection({ editor, worlds }: SectionProps) {
  const { state, update, errors } = editor;
  const shown = worlds.filter((world) => world.status !== 'archived' || state.worldIds.includes(world.id));
  const chosen = worlds.filter((world) => state.worldIds.includes(world.id)).map((world) => world.name);
  const worldList = chosen.length ? chosen.map((name) => `«${name}»`).join('، ') : null;

  const surfaces: string[] =
    state.visibility === 'public'
      ? ['فهرست کلی «رویدادها»، جست‌وجو و تقویم — برای همه', worldList ? `صفحه‌ی دنیاهای ${worldList}` : 'به هیچ دنیایی متصل نیست']
      : state.visibility === 'world'
        ? [worldList ? `فقط صفحه‌ی دنیاهای ${worldList} — برای همه` : 'هیچ‌جا؛ حداقل یک دنیا انتخاب کنید', 'نه در فهرست کلی، نه در جست‌وجو']
        : [
            `فهرست کلی${worldList ? ` و صفحه‌ی دنیاهای ${worldList}` : ''} — فقط برای مخاطب انتخاب‌شده`,
            'برای دیگران هیچ‌جا، حتی با لینک مستقیم',
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
                    {world.status !== 'published' && <span className="text-xs text-muted-foreground">({WORLD_STATUS_LABELS[world.status]})</span>}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </Field>

      <Field label="محل نمایش" error={errors.visibility} hint={VISIBILITY_HINTS[state.visibility]}>
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
        <AlertTitle>محل نمایش پس از انتشار</AlertTitle>
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
