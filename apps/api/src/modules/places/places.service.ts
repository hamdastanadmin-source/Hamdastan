import { PLACE_MAX_DEPTH } from '@hamdastan/config';
import {
  PLACE_ERROR_CODES as CODES,
  type AdminPlaceDetail,
  type AdminPlaceSummary,
  type PlaceStatus,
  type PlaceStatusAction,
  type PlaceView,
  type WorldDetail,
} from '@hamdastan/types';
import { placePublishProblems, type PlaceCreateOutput, type PlaceInputOutput } from '@hamdastan/validation';

import { AppError, NotFoundError, ValidationError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import { engagementService } from '../engagement';
import { mediaService } from '../media';
import type { UserRecord } from '../users';
import { worldsService } from '../worlds';

import { placesRepository } from './places.repository';
import type { PlaceDetailRecord, PlaceRecord } from './places.types';

/**
 * Business logic for places — مکان‌ها.
 *
 * A world has one map; places are pinned on it, and places inside those are
 * pinned on theirs — two layers at most. Each is an image with the tasks
 * done there (Engagement Studio activities: what they pay, and that they
 * pay once, is engagement's). The panel builds the tree; the product reads
 * it, and sees only what is published under a published place in a
 * published world.
 */

const notFound = () => new NotFoundError('مکان پیدا نشد');

const toSummary = (record: PlaceRecord): AdminPlaceSummary => ({
  id: record.id,
  worldId: record.worldId,
  parentId: record.parentId,
  depth: record.depth,
  name: record.name,
  status: record.status,
  imageId: record.imageId,
  pin: record.pin,
  activityCount: record.activityCount,
  childCount: record.childCount,
  updatedAt: record.updatedAt.toISOString(),
});

/** Which statuses each action may start from, and where it goes. */
const TRANSITIONS: Record<PlaceStatusAction, { to: PlaceStatus; from: PlaceStatus[] }> = {
  publish: { to: 'published', from: ['draft'] },
  unpublish: { to: 'draft', from: ['published'] },
};

async function requirePlace(id: string): Promise<PlaceDetailRecord> {
  const place = await placesRepository().findById(id);
  if (!place) throw notFound();
  return place;
}

/** Where a new place sits: the world's one map, or one layer below a place with room under it. */
async function placement(worldId: string, parentId: string | null): Promise<{ depth: number; parentDepth: number | null }> {
  if (!parentId) {
    if (await placesRepository().findMap(worldId)) {
      throw new AppError(409, CODES.PLACE_MAP_EXISTS, 'این دنیا نقشه دارد؛ مکان‌های تازه را روی همان نقشه بسازید');
    }
    return { depth: 0, parentDepth: null };
  }
  const [parent] = await placesRepository().findMany([parentId]);
  if (!parent || parent.worldId !== worldId) {
    throw new ValidationError('مکان والد در این دنیا پیدا نشد', { fields: { parentId: 'مکان والد در این دنیا پیدا نشد' } });
  }
  if (parent.depth + 1 > PLACE_MAX_DEPTH) {
    throw new AppError(400, CODES.PLACE_TOO_DEEP, 'مکان‌ها حداکثر دو لایه زیر نقشه ساخته می‌شوند', {
      fields: { parentId: `«${parent.name}» خودش در لایه‌ی دوم است و مکانی داخلش ساخته نمی‌شود` },
    });
  }
  return { depth: parent.depth + 1, parentDepth: parent.depth };
}

/** The image is an image in the library, and every task is an activity filed under the place's world. */
async function checkReferences(place: PlaceDetailRecord, input: PlaceInputOutput): Promise<void> {
  await mediaService.requireImages({ imageId: input.imageId });
  const filed = new Set((await engagementService.worldItems(place.worldId, { ids: input.activityIds })).map((item) => item.id));
  if (input.activityIds.some((id) => !filed.has(id))) {
    throw new ValidationError('فقط فعالیت‌های همین دنیا را می‌توان تسک کرد', {
      fields: { activityIds: 'فقط فعالیت‌های همین دنیا را می‌توان تسک کرد' },
    });
  }
}

async function toDetail(place: PlaceDetailRecord): Promise<AdminPlaceDetail> {
  const [world, children] = await Promise.all([worldsService.adminGet(place.worldId), placesRepository().findChildren(place.id)]);
  return {
    ...toSummary(place),
    world: { id: world.id, slug: world.slug, name: world.name },
    summary: place.summary,
    activityIds: place.activityIds,
    children: children.map(toSummary),
    publishedAt: place.publishedAt?.toISOString() ?? null,
  };
}

/** A place as a person sees it: the way down to it, the published places pinned on it, and its tasks. */
async function toView(user: UserRecord, world: WorldDetail, place: PlaceDetailRecord): Promise<PlaceView> {
  const ancestorIds = [place.parentId].filter((id): id is string => Boolean(id));
  const parents = await placesRepository().findMany(ancestorIds);
  // Two layers at most: the parent's own parent is the map.
  const grandparentId = parents[0]?.parentId;
  const grandparents = grandparentId ? await placesRepository().findMany([grandparentId]) : [];
  const [children, tasks] = await Promise.all([
    placesRepository().findChildren(place.id),
    engagementService.cardsFor(user.id, place.activityIds),
  ]);
  const crumb = (record: PlaceRecord) => ({ id: record.id, name: record.name });

  return {
    id: place.id,
    world: { slug: world.slug, name: world.name },
    name: place.name,
    summary: place.summary,
    imageId: place.imageId,
    trail: [...grandparents, ...parents, place].map(crumb),
    pins: children.filter((child) => child.available).map((child) => ({ ...crumb(child), ...child.pin, taskCount: child.taskCount })),
    tasks,
  };
}

export const placesService = {
  // ─── Admin ─────────────────────────────────────────────────────────────

  /** Every world's map; the places inside each are on the map's own page. */
  async list(): Promise<AdminPlaceSummary[]> {
    return (await placesRepository().listMaps()).map(toSummary);
  },

  async get(id: string): Promise<AdminPlaceDetail> {
    return toDetail(await requirePlace(id));
  },

  async create(actor: AdminRecord, input: PlaceCreateOutput): Promise<AdminPlaceDetail> {
    const world = await worldsService.adminGet(input.worldId);
    const where = await placement(world.id, input.parentId);
    const id = await placesRepository().create({ ...input, ...where }, actor.id);
    return this.get(id);
  },

  async update(actor: AdminRecord, id: string, input: PlaceInputOutput): Promise<AdminPlaceDetail> {
    const current = await requirePlace(id);
    await checkReferences(current, input);
    // A published place stays complete.
    if (current.status === 'published') assertPublishable(input);
    if (!(await placesRepository().update(id, input, actor.id))) throw notFound();
    return this.get(id);
  },

  /** Publishing asks for a name and an image. */
  async changeStatus(id: string, action: PlaceStatusAction): Promise<AdminPlaceDetail> {
    const place = await requirePlace(id);
    if (action === 'publish') assertPublishable(place);
    const transition = TRANSITIONS[action];
    if (!(await placesRepository().setStatus(id, transition.to, transition.from))) {
      throw new AppError(409, CODES.PLACE_INVALID_TRANSITION, 'این تغییر وضعیت برای این مکان ممکن نیست');
    }
    return this.get(id);
  },

  /** Only a draft with no places inside it. */
  async remove(id: string): Promise<{ deleted: true }> {
    const place = await requirePlace(id);
    if (place.status === 'published') throw new AppError(409, CODES.PLACE_IN_USE, 'مکان منتشرشده حذف نمی‌شود؛ اول انتشارش را لغو کنید');
    const outcome = await placesRepository().remove(id);
    if (outcome === 'not_found') throw notFound();
    if (outcome === 'in_use') throw new AppError(409, CODES.PLACE_IN_USE, 'این مکان، مکان‌های داخلی دارد؛ اول آن‌ها را حذف کنید');
    return { deleted: true };
  },

  // ─── Product ───────────────────────────────────────────────────────────

  /** A published world's map, as the top of its home shows it; null when it has none to show. */
  async map(user: UserRecord, slug: string): Promise<PlaceView | null> {
    const world = await worldsService.getBySlug(slug);
    const map = await placesRepository().findMap(world.id);
    if (!map?.available) return null;
    return toView(user, world, await requirePlace(map.id));
  },

  /** One place of a published world; any other is a 404. */
  async view(user: UserRecord, slug: string, id: string): Promise<PlaceView> {
    const world = await worldsService.getBySlug(slug);
    const place = await placesRepository().findById(id);
    if (!place || place.worldId !== world.id || !place.available) throw notFound();
    return toView(user, world, place);
  },
};

function assertPublishable(place: { name: string; imageId: string | null }): void {
  const problems = placePublishProblems(place);
  if (problems.length > 0) {
    throw new AppError(400, CODES.PLACE_INCOMPLETE, problems[0].message, {
      fields: Object.fromEntries(problems.map((problem) => [problem.field, problem.message])),
    });
  }
}
