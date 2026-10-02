/**
 * Persian text normalisation.
 *
 * Every string a Persian keyboard produces has more than one legitimate
 * encoding: digits come in three scripts, and the Arabic ي/ك sit next to the
 * Persian ی/ک on most layouts. Normalising once, here, is what lets the rest
 * of the product compare, validate and store a single form — the front-end
 * cleans the field as it is typed and the backend re-runs the same functions
 * on the way in, because a client is never the last word on input.
 */

/** ۰-۹ (Persian) and ٠-٩ (Arabic-Indic), in code-point order. */
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const LATIN_DIGITS = '0123456789';

/** Arabic letters that share a key with their Persian counterpart. */
const ARABIC_TO_PERSIAN_LETTERS: Record<string, string> = {
  'ي': 'ی',
  'ك': 'ک',
  'ﻻ': 'لا',
  'ٱ': 'ا',
  'أ': 'ا',
  'إ': 'ا',
  'ة': 'ه',
};

/** Rewrites Persian and Arabic-Indic digits as 0-9. */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    if (persian !== -1) return LATIN_DIGITS[persian];
    return LATIN_DIGITS[ARABIC_DIGITS.indexOf(digit)];
  });
}

/** Rewrites 0-9 as ۰-۹, for display only — never for a value being stored. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/**
 * The canonical form of a name or any other free-text Persian field:
 * Latin digits, Persian letters, collapsed whitespace, trimmed. The
 * zero-width non-joiner (U+200C) survives — it is a letter-joining rule in
 * Persian, not whitespace, and "نام‌خانوادگی" is spelled with it.
 */
export function normalizePersianText(value: string): string {
  return toLatinDigits(value)
    .replace(/[يكﻻٱأإة]/g, (letter) => ARABIC_TO_PERSIAN_LETTERS[letter] ?? letter)
    .replace(/[ً-ْ]/g, '') // Arabic diacritics: invisible, and never typed deliberately here.
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

/**
 * The one stored form of an Iranian mobile number: `09` followed by nine
 * digits. Accepts every way a person writes their own number — `+98 912…`,
 * `0098…`, `912…`, with spaces or dashes — and returns null for anything
 * that is not one of them, so the caller never has to guess.
 */
export function normalizeIranMobile(value: string): string | null {
  const digits = toLatinDigits(value).replace(/[\s()-]/g, '').replace(/^\+/, '00');

  const national = digits.startsWith('0098')
    ? digits.slice(4)
    : digits.startsWith('98')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  // What remains must be a mobile subscriber number: 9 then nine digits.
  return /^9\d{9}$/.test(national) ? `0${national}` : null;
}

/** Length of the stored form, `09` plus nine digits. */
export const IRAN_MOBILE_LENGTH = 11;

/**
 * What the mobile field holds while it is being typed: Latin digits only, at
 * most eleven of them. A complete number pasted in any accepted form
 * (`+98 912…`) is normalised first, so it is not truncated into nonsense.
 */
export function toMobileInput(value: string): string {
  return (
    normalizeIranMobile(value) ??
    toLatinDigits(value).replace(/\D/g, '').slice(0, IRAN_MOBILE_LENGTH)
  );
}
