'use client';

import { Eye } from 'lucide-react';

import { EVENT_VISIBILITY_LABELS, EVENT_VISIBILITIES } from '@hamdastan/config';
import type { EventVisibility } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { Field, WorldsField } from '@/components';
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
        <WorldsField worlds={worlds} value={state.worldIds} onChange={(worldIds) => update({ worldIds })} />
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
