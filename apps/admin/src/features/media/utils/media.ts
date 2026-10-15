import { MEDIA_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/** «۱۲۸ کیلوبایت». */
export function formatSize(bytes: number): string {
  return `${toPersianDigits(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
}

/** A file's name without its extension — the library name an upload starts with. */
export const nameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, '').slice(0, MEDIA_LIMITS.NAME_MAX);

/**
 * What can be said about a chosen file before it is sent: only its size.
 * Its type is decided by the API from its bytes, whatever the browser says.
 */
export function tooLarge(file: File): string | null {
  return file.size > MEDIA_LIMITS.MAX_BYTES
    ? `حجم این فایل ${formatSize(file.size)}ه؛ حداکثر ${formatSize(MEDIA_LIMITS.MAX_BYTES)} مجازه`
    : null;
}
