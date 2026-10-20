import Link from 'next/link';

import type { WorldHomeBlock } from '@hamdastan/types';

import { ActivityCard } from '@/features/activities';
import { ArticleCard } from '@/features/content';
import { EventCard } from '@/features/events';

import { tabHref } from '../utils/tabs';
import { WorldEmpty } from './WorldEmpty';

/** The items of one block, each in its own card. */
function Items({ block }: { block: WorldHomeBlock }) {
  switch (block.kind) {
    case 'news':
    case 'knowledge':
      return block.items.map((card) => (
        <li key={card.id}>
          <ArticleCard card={card} />
        </li>
      ));
    case 'events':
      return block.items.map((card) => (
        <li key={card.id}>
          <EventCard card={card} layout="row" />
        </li>
      ));
    case 'activities':
      return block.items.map((card) => (
        <li key={card.id}>
          <ActivityCard card={card} />
        </li>
      ));
  }
}

/**
 * A world's home: the sections the admin arranged, in their order, each
 * with the items the API found eligible — featured or newest — and «همه»
 * to the section's tab. A section the admin asked to keep when empty says
 * «فعلاً چیزی نیست»; one asked to hide never arrives.
 * `linked` is off in a preview, whose tabs are not pages.
 */
export function WorldHomeSections({ slug, sections, linked = true }: { slug: string; sections: WorldHomeBlock[]; linked?: boolean }) {
  if (sections.length === 0) return <WorldEmpty>این دنیا هنوز محتوایی برای نمایش نداره؛ به‌زودی برگرد.</WorldEmpty>;

  return sections.map((block) => (
    <section key={block.kind} className="flex flex-col gap-3" aria-labelledby={`world-section-${block.kind}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`world-section-${block.kind}`} className="text-lg font-bold leading-tight">
          {block.title}
        </h2>
        {linked && block.items.length > 0 && (
          <Link href={tabHref(slug, block.kind)} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            همه
          </Link>
        )}
      </div>
      {block.items.length === 0 ? (
        <WorldEmpty>فعلاً چیزی نیست</WorldEmpty>
      ) : (
        <ul className="flex flex-col gap-3">
          <Items block={block} />
        </ul>
      )}
    </section>
  ));
}
