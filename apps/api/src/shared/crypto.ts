import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * The secret-handling primitives the auth module is built from.
 *
 * They live in `shared/` rather than inside the module because "how a secret
 * is generated and compared" is a property of the API, not of one domain: the
 * next thing that issues a token — an invite link, a password reset — must
 * use the same three functions rather than a second, slightly different copy.
 */

/**
 * A numeric code of `length` digits, from the OS entropy source.
 *
 * `randomInt` rather than `Math.random`, and per digit rather than one range,
 * so the leading digit may be zero without the code losing a digit's worth of
 * entropy to padding.
 */
export function generateNumericCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += String(randomInt(0, 10));
  return code;
}

/** 256 bits of CSPRNG output, URL-safe. The value a cookie carries. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256, hex. What goes in the database.
 *
 * Unsalted and fast is right for these and wrong for a password: the inputs
 * are either 256 bits of random or a six-digit code bound to a phone number,
 * so there is no dictionary worth building. What the hash buys is that a
 * leaked table cannot be replayed at the API.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Hash of a one-time code, bound to the number it was issued for. The binding
 * is what stops a code observed for one number being presented for another.
 */
export function hashOtp(phone: string, code: string): string {
  return sha256(`${phone}:${code}`);
}

/** Constant-time comparison of two hex digests. */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
