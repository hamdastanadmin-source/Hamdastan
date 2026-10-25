import Link from 'next/link';

import type { WorldHomeBlock } from '@hamdastan/types';

import { ActivityCard } from '@/features/activities';
import { ArticleCard } from '@/features/content';
import { EventsCarousel } from '@/features/events';

import { worldActivitiesHref, worldListHref } from '../utils/pages';
import { WorldEmpty } from './WorldEmpty';

/** A block's items: events side by side in a carousel, the rest one under another. */
function Items({ block }: { block: WorldHomeBlock }) {
  switch (block.kind) {
    case 'events':
      return <EventsCarousel events={block.items} label={block.title} />;
    case 'news':
    case 'knowledge':
      return (
        <ul className="flex flex-col gap-3">
          {block.items.map((card) => (
            <li key={card.id}>
              <ArticleCard card={card} />
            </li>
          ))}
        </ul>
      );
    case 'activities':
      return (
        <ul className="flex flex-col gap-3">
          {block.items.map((card) => (
            <li key={card.id}>
              <ActivityCard card={card} withWorld={false} />
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * A world's home: the sections the API sends, events first, each with the
 * items it found eligible — featured or newest. «همه» opens the section's
 * own page; for activities that is the world's «فعالیت‌ها», when its menu
 * has it. A section the admin asked to keep when empty says «فعلاً چیزی
 * نیست»; one asked to hide never arrives. `linked` is off in a preview.
 */
export function WorldHomeSections({
  slug,
  sections,
  activities,
  linked = true,
}: {
  slug: string;
  sections: WorldHomeBlock[];
  /** Whether the world's menu has «فعالیت‌ها». */
  activities: boolean;
  linked?: boolean;
}) {
  if (sections.length === 0) return <WorldEmpty>این دنیا هنوز محتوایی برای نمایش نداره؛ به‌زودی برگرد.</WorldEmpty>;

  return sections.map((block) => {
    const all = block.kind === 'activities' ? (activities ? worldActivitiesHref(slug) : null) : worldListHref(slug, block.kind);
    return (
      <section key={block.kind} className="flex flex-col gap-3" aria-labelledby={`world-section-${block.kind}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={`world-section-${block.kind}`} className="text-lg font-bold leading-tight">
            {block.title}
          </h2>
          {linked && all && block.items.length > 0 && (
            <Link href={all} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              همه
            </Link>
          )}
        </div>
        {block.items.length === 0 ? <WorldEmpty>فعلاً چیزی نیست</WorldEmpty> : <Items block={block} />}
      </section>
    );
  });
}
