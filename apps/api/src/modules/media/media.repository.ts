import type { MediaCategory } from '@hamdastan/types';

import { query, queryOne } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type { MediaFile, MediaListQuery, MediaListRecord, MediaRecord } from './media.types';

/**
 * Data access port for the Media module, and the PostgreSQL adapter that
 * satisfies it: the library's rows (`v2_media_assets`). The bytes are not
 * here — the service keeps them through the `MediaStorage` integration.
 *
 * Whether a file is in use is read from the activity definitions, every
 * version of them (a response keeps the version it answered, and that
 * version may still be drawn), and from what events and worlds point at.
 */
export interface MediaRepository {
  list(query: MediaListQuery): Promise<{ items: MediaListRecord[]; total: number }>;
  findById(id: string): Promise<MediaListRecord | null>;
  /** The ones of `ids` that exist. */
  findMany(ids: string[]): Promise<MediaRecord[]>;
  create(id: string, file: MediaFile, fields: { name: string; category: MediaCategory }, adminId: string): Promise<void>;
  /** Moves to the next version, only from `fromVersion`; false when someone else replaced it first. */
  replace(id: string, fromVersion: number, file: MediaFile, adminId: string): Promise<boolean>;
  update(id: string, fields: { name?: string; category?: MediaCategory }, adminId: string): Promise<boolean>;
  /** Deletes it unless something uses it; answers with what was deleted, or why not. */
  remove(id: string): Promise<{ status: 'deleted'; record: MediaRecord } | { status: 'in_use' | 'not_found' }>;
}

const slot = createRepositorySlot<MediaRepository>('media');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const mediaRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setMediaRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

const COLUMNS = `m.id, m.kind, m.format, m.category, m.name, m.size_bytes, m.sha256, m.version, m.created_at, m.updated_at`;

/**
 * Places that use this file: activities whose definitions — in any version —
 * name it, and events (cover, organizer logo, gallery), event categories and
 * worlds that point at it.
 */
const USAGE = `(
    (SELECT count(DISTINCT v.activity_id) FROM v2_engagement_versions v
      WHERE strpos(v.definition::text, m.id::text) > 0)
  + (SELECT count(*) FROM v2_events e WHERE m.id IN (e.cover_media_id, e.organizer_logo_media_id))
  + (SELECT count(*) FROM v2_event_media g WHERE g.media_id = m.id)
  + (SELECT count(*) FROM v2_event_categories c WHERE c.image_media_id = m.id)
  + (SELECT count(*) FROM v2_worlds w WHERE w.cover_media_id = m.id))::int`;

type Row = {
  id: string;
  kind: MediaRecord['kind'];
  format: MediaRecord['format'];
  category: MediaCategory;
  name: string;
  size_bytes: number;
  sha256: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const toRecord = (row: Row): MediaRecord => ({
  id: row.id,
  kind: row.kind,
  format: row.format,
  category: row.category,
  name: row.name,
  sizeBytes: row.size_bytes,
  sha256: row.sha256,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** `%` and `_` in a search are literal characters, not wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export const sqlMediaRepository: MediaRepository = {
  async list({ category, kind, search, page, pageSize }) {
    const where = `WHERE ($1::text IS NULL OR m.category = $1)
                     AND ($2::v2_media_kind IS NULL OR m.kind = $2)
                     AND ($3::text IS NULL OR m.name ILIKE $3)`;
    const params = [category ?? null, kind ?? null, search ? `%${escapeLike(search)}%` : null];
    const [rows, count] = await Promise.all([
      query<Row & { usage: number }>(
        `SELECT ${COLUMNS}, ${USAGE} AS usage FROM v2_media_assets m ${where}
          ORDER BY m.created_at DESC, m.id LIMIT $4 OFFSET $5`,
        [...params, pageSize, (page - 1) * pageSize]
      ),
      queryOne<{ total: number }>(`SELECT count(*)::int AS total FROM v2_media_assets m ${where}`, params),
    ]);
    return { items: rows.map((row) => ({ ...toRecord(row), usage: row.usage })), total: count?.total ?? 0 };
  },

  async findById(id) {
    const row = await queryOne<Row & { usage: number }>(
      `SELECT ${COLUMNS}, ${USAGE} AS usage FROM v2_media_assets m WHERE m.id = $1`,
      [id]
    );
    return row ? { ...toRecord(row), usage: row.usage } : null;
  },

  async findMany(ids) {
    if (ids.length === 0) return [];
    const rows = await query<Row>(`SELECT ${COLUMNS} FROM v2_media_assets m WHERE m.id = ANY($1::uuid[])`, [ids]);
    return rows.map(toRecord);
  },

  async create(id, file, { name, category }, adminId) {
    await query(
      `INSERT INTO v2_media_assets (id, kind, format, category, name, size_bytes, sha256, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, file.kind, file.format, category, name, file.sizeBytes, file.sha256, adminId]
    );
  },

  async replace(id, fromVersion, file, adminId) {
    const rows = await query(
      `UPDATE v2_media_assets
          SET format = $3, size_bytes = $4, sha256 = $5, version = version + 1, updated_by = $6, updated_at = now()
        WHERE id = $1 AND version = $2
        RETURNING id`,
      [id, fromVersion, file.format, file.sizeBytes, file.sha256, adminId]
    );
    return rows.length > 0;
  },

  async update(id, { name, category }, adminId) {
    const rows = await query(
      `UPDATE v2_media_assets
          SET name = COALESCE($2, name), category = COALESCE($3, category), updated_by = $4, updated_at = now()
        WHERE id = $1 RETURNING id`,
      [id, name ?? null, category ?? null, adminId]
    );
    return rows.length > 0;
  },

  async remove(id) {
    // One statement: the use check and the delete see the same definitions.
    const rows = await query<Row & { usage: number }>(
      `WITH target AS (SELECT ${COLUMNS}, ${USAGE} AS usage FROM v2_media_assets m WHERE m.id = $1),
            gone AS (DELETE FROM v2_media_assets d USING target t WHERE d.id = t.id AND t.usage = 0 RETURNING d.id)
       SELECT target.* FROM target`,
      [id]
    );
    const row = rows[0];
    if (!row) return { status: 'not_found' };
    if (row.usage > 0) return { status: 'in_use' };
    return { status: 'deleted', record: toRecord(row) };
  },
};
