import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { MediaStorage } from './media-storage';

/** Keys are `<uuid>-<n>.<format>`: nothing else is ever a path on this disk. */
const SAFE_KEY = /^[0-9a-f-]{36}-\d+\.[a-z0-9]{2,6}$/;

function resolve(directory: string, key: string): string {
  if (!SAFE_KEY.test(key)) throw new Error(`media storage: refused key "${key}"`);
  return path.join(directory, key);
}

/**
 * The media library on a local directory — the API container's `media`
 * volume in production (`MEDIA_DIR`). A file is written under a temporary
 * name and renamed into place, which is atomic on one filesystem.
 */
export function createLocalMediaStorage(directory: string): MediaStorage {
  let ready: Promise<unknown> | null = null;
  const ensureDirectory = () => (ready ??= mkdir(directory, { recursive: true }));

  return {
    name: 'local',

    async write(key, bytes) {
      await ensureDirectory();
      const target = resolve(directory, key);
      const temporary = path.join(directory, `.${randomUUID()}.tmp`);
      await writeFile(temporary, bytes, { mode: 0o640 });
      await rename(temporary, target);
    },

    async read(key) {
      try {
        return await readFile(resolve(directory, key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },

    async remove(key) {
      await rm(resolve(directory, key), { force: true });
    },
  };
}
