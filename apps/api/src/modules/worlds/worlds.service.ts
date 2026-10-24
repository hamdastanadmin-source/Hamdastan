import { WORLD_SECTION_LABELS } from '@hamdastan/config';
import {
  WORLD_ERROR_CODES as CODES,
  type ActivityCard,
  type AdminWorld,
  type AdminWorldDetail,
  type AdminWorldHome,
  type World,
  type WorldDetail,
  type WorldHome,
  type WorldHomeBlock,
  type WorldHomeCandidate,
  type WorldHomeKind,
  type WorldStatus,
  type WorldStatusAction,
} from '@hamdastan/types';
import { worldPublishProblems, type WorldHomeInputOutput } from '@hamdastan/validation';

import { AppError, NotFoundError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import { contentService } from '../content';
import { engagementService } from '../engagement';
import { eventsService } from '../events';
import { mediaService } from '../media';
import type { UserRecord } from '../users';

import { worldsRepository } from './worlds.repository';
import type { HomeSectionRecord, WorldFields, WorldRecord } from './worlds.types';

/**
 * Business logic for worlds — دنیاها: their lifecycle, identity and menu,
 * and their home page.
 *
 * What a world's home shows is decided here, section by section, from the
 * admin's configuration — and each item's eligibility is decided by the
 * module that owns it (`worldCards`): an unpublished, scheduled, ended or
 * restricted item never appears, featured or not. Events lead the home;
 * the menu (home and activities) no longer decides which sections show.
 */

const notFound = () => new NotFoundError('دنیا پیدا نشد');

/** Open activities are few at a time; the «فعالیت‌ها» menu lists them without pages. */
const WORLD_TAB_ACTIVITIES_MAX = 50;

const iso = (date: Date | null) => date?.toISOString() ?? null;

const toWorld = (record: WorldRecord): World => ({
  id: record.id,
  slug: record.slug,
  name: record.name,
  summary: record.summary,
  coverId: record.coverId,
});

const toDetail = (record: WorldRecord): WorldDetail => ({
  ...toWorld(record),
  tagline: record.tagline,
  description: record.description,
  theme: record.theme,
  navigation: record.navigation.filter((item) => item.enabled),
});

const toAdminWorld = (record: WorldRecord): AdminWorld => ({
  ...toWorld(record),
  tagline: record.tagline,
  position: record.position,
  status: record.status,
  publishedAt: iso(record.publishedAt),
  eventCount: record.eventCount,
  articleCount: record.articleCount,
  activityCount: record.activityCount,
  updatedAt: record.updatedAt.toISOString(),
});

const toAdminDetail = (record: WorldRecord): AdminWorldDetail => ({
  ...toAdminWorld(record),
  description: record.description,
  theme: record.theme,
  navigation: record.navigation,
});

function assertPublishable(fields: Pick<WorldFields, 'name' | 'summary' | 'coverId'>): void {
  const problems = worldPublishProblems(fields);
  if (problems.length > 0) {
    throw new AppError(400, CODES.WORLD_INCOMPLETE, problems[0].message, {
      fields: Object.fromEntries(problems.map((problem) => [problem.field, problem.message])),
    });
  }
}

const checkMedia = (fields: WorldFields) => mediaService.requireImages({ coverId: fields.coverId });

/** Which statuses each action may start from, and where it goes. Archiving keeps every link. */
const TRANSITIONS: Record<WorldStatusAction, { to: WorldStatus; from: WorldStatus[] }> = {
  publish: { to: 'published', from: ['draft', 'unpublished'] },
  unpublish: { to: 'unpublished', from: ['published'] },
  archive: { to: 'archived', from: ['draft', 'published', 'unpublished'] },
  restore: { to: 'unpublished', from: ['archived'] },
};

/** One section's items now: the module that owns the kind decides what may appear. */
function cardsFor(section: HomeSectionRecord, worldId: string, userId: string | null): Promise<WorldHomeBlock['items']> {
  const options = { ids: section.source === 'featured' ? section.featuredIds : undefined, limit: section.itemLimit };
  switch (section.kind) {
    case 'news':
    case 'knowledge':
      return contentService.worldCards(worldId, section.kind, options);
    case 'events':
      return eventsService.worldCards(userId, worldId, options);
    case 'activities':
      return engagementService.worldCards(userId, worldId, options);
  }
}

/** The panel's view of items of one kind: title, status and whether it may appear now. */
function itemsFor(kind: WorldHomeKind, worldId: string, options: { ids?: string[]; q?: string }): Promise<WorldHomeCandidate[]> {
  switch (kind) {
    case 'news':
    case 'knowledge':
      return contentService.worldItems(worldId, kind, options);
    case 'events':
      return eventsService.worldItems(worldId, options);
    case 'activities':
      return engagementService.worldItems(worldId, options);
  }
}

async function buildHome(record: WorldRecord, userId: string | null): Promise<WorldHome> {
  const sections = (await worldsRepository().findHome(record.id)).filter((section) => section.enabled);
  const blocks = await Promise.all(
    sections.map(async (section) => {
      const items = await cardsFor(section, record.id, userId);
      if (items.length === 0 && section.whenEmpty === 'hide') return null;
      return { kind: section.kind, title: section.title || WORLD_SECTION_LABELS[section.kind], items } as WorldHomeBlock;
    })
  );
  return { world: toDetail(record), sections: blocks.filter((block) => block !== null) };
}

async function requireWorld(id: string): Promise<WorldRecord> {
  const record = await worldsRepository().findById(id);
  if (!record) throw notFound();
  return record;
}

export const worldsService = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(): Promise<World[]> {
    return (await worldsRepository().list(true)).map(toWorld);
  },

  /** Only a published world; any other is a 404. */
  async getBySlug(slug: string): Promise<WorldDetail> {
    const found = await worldsRepository().findPublishedBySlug(slug);
    if (!found) throw notFound();
    return toDetail(found);
  },

  async home(user: UserRecord, slug: string): Promise<WorldHome> {
    const found = await worldsRepository().findPublishedBySlug(slug);
    if (!found) throw notFound();
    return buildHome(found, user.id);
  },

  /** The world's «فعالیت‌ها» menu: every open activity filed under it that the person may take part in. */
  async activities(user: UserRecord, slug: string): Promise<ActivityCard[]> {
    const found = await worldsRepository().findPublishedBySlug(slug);
    if (!found || !found.navigation.some((item) => item.section === 'activities' && item.enabled)) throw notFound();
    return engagementService.worldCards(user.id, found.id, { limit: WORLD_TAB_ACTIVITIES_MAX });
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async listAll(): Promise<AdminWorld[]> {
    return (await worldsRepository().list(false)).map(toAdminWorld);
  },

  async adminGet(id: string): Promise<AdminWorldDetail> {
    return toAdminDetail(await requireWorld(id));
  },

  async create(actor: AdminRecord, fields: WorldFields): Promise<AdminWorldDetail> {
    await checkMedia(fields);
    const id = await worldsRepository().create(fields, actor.id);
    return this.adminGet(id);
  },

  async update(actor: AdminRecord, id: string, fields: WorldFields): Promise<AdminWorldDetail> {
    const current = await requireWorld(id);
    if (current.status === 'archived') throw new AppError(409, CODES.WORLD_ARCHIVED, 'دنیای بایگانی‌شده قابل ویرایش نیست؛ اول آن را بازگردانید');
    // What the product shows must stay complete; a draft may be anything.
    if (current.status === 'published') assertPublishable(fields);
    await checkMedia(fields);
    await worldsRepository().update(id, fields, actor.id);
    return this.adminGet(id);
  },

  async changeStatus(actor: AdminRecord, id: string, action: WorldStatusAction): Promise<AdminWorldDetail> {
    const current = await requireWorld(id);
    if (action === 'publish') assertPublishable(current);
    const { to, from } = TRANSITIONS[action];
    if (!(await worldsRepository().setStatus(id, to, from, actor.id, action))) {
      throw new AppError(409, CODES.WORLD_INVALID_TRANSITION, 'این تغییر وضعیت برای این دنیا ممکن نیست');
    }
    return this.adminGet(id);
  },

  async reorder(ids: string[]): Promise<AdminWorld[]> {
    await worldsRepository().reorder(ids);
    return this.listAll();
  },

  /** Only a world nothing is filed under; otherwise archive it. */
  async remove(actor: AdminRecord, id: string): Promise<{ deleted: true }> {
    const outcome = await worldsRepository().remove(id, actor.id);
    if (outcome === 'not_found') throw notFound();
    if (outcome === 'in_use') {
      throw new AppError(409, CODES.WORLD_IN_USE, 'محتوایی به این دنیا متصل است؛ به‌جای حذف، آن را بایگانی کنید');
    }
    return { deleted: true };
  },

  // ─── Admin: the home ───────────────────────────────────────────────────
  async getHome(id: string): Promise<AdminWorldHome> {
    await requireWorld(id);
    const sections = await worldsRepository().findHome(id);
    return {
      sections: await Promise.all(
        sections.map(async ({ featuredIds, ...section }) => ({
          ...section,
          featured: featuredIds.length > 0 ? await itemsFor(section.kind, id, { ids: featuredIds }) : [],
        }))
      ),
    };
  },

  /** Every featured item must be of its section's kind and filed under this world. */
  async saveHome(actor: AdminRecord, id: string, input: WorldHomeInputOutput): Promise<AdminWorldHome> {
    const current = await requireWorld(id);
    if (current.status === 'archived') throw new AppError(409, CODES.WORLD_ARCHIVED, 'دنیای بایگانی‌شده قابل ویرایش نیست؛ اول آن را بازگردانید');

    const problems: Record<string, string> = {};
    await Promise.all(
      input.sections.map(async (section, index) => {
        const filed = new Set(await worldsRepository().filedUnder(id, section.kind, section.featuredIds));
        if (section.featuredIds.some((itemId) => !filed.has(itemId))) {
          problems[`sections.${index}.featuredIds`] = `موردی در «${WORLD_SECTION_LABELS[section.kind]}» به این دنیا متصل نیست`;
        }
      })
    );
    const first = Object.values(problems)[0];
    if (first) throw new AppError(400, CODES.WORLD_HOME_ITEM_INVALID, first, { fields: problems });

    await worldsRepository().saveHome(id, input.sections, actor.id);
    return this.getHome(id);
  },

  /** What may be featured in a section: items of its kind filed under the world, in any status. */
  async candidates(id: string, kind: WorldHomeKind, q: string | undefined): Promise<WorldHomeCandidate[]> {
    await requireWorld(id);
    return itemsFor(kind, id, { q: q?.trim() || undefined });
  },

  /** The world's home as a person would see it, whatever the world's status — nothing is recorded. */
  async preview(id: string): Promise<WorldHome> {
    const record = await requireWorld(id);
    return { ...(await buildHome(record, null)), preview: { status: record.status } };
  },
};
