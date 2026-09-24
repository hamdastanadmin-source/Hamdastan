/**
 * Number formatting utilities.
 *
 * Separated from format.ts to work around a Turbopack per-export module
 * splitting + async script loading race condition. When format.ts exports
 * are split across chunks and loaded via async scripts, consumer chunks may
 * execute before the format module registers its exports, causing
 * "formatCompactNumber is not a function" at runtime.
 *
 * Keeping these small, self-contained (no cross-module imports) guarantees
 * Turbopack inlines them directly into each consumer chunk.
 */

const LOCALE = 'fa-IR';

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat(LOCALE).format(num);
}

/**
 * Format a number in compact notation for social metrics.
 * - < 1,000: plain Persian number (e.g. ۸۴۲)
 * - 1,000–999,999: XX.Xk (e.g. 54.4k)
 * - 1,000,000+: X.XXm (e.g. 1.34m)
 */
export function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '۰';
  if (num < 1_000) return new Intl.NumberFormat(LOCALE).format(num);
  if (num < 1_000_000) {
    const val = num / 1_000;
    const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '');
    return `${formatted}k`;
  }
  const val = num / 1_000_000;
  const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${formatted}m`;
}
