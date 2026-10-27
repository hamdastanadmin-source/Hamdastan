import type { PlaceStatus } from '@hamdastan/types';

import { query, queryOne, withTransaction } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type { PlaceDetailRecord, PlaceFields, PlaceRecord } from './places.types';

/**
 * Data access port for the Places module, and the PostgreSQL adapter that
 * satisfies it: the places (`v2_places`) and their tasks
 * (`v2_place_activities`). The world and its activities are read here only
 * to say whether a place may be shown and how many tasks its pin holds.
 */
export interface PlacesRepository {
  /** Every world's map, in any status, in the worlds' own order. */
  listMaps(): Promise<PlaceRecord[]>;
  findById(id: string): Promise<PlaceDetailRecord | null>;
  /** Several, without their tasks — a parent, a trail. */
  findMany(ids: string[]): Promise<PlaceRecord[]>;
  /** The places pinned on one, in order. */
  findChildren(parentId: string): Promise<PlaceRecord[]>;
  /** The world's map, in any status; null before one is made. */
  findMap(worldId: string): Promise<PlaceRecord | null>;
  /** Answers with the new id: a draft, last among its siblings, pinned in the middle of its parent. */
  create(fields: { worldId: string; parentId: string | null; depth: number; parentDepth: number | null; name: string }, adminId: string): Promise<string>;
  /** Replaces the place, its tasks, and where its children are pinned. False when it is gone. */
  update(id: string, fields: PlaceFields, adminId: string): Promise<boolean>;
  /** Moves the status only from one of `from`; false when it was in none of them. */
  setStatus(id: string, to: PlaceStatus, from: PlaceStatus[]): Promise<boolean>;
  /** Deletes it unless places sit inside it. */
  remove(id: string): Promise<'deleted' | 'in_use' | 'not_found'>;
}

const slot = createRepositorySlot<PlacesRepository>('places');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const placesRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setPlacesRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** Published, under published places (two at most), in a published world. */
const AVAILABLE = `(p.status = 'published'
  AND EXISTS (SELECT 1 FROM v2_worlds w WHERE w.id = p.world_id AND w.status = 'published')
  AND (p.parent_id IS NULL OR EXISTS (
    SELECT 1 FROM v2_places a WHERE a.id = p.parent_id AND a.status = 'published'
      AND (a.parent_id IS NULL OR EXISTS (SELECT 1 FROM v2_places b WHERE b.id = a.parent_id AND b.status = 'published')))))`;

/** Published tasks at this place and at the published places inside it (one layer is all there can be under a pin). */
const TASK_COUNT = `(SELECT count(*) FROM v2_place_activities t
    JOIN v2_places d ON d.id = t.place_id
    JOIN v2_engagement_activities e ON e.id = t.activity_id AND e.status = 'published'
   WHERE d.id = p.id OR (d.parent_id = p.id AND d.status = 'published'))::int`;

const COLUMNS = `p.id, p.world_id, p.parent_id, p.depth, p.name, p.summary, p.image_media_id, p.pin_x, p.pin_y,
  p.position, p.status, p.published_at, p.updated_at, ${AVAILABLE} AS available,
  (SELECT count(*) FROM v2_place_activities t WHERE t.place_id = p.id)::int AS activity_count,
  (SELECT count(*) FROM v2_places c WHERE c.parent_id = p.id)::int AS child_count,
  ${TASK_COUNT} AS task_count`;

/** The map first, then each layer, in the admin's order. */
const ORDER = `ORDER BY p.depth, p.position, p.created_at, p.id`;

type Row = {
  id: string;
  world_id: string;
  parent_id: string | null;
  depth: number;
  name: string;
  summary: string;
  image_media_id: string | null;
  // numeric arrives as text
  pin_x: string;
  pin_y: string;
  position: number;
  status: PlaceStatus;
  published_at: Date | null;
  updated_at: Date;
  available: boolean;
  activity_count: number;
  child_count: number;
  task_count: number;
};

