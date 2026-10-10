'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminActivityDetail } from '@hamdastan/types';
import { Badge, Button, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';
import { errorMessage } from '@/lib';

import { useActivityEditor, type ActivityEditorApi } from '../hooks/use-activity-editor';
import { EDITOR_STEPS, type EditorStepId } from '../utils/draft';
import { STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { AudienceStep } from './editor/AudienceStep';
import { DetailsStep } from './editor/DetailsStep';
import { PreviewStep } from './editor/PreviewStep';
import { QuestionsStep } from './editor/QuestionsStep';
import { ScheduleStep } from './editor/ScheduleStep';
import { TypeStep } from './editor/TypeStep';
import { XpStep } from './editor/XpStep';

const STEP_VIEWS: Record<EditorStepId, (props: { editor: ActivityEditorApi }) => React.ReactNode> = {
  type: TypeStep,
  details: DetailsStep,
  questions: QuestionsStep,
  audience: AudienceStep,
  xp: XpStep,
  schedule: ScheduleStep,
  preview: PreviewStep,
};

/** The selected step is told by weight and a foreground rule — never the brand colour. */
const STEP_TRIGGER =
  'shrink-0 px-3 data-[state=active]:border-foreground data-[state=active]:text-foreground';

/**
 * The activity builder — seven steps, one screen. Any step can be opened;
 * «بعدی»/«قبلی» walk them in order. «ذخیره» keeps a draft (or, once live,
 * writes a new version); the last step's primary action publishes.
 */
export function ActivityEditor({
  initial,
  initialStep = 'type',
}: {
  initial?: AdminActivityDetail;
  initialStep?: EditorStepId;
}) {
  const router = useRouter();
  const editor = useActivityEditor(initial);
  const can = useAdminCan();
  const canWrite = can('activities.write');
  const canPublish = can('activities.publish');
  const [step, setStep] = useState<EditorStepId>(initialStep);
  const index = EDITOR_STEPS.findIndex((s) => s.id === step);
  const live = editor.saved !== null && editor.saved.status !== 'draft';

  const goTo = (next: EditorStepId) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const run = async (publish: boolean) => {
    try {
      const outcome = publish ? await editor.saveAndPublish() : await editor.save();
      if ('step' in outcome) {
        goTo(outcome.step);
        toast.error('چند مورد نیاز به اصلاح داره');
        return;
      }
      const { detail } = outcome;
      toast.success(
        publish && detail.status !== 'draft'
          ? `«${detail.title}» ${STATUS_LABELS[detail.status]} شد`
          : live
            ? `تغییرات ذخیره شد — نسخه‌ی ${toPersianDigits(detail.version)}`
            : 'پیش‌نویس ذخیره شد'
      );
      if (publish) router.push(`/engagement/${detail.id}`);
      else if (!initial) router.replace(`/engagement/${detail.id}/edit?step=${step}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const View = STEP_VIEWS[step];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/engagement">
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              استودیو
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {initial ? 'ویرایش فعالیت' : 'فعالیت جدید'}
            {editor.saved && (
              <Badge variant={STATUS_BADGE[editor.saved.status]}>{STATUS_LABELS[editor.saved.status]}</Badge>
            )}
          </h1>
          {live && (
            <p className="text-sm text-muted-foreground">
              این فعالیت منتشر شده؛ ذخیره یک نسخه‌ی جدید می‌سازه و پاسخ‌ها و XPهای قبلی دست نمی‌خورن.
            </p>
          )}
        </div>
        {canWrite && (
          <Button variant="outline" onClick={() => run(false)} loading={editor.busy}>
            ذخیره
          </Button>
        )}
      </div>

      <Tabs value={step} onValueChange={(value) => goTo(value as EditorStepId)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {EDITOR_STEPS.map((s, i) => (
            <TabsTrigger key={s.id} value={s.id} className={STEP_TRIGGER}>
              {toPersianDigits(i + 1)}. {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={step} className="mt-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <View editor={editor} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={index === 0} onClick={() => goTo(EDITOR_STEPS[index - 1].id)}>
          {/* RTL: the previous step lies towards the reading start, on the right. */}
          <ChevronRight aria-hidden="true" />
          قبلی
        </Button>
        {/* Keyed apart, so the outline «بعدی» is not animated into the primary action. */}
        {step === 'preview' ? (
          // Without both permissions the preview is read-only: the API would refuse the save.
          canWrite && canPublish ? (
            <Button key="publish" onClick={() => run(true)} loading={editor.busy}>
              {live ? 'ذخیره‌ی تغییرات' : editor.state.startsAt && new Date(editor.state.startsAt) > new Date() ? 'زمان‌بندی انتشار' : 'انتشار'}
            </Button>
          ) : null
        ) : (
          <Button key="next" variant="outline" onClick={() => goTo(EDITOR_STEPS[index + 1].id)}>
            بعدی
            <ChevronLeft aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
