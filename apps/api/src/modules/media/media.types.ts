import type { MediaCategory, MediaFormat, MediaKind } from '@hamdastan/types';

/**
 * Types internal to the Media module. What leaves the API is in
 * `@hamdastan/types`; this is what the repository returns.
 */

export type MediaRecord = {
  id: string;
  kind: MediaKind;
  format: MediaFormat;
  category: MediaCategory;
  name: string;
  sizeBytes: number;
  sha256: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

/** A record, with how many activities refer to it. */
export type MediaListRecord = MediaRecord & { usage: number };

export type MediaListQuery = {
  category?: MediaCategory;
  kind?: MediaKind;
  search?: string;
  page: number;
  pageSize: number;
};

/** The file's own facts, read from its bytes. */
export type MediaFile = { kind: MediaKind; format: MediaFormat; sizeBytes: number; sha256: string };

/** The storage key of a file at a version. */
export const storageKey = (record: Pick<MediaRecord, 'id' | 'version' | 'format'>) =>
  `${record.id}-${record.version}.${record.format}`;
