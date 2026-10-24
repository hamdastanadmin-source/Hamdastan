import Link from 'next/link';
import { Eye, Newspaper } from 'lucide-react';

import { ARTICLE_KIND_LABELS } from '@hamdastan/config';
import type { ArticleDetail } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle } from '@hamdastan/ui';

import { MediaImage, Screen, ScreenBack, ScreenBody, ScreenHeader } from '@/components';

import { paragraphsOf, publishedOn } from '../utils/format';

const PREVIEW_STATUS: Record<string, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشرشده',
  unpublished: 'لغو انتشار',
  archived: 'بایگانی',
};

/**
 * `/articles/:slug`: one news item or knowledge article — cover, kind and
 * category, title, date, summary and the body, paragraph by paragraph —
 * and the worlds it belongs to. The API has already decided it is live; an
 * admin's preview carries a banner with where it stands.
 */
export function ArticleScreen({ article }: { article: ArticleDetail }) {
  const home = article.worlds[0];
  const back = home ? { href: `/worlds/${home.slug}/${article.kind}`, label: home.name } : { href: '/', label: 'خانه' };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href={back.href} label={back.label} />
      </ScreenHeader>

      <ScreenBody className="gap-5 pt-1">
        {article.preview && (
          <Alert>
            <Eye aria-hidden="true" />
            <AlertTitle>پیش‌نمایش</AlertTitle>
            <AlertDescription>
              وضعیت: {PREVIEW_STATUS[article.preview.status] ?? article.preview.status}. کاربرها این صفحه رو فقط بعد از انتشار می‌بینن.
            </AlertDescription>
          </Alert>
        )}

        {article.coverId && (
          <MediaImage id={article.coverId} alt={article.coverAlt} fallback={<Newspaper aria-hidden="true" />} className="aspect-video w-full rounded-2xl" priority />
        )}

        <header className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {ARTICLE_KIND_LABELS[article.kind]}
            {article.category && ` / ${article.category}`}
            {article.publishedAt && ` — ${publishedOn(article.publishedAt)}`}
          </p>
          <h1 className="text-2xl font-extrabold leading-tight text-balance">{article.title}</h1>
          {article.summary && <p className="text-sm leading-relaxed text-muted-foreground">{article.summary}</p>}
        </header>

        <div className="flex flex-col gap-4">
          {paragraphsOf(article.body).map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line text-base leading-loose">
              {paragraph}
            </p>
          ))}
        </div>

        {article.worlds.length > 0 && (
          <p className="flex flex-wrap gap-x-2 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">از دنیای</span>
            {article.worlds.map((world, index) => (
              <Link key={world.slug} href={`/worlds/${world.slug}`} className="font-semibold underline-offset-4 hover:underline">
                {world.name}
                {index < article.worlds.length - 1 && '،'}
              </Link>
            ))}
          </p>
        )}
      </ScreenBody>
    </Screen>
  );
}
