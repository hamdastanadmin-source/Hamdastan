'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, CircleCheck, ExternalLink } from 'lucide-react';

import { WEB_BASE_URL } from '@hamdastan/config';
import type { AdminEventHistoryEntry, EventStatusAction, EventStatusInput } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Badge, Button, Input } from '@hamdastan/ui';

import { Field } from '@/components';
import { useAdminCan } from '@/features/auth';
import { errorMessage, formatDateTime } from '@/lib';
import { adminEventsService } from '@/services';

import { EDITOR_SECTIONS, sectionOfPath, type EditorSectionId } from '../../utils/draft';
import { ACTION_LABELS, ACTIONS_FOR, HISTORY_LABELS, STATUS_BADGE, STATUS_LABELS } from '../../utils/labels';
import type { SectionProps } from './types';

/**
 * Saves, then opens the event's page as a person would see it. The tab is
 * opened at once, while the click still counts, and pointed at the preview
 * once the save is done.
 */
async function openPreview(editor: SectionProps['editor'], onGoTo: (section: EditorSectionId) => void) {
  const tab = window.open('', '_blank');
  try {
    const outcome = await editor.save();
    if (!('detail' in outcome)) {
      tab?.close();
      onGoTo(outcome.section);
      toast.error('اول موارد مشخص‌شده رو اصلاح کن');
      return;
    }
    const url = `${WEB_BASE_URL}/preview/events/${outcome.detail.id}`;
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (error) {
    tab?.close();
    toast.error(errorMessage(error));
  }
}

const sectionLabel = (id: EditorSectionId) => EDITOR_SECTIONS.find((section) => section.id === id)?.label ?? '';

/**
 * H. Publishing: what still stands between the event and the product — the
 * API's own checklist — when it goes live (now, or scheduled), and the moves
 * back: unpublish, cancel, archive. Ends with the event's history.
 */
export function PublishSection({
  editor,
  onGoTo,
  onStatus,
}: SectionProps & {
  onGoTo: (section: EditorSectionId) => void;
  /** Saves and changes the status; the take-away actions ask first. */
  onStatus: (input: EventStatusInput) => void;
}) {
  const can = useAdminCan();
  const { saved, problems, busy } = editor;
  const [at, setAt] = useState('');
  const status = saved?.status ?? 'draft';
  const actions = can('events.publish') ? ACTIONS_FOR[status] : [];
  const canPublish = actions.includes('publish');
  const scheduled = at !== '' && new Date(at) > new Date();
  const others = actions.filter((action): action is Exclude<EventStatusAction, 'publish'> => action !== 'publish');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">وضعیت:</span>
        <Badge variant={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
        {saved?.publishAt && <span className="text-muted-foreground">انتشار: {formatDateTime(saved.publishAt)}</span>}
        {can('events.write') && (
          <Button variant="outline" size="sm" className="ms-auto" onClick={() => openPreview(editor, onGoTo)} disabled={busy}>
            <ExternalLink aria-hidden="true" />
            پیش‌نمایش در محصول
          </Button>
        )}
      </div>

      {problems.length > 0 ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>برای انتشار، این‌ها مونده</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {problems.map((problem) => (
                <li key={problem.field} className="flex flex-wrap items-center gap-2">
                  {problem.message}
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onGoTo(sectionOfPath(problem.field))}>
                    رفتن به «{sectionLabel(sectionOfPath(problem.field))}»
                  </Button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleCheck aria-hidden="true" />
          <AlertTitle>آماده‌ی انتشار</AlertTitle>
          <AlertDescription>همه‌ی اطلاعات لازم کامله. پیش‌نویس رو هر وقت خواستی ذخیره کن.</AlertDescription>
        </Alert>
      )}

      {canPublish && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="زمان انتشار" htmlFor="publish-at" hint={at ? formatDateTime(new Date(at).toISOString()) : 'خالی یعنی همین حالا.'}>
            <Input id="publish-at" type="datetime-local" dir="ltr" className="sm:w-64" value={at} onChange={(event) => setAt(event.target.value)} />
          </Field>
          <Button
            disabled={problems.length > 0}
            loading={busy}
            onClick={() => onStatus({ action: 'publish', publishAt: scheduled ? new Date(at).toISOString() : null })}
          >
            {scheduled ? 'زمان‌بندی انتشار' : 'انتشار'}
          </Button>
        </div>
      )}

      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((action) => (
            <Button key={action} variant="outline" disabled={busy} onClick={() => onStatus({ action })}>
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      )}

      {saved && <History id={saved.id} updatedAt={saved.updatedAt} />}
    </div>
  );
}

/** Who did what to the event, newest first. Read again whenever the event changes. */
function History({ id, updatedAt }: { id: string; updatedAt: string }) {
  const [entries, setEntries] = useState<AdminEventHistoryEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    adminEventsService.history(id).then((list) => active && setEntries(list), () => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [id, updatedAt]);

  if (!entries?.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">سابقه</h3>
      <ol className="flex flex-col gap-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
            <span className="text-foreground">{HISTORY_LABELS[entry.action] ?? entry.action}</span>
            {entry.admin && <span>— {entry.admin}</span>}
            <span>— {formatDateTime(entry.createdAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
