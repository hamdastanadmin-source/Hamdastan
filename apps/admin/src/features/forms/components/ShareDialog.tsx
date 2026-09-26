'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Check, Copy, Link2, Users } from 'lucide-react';

import { WEB_BASE_URL } from '@hamdastan/config';
import { formatJalaliDate } from '@hamdastan/shared';
import type { Form, FormSummary } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
  Skeleton,
  toast,
} from '@hamdastan/ui';

import { HttpError } from '@/services';

import { formsApi } from '../services/forms.api';

/**
 * Publishing, and the link that comes out of it.
 *
 * The same dialog answers both «انتشار» and «اشتراک‌گذاری», because they are one
 * conversation: here is what you are about to publish, to whom, and for how
 * long — and once it is published, here is the link.
 *
 * It reads the form itself when it opens rather than taking the summary's word
 * for it: the audience and the availability window are what the admin is being
 * asked to confirm, and a stale copy of either is exactly the thing that should
 * not be confirmed.
 */

const AUDIENCE_LABELS: Record<string, string> = {
  EVERYONE: 'همهٔ کاربران',
  USERS: 'کاربران انتخاب‌شده',
  ROLES: 'نقش‌های انتخاب‌شده',
  GROUPS: 'گروه‌های انتخاب‌شده',
};

export function ShareDialog({
  form,
  open,
  onOpenChange,
  /** The builder already holds the document, so it passes it and skips the read. */
  details,
  onPublished,
}: {
  form: FormSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details?: Form;
  onPublished?: (form: Form) => void;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Form | null>(details ?? null);
  const [status, setStatus] = useState(form.status);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = `${WEB_BASE_URL}/forms/${form.id}`;

  useEffect(() => {
    if (loaded) return;

    let cancelled = false;
    void formsApi
      .get(form.id)
      .then(({ form: full }) => {
        if (!cancelled) setLoaded(full);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [form.id, loaded]);

  const publish = async () => {
    setIsPending(true);
    setError(null);

    try {
      const { form: published } = await formsApi.publish(form.id);
      setStatus(published.status);
      setLoaded(published);
      onPublished?.(published);
      toast.success('فرم منتشر شد');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof HttpError ? caught.message : 'انتشار فرم ممکن نشد.');
    } finally {
      setIsPending(false);
    }
  };

  const unpublish = async () => {
    setIsPending(true);
    setError(null);

    try {
      const { form: draft } = await formsApi.unpublish(form.id);
      setStatus(draft.status);
      setLoaded(draft);
      onPublished?.(draft);
      toast.success('انتشار فرم متوقف شد');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof HttpError ? caught.message : 'توقف انتشار ممکن نشد.');
    } finally {
      setIsPending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses clipboard access still shows the link, which is
      // selectable — nothing is lost but the convenience.
      toast.error('کپی خودکار ممکن نشد؛ نشانی را دستی کپی کنید.');
    }
  };

  const published = status === 'PUBLISHED';
  const availability = loaded?.settings.availability;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{published ? 'اشتراک‌گذاری فرم' : 'انتشار فرم'}</DialogTitle>
          <DialogDescription>{form.title}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
          <Row label="وضعیت">
            {published ? (
              <Badge variant="success">منتشرشده</Badge>
            ) : (
              <Badge variant="secondary">
                {form.questionCount > 0 ? 'آمادهٔ انتشار' : 'بدون پرسش'}
              </Badge>
            )}
          </Row>

          <Separator />

          <Row label="مخاطبان" icon={<Users className="size-4 text-muted-foreground" />}>
            {loaded ? (
              <span>{AUDIENCE_LABELS[loaded.audience.mode] ?? loaded.audience.mode}</span>
            ) : (
              <Skeleton className="h-4 w-24" />
            )}
          </Row>

          <Row
            label="بازهٔ پاسخ‌گویی"
            icon={<CalendarClock className="size-4 text-muted-foreground" />}
          >
            {!availability ? (
              <Skeleton className="h-4 w-32" />
            ) : availability.alwaysAvailable ? (
              <span>همیشه باز</span>
            ) : (
              <span className="text-xs">
                {availability.publishAt ? formatJalaliDate(availability.publishAt) : 'از هم‌اکنون'}
                {' تا '}
                {availability.closeAt ? formatJalaliDate(availability.closeAt) : 'بدون پایان'}
              </span>
            )}
          </Row>
        </div>

        {loaded && loaded.audience.mode !== 'EVERYONE' && (
          <Alert variant="warning">
            <Users className="size-4" />
            <AlertDescription>
              این فرم عمومی نیست: فقط {AUDIENCE_LABELS[loaded.audience.mode]} می‌توانند پاسخ
              دهند. هر کس دیگری — از جمله خودتان با حسابی خارج از این فهرست — با پیام «دسترسی
              ندارید» روبه‌رو می‌شود. برای باز کردن آن برای همه، در تنظیمات فرم مخاطبان را روی
              «همهٔ کاربران» بگذارید.
            </AlertDescription>
          </Alert>
        )}

        {published && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link2 className="size-3.5" />
              نشانی پاسخ‌گویی
            </label>
            <div className="flex gap-2">
              {/* rtl-ok: a URL is read left-to-right. */}
              <Input readOnly value={link} dir="ltr" className="text-start font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => void copy()}>
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            بستن
          </Button>

          {published ? (
            <Button variant="outline" loading={isPending} onClick={() => void unpublish()}>
              توقف انتشار
            </Button>
          ) : (
            <Button loading={isPending} onClick={() => void publish()}>
              انتشار فرم
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
