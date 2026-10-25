import { randomUUID } from 'node:crypto';

import {
  CONTENT_ERROR_CODES as CODES,
  type AdminArticleDetail,
  type AdminArticleHistoryEntry,
  type AdminArticleSummary,
  type ArticleCard,
  type ArticleDetail,
  type ArticleKind,
  type ArticleReaction,
  type ArticleReactions,
  type ArticleStatus,
  type ArticleStatusAction,
  type ArticleStoredStatus,
  type ContentIndexItem,
  type Paginated,
  type WorldHomeCandidate,
} from '@hamdastan/types';
import {
  articlePublishProblems,
  type AdminArticleListQueryOutput,
  type ArticleInputOutput,
  type ArticleListQueryOutput,
  type ContentIndexQueryOutput,
} from '@hamdastan/validation';

import { AppError, NotFoundError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import type { UserRecord } from '../users';
import { mediaService } from '../media';

import { contentRepository } from './content.repository';
import type { ArticleFields, ArticleRecord } from './content.types';

/**
 * Business logic for content — news items and knowledge articles filed under
 * worlds. Whether an article may be published, and whether the product may
 * see it, is decided here and in the repository's `LIVE` rule — nowhere in
 * either app.
 */

const notFound = () => new NotFoundError('محتوا پیدا نشد');

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** Read off the clock: a published article whose date has not come is «scheduled». */
function effectiveStatus(record: ArticleRecord, now: Date): ArticleStatus {
  if (record.status === 'published' && record.publishAt && record.publishAt > now) return 'scheduled';
  return record.status;
}

const isLive = (record: ArticleRecord, now: Date) => effectiveStatus(record, now) === 'published';

function toCard(record: ArticleRecord): ArticleCard {
  return {
    id: record.id,
    slug: record.slug,
    kind: record.kind,
    title: record.title,
    summary: record.summary,
    category: record.category,
    imageId: record.thumbnailId ?? record.coverId,
    // A live article has a date — publishing sets one.
    publishedAt: iso(record.publishAt) ?? '',
    worlds: record.worlds.filter((world) => world.published).map(({ slug, name }) => ({ slug, name })),
    reactions: record.reactions,
  };
}

const toDetail = (record: ArticleRecord, mine: ArticleReaction | null): ArticleDetail => ({
  ...toCard(record),
  body: record.body,
  coverId: record.coverId,
  coverAlt: record.coverAlt,
  reactions: { ...record.reactions, mine },
});

function toAdminSummary(record: ArticleRecord, now: Date): AdminArticleSummary {
  return {
    id: record.id,
    slug: record.slug,
    kind: record.kind,
    title: record.title,
    category: record.category,
    status: effectiveStatus(record, now),
    publishAt: iso(record.publishAt),
    worlds: record.worlds.map(({ id, name }) => ({ id, name })),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toAdminDetail(record: ArticleRecord, now: Date): AdminArticleDetail {
  return {
    ...toAdminSummary(record, now),
    summary: record.summary,
    body: record.body,
    coverId: record.coverId,
    coverAlt: record.coverAlt,
    thumbnailId: record.thumbnailId,
    worldIds: record.worlds.map((world) => world.id),
    reactions: record.reactions,
    createdAt: record.createdAt.toISOString(),
  };
}

function assertPublishable(fields: Pick<ArticleFields, 'title' | 'summary' | 'body' | 'worldIds'>): void {
  const problems = articlePublishProblems(fields);
  if (problems.length > 0) {
    throw new AppError(400, CODES.ARTICLE_INCOMPLETE, problems[0].message, {
      fields: Object.fromEntries(problems.map((problem) => [problem.field, problem.message])),
    });
  }
}

const checkMedia = (fields: ArticleFields) =>
  mediaService.requireImages({ coverId: fields.coverId, thumbnailId: fields.thumbnailId });

const newSlug = (kind: ArticleKind) => `${kind}-${randomUUID().slice(0, 8)}`;

/** Which stored statuses each action may start from, and where it goes. */
const TRANSITIONS: Record<ArticleStatusAction, { to: ArticleStoredStatus; from: ArticleStoredStatus[] }> = {
  // From `published` too: moving a scheduled date.
  publish: { to: 'published', from: ['draft', 'unpublished', 'published'] },
  unpublish: { to: 'unpublished', from: ['published'] },
  archive: { to: 'archived', from: ['draft', 'published', 'unpublished'] },
};

/** `records` in the order of `ids`; ids with no record are dropped. */
function inOrder<T extends { id: string }>(records: T[], ids: string[]): T[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export const contentService = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(query: ArticleListQueryOutput): Promise<Paginated<ArticleCard>> {
    const { items, total } = await contentRepository().listLive({ worldSlug: query.world, kind: query.kind }, query.page, query.pageSize);
    return { items: items.map(toCard), page: query.page, pageSize: query.pageSize, total };
  },

  /** One the product may not see is a 404 — never a hint that it exists. */
  async get(user: UserRecord, slug: string): Promise<ArticleDetail> {
    const record = await contentRepository().findLiveBySlug(slug);
    if (!record) throw notFound();
    return toDetail(record, await contentRepository().reactionOf(record.id, user.id));
  },

  /** A like, a dislike, or (null) neither — one per person; only on a live article. */
  async react(user: UserRecord, id: string, reaction: ArticleReaction | null): Promise<ArticleReactions> {
    const counts = await contentRepository().react(id, user.id, reaction);
    if (!counts) throw notFound();
    return { ...counts, mine: reaction };
  },

  // ─── For a world's home ────────────────────────────────────────────────
  /** Live articles of `kind` filed under the world: the featured ones in their order, else the newest. */
  async worldCards(worldId: string, kind: ArticleKind, options: { ids?: string[]; limit: number }): Promise<ArticleCard[]> {
    const records = await contentRepository().forWorld(worldId, kind, { ids: options.ids, liveOnly: true, limit: options.ids?.length ?? options.limit });
    const ordered = options.ids ? inOrder(records, options.ids) : records;
    return ordered.slice(0, options.limit).map(toCard);
  },

  /** What the panel may feature: articles of `kind` filed under the world, in any status. */
  async worldItems(worldId: string, kind: ArticleKind, options: { ids?: string[]; q?: string }): Promise<WorldHomeCandidate[]> {
    const now = new Date();
    const records = await contentRepository().forWorld(worldId, kind, { ...options, liveOnly: false, limit: options.ids?.length ?? 30 });
    return (options.ids ? inOrder(records, options.ids) : records).map((record) => ({
      id: record.id,
      title: record.title,
      status: effectiveStatus(record, now),
      live: isLive(record, now),
    }));
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async adminList(query: AdminArticleListQueryOutput): Promise<Paginated<AdminArticleSummary>> {
    const now = new Date();
    const { items, total } = await contentRepository().adminList(query);
    return { items: items.map((record) => toAdminSummary(record, now)), page: query.page, pageSize: query.pageSize, total };
  },

  async adminGet(id: string): Promise<AdminArticleDetail> {
    const record = await contentRepository().findById(id);
    if (!record) throw notFound();
    return toAdminDetail(record, new Date());
  },

  async create(actor: AdminRecord, input: ArticleInputOutput): Promise<AdminArticleDetail> {
    const fields = { ...input, slug: input.slug || newSlug(input.kind) };
    await checkMedia(fields);
    const id = await contentRepository().create(fields, actor.id);
    return this.adminGet(id);
  },

  async update(actor: AdminRecord, id: string, input: ArticleInputOutput): Promise<AdminArticleDetail> {
    const current = await contentRepository().findById(id);
    if (!current) throw notFound();
    if (current.status === 'archived') throw new AppError(409, CODES.ARTICLE_ARCHIVED, 'محتوای بایگانی‌شده قابل ویرایش نیست');
    const fields = { ...input, slug: input.slug || current.slug };
    // What the product can see must stay complete; a draft may be anything.
    if (current.status === 'published') assertPublishable(fields);
    await checkMedia(fields);
    await contentRepository().update(id, fields, actor.id);
    return this.adminGet(id);
  },

  async changeStatus(actor: AdminRecord, id: string, action: ArticleStatusAction, publishAt: string | null | undefined): Promise<AdminArticleDetail> {
    const current = await contentRepository().findById(id);
    if (!current) throw notFound();
    if (action === 'publish') {
      assertPublishable({ ...current, worldIds: current.worlds.map((world) => world.id) });
    }
    const now = new Date();
    // A date already past is «now»; only a date ahead schedules.
    const when = action === 'publish' && publishAt && new Date(publishAt) > now ? new Date(publishAt) : null;
    const { to, from } = TRANSITIONS[action];
    const auditAction = action === 'publish' && when ? 'schedule' : action;
    if (!(await contentRepository().setStatus(id, to, from, when, actor.id, auditAction))) {
      throw new AppError(409, CODES.ARTICLE_INVALID_TRANSITION, 'این تغییر وضعیت برای این محتوا ممکن نیست');
    }
    return this.adminGet(id);
  },

  /** The article page as a person would see it, whatever the status — nothing is recorded. */
  async preview(id: string): Promise<ArticleDetail> {
    const record = await contentRepository().findById(id);
    if (!record) throw notFound();
    return { ...toDetail(record, null), preview: { status: effectiveStatus(record, new Date()) } };
  },

  async history(id: string): Promise<AdminArticleHistoryEntry[]> {
    return (await contentRepository().history(id)).map((row) => ({
      id: row.id,
      action: row.action,
      admin: row.adminName,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /** Everything filed under worlds, in one list — editing happens in each kind's own editor. */
  async index(query: ContentIndexQueryOutput): Promise<Paginated<ContentIndexItem>> {
    const { items, total } = await contentRepository().index(query);
    return {
      items: items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  },
};
