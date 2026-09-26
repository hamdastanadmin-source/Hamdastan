import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Passwords, as the API stores and checks them.
 *
 * Only the admin panel has passwords — the product itself is passwordless. It
 * lives in `shared/` rather than in a module because two modules need it:
 * `admin-auth` verifies and replaces a password, `admin-users` generates the
 * temporary one a new account starts with.
 *
 * **A plain password is never stored, logged or returned.** What goes into a
 * record is the string `hashPassword` returns, and the only thing that can be
 * done with it is `verifyPassword`.
 *
 * scrypt is used because it is in Node's standard library: no dependency, and
 * no argument about which password-hashing package to add before a data layer
 * is even chosen. The parameters are recorded inside the hash, so raising them
 * later does not invalidate the passwords already hashed with the old ones.
 */

/** OWASP's scrypt floor at the time of writing. */
const COST = 2 ** 14;
const BLOCK_SIZE = 8;
const PARALLELISATION = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** `scrypt$N$r$p$salt$key`, all base64url. Self-describing, so it can be re-tuned. */
const FORMAT = 'scrypt';

/**
 * `scrypt` with options, as a promise.
 *
 * Written out rather than promisified because `promisify`'s typing only sees
 * the three-argument overload, and the parameters are exactly what has to be
 * passed here.
 */
function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelisation: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      {
        N: cost,
        r: blockSize,
        p: parallelisation,
        // scrypt's own default (32 MiB) is below what N=2^14, r=8 needs.
        maxmem: 256 * 1024 * 1024,
      },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISATION);

  return [
    FORMAT,
    COST,
    BLOCK_SIZE,
    PARALLELISATION,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

/**
 * Whether a password matches a stored hash.
 *
 * Returns false rather than throwing for a malformed stored value: a corrupt
 * row must refuse the sign-in, not crash the request. The comparison is
 * constant-time, so a wrong password reveals nothing by how long it took.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== FORMAT) return false;

  const [, cost, blockSize, parallelisation, salt, key] = parts;
  const expected = Buffer.from(key, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(
    password,
    Buffer.from(salt, 'base64url'),
    Number(cost),
    Number(blockSize),
    Number(parallelisation)
  );

  return timingSafeEqual(actual, expected);
}

/**
 * A numeric password of `length` digits, from the CSPRNG.
 *
 * `randomInt` rather than `Math.random`, for the same reason one-time codes use
 * it: a password anybody can predict is not a password. Leading zeros are kept,
 * so every string of that length is equally likely.
 */
export function generateNumericPassword(length: number): string {
  return Array.from({ length }, () => String(randomInt(0, 10))).join('');
}
