'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { JOURNEY_DEFAULTS, JOURNEY_LIMITS } from '@hamdastan/config';
import type { JourneyCharacter, JourneyResultSettings, ResultCardStyle } from '@hamdastan/types';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@hamdastan/ui';

import { CardPreview, MediaField } from '@/features/media';

import { newKey } from '../../utils/draft';
import { Field, invalid, SwitchRow } from './Field';

const NONE = 'none';

/**
 * A journey's final result: the traits answers can show more of, the
 * characters people can come out as (each standing for one trait), the
 * default, and how the shareable card looks — beside the card itself, drawn
 * by the product's own renderer. The points each option gives are set on
 * the option, in the questions step.
 */
export function JourneyResultsPanel({
  result,
  errors,
  onChange,
}: {
  result: JourneyResultSettings;
  errors: Record<string, string>;
  onChange: (result: JourneyResultSettings) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const error = (path: string) => errors[`definition.journey.result.${path}`];
  const set = (patch: Partial<JourneyResultSettings>) => onChange({ ...result, ...patch });
  const setCharacter = (index: number, patch: Partial<JourneyCharacter>) =>
    set({ characters: result.characters.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  const setCard = (patch: Partial<ResultCardStyle>) => set({ card: { ...result.card, ...patch } });

  const preview =
    result.characters.find((c) => c.id === previewId) ??
    result.characters.find((c) => c.id === result.defaultCharacterId) ??
    result.characters[0];

  const addCharacter = () => {
    const character: JourneyCharacter = { id: newKey(), name: '', title: '', description: '', imageId: null, traitId: null };
    set({
      characters: [...result.characters, character],
      defaultCharacterId: result.defaultCharacterId ?? character.id,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SwitchRow id="result-enabled" label="کارت شخصیت نهایی" hint="پس از تکمیل همه‌ی روزها، به هر کاربر یک شخصیت اختصاص می‌یابد که ثابت می‌ماند.">
        <Switch id="result-enabled" checked={result.enabled} onCheckedChange={(enabled) => set({ enabled })} />
      </SwitchRow>

      {result.enabled && (
        <>
          <section aria-labelledby="traits" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h4 id="traits" className="text-sm font-semibold">
                ویژگی‌ها
              </h4>
              <p className="text-xs text-muted-foreground">
                هر گزینه‌ی سؤال می‌تواند به یک یا چند ویژگی امتیاز بدهد (در مرحله‌ی سؤال‌ها، زیر گزینه‌ها). در صورت تساوی، ترتیب این فهرست
                برنده را تعیین می‌کند.
              </p>
            </div>
            {result.traits.map((trait, t) => (
              <div key={trait.id} className="flex items-center gap-2">
                <Input
                  value={trait.title}
                  aria-label={`نام ویژگی ${t + 1}`}
                  placeholder="مثلاً شجاعت"
                  maxLength={JOURNEY_LIMITS.CHARACTER_NAME_MAX}
                  onChange={(event) => set({ traits: result.traits.map((x, i) => (i === t ? { ...x, title: event.target.value } : x)) })}
                  {...invalid(error(`traits.${t}.title`))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="حذف ویژگی"
                  onClick={() =>
                    set({
                      traits: result.traits.filter((_, i) => i !== t),
                      // A character standing for it stands for nothing now.
                      characters: result.characters.map((c) => (c.traitId === trait.id ? { ...c, traitId: null } : c)),
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-fit"
              disabled={result.traits.length >= JOURNEY_LIMITS.TRAITS_MAX}
              onClick={() => set({ traits: [...result.traits, { id: newKey(), title: '' }] })}
            >
              <Plus aria-hidden="true" />
              ویژگی جدید
            </Button>
          </section>

          <section aria-labelledby="characters" className="flex flex-col gap-3">
            <h4 id="characters" className="text-sm font-semibold">
              شخصیت‌ها
            </h4>
            {error('characters') && <p className="text-xs text-destructive">{error('characters')}</p>}
            {result.characters.map((character, c) => (
              <div key={character.id} className="flex flex-col gap-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{character.name || `شخصیت ${c + 1}`}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="حذف شخصیت"
                    onClick={() => {
                      const characters = result.characters.filter((_, i) => i !== c);
                      set({
                        characters,
                        defaultCharacterId:
                          result.defaultCharacterId === character.id ? (characters[0]?.id ?? null) : result.defaultCharacterId,
                      });
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="نام" htmlFor={`char-${character.id}-name`} error={error(`characters.${c}.name`)}>
                    <Input
                      id={`char-${character.id}-name`}
                      value={character.name}
                      maxLength={JOURNEY_LIMITS.CHARACTER_NAME_MAX}
                      onChange={(event) => setCharacter(c, { name: event.target.value })}
                      {...invalid(error(`characters.${c}.name`))}
                    />
                  </Field>
                  <Field label="عنوان" htmlFor={`char-${character.id}-title`}>
                    <Input id={`char-${character.id}-title`} value={character.title} onChange={(event) => setCharacter(c, { title: event.target.value })} />
                  </Field>
                </div>
                <Field label="توضیح" htmlFor={`char-${character.id}-description`}>
                  <Textarea
                    id={`char-${character.id}-description`}
                    rows={2}
                    maxLength={JOURNEY_LIMITS.CHARACTER_DESCRIPTION_MAX}
                    value={character.description}
                    onChange={(event) => setCharacter(c, { description: event.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="تصویر" error={error(`characters.${c}.imageId`)}>
                    <MediaField
                      value={character.imageId}
                      onChange={(imageId) => setCharacter(c, { imageId })}
                      kind="image"
                      category="result"
                      pickerTitle={`تصویر ${character.name || 'شخصیت'}`}
                    />
                  </Field>
                  <Field label="شرط اختصاص" htmlFor={`char-${character.id}-trait`} error={error(`characters.${c}.traitId`)}>
                    <Select
                      value={character.traitId ?? NONE}
                      onValueChange={(value) => setCharacter(c, { traitId: value === NONE ? null : value })}
                    >
                      <SelectTrigger id={`char-${character.id}-trait`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>فقط به‌عنوان نتیجه‌ی پیش‌فرض</SelectItem>
                        {result.traits.map((trait) => (
                          <SelectItem key={trait.id} value={trait.id}>
                            بیشترین امتیاز در «{trait.title || 'بی‌نام'}»
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-fit"
              disabled={result.characters.length >= JOURNEY_LIMITS.CHARACTERS_MAX}
              onClick={addCharacter}
            >
              <Plus aria-hidden="true" />
              شخصیت جدید
            </Button>
            {result.characters.length > 0 && (
              <Field
                label="نتیجه‌ی پیش‌فرض"
                htmlFor="result-default"
                error={error('defaultCharacterId')}
                hint="برای زمانی که امتیازی ثبت نشده یا برای ویژگی برتر، شخصیتی تعریف نشده است."
              >
                <Select value={result.defaultCharacterId ?? undefined} onValueChange={(defaultCharacterId) => set({ defaultCharacterId })}>
                  <SelectTrigger id="result-default" className="w-full sm:w-72" {...invalid(error('defaultCharacterId'))}>
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {result.characters.map((character, c) => (
                      <SelectItem key={character.id} value={character.id}>
                        {character.name || `شخصیت ${c + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </section>

          <section aria-labelledby="card" className="grid gap-6 xl:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-4">
              <h4 id="card" className="text-sm font-semibold">
                کارت قابل اشتراک‌گذاری (۱۰۸۰×۱۹۲۰)
              </h4>
              <Field label="نام برند روی کارت" htmlFor="card-brand">
                <Input
                  id="card-brand"
                  value={result.card.brandName}
                  maxLength={JOURNEY_LIMITS.BRAND_NAME_MAX}
                  onChange={(event) => setCard({ brandName: event.target.value })}
                />
              </Field>
              <Field label="لوگو" hint="اگر خالی بماند، لوگوی هم‌داستان استفاده می‌شود.">
                <MediaField value={result.card.logoId} onChange={(logoId) => setCard({ logoId })} kind="image" category="result" pickerTitle="لوگوی کارت" />
              </Field>
              <SwitchRow id="card-background" label="رنگ اختصاصی کارت" hint="اگر خاموش باشد، رنگ زمینه‌ی اپلیکیشن استفاده می‌شود.">
                <div className="flex items-center gap-3">
                  {result.card.background && (
                    <Input
                      type="color"
                      aria-label="رنگ کارت"
                      className="h-8 w-12 cursor-pointer p-1"
                      value={result.card.background}
                      onChange={(event) => setCard({ background: event.target.value })}
                    />
                  )}
                  <Switch
                    id="card-background"
                    checked={result.card.background !== null}
                    onCheckedChange={(on) => setCard({ background: on ? JOURNEY_DEFAULTS.COVER_BACKGROUND : null })}
                  />
                </div>
              </SwitchRow>
              <SwitchRow id="card-name" label="نام کاربر روی کارت" hint="کاربر نیز می‌تواند پیش از دانلود آن را خاموش کند.">
                <Switch id="card-name" checked={result.card.showUserName} onCheckedChange={(showUserName) => setCard({ showUserName })} />
              </SwitchRow>
            </div>
            {preview && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="card-preview-of">پیش‌نمایش کارت</Label>
                <Select value={preview.id} onValueChange={setPreviewId}>
                  <SelectTrigger id="card-preview-of" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {result.characters.map((character, c) => (
                      <SelectItem key={character.id} value={character.id}>
                        {character.name || `شخصیت ${c + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CardPreview
                  content={{
                    name: preview.name || 'نام شخصیت',
                    title: preview.title,
                    description: preview.description,
                    userName: result.card.showUserName ? 'سارا' : null,
                    brandName: result.card.brandName,
                    background: result.card.background,
                  }}
                  characterImageId={preview.imageId}
                  logoId={result.card.logoId}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
