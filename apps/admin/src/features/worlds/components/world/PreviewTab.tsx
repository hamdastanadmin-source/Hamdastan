'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, ExternalLink, RefreshCw } from 'lucide-react';

import { WEB_BASE_URL } from '@hamdastan/config';

import type { WorldHome, WorldHomeBlock } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, Skeleton } from '@hamdastan/ui';

import { MediaPreview, useMediaAsset } from '@/features/media';
import { errorMessage, formatDateTime } from '@/lib';
import { adminWorldsService } from '@/services';

/** One line under an item's title: when for an event, the summary for the rest. */
function detailOf(block: WorldHomeBlock, index: number): string {
  if (block.kind === 'events') return formatDateTime(block.items[index].startAt);
  return block.items[index].summary;
}

/**
 * «پیش‌نمایش»: the world's home as the server builds it for a person — saved
 * settings only, whatever the world's status. Restricted events and
 * activities for a chosen audience reach only their audience, so they may
 * be missing here. Nothing is recorded.
 */
export function PreviewTab({ worldId }: { worldId: string }) {
  const [home, setHome] = useState<WorldHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const { asset: cover } = useMediaAsset(home?.world.coverId ?? null);

  useEffect(() => {
    let active = true;
    adminWorldsService.preview(worldId).then(
      (data) => {
        if (!active) return;
        setHome(data);
        setError(null);
      },
      (caught) => active && setError(errorMessage(caught))
    );
    return () => {
      active = false;
    };
  }, [worldId, reloads]);

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>پیش‌نمایش ساخته نشد</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setReloads((n) => n + 1)}>
            تلاش دوباره
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          خانه‌ی دنیا همان‌طور که سرور برای کاربر می‌سازد، از تنظیمات ذخیره‌شده. رویدادهای محدود و فعالیت‌های مخاطب خاص فقط به مخاطب خودشان نمایش داده می‌شوند.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloads((n) => n + 1)}>
            <RefreshCw aria-hidden="true" />
            به‌روزرسانی
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`${WEB_BASE_URL}/preview/worlds/${worldId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              نمای کامل در اپلیکیشن
            </a>
          </Button>
        </div>
      </div>

      {!home ? (
        <Skeleton className="mx-auto h-96 w-full max-w-shell" />
      ) : (
        <Card className="mx-auto w-full max-w-shell gap-0 overflow-hidden py-0">
          <div className="aspect-[3/1] bg-muted/50">{cover && <MediaPreview asset={cover} className="size-full" />}</div>
          <CardContent className="flex flex-col gap-4 p-4">
            <div>
              <h2 className="text-xl font-bold">{home.world.name}</h2>
              {home.world.tagline && <p className="text-sm text-muted-foreground">{home.world.tagline}</p>}
            </div>
            <nav aria-label="منوی دنیا" className="flex gap-4 overflow-x-auto border-b pb-2 text-sm">
              {home.world.navigation.map((item, index) => (
                <span key={item.section} className={index === 0 ? 'font-semibold' : 'text-muted-foreground'}>
                  {item.label}
                </span>
              ))}
            </nav>
            {home.sections.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">خانه‌ی این دنیا فعلاً بخشی برای نمایش ندارد.</p>}
            {home.sections.map((block) => (
              <section key={block.kind} className="flex flex-col gap-2">
                <h3 className="font-semibold">{block.title}</h3>
                {block.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">فعلاً چیزی نیست</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {block.items.map((item, index) => (
                      <li key={item.id} className="rounded-lg border p-3">
                        <p className="text-sm font-medium">{item.title}</p>
                        {detailOf(block, index) && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{detailOf(block, index)}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
