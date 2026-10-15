'use client';

import { useState } from 'react';
import { Shuffle } from 'lucide-react';

import { BUILTIN_MOTION_EFFECT_LABELS, BUILTIN_MOTION_EFFECTS, MOTION_DURATION } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { BuiltinMotionEffect, MediaCategory, MotionMode, MotionSetting } from '@hamdastan/types';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { useMediaAsset } from '../hooks/use-media-asset';
import { MediaField } from './MediaField';
import { MediaPicker } from './MediaPicker';
import { MediaPreview } from './MediaPreview';

const MODES: { mode: MotionMode; label: string }[] = [
  { mode: 'off', label: 'غیرفعال' },
  { mode: 'mascot', label: 'مسکات آماده' },
  { mode: 'custom', label: 'موشن اختصاصی' },
  { mode: 'builtin', label: 'افکت داخلی' },
  { mode: 'random', label: 'تصادفی' },
];

/** A setting in a new mode, keeping what the modes share. */
function inMode(current: MotionSetting, mode: MotionMode): MotionSetting {
  const { durationMs, caption, sound } = current;
  const common = { durationMs, caption, sound };
  switch (mode) {
    case 'off':
      return { mode, ...common };
    case 'mascot':
    case 'custom':
      return { mode, assetId: 'assetId' in current ? current.assetId : '', ...common };
    case 'builtin':
      return { mode, effect: 'effect' in current ? current.effect : 'confetti', ...common };
    case 'random':
      return { mode, assetIds: 'assetIds' in current ? current.assetIds : [], ...common };
  }
}

function RandomThumb({ id }: { id: string }) {
  const { asset } = useMediaAsset(id);
  return <div className="size-14 rounded-md border bg-muted/50">{asset && <MediaPreview asset={asset} className="size-full p-1" />}</div>;
}

/**
 * Where a motion can be set, the admin picks one of five modes: a ready
 * mascot, a motion uploaded for this place, one of the product's own simple
 * effects, a random one of a set, or none — then how long it stays, the
 * line under it, and whether a video plays its sound (off by default).
 */
export function MotionSettingField({
  id,
  value,
  onChange,
  category = 'answer_motion',
  errors = {},
}: {
  id: string;
  value: MotionSetting;
  onChange: (value: MotionSetting) => void;
  /** The shelf an uploaded motion goes on. */
  category?: MediaCategory;
  /** Problems by the setting's own field: `assetId`, `assetIds`, `durationMs`, `caption`. */
  errors?: Record<string, string | undefined>;
}) {
  const [pickingSet, setPickingSet] = useState(false);
  const firstError = Object.values(errors).find(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={value.mode}
        onValueChange={(mode) => mode && onChange(inMode(value, mode as MotionMode))}
        variant="outline"
        className="flex w-full flex-wrap justify-start"
        aria-label="نوع موشن"
      >
        {MODES.map(({ mode, label }) => (
          <ToggleGroupItem
            key={mode}
            value={mode}
            className="flex-none px-3 data-[state=on]:border-foreground data-[state=on]:bg-accent"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {(value.mode === 'mascot' || value.mode === 'custom') && (
        <MediaField
          value={value.assetId || null}
          onChange={(assetId) => onChange({ ...value, assetId: assetId ?? '' })}
          category={value.mode === 'mascot' ? 'mascot' : category}
          pickerTitle={value.mode === 'mascot' ? 'انتخاب مسکات' : 'انتخاب موشن'}
          invalid={Boolean(errors.assetId)}
        />
      )}

      {value.mode === 'builtin' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-effect`}>افکت</Label>
          <Select value={value.effect} onValueChange={(effect) => onChange({ ...value, effect: effect as BuiltinMotionEffect })}>
            <SelectTrigger id={`${id}-effect`} className="w-full sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILTIN_MOTION_EFFECTS.map((effect) => (
                <SelectItem key={effect} value={effect}>
                  {BUILTIN_MOTION_EFFECT_LABELS[effect]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.mode === 'random' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {value.assetIds.map((assetId) => (
              <RandomThumb key={assetId} id={assetId} />
            ))}
            <Button variant="outline" onClick={() => setPickingSet(true)}>
              <Shuffle aria-hidden="true" />
              {value.assetIds.length ? 'تغییر مجموعه' : 'انتخاب مجموعه'}
            </Button>
          </div>
          <MediaPicker
            open={pickingSet}
            onOpenChange={setPickingSet}
            title="مجموعه‌ی موشن‌های تصادفی"
            category={category}
            multiple
            selected={value.assetIds}
            onConfirm={(assetIds) => onChange({ ...value, assetIds })}
          />
        </div>
      )}

      {value.mode !== 'off' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Label htmlFor={`${id}-duration`}>
              مدت نمایش: {toPersianDigits((value.durationMs / 1000).toFixed(1))} ثانیه
            </Label>
            <Slider
              id={`${id}-duration`}
              min={MOTION_DURATION.MIN_MS}
              max={MOTION_DURATION.MAX_MS}
              step={100}
              // Neutral: the brand colour is the screen's primary action only.
              trackClassName="bg-foreground/10"
              rangeClassName="bg-foreground/35"
              thumbClassName="border-foreground/40"
              value={[value.durationMs]}
              onValueChange={([durationMs]) => onChange({ ...value, durationMs })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-caption`}>متن کوتاه همراه (اختیاری)</Label>
            <Input
              id={`${id}-caption`}
              value={value.caption}
              maxLength={MOTION_DURATION.CAPTION_MAX}
              placeholder="ایول!"
              onChange={(event) => onChange({ ...value, caption: event.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`${id}-sound`}>پخش صدا</Label>
              <span className="text-xs text-muted-foreground">فقط برای موشن ویدیویی؛ پیش‌فرض بی‌صدا.</span>
            </div>
            <Switch id={`${id}-sound`} checked={value.sound} onCheckedChange={(sound) => onChange({ ...value, sound })} />
          </div>
        </div>
      )}

      {firstError && (
        <p role="alert" className="text-xs text-destructive">
          {firstError}
        </p>
      )}
    </div>
  );
}
