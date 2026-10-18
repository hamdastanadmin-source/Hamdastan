'use client';

import { Bell, Megaphone } from 'lucide-react';

import type { CampaignInput } from '@hamdastan/types';
import { Card, CardContent, CardHeader, CardTitle } from '@hamdastan/ui';

import { MediaPreview, useMediaAsset } from '@/features/media';

import { CATEGORY_LABELS } from '../utils/labels';

/**
 * How the campaign will look: as a row of the product's Notification
 * Center, and as a push on a phone's lock screen (shown only when the
 * campaign goes to phones too). Drawn from what is typed, not saved.
 */
export function CampaignPreview({ value }: { value: CampaignInput }) {
  const { asset } = useMediaAsset(value.imageId);
  const title = value.title || 'عنوان اعلان';
  const body = value.body || 'متن کوتاه اعلان';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">پیش‌نمایش</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">در مرکز اعلان‌های اپلیکیشن</p>
          <div className="flex items-start gap-3 rounded-2xl border bg-background p-3" dir="rtl">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-secondary">
              {asset ? <MediaPreview asset={asset} className="size-full" /> : <Megaphone aria-hidden="true" className="size-5 text-muted-foreground" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-start gap-2">
                <span className="flex-1 text-sm font-bold leading-snug">{title}</span>
                <span className="text-xs text-muted-foreground">همین حالا</span>
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
              <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[value.category]}</span>
            </span>
          </div>
        </div>

        {value.push && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">روی صفحه‌ی قفل گوشی (ظاهر دقیق به سیستم‌عامل بستگی دارد)</p>
            <div className="flex items-start gap-3 rounded-2xl bg-muted p-3" dir="rtl">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                <Bell aria-hidden="true" className="size-4 text-muted-foreground" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">هم‌داستان</span>
                <span className="truncate text-sm font-bold">{title}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{body}</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
