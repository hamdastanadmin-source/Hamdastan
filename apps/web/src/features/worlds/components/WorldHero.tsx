import Image from 'next/image';
import { Globe } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { WorldDetail } from '@hamdastan/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@hamdastan/ui';

import { MediaImage } from '@/components';
import { paragraphsOf } from '@/features/content';

import { BUILT_IN_ARTWORK } from '../utils/artwork';
import { THEME_BAND } from '../utils/theme';

/**
 * The top of a world's page, one card: its cover (or the artwork it shipped with), then a band in the world's
 * theme tint with its name and tagline (its summary when it has none), and — when the world has a description —
 * «درباره‌ی …» folded at the card's foot, closed until asked. The words are the foreground on the tint, so they
 * read on every theme, light or dark.
 */
export function WorldHero({ world }: { world: WorldDetail }) {
  const builtIn = world.coverId ? undefined : BUILT_IN_ARTWORK[world.slug];
  const band = THEME_BAND[world.theme];
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border">
      {builtIn ? (
        <div className="relative aspect-[3/1] w-full bg-muted">
          <Image src={builtIn.src} alt="" fill sizes="(max-width: 430px) 100vw, 430px" className="object-cover" priority />
        </div>
      ) : (
        <MediaImage id={world.coverId} alt="" fallback={<Globe aria-hidden="true" />} className="aspect-[3/1] w-full" priority />
      )}
      <div className={cn('flex flex-col gap-0.5 p-4', band)}>
        <h1 className="text-xl font-extrabold leading-tight text-balance">{world.name}</h1>
        {(world.tagline || world.summary) && <p className="text-sm leading-relaxed text-muted-foreground">{world.tagline || world.summary}</p>}
      </div>
      {world.description && (
        <Accordion type="single" collapsible className={cn('border-t border-border px-4', band)}>
          <AccordionItem value="about">
            <AccordionTrigger className="min-h-11 items-center py-3 font-semibold hover:no-underline">درباره‌ی {world.name}</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2">
              {paragraphsOf(world.description).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line leading-loose text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
