'use client';

import { useState } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';

import type { ImageFrame } from '@hamdastan/config';
import type { MediaCategory, MediaKind } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { useMediaAsset } from '../hooks/use-media-asset';
import { FramedPreview, frameHint } from './FramedPreview';
import { MediaPicker } from './MediaPicker';
import { MediaPreview } from './MediaPreview';

/**
 * One library file in a form: its preview with «جایگزینی» and «حذف», or a
 * button to choose one. Holds only the id — the file stays in the library.
 */
export function MediaField({
  value,
  onChange,
  kind,
  category,
  pickerTitle,
  invalid,
  frame,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  kind?: MediaKind;
  category?: MediaCategory;
  pickerTitle: string;
  invalid?: boolean;
  /** The size the product draws this image at: said up front, previewed as cropped, warned about when off. */
  frame?: ImageFrame;
}) {
  const [picking, setPicking] = useState(false);
  const { asset, missing } = useMediaAsset(value);

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2" aria-invalid={invalid || missing || undefined}>
          <div className="size-16 shrink-0 rounded-md bg-muted/50">
            {asset && <MediaPreview asset={asset} className="size-full p-1" />}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">
            {missing ? <span className="text-destructive">این فایل از کتابخانه حذف شده</span> : (asset?.name ?? '…')}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setPicking(true)} aria-label="جایگزینی">
            <RefreshCw aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => onChange(null)} aria-label="حذف">
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full justify-start" onClick={() => setPicking(true)}>
          <ImagePlus aria-hidden="true" />
          انتخاب از کتابخانه یا بارگذاری
        </Button>
      )}

      {frame && !value && <p className="text-xs text-muted-foreground">{frameHint(frame)}</p>}
      {frame && value && asset && !missing && <FramedPreview asset={asset} frame={frame} />}

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title={pickerTitle}
        kind={kind}
        category={category}
        selected={value ? [value] : []}
        onConfirm={([id]) => onChange(id ?? null)}
      />
    </div>
  );
}
