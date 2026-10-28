'use client';

import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { JourneyPreview as Preview, PlayerActivity, PlayerJourney } from '@hamdastan/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import type { JourneyPlayerOptions } from '../../hooks/use-journey-player';
import { previewResult, simulateAnswer } from '../../utils/preview';
import { JourneyPlayer } from './JourneyPlayer';

type Scenario = 'timeline' | 'locked' | 'cover' | 'questions' | 'dayEnd' | 'result';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'timeline', label: 'تایم‌لاین' },
  { id: 'locked', label: 'روز قفل' },
  { id: 'cover', label: 'کاور' },
  { id: 'questions', label: 'سؤال‌ها' },
  { id: 'dayEnd', label: 'پایان روز' },
  { id: 'result', label: 'کارت نهایی' },
];

const TOGGLE = 'flex-none px-2.5 text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground/10';

/** The journey with every day before `number` done — how the day-end page and the card find it. */
function doneUpTo(journey: PlayerJourney, number: number, finished: boolean): PlayerJourney {
  const days = journey.days.map((day) =>
    day.number <= number ? { ...day, status: 'completed' as const, answeredCount: day.questionCount } : day
  );
  return {
    ...journey,
    days,
    completedDays: days.filter((day) => day.status === 'completed').length,
    completedAt: finished ? new Date().toISOString() : null,
  };
}

/**
 * The admin's full preview of a journey, in the product itself: any day, as
 * a locked day, its cover, its questions with their motions, its end page
 * and invitation, the character card — on a phone frame or as a desktop
 * shows it. Every answer here is simulated in the browser; nothing reaches
 * the API, so no answer and no XP is ever recorded.
 */
export function JourneyPreview({ preview }: { preview: Preview }) {
  const { activity: base, definition } = preview;
  const days = base.journey!.days;
  const characters = definition.journey?.result?.enabled ? definition.journey.result.characters : [];
  const [dayId, setDayId] = useState(days[0].id);
  const [scenario, setScenario] = useState<Scenario>('timeline');
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [characterId, setCharacterId] = useState<string | null>(characters[0]?.id ?? null);
  // When the preview opened: what «before its time» is measured from.
  const [openedAt] = useState(() => Date.now());
  const day = days.find((d) => d.id === dayId)!;
  const last = day.number === days.length;

  const { activity, options } = useMemo((): { activity: PlayerActivity; options: JourneyPlayerOptions } => {
    const journey = base.journey!;
    const send: JourneyPlayerOptions['send'] = async (questionId, value, current) =>
      simulateAnswer(base, definition, current, questionId, value);

    switch (scenario) {
      case 'locked': {
        // Shown as it would be before its time: its own opening time, or tomorrow if that has passed.
        const opens =
          day.unlocksAt && new Date(day.unlocksAt).getTime() > openedAt
            ? day.unlocksAt
            : new Date(openedAt + 86_400_000).toISOString();
        return {
          activity: {
            ...base,
            steps: base.steps.filter((step) => step.id !== dayId),
            journey: {
              ...journey,
              days: journey.days.map((d) =>
                d.id === dayId ? { ...d, title: null, status: 'locked', lockReason: 'schedule', unlocksAt: opens } : d
              ),
              nextUnlockAt: opens,
            },
          },
          options: { send },
        };
      }
      case 'cover':
        return { activity: base, options: { send, start: { view: 'cover', dayId } } };
      case 'questions':
        return { activity: base, options: { send, start: { view: 'question', dayId } } };
      case 'dayEnd': {
        const rewards = journey.rewards;
        const xpToday = rewards ? rewards.perQuestion * day.questionCount + rewards.perDay : 0;
        return {
          activity: { ...base, journey: doneUpTo(journey, day.number, last) },
          options: { send, start: { view: 'dayEnd', dayId, dayEnd: { dayNumber: day.number, xpToday, journeyCompleted: last } } },
        };
      }
      case 'result':
        return {
          activity: {
            ...base,
            journey: { ...doneUpTo(journey, days.length, true), result: previewResult(definition, characterId) },
          },
          options: { send, start: { view: 'result', dayId: null } },
        };
      default:
        return { activity: base, options: { send } };
    }
  }, [base, definition, scenario, dayId, day, last, days.length, characterId, openedAt]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-40 flex flex-col gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye aria-hidden="true" className="size-3.5" />
          پیش‌نمایش «{base.title}» — هیچ پاسخ یا XPی ثبت نمی‌شه.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dayId} onValueChange={setDayId}>
            <SelectTrigger className="h-8 w-32 text-xs" aria-label="روز">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  روز {toPersianDigits(d.number)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={device}
            onValueChange={(value) => value && setDevice(value as 'mobile' | 'desktop')}
            variant="outline"
            size="sm"
            aria-label="نما"
          >
            <ToggleGroupItem value="mobile" className={TOGGLE}>
              موبایل
            </ToggleGroupItem>
            <ToggleGroupItem value="desktop" className={TOGGLE}>
              دسکتاپ
            </ToggleGroupItem>
          </ToggleGroup>
          {scenario === 'result' && characters.length > 0 && (
            <Select value={characterId ?? undefined} onValueChange={setCharacterId}>
              <SelectTrigger className="h-8 w-32 text-xs" aria-label="شخصیت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || 'بی‌نام'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <ToggleGroup
          type="single"
          value={scenario}
          onValueChange={(value) => value && setScenario(value as Scenario)}
          variant="outline"
          size="sm"
          className="flex w-full flex-wrap justify-start"
          aria-label="صفحه"
        >
          {SCENARIOS.filter((s) => s.id !== 'result' || characters.length > 0).map((s) => (
            <ToggleGroupItem key={s.id} value={s.id} className={TOGGLE}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className={cn('flex-1', device === 'mobile' && 'py-4')}>
        <div
          // The frame, not the page, is what the player scrolls back to the top.
          data-scroll-root={device === 'mobile' ? '' : undefined}
          className={cn(
            device === 'mobile' &&
              // A phone-sized frame; the transform makes it the box the player's overlays fill.
              'mx-auto h-[844px] max-h-[80dvh] w-[390px] max-w-full overflow-y-auto rounded-3xl border shadow-sm [transform:translateZ(0)]'
          )}
        >
          <JourneyPlayer key={`${scenario}:${dayId}:${characterId}`} activity={activity} preview={options} />
        </div>
      </div>
    </div>
  );
}
