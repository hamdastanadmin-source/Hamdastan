/**
 * The artwork the first worlds shipped with, by slug — what the product
 * draws for one of them until an admin sets a cover. Sources live in
 * `assets/worlds/`; the files are larger than the media library takes.
 */
export const BUILT_IN_ARTWORK: Record<string, { src: string; alt: string }> = {
  hogwarts: { src: '/images/worlds/hogwarts-banner-v2.png', alt: 'هاگوارتز، هری پاتر' },
  gta: { src: '/images/worlds/gta-banner-v2.png', alt: 'جی تی ای' },
  'game-of-thrones': { src: '/images/worlds/game-of-thrones-banner-v2.png', alt: 'بازی تاج و تخت' },
  liverpool: { src: '/images/worlds/liverpool-banner.png', alt: 'لیورپول، تنها قدم نخواهی زد' },
};
