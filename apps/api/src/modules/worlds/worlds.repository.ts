import { WORLD_DEFAULT_HOME_ORDER, WORLD_DEFAULT_NAVIGATION, WORLD_SECTIONS } from '@hamdastan/config';
import type { WorldHomeKind, WorldStatus } from '@hamdastan/types';

import { query, queryOne, withTransaction, type DbClient } from '../../data';
import { AppError } from '../../shared/errors';
import { createRepositorySlot } from '../../shared/repository';

import type { HomeSectionRecord, WorldFields, WorldRecord } from './worlds.types';

/**
 * Data access port for the Worlds module, and the PostgreSQL adapter that
 * satisfies it: the worlds (`v2_worlds`), their home sections and featured
 * items (`v2_world_home_*`). What is filed under a world — events, articles,
 * activities — is read here only to count it, to refuse deleting a world in
 * use, and to check that a featured item belongs to the world.
 */
export interface WorldsRepository {
  /** In display order. `publishedOnly` is the product's list. */
  list(publishedOnly: boolean): Promise<WorldRecord[]>;
  findById(id: string): Promise<WorldRecord | null>;
  findPublishedBySlug(slug: string): Promise<WorldRecord | null>;
  /** Answers with the new id. The world starts as a draft with the default home. */
  create(fields: WorldFields, adminId: string): Promise<string>;
  update(id: string, fields: WorldFields, adminId: string): Promise<boolean>;
  /** Moves the status only from one of `from`; false when it was in none of them. */
  setStatus(id: string, to: WorldStatus, from: WorldStatus[], adminId: string, action: string): Promise<boolean>;
  /** Positions follow the order of `ids`; ids not in the list are left alone. */
  reorder(ids: string[]): Promise<void>;
  remove(id: string, adminId: string): Promise<'deleted' | 'in_use' | 'not_found'>;
  /** Every home section, in home order — events first, whatever their stored position. */
  findHome(worldId: string): Promise<HomeSectionRecord[]>;
  /** Replaces the home as a whole: sections in the given order, each with its featured ids. */
  saveHome(worldId: string, sections: HomeSectionRecord[], adminId: string): Promise<void>;
  /** Of `ids`, the ones of `kind` filed under the world. */
  filedUnder(worldId: string, kind: WorldHomeKind, ids: string[]): Promise<string[]>;
}

const slot = createRepositorySlot<WorldsRepository>('worlds');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const worldsRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setWorldsRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** PostgreSQL's unique_violation. */
const UNIQUE_VIOLATION = '23505';

const COLUMNS = `w.id, w.slug, w.name, w.summary, w.tagline, w.description, w.cover_media_id,
  w.theme, w.navigation, w.position, w.status, w.published_at, w.updated_at,
  (SELECT count(*) FROM v2_event_world_links l WHERE l.world_id = w.id)::int AS event_count,
  (SELECT count(*) FROM v2_article_world_links l WHERE l.world_id = w.id)::int AS article_count,
  (SELECT count(*) FROM v2_engagement_activity_worlds l WHERE l.world_id = w.id)::int AS activity_count`;

type Row = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  tagline: string;
  description: string;
  cover_media_id: string | null;
  theme: WorldRecord['theme'];
  navigation: WorldRecord['navigation'];
  position: number;
  status: WorldStatus;
  published_at: Date | null;
  updated_at: Date;
  event_count: number;
  article_count: number;
  activity_count: number;
};

/**
 * The menu as it is now: one item per section, in `WORLD_SECTIONS` order. A
 * world saved when news, knowledge and events were menus too keeps its
 * labels and switches for the sections that remain.
 */
const menuOf = (stored: WorldRecord['navigation']): WorldRecord['navigation'] =>
  WORLD_SECTIONS.map((section) => stored.find((item) => item.section === section) ?? WORLD_DEFAULT_NAVIGATION.find((item) => item.section === section)!);

const toRecord = (row: Row): WorldRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  summary: row.summary,
  tagline: row.tagline,
  description: row.description,
  coverId: row.cover_media_id,
  theme: row.theme,
  navigation: menuOf(row.navigation),
  position: row.position,
  status: row.status,
  publishedAt: row.published_at,
  eventCount: row.event_count,
  articleCount: row.article_count,
  activityCount: row.activity_count,
  updatedAt: row.updated_at,
});

