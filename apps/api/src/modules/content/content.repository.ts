import type { ArticleKind, ArticleStoredStatus, ContentIndexQuery } from '@hamdastan/types';
import type { AdminArticleListQueryOutput } from '@hamdastan/validation';

import { query, queryOne, withTransaction, type DbClient } from '../../data';
import { AppError, ValidationError } from '../../shared/errors';
import { createRepositorySlot } from '../../shared/repository';

import type { ArticleFields, ArticleHistoryRecord, ArticleRecord, ContentIndexRecord, WorldArticleQuery } from './content.types';

/**
 * Data access port for the Content module, and the PostgreSQL adapter that
 * satisfies it: articles (`v2_articles`, their world links and history), and
 * the read-only content index across articles, events and activities.
 *
 * What the product may see is one rule, `LIVE`, that every product read goes
 * through — a world's tab, its home and the article page.
 */
export interface ContentRepository {
  // ─── Product ───────────────────────────────────────────────────
  /** Live articles, newest first; under a published world when `worldSlug` is given. */
  listLive(filter: { worldSlug?: string; kind?: ArticleKind }, page: number, pageSize: number): Promise<{ items: ArticleRecord[]; total: number }>;
  findLiveBySlug(slug: string): Promise<ArticleRecord | null>;
  /** A world's articles of one kind — for its home and the panel's picker. */
  forWorld(worldId: string, kind: ArticleKind, query: WorldArticleQuery): Promise<ArticleRecord[]>;

  // ─── Admin ─────────────────────────────────────────────────────
  adminList(query: AdminArticleListQueryOutput): Promise<{ items: ArticleRecord[]; total: number }>;
  findById(id: string): Promise<ArticleRecord | null>;
  create(fields: ArticleFields, adminId: string): Promise<string>;
  update(id: string, fields: ArticleFields, adminId: string): Promise<boolean>;
  /** Moves the status only from one of `from`; false when it was in none of them. */
  setStatus(id: string, to: ArticleStoredStatus, from: ArticleStoredStatus[], publishAt: Date | null, adminId: string, action: string): Promise<boolean>;
  history(id: string): Promise<ArticleHistoryRecord[]>;
  /** Articles, events and activities in one list, newest change first. */
  index(query: Required<Pick<ContentIndexQuery, 'page' | 'pageSize'>> & ContentIndexQuery): Promise<{ items: ContentIndexRecord[]; total: number }>;
}

const slot = createRepositorySlot<ContentRepository>('content');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const contentRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setContentRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/** `%` and `_` in a search are literal characters, not wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Published, and its publication date has come. */
const LIVE = `a.status = 'published' AND a.publish_at <= now()`;

const COLUMNS = `
  a.id, a.kind, a.slug, a.title, a.summary, a.body, a.category, a.cover_media_id, a.cover_alt,
  a.thumbnail_media_id, a.status, a.publish_at, a.created_at, a.updated_at,
  (SELECT coalesce(json_agg(json_build_object('id', w.id, 'slug', w.slug, 'name', w.name,
            'published', w.status = 'published') ORDER BY w.position, w.name), '[]')
     FROM v2_article_world_links l JOIN v2_worlds w ON w.id = l.world_id
    WHERE l.article_id = a.id) AS worlds`;

type Row = {
  id: string;
  kind: ArticleKind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  cover_media_id: string | null;
  cover_alt: string;
  thumbnail_media_id: string | null;
  status: ArticleStoredStatus;
  publish_at: Date | null;
  created_at: Date;
  updated_at: Date;
  worlds: ArticleRecord['worlds'];
};

