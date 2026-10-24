import Image from 'next/image';
import Link from 'next/link';

import type { World } from '@hamdastan/types';

import { MediaImage } from '@/components';

import { BUILT_IN_ARTWORK } from '../utils/artwork';

const BOX = 'block overflow-hidden rounded-2xl border border-border';

function Banner({ world }: { world: World }) {
  if (world.coverId) return <MediaImage id={world.coverId} alt={world.name} fallback={null} className="aspect-[3/1] w-full" />;
  const builtIn = BUILT_IN_ARTWORK[world.slug];
  if (builtIn) {
    return <Image src={builtIn.src} alt={builtIn.alt} width={1290} height={344} sizes="(max-width: 430px) 100vw, 430px" className="h-auto w-full" />;
  }
  return <span className="flex aspect-[3/1] w-full items-center justify-center bg-muted text-lg font-bold">{world.name}</span>;
}

/**
 * Home's world picker: every published world, in the admin's order, each
 * its cover — or the artwork it shipped with — and a link to its page.
 * Absent when there is none to show; home never fails because of it.
 */
export function WorldBanners({ worlds }: { worlds: World[] }) {
  if (worlds.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="world-picker">
      <h2 id="world-picker" className="text-lg font-bold leading-tight">
        دنیای داستانی‌ات رو انتخاب کن
      </h2>
      <ul className="flex flex-col gap-3">
        {worlds.map((world) => (
          <li key={world.id}>
            <Link href={`/worlds/${world.slug}`} aria-label={world.name} className={`${BOX} outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              <Banner world={world} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
