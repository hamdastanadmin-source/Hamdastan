'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Images, Plus, X } from 'lucide-react';

import { IMAGE_FRAMES, THIS_OR_THAT_LIMITS as T } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ThisOrThatCard, ThisOrThatSettings } from '@hamdastan/types';
import { Button, Input, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { NEUTRAL_TOGGLE } from '@/components';
import { MediaField, MediaPicker } from '@/features/media';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { emptyCard } from '../../utils/draft';
import { Field, invalid } from './Field';

const ORDERS: { value: ThisOrThatSettings['order']; label: string }[] = [
  { value: 'manual', label: 'به ترتیب فهرست' },
  { value: 'random', label: 'تصادفی برای هر کاربر' },
];

/**
 * Step 3 of «این یا اون»: the cover, the order and the cards — each an
 * image with an optional title, moved up and down, replaced or removed.
 * «افزودن چند تصویر» turns a multi-pick from the library into cards,
 * filling the empty ones first.
 */
export function CardsStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, updateDefinition, errors } = editor;
  const [picking, setPicking] = useState(false);
  const settings = state.definition.thisOrThat;
  if (!settings) return null;

  const { cards } = settings;
  const set = (patch: Partial<ThisOrThatSettings>) => updateDefinition({ thisOrThat: { ...settings, ...patch } });
  const setCards = (next: ThisOrThatCard[]) => set({ cards: next });
  const setCard = (id: string, patch: Partial<ThisOrThatCard>) =>
    setCards(cards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  const move = (index: number, offset: -1 | 1) => {
    const next = [...cards];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setCards(next);
  };

  const addImages = (ids: string[]) => {
    const queue = [...ids];
    const filled = cards.map((card) => (card.imageId || queue.length === 0 ? card : { ...card, imageId: queue.shift()! }));
    const added = queue.slice(0, T.CARDS_MAX - filled.length).map((id) => emptyCard(id));
    setCards([...filled, ...added]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field
          label="تصویر کاور"
          error={errors['definition.thisOrThat.coverImageId']}
          hint="بالای صفحه‌ی شروع فعالیت نمایش داده می‌شود. اختیاری است."
        >
          <MediaField
            value={settings.coverImageId}
            onChange={(coverImageId) => set({ coverImageId })}
            kind="image"
            category="cover"
            pickerTitle="تصویر کاور"
            frame={IMAGE_FRAMES.activityCover}
            invalid={Boolean(errors['definition.thisOrThat.coverImageId'])}
          />
        </Field>
        <Field
          label="ترتیب نمایش کارت‌ها"
          hint="در حالت تصادفی، هر کاربر ترتیب مخصوص خودش را می‌بیند و با خروج و بازگشت همان ترتیب حفظ می‌شود."
        >
          <ToggleGroup
            type="single"
            value={settings.order}
            onValueChange={(order) => order && set({ order: order as ThisOrThatSettings['order'] })}
            spacing={2}
            className="flex-wrap"
            aria-label="ترتیب نمایش کارت‌ها"
          >
            {ORDERS.map((order) => (
              <ToggleGroupItem key={order.value} value={order.value} className={NEUTRAL_TOGGLE}>
                {order.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold">کارت‌ها</h3>
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(cards.length)} کارت؛ کاربر {toPersianDigits(Math.max(0, cards.length - 1))} بار بین دو تصویر
              انتخاب می‌کند و برنده‌ی هر رقابت با کارت بعدی روبه‌رو می‌شود.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPicking(true)} disabled={cards.every((card) => card.imageId) && cards.length >= T.CARDS_MAX}>
              <Images aria-hidden="true" />
              افزودن چند تصویر
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCards([...cards, emptyCard()])} disabled={cards.length >= T.CARDS_MAX}>
              <Plus aria-hidden="true" />
              کارت جدید
            </Button>
          </div>
        </div>
        {errors['definition.thisOrThat.cards'] && (
          <p role="alert" className="text-xs text-destructive">
            {errors['definition.thisOrThat.cards']}
          </p>
        )}

        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => {
            const at = `definition.thisOrThat.cards.${index}`;
            const number = toPersianDigits(index + 1);
            return (
              <li key={card.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-1">
                  <span className="me-auto text-sm font-semibold tabular-nums">کارت {number}</span>
                  <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`بالا بردن کارت ${number}`}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === cards.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`پایین بردن کارت ${number}`}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={cards.length <= T.CARDS_MIN}
                    onClick={() => setCards(cards.filter((c) => c.id !== card.id))}
                    aria-label={`حذف کارت ${number}`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <MediaField
                  value={card.imageId || null}
                  onChange={(imageId) => setCard(card.id, { imageId: imageId ?? '' })}
                  kind="image"
                  category="question"
                  pickerTitle={`تصویر کارت ${number}`}
                  frame={IMAGE_FRAMES.thisOrThatCard}
                  invalid={Boolean(errors[`${at}.imageId`])}
                />
                {errors[`${at}.imageId`] && <p className="text-xs text-destructive">{errors[`${at}.imageId`]}</p>}
                <Input
                  value={card.title}
                  maxLength={T.CARD_TITLE_MAX}
                  placeholder="عنوان کارت (اختیاری)"
                  aria-label={`عنوان کارت ${number}`}
                  onChange={(event) => setCard(card.id, { title: event.target.value })}
                  {...invalid(errors[`${at}.title`])}
                />
              </li>
            );
          })}
        </ol>
      </div>

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title="افزودن تصویر کارت‌ها"
        kind="image"
        category="question"
        multiple
        onConfirm={addImages}
      />
    </div>
  );
}
