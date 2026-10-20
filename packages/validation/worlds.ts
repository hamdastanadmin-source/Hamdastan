/**
 * Worlds' rules, written once: the admin panel and the `worlds` module both
 * parse a world, its menu and its home with these schemas, and both ask
 * `worldPublishProblems` whether a world may be published.
 */

import {
  EVENT_RESERVED_SLUGS,
  WORLD_HOME_KINDS,
  WORLD_HOME_SOURCES,
  WORLD_HOME_WHEN_EMPTY,
  WORLD_LIMITS as L,
  WORLD_SECTIONS,
  WORLD_THEMES,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { WorldInput } from '@hamdastan/types';

import { z } from 'zod';

import { line, paragraph, slugSchema, uniqueIdsSchema } from './common';
import { mediaIdSchema } from './media';

const fa = (n: number) => toPersianDigits(n);

/** Home first and on; every other section exactly once, each with a label. */
const navigationSchema = z
  .array(
    z.object({
      section: z.enum(WORLD_SECTIONS),
      label: line(L.NAV_LABEL_MAX, 'برچسب منو را وارد کنید'),
      enabled: z.boolean(),
    })
  )
  .superRefine((items, ctx) => {
    const sections = items.map((item) => item.section);
    if (sections.length !== WORLD_SECTIONS.length || new Set(sections).size !== sections.length) {
      ctx.addIssue({ code: 'custom', message: 'هر بخش منو باید دقیقاً یک بار بیاید' });
      return;
    }
    if (items[0].section !== 'home' || !items[0].enabled) {
      ctx.addIssue({ code: 'custom', path: [0], message: '«خانه» همیشه اولین بخش و فعال است' });
    }
  });

export const worldInputSchema = z.object({
  slug: slugSchema(60, EVENT_RESERVED_SLUGS).refine((value) => value !== '', { error: 'نامک را وارد کنید' }),
  name: line(L.NAME_MAX, 'نام دنیا را وارد کنید'),
  summary: line(L.SUMMARY_MAX, null),
  tagline: line(L.TAGLINE_MAX, null),
  description: paragraph(L.DESCRIPTION_MAX),
  coverId: mediaIdSchema.nullable(),
  logoId: mediaIdSchema.nullable(),
  theme: z.enum(WORLD_THEMES),
  navigation: navigationSchema,
});

export const worldStatusSchema = z.object({ action: z.enum(['publish', 'unpublish', 'archive', 'restore']) });

/**
 * What a world needs before the product may show it. Empty when it may be
 * published. A cover is not required: without one the product draws the
 * world's built-in artwork, or a quiet tile.
 */
export function worldPublishProblems(input: Pick<WorldInput, 'name' | 'summary'>): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];
  if (!input.name.trim()) problems.push({ field: 'name', message: 'نام دنیا را وارد کنید' });
  if (!input.summary.trim()) problems.push({ field: 'summary', message: 'پیش از انتشار، معرفی کوتاه دنیا را بنویسید' });
  return problems;
}

// ─── Home ────────────────────────────────────────────────────────────────────

export const worldHomeInputSchema = z.object({
  sections: z
    .array(
      z.object({
        kind: z.enum(WORLD_HOME_KINDS),
        title: line(L.SECTION_TITLE_MAX, null),
        source: z.enum(WORLD_HOME_SOURCES),
        itemLimit: z.number().int().min(1).max(L.SECTION_ITEMS_MAX, { error: `حداکثر ${fa(L.SECTION_ITEMS_MAX)} مورد` }),
        whenEmpty: z.enum(WORLD_HOME_WHEN_EMPTY),
        enabled: z.boolean(),
        featuredIds: uniqueIdsSchema(L.FEATURED_MAX, 'مورد ویژه'),
      })
    )
    .superRefine((sections, ctx) => {
      const kinds = sections.map((section) => section.kind);
      if (kinds.length !== WORLD_HOME_KINDS.length || new Set(kinds).size !== kinds.length) {
        ctx.addIssue({ code: 'custom', message: 'هر بخش خانه باید دقیقاً یک بار بیاید' });
      }
      sections.forEach((section, index) => {
        if (section.enabled && section.source === 'featured' && section.featuredIds.length === 0) {
          ctx.addIssue({ code: 'custom', path: [index, 'featuredIds'], message: 'دست‌کم یک مورد ویژه انتخاب کنید یا منبع را «جدیدترین» بگذارید' });
        }
      });
    }),
});

/** `GET /admin/worlds/:id/home/candidates`. */
export const worldHomeCandidatesQuerySchema = z.object({
  kind: z.enum(WORLD_HOME_KINDS),
  q: z.string().max(60).optional(),
});

export type WorldInputOutput = z.output<typeof worldInputSchema>;
export type WorldHomeInputOutput = z.output<typeof worldHomeInputSchema>;
