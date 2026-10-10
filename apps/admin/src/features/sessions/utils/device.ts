/**
 * A short, readable name for a user agent: «آیفون · Safari». Good enough
 * to tell one person's devices apart; not a parser, and it does not try to be.
 */

const PLATFORMS: Array<[RegExp, string]> = [
  [/iPhone|iPad|iPod/i, 'آیفون'],
  [/Android/i, 'اندروید'],
  [/Windows/i, 'ویندوز'],
  [/Mac OS X|Macintosh/i, 'مک'],
  [/Linux/i, 'لینوکس'],
];

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'نامشخص';
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return [platform, browser].filter(Boolean).join(' · ') || 'نامشخص';
}
