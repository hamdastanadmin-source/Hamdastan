import type { MediaFormat } from '@hamdastan/types';

/**
 * What a file really is, read from its bytes — never from its name or the
 * type a browser claimed. Pure; the media service calls it on every upload
 * and replacement.
 *
 * Images and videos are recognised by their signatures. A Lottie file is
 * JSON, so it is parsed and must look like an animation: a version, frame
 * rate, in and out points, a size and a list of layers. Anything else —
 * SVG, GIF, HTML, a script — is not in the library.
 */

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (bytes: Buffer, from: number, to: number) => bytes.subarray(from, to).toString('latin1');

function isLottie(bytes: Buffer): boolean {
  // JSON starts with `{`, after optional whitespace or a UTF-8 BOM.
  const text = bytes.toString('utf8').replace(/^﻿/, '').trimStart();
  if (!text.startsWith('{')) return false;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return (
      typeof data.v === 'string' &&
      typeof data.fr === 'number' &&
      typeof data.ip === 'number' &&
      typeof data.op === 'number' &&
      typeof data.w === 'number' &&
      typeof data.h === 'number' &&
      Array.isArray(data.layers)
    );
  } catch {
    return false;
  }
}

export function sniffMedia(bytes: Buffer): MediaFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  // EBML header; WebM declares its doc type in it.
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && ascii(bytes, 0, 64).includes('webm')) return 'webm';
  // ISO base media: an `ftyp` box first, with an MP4 brand.
  if (ascii(bytes, 4, 8) === 'ftyp' && /^(isom|iso\d|mp4\d|avc1|M4V |mp41|mp42|dash)$/.test(ascii(bytes, 8, 12))) return 'mp4';
  if (isLottie(bytes)) return 'lottie';
  return null;
}
