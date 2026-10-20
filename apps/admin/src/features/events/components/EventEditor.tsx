'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminEventDetail, EventStatusAction, EventStatusInput } from '@hamdastan/types';
import { Badge, Button, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';
import { errorMessage } from '@/lib';

import { useEventEditor } from '../hooks/use-event-editor';
import { useEventOptions } from '../hooks/use-event-options';
import { EDITOR_SECTIONS, type EditorSectionId } from '../utils/draft';
import { STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { BookingsPanel } from './BookingsPanel';
import { AudienceSection } from './editor/AudienceSection';
import { BasicsSection } from './editor/BasicsSection';
import { BookingSection } from './editor/BookingSection';
import { MediaSection } from './editor/MediaSection';
import { OrganizerSection } from './editor/OrganizerSection';
import { PublishSection } from './editor/PublishSection';
import { ScheduleSection } from './editor/ScheduleSection';
import type { SectionProps } from './editor/types';
import { VenueSection } from './editor/VenueSection';
import { EventStatusDialog } from './EventStatusDialog';

type TabId = EditorSectionId | 'bookings';

const SECTION_VIEWS: Record<Exclude<EditorSectionId, 'publish'>, (props: SectionProps) => ReactNode> = {
  basics: BasicsSection,
  media: MediaSection,
  audience: AudienceSection,
  schedule: ScheduleSection,
  venue: VenueSection,
  organizer: OrganizerSection,
  booking: BookingSection,
};

/** The selected tab is told by weight and a foreground rule — never the brand colour. */
const TAB_TRIGGER = 'shrink-0 px-3 data-[state=active]:border-foreground data-[state=active]:text-foreground';

const SUCCESS: Record<EventStatusAction, string> = {
  publish: 'منتشر شد',
  unpublish: 'انتشار لغو شد',
  cancel: 'لغو شد',
  archive: 'بایگانی شد',
};

/**
 * The event editor: eight sections on one screen, any of them open at a
 * time, and — once saved — the event's bookings. «ذخیره» keeps the event
 * as it is (a draft may be incomplete); the «انتشار» section publishes,
 * schedules and takes it back. A problem opens the section it is in.
 */
export function EventEditor({ initial, initialTab = 'basics', worldId }: { initial?: AdminEventDetail; initialTab?: TabId; worldId?: string }) {
  const router = useRouter();
  const can = useAdminCan();
  const editor = useEventEditor(initial, worldId);
  const { categories, worlds } = useEventOptions();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [confirming, setConfirming] = useState<EventStatusAction | null>(null);
  const status = editor.saved?.status;
  const writable = can('events.write') && status !== 'archived';

  const goTo = (next: TabId) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    try {
      const outcome = await editor.save();
      if ('section' in outcome) {
        goTo(outcome.section);
        toast.error('چند مورد نیاز به اصلاح دارد');
        return;
      }
      toast.success(initial || editor.saved ? 'تغییرات ذخیره شد' : 'پیش‌نویس ذخیره شد');
      if (!initial) router.replace(`/events/${outcome.detail.id}/edit`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const runStatus = async (input: EventStatusInput) => {
    try {
      const outcome = await editor.changeStatus(input);
      if ('section' in outcome) {
        goTo(outcome.section);
        toast.error('برای این کار، چند مورد نیاز به اصلاح دارد');
        return;
      }
      const { detail } = outcome;
      toast.success(
        input.action === 'publish' && detail.status === 'scheduled' ? 'انتشار زمان‌بندی شد' : `«${detail.title}» ${SUCCESS[input.action]}`
      );
      if (!initial) router.replace(`/events/${detail.id}/edit?tab=publish`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const sectionProps: SectionProps = { editor, categories, worlds };
  const View = SECTION_VIEWS[tab === 'bookings' || tab === 'publish' ? 'basics' : tab];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/events">
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              رویدادها
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {initial ? 'ویرایش رویداد' : 'رویداد جدید'}
            {status && <Badge variant={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>}
          </h1>
          {status === 'archived' && <p className="text-sm text-muted-foreground">رویداد بایگانی‌شده قابل ویرایش نیست.</p>}
        </div>
        {writable && (
          <Button variant="outline" onClick={save} loading={editor.busy}>
            ذخیره
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(value) => goTo(value as TabId)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {EDITOR_SECTIONS.map((section) => (
            <TabsTrigger key={section.id} value={section.id} className={TAB_TRIGGER}>
              {section.label}
            </TabsTrigger>
          ))}
          {editor.saved && (
            <TabsTrigger value="bookings" className={TAB_TRIGGER}>
              رزروها
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              {tab === 'bookings' && editor.saved ? (
                <BookingsPanel eventId={editor.saved.id} />
              ) : tab === 'publish' ? (
                <PublishSection
                  {...sectionProps}
                  onGoTo={goTo}
                  onStatus={(input) => (input.action === 'publish' ? runStatus(input) : setConfirming(input.action))}
                />
              ) : (
                <View {...sectionProps} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EventStatusDialog
        key={confirming ?? 'none'}
        pending={confirming && { action: confirming, title: editor.state.title }}
        onCancel={() => setConfirming(null)}
        onConfirm={async (input) => {
          await runStatus(input);
          setConfirming(null);
        }}
      />
    </div>
  );
}