/** The unique index decides, not a prior read. */
function rethrowSlugTaken(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new AppError(409, 'WORLD_SLUG_TAKEN', 'این نامک قبلاً برای دنیای دیگری ثبت شده است', {
      fields: { slug: 'این نامک قبلاً ثبت شده است' },
    });
  }
  throw error;
}

/** Worlds keep their history beside events' (`entity = 'world'`), as before. */
async function audit(client: DbClient | null, worldId: string, adminId: string, action: string, details: Record<string, unknown> = {}) {
  const sql = `INSERT INTO v2_event_audit_log (entity, entity_id, admin_id, action, details) VALUES ('world', $1, $2, $3, $4)`;
  const values = [worldId, adminId, action, details];
  await (client ? client.query(sql, values) : query(sql, values));
}

/** Where each kind of featured item lives, and the link that files it under a world. */
const FILED: Record<WorldHomeKind, { column: string; check: string }> = {
  news: {
    column: 'article_id',
    check: `SELECT a.id FROM v2_articles a JOIN v2_article_world_links l ON l.article_id = a.id
             WHERE l.world_id = $1 AND a.kind = 'news' AND a.id = ANY($2::uuid[])`,
  },
  knowledge: {
    column: 'article_id',
    check: `SELECT a.id FROM v2_articles a JOIN v2_article_world_links l ON l.article_id = a.id
             WHERE l.world_id = $1 AND a.kind = 'knowledge' AND a.id = ANY($2::uuid[])`,
  },
  events: {
    column: 'event_id',
    check: `SELECT l.event_id AS id FROM v2_event_world_links l WHERE l.world_id = $1 AND l.event_id = ANY($2::uuid[])`,
  },
  activities: {
    column: 'activity_id',
    check: `SELECT l.activity_id AS id FROM v2_engagement_activity_worlds l WHERE l.world_id = $1 AND l.activity_id = ANY($2::uuid[])`,
  },
};

