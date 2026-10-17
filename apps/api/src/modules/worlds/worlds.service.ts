import { EVENT_ERROR_CODES as CODES, type AdminWorld, type World } from '@hamdastan/types';

import { AppError, NotFoundError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import { mediaService } from '../media';

import { worldsRepository } from './worlds.repository';
import type { WorldFields, WorldRecord } from './worlds.types';

/**
 * Business logic for the world list — the minimal one events are filed
 * under. A world is a name, a slug and a cover an admin keeps; switching one
 * off hides it from the product without touching the events linked to it.
 */

const notFound = () => new NotFoundError('دنیا پیدا نشد');

const toWorld = (record: WorldRecord): World => ({
  id: record.id,
  slug: record.slug,
  name: record.name,
  summary: record.summary,
  coverId: record.coverId,
});

const toAdminWorld = (record: WorldRecord): AdminWorld => ({
  ...toWorld(record),
  position: record.position,
  isActive: record.isActive,
  eventCount: record.eventCount,
});

export const worldsService = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(): Promise<World[]> {
    return (await worldsRepository().list(true)).map(toWorld);
  },

  async getBySlug(slug: string): Promise<World> {
    const found = await worldsRepository().findActiveBySlug(slug);
    if (!found) throw notFound();
    return toWorld(found);
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async listAll(): Promise<AdminWorld[]> {
    return (await worldsRepository().list(false)).map(toAdminWorld);
  },

  async create(actor: AdminRecord, fields: WorldFields): Promise<AdminWorld> {
    await mediaService.requireImages({ coverId: fields.coverId });
    const id = await worldsRepository().create(fields, actor.id);
    return toAdminWorld((await worldsRepository().findById(id))!);
  },

  async update(actor: AdminRecord, id: string, fields: WorldFields): Promise<AdminWorld> {
    await mediaService.requireImages({ coverId: fields.coverId });
    if (!(await worldsRepository().update(id, fields, actor.id))) throw notFound();
    return toAdminWorld((await worldsRepository().findById(id))!);
  },

  async reorder(ids: string[]): Promise<AdminWorld[]> {
    await worldsRepository().reorder(ids);
    return this.listAll();
  },

  /** Only a world no event is filed under; otherwise switch it off. */
  async remove(actor: AdminRecord, id: string): Promise<{ deleted: true }> {
    const outcome = await worldsRepository().remove(id, actor.id);
    if (outcome === 'not_found') throw notFound();
    if (outcome === 'in_use') {
      throw new AppError(409, CODES.WORLD_IN_USE, 'رویدادهایی به این دنیا وصل‌اند؛ به‌جای حذف، غیرفعالش کن');
    }
    return { deleted: true };
  },
};
