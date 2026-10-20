import Link from 'next/link';
import { Eye } from 'lucide-react';

import { WORLD_STATUS_LABELS } from '@hamdastan/config';
import type { WorldHome } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader } from '@/components';
import { ActivityCard } from '@/features/activities';
import { ArticleCard, paragraphsOf } from '@/features/content';
import { EventCard } from '@/features/events';

import { tabHref, type WorldPage } from '../utils/tabs';
import { WorldEmpty } from './WorldEmpty';
import { WorldHero } from './WorldHero';
import { WorldHomeSections } from './WorldHomeSections';
import { WorldPager } from './WorldPager';
import { WorldTabs } from './WorldTabs';

const EMPTY: Record<'news' | 'knowledge' | 'events' | 'activities', string> = {
  news: 'هنوز خبری منتشر نشده.',
  knowledge: 'هنوز دانستنی‌ای منتشر نشده.',
  events: 'فعلاً رویدادی در این دنیا نیست.',
  activities: 'فعلاً فعالیتی برای انجام دادن نیست.',
};

const FAILED = 'بارگذاری نشد؛ اتصال رو بررسی کن و دوباره امتحان کن.';

/** The open tab's content. */
function TabContent({ page: { world, content } }: { page: WorldPage }) {
  const retry = tabHref(world.slug, content.tab);
  switch (content.tab) {
    case 'home':
      return (
        <>
          {content.sections ? <WorldHomeSections slug={world.slug} sections={content.sections} /> : <WorldEmpty retryHref={retry}>{FAILED}</WorldEmpty>}
          {world.description && (
            <section className="flex flex-col gap-2" aria-labelledby="world-about">
              <h2 id="world-about" className="text-lg font-bold leading-tight">
                درباره‌ی {world.name}
              </h2>
              {paragraphsOf(world.description).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line text-sm leading-loose text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          )}
        </>
      );
    case 'news':
    case 'knowledge': {
      const { page } = content;
      if (!page) return <WorldEmpty retryHref={retry}>{FAILED}</WorldEmpty>;
      if (page.items.length === 0) return <WorldEmpty>{EMPTY[content.tab]}</WorldEmpty>;
      return (
        <>
          <ul className="flex flex-col gap-3">
            {page.items.map((card) => (
              <li key={card.id}>
                <ArticleCard card={card} />
              </li>
            ))}
          </ul>
          <WorldPager page={page.page} total={page.total} pageSize={page.pageSize} hrefOf={(n) => tabHref(world.slug, content.tab, n)} />
        </>
      );
    }
    case 'events': {
      const { page } = content;
      if (!page) return <WorldEmpty retryHref={retry}>{FAILED}</WorldEmpty>;
      if (page.items.length === 0) return <WorldEmpty>{EMPTY.events}</WorldEmpty>;
      return (
        <>
          <ul className="flex flex-col gap-3">
            {page.items.map((card) => (
              <li key={card.id}>
                <EventCard card={card} />
              </li>
            ))}
          </ul>
          <WorldPager page={page.page} total={page.total} pageSize={page.pageSize} hrefOf={(n) => tabHref(world.slug, 'events', n)} />
          <Link href={`/events?world=${world.slug}`} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            جست‌وجو و فیلتر در «رویدادها»
          </Link>
        </>
      );
    }
    case 'activities':
      if (!content.cards) return <WorldEmpty retryHref={retry}>{FAILED}</WorldEmpty>;
      if (content.cards.length === 0) return <WorldEmpty>{EMPTY.activities}</WorldEmpty>;
      return (
        <ul className="flex flex-col gap-3">
          {content.cards.map((card) => (
            <li key={card.id}>
              <ActivityCard card={card} />
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * `/worlds/:slug`: one world — its cover and name in its theme, its menu of
 * tabs, and the open tab: the home the admin arranged, its news, knowledge,
 * events or activities. Every tab is an address. The API has already decided
 * the world is published and what each list may hold.
 */
export function WorldScreen({ page }: { page: WorldPage }) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/" label="خانه" />
      </ScreenHeader>
      <ScreenBody className="gap-5 pt-1">
        <WorldHero world={page.world} />
        <WorldTabs slug={page.world.slug} navigation={page.world.navigation} current={page.content.tab} />
        <TabContent page={page} />
      </ScreenBody>
    </Screen>
  );
}

/** An admin's preview of a world's home, in any status: the same page, its tabs not followed. Nothing is recorded. */
export function WorldPreviewScreen({ home }: { home: WorldHome }) {
  return (
    <Screen>
      <ScreenBody className="gap-5 pt-4">
        <Alert>
          <Eye aria-hidden="true" />
          <AlertTitle>پیش‌نمایش</AlertTitle>
          <AlertDescription>
            وضعیت: {home.preview ? WORLD_STATUS_LABELS[home.preview.status] : '—'}. کاربرها این صفحه رو فقط بعد از انتشار دنیا می‌بینن؛ رویدادهای محدود و
            فعالیت‌های مخاطب خاص فقط به مخاطب خودشون نشون داده می‌شن.
          </AlertDescription>
        </Alert>
        <WorldHero world={home.world} />
        <WorldTabs slug={home.world.slug} navigation={home.world.navigation} current="home" linked={false} />
        <WorldHomeSections slug={home.world.slug} sections={home.sections} linked={false} />
      </ScreenBody>
    </Screen>
  );
}
