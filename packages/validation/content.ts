/**
 * Content's rules, written once: the admin article editor and the `content`
 * module both parse an article with `articleInputSchema`, and both ask
 * `articlePublishProblems` whether it may be published.
 */

import {
  ARTICLE_KINDS,
  ARTICLE_LIMITS as L,
  ARTICLE_RESERVED_SLUGS,
  ARTICLE_STATUSES,
  ARTICLES_PAGE_SIZE,
} from '@hamdastan/config';
import { CONTENT_STATUSES, CONTENT_TYPES, type ArticleInput } from '@hamdastan/types';

import { z } from 'zod';

import { cleanText, line, paragraph, SLUG_PATTERN, slugSchema, uniqueIdsSchema, uuidSchema } from './common';
import { mediaIdSchema } from './media';

export const articleInputSchema = z.object({
  kind: z.enum(ARTICLE_KINDS, { error: 'نوع محتوا را انتخاب کنید' }),
  slug: slugSchema(L.SLUG_MAX, ARTICLE_RESERVED_SLUGS),
  title: line(L.TITLE_MAX, 'عنوان را وارد کنید'),
  summary: line(L.SUMMARY_MAX, null),
  body: paragraph(L.BODY_MAX),
  category: line(L.CATEGORY_MAX, null),
  coverId: mediaIdSchema.nullable(),
  coverAlt: line(L.ALT_MAX, null),
  thumbnailId: mediaIdSchema.nullable(),
  worldIds: uniqueIdsSchema(L.WORLDS_MAX, 'دنیا'),
});

/** What an article needs before the product may show it. Empty when it may be published. */
export function articlePublishProblems(input: Pick<ArticleInput, 'title' | 'summary' | 'body' | 'worldIds'>): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];
  if (!input.title.trim()) problems.push({ field: 'title', message: 'عنوان را وارد کنید' });
  if (!input.summary.trim()) problems.push({ field: 'summary', message: 'پیش از انتشار، خلاصه را بنویسید' });
  if (!input.body.trim()) problems.push({ field: 'body', message: 'پیش از انتشار، متن را بنویسید' });
  if (input.worldIds.length === 0) problems.push({ field: 'worldIds', message: 'پیش از انتشار، دست‌کم یک دنیا انتخاب کنید' });
  return problems;
}

export const articleStatusSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive']),
  publishAt: z.iso.datetime({ offset: true, error: 'تاریخ معتبر نیست' }).nullable().optional(),
});

const search = z.string().max(60).transform((value) => cleanText(value, false)).optional();
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(ARTICLES_PAGE_SIZE);

/** `GET /admin/content/articles`. */
export const adminArticleListQuerySchema = z.object({
  q: search,
  kind: z.enum(ARTICLE_KINDS).optional(),
  status: z.enum([...ARTICLE_STATUSES, 'scheduled']).optional(),
  world: uuidSchema.optional(),
  page,
  pageSize,
});

/** `GET /admin/content` — the index of everything filed under worlds. */
export const contentIndexQuerySchema = z.object({
  q: search,
  type: z.enum(CONTENT_TYPES).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  world: uuidSchema.optional(),
  page,
  pageSize,
});

/** `GET /content/articles`. */
export const articleListQuerySchema = z.object({
  world: z.string().regex(SLUG_PATTERN).optional(),
  kind: z.enum(ARTICLE_KINDS).optional(),
  page,
  pageSize: z.coerce.number().int().min(1).max(50).default(ARTICLES_PAGE_SIZE),
});

export type ArticleInputOutput = z.output<typeof articleInputSchema>;
export type AdminArticleListQueryOutput = z.output<typeof adminArticleListQuerySchema>;
export type ContentIndexQueryOutput = z.output<typeof contentIndexQuerySchema>;
export type ArticleListQueryOutput = z.output<typeof articleListQuerySchema>;
