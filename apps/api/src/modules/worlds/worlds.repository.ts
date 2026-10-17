import { query, queryOne } from '../../data';
import { AppError } from '../../shared/errors';
import { createRepositorySlot } from '../../shared/repository';

import type { WorldFields, WorldRecord } from './worlds.types';

/**
 * Data access port for the Worlds module, and the PostgreSQL adapter that
 * satisfies it: the world list (`v2_worlds`). Membership does not exist yet;
 * events are filed under worlds through `v2_event_world_links`, which is
 * read here only to count and to refuse deleting a world in use.
 */
export interface WorldsRepository {
  /** In display order. `activeOnly` is the product's list. */
  list(activeOnly: boolean): Promise<WorldRecord[]>;
  findById(id: string): Promise<WorldRecord | null>;
  findActiveBySlug(slug: string): Promise<WorldRecord | null>;
  /** Answers with the new id. */
  create(fields: WorldFields, adminId: string): Promise<string>;
  update(id: string, fields: WorldFields, adminId: string): Promise<boolean>;
  /** Positions follow the order of `ids`; ids not in the list are left alone. */
  reorder(ids: string[]): Promise<void>;
  remove(id: string, adminId: string): Promise<'deleted' | 'in_use' | 'not_found'>;
}

const slot = createRepositorySlot<WorldsRepository>('worlds');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const worldsRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setWorldsRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** PostgreSQL's unique_violation. */
const UNIQUE_VIOLATION = '23505';

const COLUMNS = `w.id, w.slug, w.name, w.summary, w.cover_media_id, w.position, w.is_active,
  (SELECT count(*) FROM v2_event_world_links l WHERE l.world_id = w.id)::int AS event_count`;

type Row = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  cover_media_id: string | null;
  position: number;
  is_active: boolean;
  event_count: number;
};

const toRecord = (row: Row): WorldRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  summary: row.summary,
  coverId: row.cover_media_id,
  position: row.position,
  isActive: row.is_active,
  eventCount: row.event_count,
});

/** The unique index decides, not a prior read. */
function rethrowSlugTaken(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new AppError(409, 'WORLD_SLUG_TAKEN', 'این نامک برای دنیای دیگه‌ای ثبت شده');
  }
  throw error;
}

const audit = (worldId: string, adminId: string, action: string, details: Record<string, unknown> = {}) =>
  query(
    `INSERT INTO v2_event_audit_log (entity, entity_id, admin_id, action, details) VALUES ('world', $1, $2, $3, $4)`,
    [worldId, adminId, action, details]
  );

export const sqlWorldsRepository: WorldsRepository = {
  async list(activeOnly) {
    const rows = await query<Row>(
      `SELECT ${COLUMNS} FROM v2_worlds w WHERE ($1::boolean = false OR w.is_active) ORDER BY w.position, w.name`,
      [activeOnly]
    );
    return rows.map(toRecord);
  },

  async findById(id) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_worlds w WHERE w.id = $1`, [id]);
    return row ? toRecord(row) : null;
  },

  async findActiveBySlug(slug) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_worlds w WHERE w.slug = $1 AND w.is_active`, [slug]);
    return row ? toRecord(row) : null;
  },

  async create(fields, adminId) {
    try {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO v2_worlds (slug, name, summary, cover_media_id, is_active, position)
         VALUES ($1, $2, $3, $4, $5, (SELECT coalesce(max(position), 0) + 1 FROM v2_worlds))
         RETURNING id`,
        [fields.slug, fields.name, fields.summary, fields.coverId, fields.isActive]
      );
      await audit(row!.id, adminId, 'create', { name: fields.name });
      return row!.id;
    } catch (error) {
      rethrowSlugTaken(error);
    }
  },

  async update(id, fields, adminId) {
    try {
      const rows = await query(
        `UPDATE v2_worlds
            SET slug = $2, name = $3, summary = $4, cover_media_id = $5, is_active = $6, updated_at = now()
          WHERE id = $1 RETURNING id`,
        [id, fields.slug, fields.name, fields.summary, fields.coverId, fields.isActive]
      );
      if (rows.length === 0) return false;
      await audit(id, adminId, 'update', { name: fields.name, isActive: fields.isActive });
      return true;
    } catch (error) {
      rethrowSlugTaken(error);
    }
  },

  async reorder(ids) {
    await query(
      `UPDATE v2_worlds w SET position = o.ordinality, updated_at = now()
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, ordinality)
        WHERE w.id = o.id`,
      [ids]
    );
  },

  async remove(id, adminId) {
    // One statement: the use check and the delete see the same links.
    const rows = await query<{ id: string; in_use: boolean; deleted: boolean }>(
      `WITH target AS (
         SELECT w.id, EXISTS (SELECT 1 FROM v2_event_world_links l WHERE l.world_id = w.id) AS in_use
           FROM v2_worlds w WHERE w.id = $1),
       gone AS (DELETE FROM v2_worlds d USING target t WHERE d.id = t.id AND NOT t.in_use RETURNING d.id)
       SELECT t.id, t.in_use, EXISTS (SELECT 1 FROM gone) AS deleted FROM target t`,
      [id]
    );
    const row = rows[0];
    if (!row) return 'not_found';
    if (row.in_use) return 'in_use';
    await audit(id, adminId, 'delete');
    return 'deleted';
  },
};
