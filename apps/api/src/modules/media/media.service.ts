import { createHash, randomUUID } from 'node:crypto';

import { MEDIA_FORMATS, MEDIA_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  MEDIA_ERROR_CODES as CODES,
  type MediaAsset,
  type MediaCategory,
  type MediaKind,
  type Paginated,
  type PlayerMedia,
} from '@hamdastan/types';

import type { MediaStorage } from '../../integrations';
import { AppError, NotFoundError } from '../../shared/errors';
import type { AdminRecord } from '../admin';

import { mediaRepository } from './media.repository';
import { sniffMedia } from './media.sniff';
import { storageKey, type MediaFile, type MediaListQuery, type MediaListRecord, type MediaRecord } from './media.types';

/**
 * Business logic for the media & motion library.
 *
 * Every file is checked here before a byte is kept: at most 250 KB, and one
 * of the six formats — decided from its bytes. Its row and its file are kept
 * apart (the row in the database, the bytes in `MediaStorage`), so each
 * write orders them to leave nothing behind on failure: the file is written
 * first under a key nobody refers to yet, and removed again if the row is
 * not.
 */

let storage: MediaStorage | null = null;

/** Binds where the bytes live. Called once, at boot. */
export function setMediaStorage(next: MediaStorage): void {
  storage = next;
}

function store(): MediaStorage {
  if (!storage) throw new AppError(503, 'MEDIA_STORAGE_UNAVAILABLE', 'محل ذخیره‌ی فایل‌ها در دسترس نیست');
  return storage;
}

const notFound = () => new NotFoundError('فایل پیدا نشد');

/** The file's facts, or why it is not taken. */
function readFile(base64: string): { file: MediaFile; bytes: Buffer } {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) throw new AppError(400, CODES.MEDIA_UNSUPPORTED, 'فایل خالیه');
  if (bytes.length > MEDIA_LIMITS.MAX_BYTES) {
    throw new AppError(
      413,
      CODES.MEDIA_TOO_LARGE,
      `حجم فایل باید حداکثر ${toPersianDigits(MEDIA_LIMITS.MAX_BYTES / 1024)} کیلوبایت باشه`
    );
  }
  const format = sniffMedia(bytes);
  if (!format) {
    throw new AppError(
      415,
      CODES.MEDIA_UNSUPPORTED,
      'فقط تصویر PNG، JPEG و WebP یا موشن Lottie (JSON)، WebM و MP4 پذیرفته می‌شه'
    );
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { bytes, file: { kind: MEDIA_FORMATS[format].kind, format, sizeBytes: bytes.length, sha256 } };
}

function toAsset(record: MediaListRecord): MediaAsset {
  return {
    id: record.id,
    kind: record.kind,
    format: record.format,
    category: record.category,
    name: record.name,
    sizeBytes: record.sizeBytes,
    version: record.version,
    usage: record.usage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function requireAsset(id: string): Promise<MediaListRecord> {
  const record = await mediaRepository().findById(id);
  if (!record) throw notFound();
  return record;
}

export const mediaService = {
  // ─── Admin ─────────────────────────────────────────────────────────────

  async list(query: MediaListQuery): Promise<Paginated<MediaAsset>> {
    const { items, total } = await mediaRepository().list(query);
    return { items: items.map(toAsset), page: query.page, pageSize: query.pageSize, total };
  },

  async get(id: string): Promise<MediaAsset> {
    return toAsset(await requireAsset(id));
  },

  async upload(actor: AdminRecord, input: { name: string; category: MediaCategory; data: string }): Promise<MediaAsset> {
    const { file, bytes } = readFile(input.data);
    const id = randomUUID();
    const key = storageKey({ id, version: 1, format: file.format });

    await store().write(key, bytes);
    try {
      await mediaRepository().create(id, file, { name: input.name, category: input.category }, actor.id);
    } catch (error) {
      await store().remove(key);
      throw error;
    }
    return this.get(id);
  },

  /** A new file under the same id — and so everywhere it is used. An image stays an image. */
  async replace(actor: AdminRecord, id: string, data: string): Promise<MediaAsset> {
    const current = await requireAsset(id);
    const { file, bytes } = readFile(data);
    if (file.kind !== current.kind) {
      throw new AppError(
        409,
        CODES.MEDIA_KIND_CHANGED,
        current.kind === 'image' ? 'جای یک تصویر فقط تصویر می‌شینه' : 'جای یک موشن فقط موشن می‌شینه'
      );
    }

    const next = storageKey({ id, version: current.version + 1, format: file.format });
    await store().write(next, bytes);
    if (!(await mediaRepository().replace(id, current.version, file, actor.id))) {
      await store().remove(next);
      throw new AppError(409, 'MEDIA_CHANGED', 'این فایل همین الان عوض شد؛ صفحه رو دوباره باز کن');
    }
    await store().remove(storageKey(current));
    return this.get(id);
  },

  async update(actor: AdminRecord, id: string, fields: { name?: string; category?: MediaCategory }): Promise<MediaAsset> {
    if (!(await mediaRepository().update(id, fields, actor.id))) throw notFound();
    return this.get(id);
  },

  /** Only a file nothing refers to — in any version of any activity — can go. */
  async remove(id: string): Promise<{ deleted: true }> {
    const outcome = await mediaRepository().remove(id);
    if (outcome.status !== 'deleted') {
      if (outcome.status === 'not_found') throw notFound();
      throw new AppError(409, CODES.MEDIA_IN_USE, 'این فایل توی فعالیت‌ها استفاده شده و حذف نمی‌شه');
    }
    await store().remove(storageKey(outcome.record));
    return { deleted: true };
  },

  // ─── Serving ───────────────────────────────────────────────────────────

  /** The file and how to send it; null when it is gone. */
  async file(id: string): Promise<{ bytes: Buffer; mime: string; etag: string } | null> {
    const [record] = await mediaRepository().findMany([id]);
    if (!record) return null;
    const bytes = await store().read(storageKey(record));
    if (!bytes) return null;
    return { bytes, mime: MEDIA_FORMATS[record.format].mime, etag: `"${record.sha256}"` };
  },

  /** A Lottie motion's animation data, for the players to draw. */
  async lottie(id: string): Promise<unknown> {
    const [record] = await mediaRepository().findMany([id]);
    if (!record || record.format !== 'lottie') throw notFound();
    const bytes = await store().read(storageKey(record));
    if (!bytes) throw notFound();
    return JSON.parse(bytes.toString('utf8').replace(/^﻿/, ''));
  },

  // ─── For other modules ─────────────────────────────────────────────────

  /** The ones of `ids` that exist, as the player needs them. */
  async describe(ids: string[]): Promise<Record<string, PlayerMedia>> {
    if (ids.length === 0) return {};
    const unique = [...new Set(ids)];
    const records = await mediaRepository().findMany(unique);
    return Object.fromEntries(
      records.map((record: MediaRecord) => [
        record.id,
        { id: record.id, kind: record.kind, format: record.format, version: record.version },
      ])
    );
  },

  /** The kind of each of `ids` that exists. */
  async kinds(ids: string[]): Promise<Map<string, MediaKind>> {
    if (ids.length === 0) return new Map();
    const records = await mediaRepository().findMany([...new Set(ids)]);
    return new Map(records.map((record) => [record.id, record.kind]));
  },
};
