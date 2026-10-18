'use client';

import { CalendarDays, ClipboardList, Flag, GraduationCap, type LucideIcon } from 'lucide-react';

import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPES } from '@hamdastan/config';
import type { ActivityType } from '@hamdastan/types';
import { ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { switchType } from '../../utils/draft';

const TYPES: Record<ActivityType, { icon: LucideIcon; body: string }> = {
  survey: {
    icon: ClipboardList,
    body: 'چند سؤال از کاربران، با امکان پاسخ ناشناس. XP پس از ثبت پاسخ معتبر اعطا می‌شود.',
  },
  mission: {
    icon: Flag,
    body: 'یک کار چندمرحله‌ای همراه با مدرک انجام. XP پس از تکمیل — و در صورت تمایل، پس از تأیید شما — اعطا می‌شود.',
  },
  assessment: {
    icon: GraduationCap,
    body: 'آزمون دانشی یا شخصیت‌شناسی همراه با نتیجه. XP مستقل از نتیجه اعطا می‌شود، مگر اینکه شرط قبولی تعیین کنید.',
  },
  journey: {
    icon: CalendarDays,
    body: 'یک ماجرای چندروزه که هر روز یک مرحله‌ی تازه از آن باز می‌شود. XP برای هر پاسخ، هر روز و پایان چالش.',
  },
};

/** Step 1. Locked once the activity has been published: a survey cannot become a mission mid-flight. */
export function TypeStep({ editor }: { editor: ActivityEditorApi }) {
  const locked = editor.saved !== null && editor.saved.status !== 'draft';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {locked ? 'نوع فعالیتِ منتشرشده قابل تغییر نیست.' : 'چه نوع فعالیتی می‌خواهید بسازید؟'}
      </p>
      <ToggleGroup
        type="single"
        value={editor.state.type}
        onValueChange={(type) => type && editor.update(switchType(editor.state, type as ActivityType))}
        disabled={locked}
        spacing={3}
        className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
        aria-label="نوع فعالیت"
      >
        {ACTIVITY_TYPES.map((type) => {
          const { icon: Icon, body } = TYPES[type];
          return (
            <ToggleGroupItem
              key={type}
              value={type}
              className="h-auto flex-col items-start gap-2 whitespace-normal rounded-xl border p-4 text-start data-[state=on]:border-foreground data-[state=on]:bg-accent"
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="text-base font-semibold">{ACTIVITY_TYPE_LABELS[type]}</span>
              <span className="text-xs font-normal leading-relaxed text-muted-foreground">{body}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