const toRecord = (row: Row): ArticleRecord => ({
  id: row.id,
  kind: row.kind,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  body: row.body,
  category: row.category,
  coverId: row.cover_media_id,
  coverAlt: row.cover_alt,
  thumbnailId: row.thumbnail_media_id,
  status: row.status,
  publishAt: row.publish_at,
  worlds: row.worlds,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Collects bound parameters, answering each one's placeholder. */
function params() {
  const values: unknown[] = [];
  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  return { values, add };
}

/** The unique index and the foreign keys decide, not a prior read. */
function rethrowWriteError(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === UNIQUE_VIOLATION) {
    throw new AppError(409, 'ARTICLE_SLUG_TAKEN', 'این نامک قبلاً برای محتوای دیگری ثبت شده است', {
      fields: { slug: 'این نامک قبلاً ثبت شده است' },
    });
  }
  if (code === FOREIGN_KEY_VIOLATION) {
    throw new ValidationError('یکی از دنیاهای انتخاب‌شده وجود ندارد', { fields: { worldIds: 'یکی از دنیاهای انتخاب‌شده وجود ندارد' } });
  }
  throw error;
}

const writeAudit = (client: DbClient, articleId: string, adminId: string, action: string, details: Record<string, unknown> = {}) =>
  client.query(`INSERT INTO v2_article_audit_log (article_id, admin_id, action, details) VALUES ($1, $2, $3, $4)`, [
    articleId,
    adminId,
    action,
    details,
  ]);

async function writeWorlds(client: DbClient, articleId: string, worldIds: string[]): Promise<void> {
  await client.query(`DELETE FROM v2_article_world_links WHERE article_id = $1`, [articleId]);
  if (worldIds.length > 0) {
    await client.query(
      `INSERT INTO v2_article_world_links (article_id, world_id) SELECT $1, unnest($2::uuid[])`,
      [articleId, worldIds]
    );
  }
}

/** The stored status the admin list filters by; `scheduled` is read off the clock. */
function adminStatusClause(status: AdminArticleListQueryOutput['status'], add: (value: unknown) => string): string | null {
  if (!status) return null;
  if (status === 'scheduled') return `a.status = 'published' AND a.publish_at > now()`;
  if (status === 'published') return `a.status = 'published' AND a.publish_at <= now()`;
  return `a.status = ${add(status)}::v2_article_status`;
}

/**
 * Every kind's lifecycle in the index's words. One definition per kind,
 * each the same rule the kind's own module reads its status by.
 */
const INDEX_SOURCE = `
  SELECT a.kind::text AS type, a.id, a.title,
         CASE WHEN a.status = 'published' AND a.publish_at > now() THEN 'scheduled' ELSE a.status::text END AS status,
         ARRAY(SELECT l.world_id FROM v2_article_world_links l WHERE l.article_id = a.id) AS world_ids,
         a.updated_at
    FROM v2_articles a
  UNION ALL
  SELECT 'event', e.id, e.title,
         CASE
           WHEN e.status = 'published' AND e.publish_at > now() THEN 'scheduled'
           WHEN e.status = 'published' AND e.end_at <= now() THEN 'ended'
           WHEN e.status = 'cancelled' THEN 'ended'
           ELSE e.status::text END,
         ARRAY(SELECT l.world_id FROM v2_event_world_links l WHERE l.event_id = e.id),
         e.updated_at
    FROM v2_events e
  UNION ALL
  SELECT 'activity', x.id, x.title,
         CASE
           WHEN x.status = 'published' AND x.starts_at > now() THEN 'scheduled'
           WHEN x.status = 'published' AND x.ends_at <= now() THEN 'ended'
           WHEN x.status = 'closed' THEN 'ended'
           ELSE x.status::text END,
         ARRAY(SELECT l.world_id FROM v2_engagement_activity_worlds l WHERE l.activity_id = x.id),
         x.updated_at
    FROM v2_engagement_activities x`;

export const sqlContentRepository: ContentRepository = {
  async listLive(filter, page, pageSize) {
    const { values, add } = params();
    const clauses = [LIVE];
    if (filter.kind) clauses.push(`a.kind = ${add(filter.kind)}::v2_article_kind`);
    if (filter.worldSlug) {
      clauses.push(`EXISTS (SELECT 1 FROM v2_article_world_links l JOIN v2_worlds w ON w.id = l.world_id
        WHERE l.article_id = a.id AND w.slug = ${add(filter.worldSlug)} AND w.status = 'published')`);
    }
    const where = clauses.join(' AND ');
    const filterValues = [...values];
    const [rows, count] = await Promise.all([
      query<Row>(
        `SELECT ${COLUMNS} FROM v2_articles a WHERE ${where}
          ORDER BY a.publish_at DESC, a.id LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`,
        values
      ),
      queryOne<{ total: number }>(`SELECT count(*)::int AS total FROM v2_articles a WHERE ${where}`, filterValues),
    ]);
    return { items: rows.map(toRecord), total: count?.total ?? 0 };
  },

  async findLiveBySlug(slug) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_articles a WHERE a.slug = $1 AND ${LIVE}`, [slug]);
    return row ? toRecord(row) : null;
  },

  async forWorld(worldId, kind, { ids, q, liveOnly, limit }) {
    const { values, add } = params();
    const clauses = [
      `a.kind = ${add(kind)}::v2_article_kind`,
      `EXISTS (SELECT 1 FROM v2_article_world_links l WHERE l.article_id = a.id AND l.world_id = ${add(worldId)})`,
    ];
    if (liveOnly) clauses.push(LIVE);
    if (ids) clauses.push(`a.id = ANY(${add(ids)}::uuid[])`);
    if (q) clauses.push(`a.title ILIKE ${add(`%${escapeLike(q)}%`)}`);
    const rows = await query<Row>(
      `SELECT ${COLUMNS} FROM v2_articles a WHERE ${clauses.join(' AND ')}
        ORDER BY a.publish_at DESC NULLS LAST, a.updated_at DESC LIMIT ${add(limit)}`,
      values
    );
    return rows.map(toRecord);
  },

  async adminList(filter) {
    const { values, add } = params();
    const clauses: string[] = [];
    if (filter.q) clauses.push(`a.title ILIKE ${add(`%${escapeLike(filter.q)}%`)}`);
    if (filter.kind) clauses.push(`a.kind = ${add(filter.kind)}::v2_article_kind`);
    const status = adminStatusClause(filter.status, add);
    if (status) clauses.push(status);
    if (filter.world) {
      clauses.push(`EXISTS (SELECT 1 FROM v2_article_world_links l WHERE l.article_id = a.id AND l.world_id = ${add(filter.world)})`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const filterValues = [...values];
    const [rows, count] = await Promise.all([
      query<Row>(
        `SELECT ${COLUMNS} FROM v2_articles a ${where}
          ORDER BY a.updated_at DESC, a.id LIMIT ${add(filter.pageSize)} OFFSET ${add((filter.page - 1) * filter.pageSize)}`,
        values
      ),
      queryOne<{ total: number }>(`SELECT count(*)::int AS total FROM v2_articles a ${where}`, filterValues),
    ]);
    return { items: rows.map(toRecord), total: count?.total ?? 0 };
  },

  async findById(id) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_articles a WHERE a.id = $1`, [id]);
    return row ? toRecord(row) : null;
  },

  async create(fields, adminId) {
    try {
      return await withTransaction(async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO v2_articles
                  (kind, slug, title, summary, body, category, cover_media_id, cover_alt, thumbnail_media_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
          [fields.kind, fields.slug, fields.title, fields.summary, fields.body, fields.category, fields.coverId, fields.coverAlt, fields.thumbnailId, adminId]
        );
        const id = rows[0].id;
        await writeWorlds(client, id, fields.worldIds);
        await writeAudit(client, id, adminId, 'create', { title: fields.title });
        return id;
      });
    } catch (error) {
      rethrowWriteError(error);
    }
  },

  async update(id, fields, adminId) {
    try {
      return await withTransaction(async (client) => {
        const { rowCount } = await client.query(
          `UPDATE v2_articles
              SET kind = $2, slug = $3, title = $4, summary = $5, body = $6, category = $7,
                  cover_media_id = $8, cover_alt = $9, thumbnail_media_id = $10, updated_by = $11, updated_at = now()
            WHERE id = $1`,
          [id, fields.kind, fields.slug, fields.title, fields.summary, fields.body, fields.category, fields.coverId, fields.coverAlt, fields.thumbnailId, adminId]
        );
        if (rowCount === 0) return false;
        await writeWorlds(client, id, fields.worldIds);
        await writeAudit(client, id, adminId, 'update', { title: fields.title });
        return true;
      });
    } catch (error) {
      rethrowWriteError(error);
    }
  },

  async setStatus(id, to, from, publishAt, adminId, action) {
    return withTransaction(async (client) => {
      // A publication keeps its first date unless a new one is given; leaving `published` keeps it for the record.
      const { rowCount } = await client.query(
        `UPDATE v2_articles
            SET status = $2::v2_article_status,
                publish_at = CASE WHEN $2::v2_article_status = 'published' THEN coalesce($4::timestamptz, now()) ELSE publish_at END,
                updated_by = $5, updated_at = now()
          WHERE id = $1 AND status = ANY($3::v2_article_status[])`,
        [id, to, from, publishAt, adminId]
      );
      if (rowCount === 0) return false;
      await writeAudit(client, id, adminId, action, publishAt ? { publishAt: publishAt.toISOString() } : {});
      return true;
    });
  },

  async history(id) {
    const rows = await query<{ id: string; action: string; admin_name: string | null; details: Record<string, unknown>; created_at: Date }>(
      `SELECT h.id::text, h.action, nullif(trim(concat_ws(' ', ad.first_name, ad.last_name)), '') AS admin_name, h.details, h.created_at
         FROM v2_article_audit_log h LEFT JOIN v2_admin_users ad ON ad.id = h.admin_id
        WHERE h.article_id = $1 ORDER BY h.created_at DESC, h.id DESC LIMIT 100`,
      [id]
    );
    return rows.map((row) => ({ id: row.id, action: row.action, adminName: row.admin_name, details: row.details, createdAt: row.created_at }));
  },

  async index(filter) {
    const { values, add } = params();
    const clauses: string[] = [];
    if (filter.q) clauses.push(`i.title ILIKE ${add(`%${escapeLike(filter.q)}%`)}`);
    if (filter.type) clauses.push(`i.type = ${add(filter.type)}`);
    if (filter.status) clauses.push(`i.status = ${add(filter.status)}`);
    if (filter.world) clauses.push(`${add(filter.world)}::uuid = ANY(i.world_ids)`);
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const filterValues = [...values];
    const [rows, count] = await Promise.all([
      query<{
        type: ContentIndexRecord['type'];
        id: string;
        title: string;
        status: ContentIndexRecord['status'];
        worlds: ContentIndexRecord['worlds'];
        updated_at: Date;
      }>(
        `WITH i AS (${INDEX_SOURCE})
         SELECT i.type, i.id, i.title, i.status, i.updated_at,
                (SELECT coalesce(json_agg(json_build_object('id', w.id, 'name', w.name) ORDER BY w.position, w.name), '[]')
                   FROM v2_worlds w WHERE w.id = ANY(i.world_ids)) AS worlds
           FROM i ${where}
          ORDER BY i.updated_at DESC, i.id
          LIMIT ${add(filter.pageSize)} OFFSET ${add((filter.page - 1) * filter.pageSize)}`,
        values
      ),
      queryOne<{ total: number }>(`WITH i AS (${INDEX_SOURCE}) SELECT count(*)::int AS total FROM i ${where}`, filterValues),
    ]);
    return {
      items: rows.map((row) => ({ type: row.type, id: row.id, title: row.title, status: row.status, worlds: row.worlds, updatedAt: row.updated_at })),
      total: count?.total ?? 0,
    };
  },
};
