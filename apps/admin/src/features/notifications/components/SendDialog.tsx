'use client';

import { useState } from 'react';

import type { AudienceEstimate, CampaignInput, CampaignOptions } from '@hamdastan/types';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { Field } from '@/components';
import { formatCount, formatDateTime } from '@/lib';

import { CATEGORY_LABELS, describeAudience, describeDestination } from '../utils/labels';

const TOGGLE_ITEM = 'h-10 rounded-lg border px-4 data-[state=on]:border-foreground data-[state=on]:bg-accent';

/**
 * The confirmation every send passes through: when (now, or a time — shown
 * back in Tehran's time, the zone it is stored against as UTC), and the
 * whole of what will happen — the content, the audience and how many it
 * reaches today, the channels, the destination. The button is busy while
 * the request is out, so a double click cannot send twice (and the API's
 * status move would refuse a second anyway).
 */
export function SendDialog({
  open,
  value,
  options,
  estimate,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  value: CampaignInput;
  options: CampaignOptions | null;
  estimate: AudienceEstimate | null;
  onCancel: () => void;
  onConfirm: (scheduledAt: string | null) => Promise<void>;
}) {
  const [mode, setMode] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState('');
  const [busy, setBusy] = useState(false);
  const scheduledAt = mode === 'later' && at ? new Date(at) : null;
  const invalidTime = mode === 'later' && (!scheduledAt || scheduledAt <= new Date());

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(scheduledAt ? scheduledAt.toISOString() : null);
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [
    ['عنوان', value.title],
    ['متن', value.body],
    ['دسته', CATEGORY_LABELS[value.category]],
    ['مخاطب', describeAudience(value.audience, options)],
    [
      'تعداد گیرندگان (امروز)',
      estimate ? `${formatCount(estimate.eligible)} نفر${value.push ? `، ${formatCount(estimate.push)} نفر روی گوشی` : ''}` : '—',
    ],
    ['کانال', value.push ? 'درون برنامه + اعلان گوشی' : 'فقط درون برنامه'],
    ['مقصد', describeDestination(value.destination, options)],
    ['زمان', scheduledAt ? `${formatDateTime(scheduledAt.toISOString())} (به وقت تهران)` : 'همین حالا — ظرف چند ثانیه'],
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ارسال اعلان</DialogTitle>
          <DialogDescription>پس از ارسال، اعلان‌ها ساخته می‌شوند و قابل بازگشت نیستند. لطفاً همه‌ی موارد را یک بار دیگر بررسی کنید.</DialogDescription>
        </DialogHeader>

        <Field label="نحوه‌ی ارسال">
          <ToggleGroup type="single" value={mode} onValueChange={(next) => next && setMode(next as 'now' | 'later')} spacing={2} aria-label="زمان ارسال">
            <ToggleGroupItem value="now" className={TOGGLE_ITEM}>
              همین حالا
            </ToggleGroupItem>
            <ToggleGroupItem value="later" className={TOGGLE_ITEM}>
              زمان‌بندی
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {mode === 'later' && (
          <Field
            label="زمان ارسال"
            htmlFor="send-at"
            hint={scheduledAt ? `${formatDateTime(scheduledAt.toISOString())} به وقت تهران` : 'یک زمان در آینده انتخاب کنید'}
            error={at && invalidTime ? 'این زمان گذشته است؛ یک زمان در آینده انتخاب کنید' : undefined}
          >
            <Input id="send-at" type="datetime-local" dir="ltr" value={at} onChange={(event) => setAt(event.target.value)} />
          </Field>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
          {rows.map(([label, text]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-line break-words">{text}</dd>
            </div>
          ))}
        </dl>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" onClick={confirm} loading={busy} disabled={invalidTime}>
            {mode === 'later' ? 'زمان‌بندی ارسال' : 'ارسال به همین مخاطب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
