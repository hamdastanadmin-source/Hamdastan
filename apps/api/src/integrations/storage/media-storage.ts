/**
 * Where the media library's bytes live. The `media` module depends on this
 * port, never on a disk or a bucket, so moving the files to object storage
 * later is a second implementation bound in `server.ts` — nothing else.
 *
 * A key is the module's own `<id>-<version>.<format>`; it is never built
 * from anything a client sent.
 */
export interface MediaStorage {
  readonly name: string;
  /** Writes the whole file; a reader never sees it half-written. */
  write(key: string, bytes: Buffer): Promise<void>;
  /** The file, or null when it is not there. */
  read(key: string): Promise<Buffer | null>;
  /** Removes it; a missing file is not an error. */
  remove(key: string): Promise<void>;
}
