import Link from 'next/link';
import { Eye } from 'lucide-react';

import { APP_NAME, WORLD_SECTION_LABELS, WORLD_STATUS_LABELS } from '@hamdastan/config';
import type { WorldHome } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader } from '@/components';
import { ActivityCard } from '@/features/activities';
import { ArticleCard } from '@/features/content';
import { EventCard } from '@/features/events';

import {
  hasActivities,
  worldActivitiesHref,
  worldHref,
  worldListHref,
  type WorldActivitiesPage,
  type WorldHomePage,
  type WorldListPage,
} from '../utils/pages';
import { WorldEmpty } from './WorldEmpty';
import { WorldHero } from './WorldHero';
import { WorldHomeSections } from './WorldHomeSections';
import { WorldMenu } from './WorldMenu';
import { WorldPager } from './WorldPager';

const EMPTY: Record<WorldListPage['kind'] | 'activities', string> = {
  news: 'هنوز خبری منتشر نشده.',
  knowledge: 'هنوز دانستنی‌ای منتشر نشده.',
  events: 'فعلاً رویدادی در این دنیا نیست.',
  activities: 'فعلاً فعالیتی برای انجام دادن نیست.',
};

const FAILED = 'بارگذاری نشد؛ اتصال رو بررسی کن و دوباره امتحان کن.';
/**
 * `/worlds/:slug`: a world's home — its card (cover, name in its theme and,
 * folded, what the world is about), then the sections the admin arranged
 * with events leading — over the world's menu. The API has already decided the world is
 * published and what each section may hold.
 */
export function WorldHomeScreen({ page: { world, sections } }: { page: WorldHomePage }) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/" label={APP_NAME} />
      </ScreenHeader>
      <ScreenBody className="gap-6 pt-1">
        <WorldHero world={world} />
        {sections ? (
          <WorldHomeSections slug={world.slug} sections={sections} activities={hasActivities(world)} />
        ) : (
          <WorldEmpty retryHref={worldHref(world.slug)}>{FAILED}</WorldEmpty>
        )}
      </ScreenBody>
      <WorldMenu world={world} />
    </Screen>
  );
}

/** `/worlds/:slug/activities`: the world's «فعالیت‌ها» menu — every open activity filed under it that the person may take. */
export function WorldActivitiesScreen({ page: { world, cards } }: { page: WorldActivitiesPage }) {
  const label = world.navigation.find((item) => item.section === 'activities')?.label ?? WORLD_SECTION_LABELS.activities;
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/" label={APP_NAME} />
      </ScreenHeader>
      <ScreenBody className="gap-5 pt-1">
        <h1 className="text-xl font-extrabold leading-tight">
          {label} · {world.name}
        </h1>
        {!cards ? (
          <WorldEmpty retryHref={worldActivitiesHref(world.slug)}>{FAILED}</WorldEmpty>
        ) : cards.length === 0 ? (
          <WorldEmpty>{EMPTY.activities}</WorldEmpty>
        ) : (
          <ul className="flex flex-col gap-3">
            {cards.map((card) => (
              <li key={card.id}>
                <ActivityCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </ScreenBody>
      <WorldMenu world={world} />
    </Screen>
  );
}

/** The cards of one «همه» page, one under another. */
function ListItems({ list }: { list: WorldListPage }) {
  if (!list.page) return null;
  return (
    <ul className="flex flex-col gap-3">
      {list.kind === 'events'
        ? list.page.items.map((card) => (
            <li key={card.id}>
              <EventCard card={card} />
            </li>
          ))
        : list.page.items.map((card) => (
            <li key={card.id}>
              <ArticleCard card={card} />
            </li>
          ))}
    </ul>
  );
}

/**
 * `/worlds/:slug/news|knowledge|events`: a home section's «همه» — one step
 * down from the world's home, so it has a way back rather than the menu.
 */
export function WorldListScreen({ list }: { list: WorldListPage }) {
  const { world, kind, page } = list;
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href={worldHref(world.slug)} label={world.name} />
      </ScreenHeader>
      <ScreenBody className="gap-5 pt-1">
        <h1 className="text-xl font-extrabold leading-tight">{WORLD_SECTION_LABELS[kind]}</h1>
        {!page ? (
          <WorldEmpty retryHref={worldListHref(world.slug, kind)}>{FAILED}</WorldEmpty>
        ) : page.items.length === 0 ? (
          <WorldEmpty>{EMPTY[kind]}</WorldEmpty>
        ) : (
          <>
            <ListItems list={list} />
            <WorldPager page={page.page} total={page.total} pageSize={page.pageSize} hrefOf={(n) => worldListHref(world.slug, kind, n)} />
          </>
        )}
        {kind === 'events' && (
          <Link href={`/events?world=${world.slug}`} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            جست‌وجو و فیلتر در «رویدادها»
          </Link>
        )}
      </ScreenBody>
    </Screen>
  );
}

/** An admin's preview of a world's home, in any status: the same page, its links not followed. Nothing is recorded. */
export function WorldPreviewScreen({ home }: { home: WorldHome }) {
  return (
    <Screen>
      <ScreenBody className="gap-6 pt-4">
        <Alert>
          <Eye aria-hidden="true" />
          <AlertTitle>پیش‌نمایش</AlertTitle>
          <AlertDescription>
            وضعیت: {home.preview ? WORLD_STATUS_LABELS[home.preview.status] : '—'}. کاربرها این صفحه رو فقط بعد از انتشار دنیا می‌بینن؛ رویدادهای محدود و
            فعالیت‌های مخاطب خاص فقط به مخاطب خودشون نشون داده می‌شن.
          </AlertDescription>
        </Alert>
        <WorldHero world={home.world} />
        <WorldHomeSections slug={home.world.slug} sections={home.sections} activities={hasActivities(home.world)} linked={false} />
      </ScreenBody>
    </Screen>
  );
}
