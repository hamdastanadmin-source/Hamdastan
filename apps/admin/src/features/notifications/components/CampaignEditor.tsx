'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleAlert, Copy, Save, Send, Square } from 'lucide-react';
import { toast } from 'sonner';

import { CAMPAIGN_CATEGORIES, NOTIFICATION_LIMITS as L } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminCampaign, CampaignCategory, NotificationDestination, NotificationDestinationKind } from '@hamdastan/types';
import { campaignSendProblems } from '@hamdastan/validation';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { Field, invalid } from '@/components';
import { useAdminCan } from '@/features/auth';
import { MediaField } from '@/features/media';
import { errorMessage, formatDateTime } from '@/lib';
import { adminNotificationsService } from '@/services';

import { useAudienceEstimate } from '../hooks/use-audience-estimate';
import { useCampaignEditor } from '../hooks/use-campaign-editor';
import { useCampaignOptions } from '../hooks/use-campaign-options';
import { CATEGORY_HINTS, CATEGORY_LABELS, DESTINATION_KINDS, STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { AudiencePicker } from './AudiencePicker';
import { CampaignPreview } from './CampaignPreview';
import { CampaignReportPanel } from './CampaignReportPanel';
import { SendDialog } from './SendDialog';

const TOGGLE_ITEM = 'h-10 rounded-lg border px-4 data-[state=on]:border-foreground data-[state=on]:bg-accent';

const destinationOf = (kind: NotificationDestinationKind): NotificationDestination =>
  kind === 'event' ? { kind, eventId: '' } : kind === 'activity' ? { kind, activityId: '' } : { kind };

/**
 * One campaign: write it (content, category, image, destination), choose
 * who it goes to and on which channel, see it as the product and a phone
 * will show it, then send or schedule it through a confirmation. A draft is
 * edited here; once it has been sent or scheduled it is read-only, with its
 * report and history, and the moves its status still allows.
 */
export function CampaignEditor({ initial }: { initial: AdminCampaign | null }) {
  const router = useRouter();
  const can = useAdminCan();
  const options = useCampaignOptions();
  const editor = useCampaignEditor(initial);
  const { campaign, state, update, errors } = editor;
  const estimate = useAudienceEstimate(state.audience, state.category, state.destination);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isDraft = !campaign || campaign.status === 'draft';
  const editable = isDraft && can('notifications.write');
  const canSend = isDraft && can('notifications.send') && can('notifications.write');
  const canBroadcast = can('notifications.broadcast');
  const pushAvailable = options?.pushAvailable ?? false;
  const problems = campaignSendProblems(state);

  const act = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(success);
      setRefreshKey((n) => n + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => act(editor.save, 'پیش‌نویس ذخیره شد');

  const onSend = async (scheduledAt: string | null) => {
    try {
      const sent = await editor.send(scheduledAt);
      toast.success(sent.scheduledAt && new Date(sent.scheduledAt) > new Date() ? 'زمان‌بندی شد' : 'در صف ارسال قرار گرفت؛ ظرف چند ثانیه ارسال می‌شود');
      setSending(false);
      setRefreshKey((n) => n + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const onDuplicate = () =>
    act(async () => {
      const copy = await adminNotificationsService.duplicate(campaign!.id);
      router.push(`/notifications/${copy.id}`);
    }, 'یک پیش‌نویس تازه ساخته شد');

  const reread = async () => editor.setCampaign(await adminNotificationsService.get(campaign!.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button asChild variant="ghost" size="sm" className="-ms-3 w-fit text-muted-foreground">
            <Link href="/notifications">
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              اعلان‌ها
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{campaign ? campaign.title || 'بدون عنوان' : 'اعلان جدید'}</h1>
          {campaign && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={STATUS_BADGE[campaign.status]}>{STATUS_LABELS[campaign.status]}</Badge>
              {campaign.status === 'scheduled' && <span>ارسال در {formatDateTime(campaign.scheduledAt)} (به وقت تهران)</span>}
              {campaign.sentAt && <span>ارسال‌شده در {formatDateTime(campaign.sentAt)}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign && can('notifications.write') && (
            <Button variant="outline" onClick={onDuplicate} disabled={busy}>
              <Copy aria-hidden="true" />
              تکثیر
            </Button>
          )}
          {campaign?.status === 'scheduled' && can('notifications.send') && (
            <Button variant="outline" disabled={busy} onClick={() => act(async () => editor.setCampaign(await adminNotificationsService.cancel(campaign.id)), 'ارسال لغو شد')}>
              لغو ارسال
            </Button>
          )}
          {(campaign?.status === 'sent' || campaign?.status === 'sending') && campaign.push && can('notifications.send') && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const { cancelled } = await adminNotificationsService.stopPush(campaign.id);
                  await reread();
                  return cancelled;
                }, 'پوش‌های باقی‌مانده متوقف شد')
              }
            >
              <Square aria-hidden="true" />
              توقف پوش‌های باقی‌مانده
            </Button>
          )}
          {editable && (
            <Button variant="outline" onClick={onSave} loading={busy}>
              <Save aria-hidden="true" />
              ذخیره‌ی پیش‌نویس
            </Button>
          )}
          {canSend && (
            <Button onClick={() => setSending(true)} disabled={busy || problems.length > 0 || estimate === null}>
              <Send aria-hidden="true" />
              ارسال یا زمان‌بندی…
            </Button>
          )}
        </div>
      </div>

      {campaign?.status === 'failed' && campaign.error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>ارسال ناموفق بود</AlertTitle>
          <AlertDescription>{campaign.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">محتوا</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Field label="عنوان" htmlFor="campaign-title" error={errors.title} hint={`${toPersianDigits(state.title.length)} از ${toPersianDigits(L.TITLE_MAX)} نویسه`}>
                <Input id="campaign-title" value={state.title} maxLength={L.TITLE_MAX} disabled={!editable} onChange={(event) => update({ title: event.target.value })} {...invalid(errors.title)} />
              </Field>
              <Field label="متن کوتاه" htmlFor="campaign-body" error={errors.body} hint={`${toPersianDigits(state.body.length)} از ${toPersianDigits(L.BODY_MAX)} نویسه`}>
                <Textarea id="campaign-body" rows={3} value={state.body} maxLength={L.BODY_MAX} disabled={!editable} onChange={(event) => update({ body: event.target.value })} {...invalid(errors.body)} />
              </Field>
              <Field label="دسته" hint={CATEGORY_HINTS[state.category]}>
                <ToggleGroup
                  type="single"
                  value={state.category}
                  onValueChange={(category) => category && update({ category: category as CampaignCategory })}
                  spacing={2}
                  className="flex-wrap"
                  aria-label="دسته"
                  disabled={!editable}
                >
                  {CAMPAIGN_CATEGORIES.map((category) => (
                    <ToggleGroupItem key={category} value={category} className={TOGGLE_ITEM}>
                      {CATEGORY_LABELS[category]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <Field label="تصویر (اختیاری)" error={errors.imageId}>
                {editable ? (
                  <MediaField value={state.imageId} onChange={(imageId) => update({ imageId })} kind="image" pickerTitle="تصویر اعلان" invalid={Boolean(errors.imageId)} />
                ) : (
                  <p className="text-sm text-muted-foreground">{state.imageId ? 'دارد' : 'ندارد'}</p>
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="مقصد پس از باز کردن اعلان">
                  <Select value={state.destination.kind} onValueChange={(kind) => update({ destination: destinationOf(kind as NotificationDestinationKind) })} disabled={!editable}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESTINATION_KINDS.map((kind) => (
                        <SelectItem key={kind.value} value={kind.value}>
                          {kind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {state.destination.kind === 'event' && (
                  <Field label="رویداد" error={errors['destination.eventId']} hint="کاربری که اجازه‌ی مشاهده‌ی رویداد را ندارد، این اعلان را دریافت نمی‌کند.">
                    <Select value={state.destination.eventId || undefined} onValueChange={(eventId) => update({ destination: { kind: 'event', eventId } })} disabled={!editable}>
                      <SelectTrigger className="w-full" {...invalid(errors['destination.eventId'])}>
                        <SelectValue placeholder="انتخاب رویداد" />
                      </SelectTrigger>
                      <SelectContent>
                        {(options?.events ?? []).map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {state.destination.kind === 'activity' && (
                  <Field label="فعالیت" error={errors['destination.activityId']} hint="کاربری که جزو مخاطبان فعالیت نیست، این اعلان را دریافت نمی‌کند.">
                    <Select value={state.destination.activityId || undefined} onValueChange={(activityId) => update({ destination: { kind: 'activity', activityId } })} disabled={!editable}>
                      <SelectTrigger className="w-full" {...invalid(errors['destination.activityId'])}>
                        <SelectValue placeholder="انتخاب فعالیت" />
                      </SelectTrigger>
                      <SelectContent>
                        {(options?.activities ?? []).map((activity) => (
                          <SelectItem key={activity.id} value={activity.id}>
                            {activity.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">مخاطب</CardTitle>
            </CardHeader>
            <CardContent>
              <AudiencePicker
                key={campaign?.id ?? 'new'}
                value={state.audience}
                onChange={(audience) => update({ audience })}
                options={options}
                estimate={estimate}
                canBroadcast={canBroadcast}
                errors={errors}
                disabled={!editable}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">کانال</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ToggleGroup
                type="single"
                value={state.push ? 'push' : 'in_app'}
                onValueChange={(channel) => channel && update({ push: channel === 'push' })}
                spacing={2}
                className="flex-wrap"
                aria-label="کانال ارسال"
                disabled={!editable}
              >
                <ToggleGroupItem value="in_app" className={TOGGLE_ITEM}>
                  فقط درون برنامه
                </ToggleGroupItem>
                <ToggleGroupItem value="push" className={TOGGLE_ITEM} disabled={!pushAvailable && !state.push}>
                  درون برنامه + اعلان گوشی
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {pushAvailable
                  ? 'اعلان گوشی فقط برای کاربرانی ارسال می‌شود که آن را روی دستگاه خود فعال کرده و این دسته را برای گوشی خاموش نکرده‌اند.'
                  : 'زیرساخت اعلان گوشی (کلیدهای VAPID) روی سرور پیکربندی نشده است؛ در حال حاضر فقط ارسال درون برنامه امکان‌پذیر است.'}
              </p>
            </CardContent>
          </Card>

          {campaign && !isDraft && <CampaignReportPanel campaign={campaign} refreshKey={refreshKey} />}
        </div>

        <div className="flex flex-col gap-6">
          <CampaignPreview value={state} />
          {isDraft && problems.length > 0 && (
            <Alert>
              <CircleAlert aria-hidden="true" />
              <AlertTitle>پیش از ارسال</AlertTitle>
              <AlertDescription>
                <ul className="list-disc ps-4">
                  {problems.map((problem) => (
                    <li key={problem.field}>{problem.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <SendDialog
        key={sending ? 'open' : 'closed'}
        open={sending}
        value={state}
        options={options}
        estimate={estimate}
        onCancel={() => setSending(false)}
        onConfirm={onSend}
      />
    </div>
  );
}
