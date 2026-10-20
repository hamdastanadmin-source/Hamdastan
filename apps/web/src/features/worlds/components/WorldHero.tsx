import Image from 'next/image';
import { Globe } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { WorldDetail } from '@hamdastan/types';

import { MediaImage } from '@/components';

import { BUILT_IN_ARTWORK } from '../utils/artwork';
import { THEME_BAND } from '../utils/tabs';

/**
 * The top of a world's page: its cover (or the artwork it shipped with), then a band in the world's theme
 * tint with its logo, name and tagline (its summary when it has none). The words are the foreground on the
 * tint, so they read on every theme, light or dark.
 */
export function WorldHero({ world }: { world: WorldDetail }) {
  const builtIn = world.coverId ? undefined : BUILT_IN_ARTWORK[world.slug];
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border">
      {builtIn ? (
        <div className="relative aspect-[3/1] w-full bg-muted">
          <Image src={builtIn.src} alt="" fill sizes="(max-width: 430px) 100vw, 430px" className="object-cover" priority />
        </div>
      ) : (
        <MediaImage id={world.coverId} alt="" fallback={<Globe aria-hidden="true" />} className="aspect-[3/1] w-full" priority />
      )}
      <div className={cn('flex items-center gap-3 p-4', THEME_BAND[world.theme])}>
        {world.logoId && <MediaImage id={world.logoId} alt="" fallback={null} className="size-12 shrink-0 rounded-xl border border-border" />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-extrabold leading-tight text-balance">{world.name}</h1>
          {(world.tagline || world.summary) && <p className="text-sm leading-relaxed text-muted-foreground">{world.tagline || world.summary}</p>}
        </div>
      </div>
    </div>
  );
}
