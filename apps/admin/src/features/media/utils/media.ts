import { MEDIA_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/** «۱۲۸ کیلوبایت». */
export function formatSize(bytes: number): string {
  return `${toPersianDigits(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
}

/** A file's name without its extension — the library name an upload starts with. */
export const nameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, '').slice(0, MEDIA_LIMITS.NAME_MAX);

/**
 * What can be said about a chosen file before it is sent: only its size —
 * 512 KB for what the browser calls an image, 250 KB for anything else. Its
 * type is decided by the API from its bytes, whatever the browser says.
 */
export function tooLarge(file: File): string | null {
  const limit = file.type.startsWith('image/') ? MEDIA_LIMITS.IMAGE_MAX_BYTES : MEDIA_LIMITS.MAX_BYTES;
  return file.size > limit ? `حجم این فایل ${formatSize(file.size)} است؛ حداکثر ${formatSize(limit)} مجاز است` : null;
}