export const sqlWorldsRepository: WorldsRepository = {
  async list(publishedOnly) {
    const rows = await query<Row>(
      `SELECT ${COLUMNS} FROM v2_worlds w WHERE ($1::boolean = false OR w.status = 'published') ORDER BY w.position, w.name`,
      [publishedOnly]
    );
    return rows.map(toRecord);
  },

  async findById(id) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_worlds w WHERE w.id = $1`, [id]);
    return row ? toRecord(row) : null;
  },

  async findPublishedBySlug(slug) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_worlds w WHERE w.slug = $1 AND w.status = 'published'`, [slug]);
    return row ? toRecord(row) : null;
  },

  async create(fields, adminId) {
    try {
      return await withTransaction(async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO v2_worlds (slug, name, summary, tagline, description, cover_media_id, theme, navigation, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT coalesce(max(position), 0) + 1 FROM v2_worlds))
           RETURNING id`,
          [fields.slug, fields.name, fields.summary, fields.tagline, fields.description, fields.coverId, fields.theme, JSON.stringify(fields.navigation)]
        );
        const id = rows[0].id;
        await client.query(
          `INSERT INTO v2_world_home_sections (world_id, kind, position)
           SELECT $1, k.kind::v2_world_section_kind, k.ordinality FROM unnest($2::text[]) WITH ORDINALITY AS k(kind, ordinality)`,
          [id, WORLD_DEFAULT_HOME_ORDER]
        );
        await audit(client, id, adminId, 'create', { name: fields.name });
        return id;
      });
    } catch (error) {
      rethrowSlugTaken(error);
    }
  },

  async update(id, fields, adminId) {
    try {
      const rows = await query(
        `UPDATE v2_worlds
            SET slug = $2, name = $3, summary = $4, tagline = $5, description = $6, cover_media_id = $7,
                theme = $8, navigation = $9, updated_at = now()
          WHERE id = $1 RETURNING id`,
        [id, fields.slug, fields.name, fields.summary, fields.tagline, fields.description, fields.coverId, fields.theme, JSON.stringify(fields.navigation)]
      );
      if (rows.length === 0) return false;
      await audit(null, id, adminId, 'update', { name: fields.name });
      return true;
    } catch (error) {
      rethrowSlugTaken(error);
    }
  },

  async setStatus(id, to, from, adminId, action) {
    return withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE v2_worlds
            SET status = $2::v2_world_status,
                published_at = CASE WHEN $2::v2_world_status = 'published' THEN coalesce(published_at, now()) ELSE published_at END,
                updated_at = now()
          WHERE id = $1 AND status = ANY($3::v2_world_status[])`,
        [id, to, from]
      );
      if (rowCount === 0) return false;
      await audit(client, id, adminId, action);
      return true;
    });
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
         SELECT w.id, (EXISTS (SELECT 1 FROM v2_event_world_links l WHERE l.world_id = w.id)
                    OR EXISTS (SELECT 1 FROM v2_article_world_links l WHERE l.world_id = w.id)
                    OR EXISTS (SELECT 1 FROM v2_engagement_activity_worlds l WHERE l.world_id = w.id)) AS in_use
           FROM v2_worlds w WHERE w.id = $1),
       gone AS (DELETE FROM v2_worlds d USING target t WHERE d.id = t.id AND NOT t.in_use RETURNING d.id)
       SELECT t.id, t.in_use, EXISTS (SELECT 1 FROM gone) AS deleted FROM target t`,
      [id]
    );
    const row = rows[0];
    if (!row) return 'not_found';
    if (row.in_use) return 'in_use';
    await audit(null, id, adminId, 'delete');
    return 'deleted';
  },

  async findHome(worldId) {
    const rows = await query<{
      kind: WorldHomeKind;
      title: string;
      source: HomeSectionRecord['source'];
      item_limit: number;
      when_empty: HomeSectionRecord['whenEmpty'];
      is_enabled: boolean;
      featured_ids: string[];
    }>(
      `SELECT s.kind, s.title, s.source, s.item_limit, s.when_empty, s.is_enabled,
              ARRAY(SELECT coalesce(i.article_id, i.event_id, i.activity_id) FROM v2_world_home_items i
                     WHERE i.section_id = s.id ORDER BY i.position) AS featured_ids
         FROM v2_world_home_sections s WHERE s.world_id = $1 ORDER BY s.kind = 'events' DESC, s.position, s.kind`,
      [worldId]
    );
    return rows.map((row) => ({
      kind: row.kind,
      title: row.title,
      source: row.source,
      itemLimit: row.item_limit,
      whenEmpty: row.when_empty,
      enabled: row.is_enabled,
      featuredIds: row.featured_ids,
    }));
  },

  async saveHome(worldId, sections, adminId) {
    await withTransaction(async (client) => {
      for (const [index, section] of sections.entries()) {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO v2_world_home_sections (world_id, kind, title, source, item_limit, when_empty, is_enabled, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (world_id, kind) DO UPDATE
              SET title = EXCLUDED.title, source = EXCLUDED.source, item_limit = EXCLUDED.item_limit,
                  when_empty = EXCLUDED.when_empty, is_enabled = EXCLUDED.is_enabled, position = EXCLUDED.position
           RETURNING id`,
          [worldId, section.kind, section.title, section.source, section.itemLimit, section.whenEmpty, section.enabled, index + 1]
        );
        const sectionId = rows[0].id;
        await client.query(`DELETE FROM v2_world_home_items WHERE section_id = $1`, [sectionId]);
        if (section.featuredIds.length > 0) {
          await client.query(
            `INSERT INTO v2_world_home_items (section_id, ${FILED[section.kind].column}, position)
             SELECT $1, f.id, f.ordinality FROM unnest($2::uuid[]) WITH ORDINALITY AS f(id, ordinality)`,
            [sectionId, section.featuredIds]
          );
        }
      }
      await audit(client, worldId, adminId, 'home_update', {
        sections: sections.map((section) => ({ kind: section.kind, enabled: section.enabled, featured: section.featuredIds.length })),
      });
    });
  },

  async filedUnder(worldId, kind, ids) {
    if (ids.length === 0) return [];
    const rows = await query<{ id: string }>(FILED[kind].check, [worldId, ids]);
    return rows.map((row) => row.id);
  },
};