const toRecord = (row: Row): PlaceRecord => ({
  id: row.id,
  worldId: row.world_id,
  parentId: row.parent_id,
  depth: row.depth,
  name: row.name,
  summary: row.summary,
  imageId: row.image_media_id,
  pin: { x: Number(row.pin_x), y: Number(row.pin_y) },
  position: row.position,
  status: row.status,
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
  available: row.available,
  activityCount: row.activity_count,
  childCount: row.child_count,
  taskCount: row.task_count,
});

export const sqlPlacesRepository: PlacesRepository = {
  async listMaps() {
    const rows = await query<Row>(
      `SELECT ${COLUMNS} FROM v2_places p JOIN v2_worlds w ON w.id = p.world_id
        WHERE p.parent_id IS NULL ORDER BY w.position, p.created_at, p.id`
    );
    return rows.map(toRecord);
  },

  async findById(id) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_places p WHERE p.id = $1`, [id]);
    if (!row) return null;
    const tasks = await query<{ activity_id: string }>(`SELECT activity_id FROM v2_place_activities WHERE place_id = $1 ORDER BY position`, [id]);
    return { ...toRecord(row), activityIds: tasks.map((task) => task.activity_id) };
  },

  async findMany(ids) {
    if (ids.length === 0) return [];
    const rows = await query<Row>(`SELECT ${COLUMNS} FROM v2_places p WHERE p.id = ANY($1::uuid[])`, [ids]);
    return rows.map(toRecord);
  },

  async findChildren(parentId) {
    const rows = await query<Row>(`SELECT ${COLUMNS} FROM v2_places p WHERE p.parent_id = $1 ${ORDER}`, [parentId]);
    return rows.map(toRecord);
  },

  async findMap(worldId) {
    const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM v2_places p WHERE p.world_id = $1 AND p.parent_id IS NULL ${ORDER} LIMIT 1`, [worldId]);
    return row ? toRecord(row) : null;
  },

  async create({ worldId, parentId, depth, parentDepth, name }, adminId) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO v2_places (world_id, parent_id, depth, parent_depth, name, position, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5,
               (SELECT coalesce(max(position), 0) + 1 FROM v2_places WHERE world_id = $1 AND parent_id IS NOT DISTINCT FROM $2),
               $6, $6)
       RETURNING id`,
      [worldId, parentId, depth, parentDepth, name, adminId]
    );
    return row!.id;
  },

  async update(id, fields, adminId) {
    return withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE v2_places SET name = $2, summary = $3, image_media_id = $4, updated_by = $5, updated_at = now() WHERE id = $1`,
        [id, fields.name, fields.summary, fields.imageId, adminId]
      );
      if (!rowCount) return false;

      // Only this place's own children move; any other id is left alone.
      for (const pin of fields.pins) {
        await client.query(`UPDATE v2_places SET pin_x = $3, pin_y = $4 WHERE id = $2 AND parent_id = $1`, [id, pin.id, pin.x, pin.y]);
      }

      await client.query(`DELETE FROM v2_place_activities WHERE place_id = $1`, [id]);
      await client.query(
        `INSERT INTO v2_place_activities (place_id, activity_id, position)
         SELECT $1, a.id, a.ordinality FROM unnest($2::uuid[]) WITH ORDINALITY AS a(id, ordinality)`,
        [id, fields.activityIds]
      );
      return true;
    });
  },

  async setStatus(id, to, from) {
    const rows = await query(
      `UPDATE v2_places
          SET status = $2::text, updated_at = now(),
              published_at = CASE WHEN $2::text = 'published' THEN coalesce(published_at, now()) ELSE published_at END
        WHERE id = $1 AND status = ANY($3::text[])
        RETURNING id`,
      [id, to, from]
    );
    return rows.length > 0;
  },

  async remove(id) {
    // One statement: the check and the delete see the same rows.
    const rows = await query<{ in_use: boolean }>(
      `WITH target AS (SELECT p.id, EXISTS (SELECT 1 FROM v2_places c WHERE c.parent_id = p.id) AS in_use FROM v2_places p WHERE p.id = $1),
       gone AS (DELETE FROM v2_places d USING target t WHERE d.id = t.id AND NOT t.in_use RETURNING d.id)
       SELECT t.in_use FROM target t`,
      [id]
    );
    if (!rows[0]) return 'not_found';
    return rows[0].in_use ? 'in_use' : 'deleted';
  },
};
